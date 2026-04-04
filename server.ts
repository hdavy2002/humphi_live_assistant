import dotenv from "dotenv";
dotenv.config();

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import path from "path";
import fs from "fs";
import { WalletUseCase } from "./src/application/use-cases";
import { DrizzleProfileRepository, DrizzleTransactionRepository } from "./src/infrastructure/repositories";
import { Redis } from '@upstash/redis';
import { inngest } from "./api/lib/inngest.js";
// Using any for mem0 as it might not have proper types or might be a CommonJS module
import { MemoryClient } from 'mem0ai';
import { db } from "./src/infrastructure/db/client.js";
import { sql } from "drizzle-orm";
import { authMiddleware, requireAuth, getAuth } from "./src/infrastructure/auth/clerk.js";

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

let mem0: any = null;
if (process.env.MEM0_API_KEY) {
  mem0 = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const profileRepo = new DrizzleProfileRepository();
const transactionRepo = new DrizzleTransactionRepository();
const walletUseCase = new WalletUseCase(profileRepo, transactionRepo, stripe);

const app = new Hono();

// Global Middleware
app.use("*", authMiddleware);

// API Routes
app.post("/api/create-checkout-session", requireAuth, async (c) => {
  const { amount, userId } = await c.req.json();
  
  // Robust URL detection
  let appUrl = process.env.APP_URL;
  if (!appUrl) {
    const host = c.req.header("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    appUrl = `${protocol}://${host}`;
  }
  
  try {
    const sessionId = await walletUseCase.createCheckoutSession(amount, userId, appUrl);
    return c.json({ id: sessionId });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.post("/api/create-payment-intent", requireAuth, async (c) => {
  const { amount, userId } = await c.req.json();
  try {
    const result = await walletUseCase.createPaymentIntent(amount, userId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.post("/api/verify-payment-intent", requireAuth, async (c) => {
  const { paymentIntentId } = await c.req.json();
  try {
    const result = await walletUseCase.verifyPaymentIntent(paymentIntentId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.post("/api/create-portal-session", requireAuth, async (c) => {
  const { userId } = await c.req.json();
  
  let appUrl = process.env.APP_URL;
  if (!appUrl) {
    const host = c.req.header("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    appUrl = `${protocol}://${host}`;
  }
  
  try {
    const url = await walletUseCase.createPortalSession(userId, appUrl);
    return c.json({ url });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.get("/api/verify-session", async (c) => {
  const sessionId = c.req.query("sessionId");
  if (!sessionId) return c.json({ error: "Missing session ID" }, 400);

  try {
    const result = await walletUseCase.verifySession(sessionId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/webhook", async (c) => {
  const sig = c.req.header("stripe-signature");
  if (!sig) return c.json({ error: "Missing signature" }, 400);

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return c.json({ error: "Webhook secret not configured" }, 500);
  }

  try {
    const rawBody = await c.req.text();
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    
    // Dispatch to Inngest and return 200 immediately — no DB work on this thread
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

app.get("/api/diag", async (c) => {
  try {
    const profileRepo = new DrizzleProfileRepository();
    const transactionRepo = new DrizzleTransactionRepository();
    const walletUseCase = new WalletUseCase(profileRepo, transactionRepo, stripe);
    
    // Check if the column exists by running a raw query
    const dbRes = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' AND table_schema = 'public' AND column_name = 'stripe_session_id';
    `);
    
    const dbUrl = process.env.DATABASE_URL || "MISSING";
    const maskedUrl = dbUrl.replace(/:[^:@/]+@/, ":****@");
    
    return c.json({
      status: "online",
      database: maskedUrl,
      columnExists: Array.isArray(dbRes) ? dbRes.length > 0 : (dbRes as any).rowCount > 0,
      columnsFound: dbRes,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("DIAG ERROR:", err);
    return c.json({ error: err.message, stack: err.stack, dbUrlSet: !!process.env.DATABASE_URL }, 500);
  }
});

app.get("/api/wallet/profile", requireAuth, async (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({ error: "Missing userId" }, 400);
  try {
    const profile = await walletUseCase.getProfile(userId);
    return c.json(profile);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get("/api/wallet/transactions", requireAuth, async (c) => {
  const userId = c.req.query("userId");
  if (!userId) return c.json({ error: "Missing userId" }, 400);
  try {
    const transactions = await walletUseCase.getTransactions(userId);
    return c.json(transactions);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/api/wallet/seed", async (c) => {
  const { userId, email } = await c.req.json();
  if (!userId || !email) return c.json({ error: "Missing userId or email" }, 400);
  try {
    const profile = await walletUseCase.seedWallet(userId, email);
    return c.json(profile);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ── Gemini session helpers ────────────────────────────────────────────────────
const sessionCountKey = (uid: string) => `gemini:sessions:active:${uid}`;
const sessionGrantKey = (gid: string) => `gemini:grant:${gid}`;
const LIVE_INPUT_COST  = 0.000001;
const LIVE_OUTPUT_COST = 0.000004;

app.get("/api/session/init", requireAuth, async (c) => {
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

// ── POST /api/gemini/token — issue ephemeral token for a Live session ────────
app.post("/api/gemini/token", requireAuth, async (c) => {
  const userId = getAuth(c)!.userId!;

  const profile = await walletUseCase.getProfile(userId).catch(() => null);
  if (!profile || (profile.walletBalance ?? 0) < 0.01) {
    return c.json({ error: "Insufficient balance" }, 402);
  }

  if (redis) {
    try {
      const count = await redis.incr(sessionCountKey(userId));
      if (count === 1) await redis.expire(sessionCountKey(userId), 35 * 60);
      const max = parseInt(process.env.GEMINI_MAX_CONCURRENT_SESSIONS || '3');
      if (count > max) {
        await redis.decr(sessionCountKey(userId));
        return c.json({ error: "Too many active sessions. Close an existing session first." }, 429);
      }
    } catch (redisErr) {
      console.error("[GeminiToken] Redis error:", redisErr);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (redis) await redis.decr(sessionCountKey(userId)).catch(() => {});
    return c.json({ error: "GEMINI_API_KEY not configured" }, 500);
  }

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const tokenResponse = await (ai as any).authTokens.create({
      config: { uses: 1, expireTime, newSessionExpireTime: expireTime },
    });
    if (!tokenResponse?.name) throw new Error("SDK returned empty token name");

    const grantId = crypto.randomUUID();
    if (redis) {
      await redis.set(
        sessionGrantKey(grantId),
        JSON.stringify({ userId, grantId, issuedAt: Date.now(), billed: false }),
        { ex: 35 * 60 }
      );
    }

    console.log(`[GeminiToken] Issued grant ${grantId} for user ${userId}`);
    return c.json({ ephemeralToken: tokenResponse.name, grantId, expiresIn: 1800 });

  } catch (err: any) {
    if (redis) await redis.decr(sessionCountKey(userId)).catch(() => {});
    console.error("[GeminiToken] Failed:", err);
    return c.json({ error: err.message || "Failed to create session token" }, 500);
  }
});

app.post("/api/session/save", requireAuth, async (c) => {
  const serverUserId = getAuth(c)!.userId!;
  const { userId, newHandle, transcript, tokenUsage, service, model, agentRole, agentName, grantId } = await c.req.json();

  if (userId && userId !== serverUserId) return c.json({ error: "Forbidden" }, 403);
  const billingUserId = serverUserId;

  try {
    if (redis && newHandle) {
      await redis.set(`handle:${billingUserId}`, newHandle, { ex: 7200 });
    }
  } catch (err) {
    console.error("Redis save failed:", err);
  }

  // Grant verification
  let grantVerified = false;
  if (redis && grantId) {
    try {
      const raw = await redis.get<string>(sessionGrantKey(grantId));
      if (raw) {
        const grant: any = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (grant.userId === billingUserId && !grant.billed) {
          grantVerified = true;
          await redis.set(sessionGrantKey(grantId), JSON.stringify({ ...grant, billed: true }), { ex: 300 });
        }
      }
    } catch (e) {
      console.error("[SessionSave] Grant lookup failed:", e);
    }
    await redis.decr(sessionCountKey(billingUserId)).catch(() => {});
  }

  // Server-authoritative cost
  const inputTokens  = grantVerified ? Math.min(tokenUsage?.input  || 0, 10_000_000) : 0;
  const outputTokens = grantVerified ? Math.min(tokenUsage?.output || 0, 10_000_000) : 0;
  const computedCost = (inputTokens * LIVE_INPUT_COST) + (outputTokens * LIVE_OUTPUT_COST);

  const sessionMeta = {
    userId: billingUserId,
    service: service || 'live',
    model:   model   || 'gemini',
    agentRole, agentName,
    grantVerified,
    inputTokens,
    outputTokens,
    tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
  };

  try {
    const profile = await walletUseCase.getProfile(billingUserId);
    if (profile) {
      if (computedCost > 0) {
        const newBalance = Math.max(0, (profile.walletBalance || 0) - computedCost);
        await profileRepo.updateBalance(billingUserId, newBalance);
        console.log(`[Billing] Deducted $${computedCost.toFixed(6)} from ${billingUserId}. Balance: $${newBalance.toFixed(4)}`);
      }
      try {
        await transactionRepo.create({
          amount: -(computedCost || 0),
          type:   'usage',
          status: 'completed',
          metadata: sessionMeta,
        });
      } catch (txErr: any) {
        console.error("[Billing] Transaction record failed:", txErr.message);
      }
    }
  } catch (err: any) {
    console.error("[Billing] Failed:", err.message);
  }

  if (transcript && transcript.trim().length > 0) {
    try {
      await inngest.send({ name: "session/completed", data: { userId: billingUserId, transcript } });
    } catch (err) {
      console.error("Queueing Mem0 sync failed:", err);
    }
  }

  return c.json({ success: true });
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  
  app.use("*", async (c, next) => {
    const req = c.req.raw;
    const res = (c.env as any)?.outgoing || (c as any).res; // Hono node-server context
    
    return new Promise((resolve) => {
      vite.middlewares(req as any, res as any, () => {
        resolve(next());
      });
    });
  });
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use("/assets/*", serveStatic({ root: distPath }));
  app.get("*", async (c) => {
    const html = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
    return c.html(html);
  });
}

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
