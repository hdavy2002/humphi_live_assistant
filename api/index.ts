import { Hono } from "hono";
import { handle } from "hono/vercel";
import Stripe from "stripe";
import { WalletUseCase } from "../src/application/use-cases.js";
import { DrizzleProfileRepository, DrizzleTransactionRepository } from "../src/infrastructure/repositories.js";
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { db } from "../src/infrastructure/db/client.js";
import { sql } from "drizzle-orm";
import { MemoryClient } from 'mem0ai';
import { serve } from "inngest/hono";
import { inngest, provisionUser, processStripeWebhook, syncMem0 } from "./lib/inngest.js";
import { clerkWebhooks } from "./routes/webhooks.js";
import { neonAuthWebhooks } from "./routes/neon-auth-webhooks.js";
import { getOrSet, invalidate, cacheKeys } from "./lib/cache.js";
import { authMiddleware, requireAuth, getAuth } from "../src/infrastructure/auth/clerk.js";

// --- Shared Redis instance (reused across hot invocations) ---
let redis: Redis | null = null;
let rawRedisUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_URL || "").trim();
let rawRedisToken = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_TOKEN || "").trim();

// Fix common misconfigurations where https:// is duplicated or placeholder text was appended
rawRedisUrl = rawRedisUrl.replace(/^https?:\/\/(https?:\/\/)/, "$1").replace("our-url.upstash.io", "");

if (rawRedisUrl && rawRedisToken) {
  redis = new Redis({
    url: rawRedisUrl,
    token: rawRedisToken,
  });
}

// --- Global Rate Limiter: 100 requests per 10 seconds per IP ---
const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "10 s"),
      ephemeralCache: new Map(), // Reduce round-trips on warm functions
      analytics: true,
      prefix: "humphi:rl",
    })
  : null;

let mem0: any = null;
if (process.env.MEM0_API_KEY) {
  mem0 = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
}

const app = new Hono().basePath("/api");

// --- Global Auth Middleware ---
app.use("*", authMiddleware);

// --- Global Rate Limiting Middleware ---
// Exclude Inngest and webhook paths (they have their own auth and must always respond quickly)
app.use("*", async (c, next) => {
  const path = c.req.path;
  const isExcluded = path.includes("/inngest") || path.includes("/webhooks") || path.includes("/webhook");

  if (!isExcluded && ratelimit) {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
    const { success, limit, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      return c.json(
        { error: "Too many requests. Please slow down.", retryAfter: Math.ceil((reset - Date.now()) / 1000) },
        429
      );
    }
    // Expose rate limit headers for good API citizens
    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(remaining));
  }

  await next();
});

// 1. Webhooks
app.route("/webhooks", clerkWebhooks);
app.route("/webhooks", neonAuthWebhooks);
// 2. Inngest Middleware — register all background functions
app.use("/inngest", serve({ client: inngest, functions: [provisionUser, processStripeWebhook, syncMem0] }));

function getWalletUseCase() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  const profileRepo = new DrizzleProfileRepository();
  const transactionRepo = new DrizzleTransactionRepository();
  return new WalletUseCase(profileRepo, transactionRepo, stripe);
}

app.onError((err, c) => {
  console.error("Global Error Handler:", err);
  return c.json({ error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined }, 500);
});

app.post("/create-checkout-session", requireAuth, async (c) => {
  const { amount, userId } = await c.req.json();
  console.log("Create checkout session request:", { amount, userId });
  
  const walletUseCase = getWalletUseCase();
  
  // Robust URL detection for Vercel
  let appUrl = process.env.APP_URL;
  if (!appUrl) {
    const host = c.req.header("host");
    if (host) {
      const protocol = host.includes("localhost") ? "http" : "https";
      appUrl = `${protocol}://${host}`;
    } else {
      // Fallback to a default if host is missing
      appUrl = "https://humphi-live-assistant.vercel.app";
    }
  }
  
  try {
    console.log("Calling walletUseCase.createCheckoutSession with appUrl:", appUrl);
    const sessionId = await walletUseCase.createCheckoutSession(amount, userId, appUrl);
    console.log("Checkout session created:", sessionId);
    return c.json({ id: sessionId });
  } catch (err: any) {
    console.error("Error creating checkout session:", err);
    return c.json({ error: err.message }, 400);
  }
});

app.post("/create-payment-intent", requireAuth, async (c) => {
  const { amount, userId } = await c.req.json();
  const walletUseCase = getWalletUseCase();

  try {
    const result = await walletUseCase.createPaymentIntent(amount, userId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.post("/verify-payment-intent", requireAuth, async (c) => {
  const { paymentIntentId } = await c.req.json();
  console.log("Verify payment intent request:", { paymentIntentId });
  const walletUseCase = getWalletUseCase();

  try {
    const result = await walletUseCase.verifyPaymentIntent(paymentIntentId);
    console.log("Verify payment intent result:", result);
    return c.json(result);
  } catch (err: any) {
    console.error("Verify payment intent error:", err.message);
    return c.json({ error: err.message }, 400);
  }
});

app.get("/verify-session", requireAuth, async (c) => {
  const sessionId = c.req.query("sessionId");
  
  if (!sessionId) return c.json({ error: "Missing session ID" }, 400);

  try {
    const walletUseCase = getWalletUseCase();
    const result = await walletUseCase.verifySession(sessionId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/webhook", async (c) => {
  const sig = c.req.header("stripe-signature");
  if (!sig) return c.json({ error: "Missing signature" }, 400);

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return c.json({ error: "Webhook secret not configured" }, 500);
  }

  try {
    const rawBody = await c.req.text();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
    // 1. Verify signature SYNCHRONOUSLY — always do this before anything else
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    // 2. Dispatch to Inngest and return 200 immediately — no DB work on this thread
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as import("stripe").Stripe.Checkout.Session;
      if (session.payment_status === "paid" && session.metadata?.userId) {
        await inngest.send({
          name: "stripe/payment.succeeded",
          data: {
            sessionId: session.id,
            userId: session.metadata.userId,
            amount: parseFloat(session.metadata.amount ?? "0"),
          },
        });
      }
    } else if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as import("stripe").Stripe.PaymentIntent;
      if (pi.metadata?.userId && pi.metadata?.amount) {
        await inngest.send({
          name: "stripe/payment.succeeded",
          data: {
            sessionId: pi.id,
            userId: pi.metadata.userId,
            amount: parseFloat(pi.metadata.amount),
          },
        });
      }
    } else {
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return c.json({ received: true });
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return c.json({ error: err.message }, 400);
  }
});

// 3. Wallet Routes
app.get("/wallet/profile", requireAuth, async (c) => {
  const userId = c.req.query("userId");
  const auth = getAuth(c);
  
  if (!userId) return c.json({ error: "Missing userId" }, 400);
  
  // Security check: ensure the requested userId matches the authenticated user
  if (auth?.userId !== userId) {
    return c.json({ error: "Forbidden: You can only access your own profile" }, 403);
  }

  try {
    const walletUseCase = getWalletUseCase();
    let profile = await walletUseCase.getProfile(userId);
    
    // Auto-provision if missing (common after migration)
    if (!profile) {
      console.log(`[API] Auto-provisioning missing profile for user: ${userId}`);
      const profileRepo = new DrizzleProfileRepository();
      
      // We don't have the email easily here without calling Clerk API, 
      // but we can at least create the record so the app doesn't crash.
      await profileRepo.create({ 
        id: userId, 
        email: "" // Email will be updated by webhook later if available
      });
      
      profile = await walletUseCase.getProfile(userId);
    }
    
    return c.json(profile);
  } catch (err: any) {
    console.error("Error in /wallet/profile:", err);
    return c.json({ error: err.message }, 500);
  }
});

app.get("/wallet/transactions", requireAuth, async (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({ error: "Missing userId" }, 400);
  try {
    const walletUseCase = getWalletUseCase();
    const transactions = await walletUseCase.getTransactions(userId);
    return c.json(transactions);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/wallet/seed", async (c) => {
  const { userId, email } = await c.req.json();
  if (!userId || !email) return c.json({ error: "Missing userId or email" }, 400);
  try {
    const walletUseCase = getWalletUseCase();
    const profile = await walletUseCase.seedWallet(userId, email);
    return c.json(profile);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/diag", async (c) => {
  try {
    // Test with 'pg' driver explicitly FIRST
    const rawConnStr = (process.env.DATABASE_URL || "").trim();
    let pgConnStr = rawConnStr;
    try {
      const url = new URL(rawConnStr);
      url.searchParams.delete('sslmode');
      url.searchParams.delete('workaround');
      pgConnStr = url.toString();
    } catch (e) {}

    let pgStatus = "not_tested";
    let pgConnected = false;
    const { Client } = await import('pg');
    const pgClient = new Client({ 
      connectionString: pgConnStr,
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      await pgClient.connect();
      const res = await pgClient.query('SELECT 1 as connected');
      pgStatus = "success";
      pgConnected = true;
      await pgClient.end();
    } catch (err: any) {
      pgStatus = `failed: ${err.message}`;
    }

    // 2. Test Drizzle only if pg didn't crash the whole process
    let drizzleStatus = "pending";
    let columnExists = false;
    let columnsFound = [];
    
    try {
      const dbRes = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'transactions' AND table_schema = 'public' AND column_name = 'stripe_session_id';
      `);
      columnExists = Array.isArray(dbRes) ? dbRes.length > 0 : false;
      columnsFound = dbRes as any;
      drizzleStatus = "success";
    } catch (err: any) {
      drizzleStatus = `failed: ${err.message}`;
    }

    // 3. Test Redis connectivity
    let redisStatus = "not_tested";
    if (redis) {
      try {
        const redisPing = await redis.ping();
        redisStatus = redisPing === "PONG" ? "success" : `unexpected: ${redisPing}`;
      } catch (err: any) {
        redisStatus = `failed: ${err.message}`;
      }
    } else {
      redisStatus = "not_configured";
    }

    // 4. Test Downstream Health from Redis Cache (Phase 5)
    let downstreamHealth = null;
    if (redis) {
      try {
        downstreamHealth = await redis.get("system:health:downstream");
      } catch (e) {}
    }

    const dbUrl = process.env.DATABASE_URL || "MISSING";
    const maskedUrl = dbUrl.replace(/:[^:@/]+@/, ":****@");

    return c.json({
      status: "online",
      environment: "vercel",
      database: maskedUrl,
      pgDriverStatus: pgStatus,
      drizzleStatus: drizzleStatus,
      redisStatus: redisStatus,
      inngestStatus: "active", // Route /inngest is mounted
      downstreamHealth: downstreamHealth || "pending_first_scan",
      columnExistsInDb: columnExists,
      columnsFound: columnsFound,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("DIAG ERROR:", err);
    return c.json({ error: err.message, stack: err.stack, dbUrlSet: !!process.env.DATABASE_URL }, 500);
  }
});

app.get("/session/init", requireAuth, async (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({ error: "Missing userId" }, 400);

  let previousHandle = null;
  let longTermMemory: any[] = [];

  try {
    if (redis) previousHandle = await redis.get(`handle:${userId}`);
  } catch (err) {
    console.error("Redis fetch failed:", err);
  }

  try {
    if (mem0) {
      const results = await mem0.search('user preferences and history', {
        user_id: userId,
        limit: 10,
      });
      longTermMemory = results || [];
    }
  } catch (err) {
    console.error("Mem0 fetch failed:", err);
  }

  return c.json({ previousHandle, longTermMemory });
});

// ── HumPhi Chat ────────────────────────────────────────────────────
const HUMPHI_CHAT_MODEL        = 'anthropic/claude-opus-4-6';
const HUMPHI_INPUT_COST_PER_M  = 8.00;   // $8 / million input tokens
const HUMPHI_OUTPUT_COST_PER_M = 28.00;  // $28 / million output tokens
const CHAT_SESSION_TTL         = 60 * 60 * 24 * 30; // 30 days

const HUMPHI_CHAT_SYSTEM_PROMPT = `You are HumPhi, an advanced AI assistant created exclusively by Humphi (humphi.com).
You are helpful, intelligent, and built to assist with analysis, coding, creative writing, research, and conversation.

Identity Rules (NEVER break these):
- Your name is HumPhi. You are Humphi's own AI model.
- You were built by the Humphi engineering team.
- If anyone asks what model you are, who made you, or what powers you — always say you are HumPhi by Humphi. Never mention Claude, Anthropic, or any third-party model.
- Do not reveal or hint at any underlying base model or provider.
- If pressed, remain confident: "I am HumPhi, Humphi's own AI assistant."

Formatting Rules:
- When writing code, always enclose it in a fenced code block with the language name (e.g. \`\`\`typescript).
- For multi-step explanations, use numbered lists.
- Keep responses concise but thorough — never padded.

Personality:
- Warm, clear, confident tone. Proud to be part of the Humphi platform.`;

// POST /api/chat — streaming chat with HumPhi (Claude opus-4-6 via OpenRouter)
app.post("/chat", requireAuth, async (c) => {
  const auth = getAuth(c);
  const { messages, userId, sessionId: existingSessionId } = await c.req.json();

  if (!userId) return c.json({ error: "Missing userId" }, 400);
  if (auth?.userId !== userId) return c.json({ error: "Forbidden" }, 403);

  // ── Fetch user Mem0 memories ──────────────────────────────────────
  let memories: string[] = [];
  if (mem0) {
    try {
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
      const query = lastUserMsg?.content?.slice(0, 200) || 'user preferences and history';
      const results = await mem0.search(query, { user_id: userId, limit: 8 });
      memories = (results || []).map((m: any) => m.memory || m.text || '').filter(Boolean);
    } catch (err) {
      console.error("[Chat] Mem0 fetch failed:", err);
    }
  }

  const memoryBlock = memories.length > 0
    ? `\n\nMemory from prior conversations with this user:\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
    : '';

  // ── Session ID + title ────────────────────────────────────────────
  const sessionId   = existingSessionId || crypto.randomUUID();
  const isNewSession = !existingSessionId;

  const firstUserMsg = messages.find((m: any) => m.role === 'user');
  const sessionTitle = firstUserMsg
    ? (firstUserMsg.content as string).split(' ').slice(0, 6).join(' ') +
      ((firstUserMsg.content as string).split(' ').length > 6 ? '…' : '')
    : 'New Chat';

  // ── Build OpenRouter request with prompt caching ──────────────────
  const openRouterMessages = [
    {
      role: 'system',
      content: [
        {
          type: 'text',
          text: HUMPHI_CHAT_SYSTEM_PROMPT + memoryBlock,
          cache_control: { type: 'ephemeral' }, // cache the system prompt
        },
      ],
    },
    ...messages,
  ];

  // ── Stream response via SSE ───────────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      if (isNewSession) {
        send(JSON.stringify({ type: 'session', sessionId, title: sessionTitle }));
      }

      try {
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://humphi.com',
            'X-Title': 'HumPhi',
          },
          body: JSON.stringify({
            model: HUMPHI_CHAT_MODEL,
            messages: openRouterMessages,
            stream: true,
          }),
        });

        if (!orRes.ok) {
          const errText = await orRes.text();
          send(JSON.stringify({ type: 'error', message: `Model error: ${errText}` }));
          controller.close();
          return;
        }

        const reader  = orRes.body!.getReader();
        const decoder = new TextDecoder();
        let fullContent  = '';
        let inputTokens  = 0;
        let outputTokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) { fullContent += delta; send(JSON.stringify({ type: 'delta', content: delta })); }
              if (parsed.usage) {
                inputTokens  = parsed.usage.prompt_tokens || 0;
                outputTokens = parsed.usage.completion_tokens || 0;
              }
            } catch {}
          }
        }

        const cost = (inputTokens / 1_000_000) * HUMPHI_INPUT_COST_PER_M
                   + (outputTokens / 1_000_000) * HUMPHI_OUTPUT_COST_PER_M;

        send(JSON.stringify({ type: 'done', inputTokens, outputTokens, cost, sessionId }));

        // ── Save session to Redis ─────────────────────────────────
        if (redis) {
          try {
            const updatedMessages = [...messages, { role: 'assistant', content: fullContent }];
            await redis.set(`chat:${sessionId}`, JSON.stringify({
              title: sessionTitle, userId, createdAt: Date.now(), messages: updatedMessages,
            }), { ex: CHAT_SESSION_TTL });
            await redis.zadd(`chat:sessions:${userId}`, { score: Date.now(), member: sessionId });
            await redis.expire(`chat:sessions:${userId}`, CHAT_SESSION_TTL);
          } catch (err) { console.error("[Chat] Redis save failed:", err); }
        }

        // ── Bill the user ─────────────────────────────────────────
        if (cost > 0) {
          try {
            const walletUseCase = getWalletUseCase();
            const profile = await walletUseCase.getProfile(userId);
            if (profile) {
              const profileRepo = new DrizzleProfileRepository();
              const transactionRepo = new DrizzleTransactionRepository();
              await profileRepo.updateBalance(userId, Math.max(0, (profile.walletBalance || 0) - cost));
              await transactionRepo.create({
                amount: -cost, type: 'usage', status: 'completed',
                metadata: { userId, service: 'chat', model: HUMPHI_CHAT_MODEL, inputTokens, outputTokens },
              });
              await invalidate(cacheKeys.profile(userId));
            }
          } catch (err: any) { console.error("[Chat] Billing failed:", err.message); }
        }

        // ── Sync conversation to Mem0 via Inngest ─────────────────
        if (fullContent) {
          try {
            const fullConvo = [...messages, { role: 'assistant', content: fullContent }]
              .map((m: any) => `${m.role === 'user' ? 'User' : 'HumPhi'}: ${m.content}`)
              .join('\n');
            await inngest.send({ name: 'session/completed', data: { userId, transcript: fullConvo } });
          } catch (err) { console.error("[Chat] Inngest Mem0 sync failed:", err); }
        }

      } catch (err: any) {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)); } catch {}
      }

      try { controller.close(); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

// GET /api/chat/sessions — list all sessions for a user
app.get("/chat/sessions", requireAuth, async (c) => {
  const userId = c.req.query("userId");
  const auth   = getAuth(c);
  if (!userId) return c.json({ error: "Missing userId" }, 400);
  if (auth?.userId !== userId) return c.json({ error: "Forbidden" }, 403);
  if (!redis) return c.json([]);

  try {
    const ids = await redis.zrange(`chat:sessions:${userId}`, 0, -1, { rev: true }) as string[];
    const sessions = await Promise.all(ids.map(async (sid) => {
      try {
        const raw = await redis!.get<string>(`chat:${sid}`);
        if (!raw) return null;
        const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return { id: sid, title: d.title, createdAt: d.createdAt };
      } catch { return null; }
    }));
    return c.json(sessions.filter(Boolean));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// GET /api/chat/session/:id — get full session (messages)
app.get("/chat/session/:id", requireAuth, async (c) => {
  const auth      = getAuth(c);
  const sessionId = c.req.param("id");
  if (!redis) return c.json({ error: "Redis not configured" }, 503);

  try {
    const raw = await redis.get<string>(`chat:${sessionId}`);
    if (!raw) return c.json({ error: "Session not found" }, 404);
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (d.userId !== auth?.userId) return c.json({ error: "Forbidden" }, 403);
    return c.json(d);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// DELETE /api/chat/session/:id
app.delete("/chat/session/:id", requireAuth, async (c) => {
  const auth      = getAuth(c);
  const sessionId = c.req.param("id");
  const userId    = auth?.userId;
  if (!redis || !userId) return c.json({ error: "Not configured" }, 503);

  try {
    const raw = await redis.get<string>(`chat:${sessionId}`);
    if (raw) {
      const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (d.userId !== userId) return c.json({ error: "Forbidden" }, 403);
    }
    await redis.del(`chat:${sessionId}`);
    await redis.zrem(`chat:sessions:${userId}`, sessionId);
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

app.post("/session/save", requireAuth, async (c) => {
  const { userId, newHandle, transcript, tokenUsage, cost, service, model } = await c.req.json();
  if (!userId) return c.json({ error: "Missing userId" }, 400);

  // Save the handle to Redis (fast, stays synchronous)
  try {
    if (redis && newHandle) {
      await redis.set(`handle:${userId}`, newHandle, { ex: 7200 }); // 2 hours TTL
    }
  } catch (err) {
    console.error("Redis save failed:", err);
  }

  // ── Billing: Deduct usage cost from wallet ───────────────────
  if (cost && cost > 0) {
    try {
      const walletUseCase = getWalletUseCase();
      const profile = await walletUseCase.getProfile(userId);
      if (profile) {
        const newBalance = Math.max(0, (profile.walletBalance || 0) - cost);
        const profileRepo = new DrizzleProfileRepository();
        await profileRepo.updateBalance(userId, newBalance);

        // Record transaction — resolve walletId from userId
        try {
          const transactionRepo = new DrizzleTransactionRepository();
          await transactionRepo.create({
            amount: -cost,
            type: 'usage',
            status: 'completed',
            metadata: { userId, service: service || 'live', model: model || 'gemini', tokens: tokenUsage?.total || 0 },
          });
        } catch (txErr: any) {
          console.error("[Billing] Transaction record failed (balance still deducted):", txErr.message);
        }

        // Invalidate cached profile
        try { await invalidate(cacheKeys.profile(userId)); } catch (e) {}

        console.log(`[Billing] Deducted $${cost.toFixed(6)} from user ${userId}. New balance: $${newBalance.toFixed(4)}`);
      }
    } catch (err: any) {
      console.error("[Billing] Failed to deduct cost:", err.message);
    }
  }

  // Offload Mem0 sync to Inngest — no longer blocking the response
  if (transcript && transcript.trim().length > 0) {
    try {
      await inngest.send({
        name: "session/completed",
        data: { userId, transcript },
      });
    } catch (err) {
      console.error("[Inngest] Failed to dispatch session/completed event:", err);
    }
  }

  return c.json({ success: true });
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
