import { Hono } from "hono";
import { handle } from "hono/vercel";
import Stripe from "stripe";
import { WalletUseCase } from "../src/application/use-cases.js";
import { DrizzleProfileRepository, DrizzleTransactionRepository } from "../src/infrastructure/repositories.js";
import { Redis } from '@upstash/redis';
import { db } from "../src/infrastructure/db/client.js";
import { sql } from "drizzle-orm";
// Using any for mem0 as it might not have proper types or might be a CommonJS module
import { MemoryClient } from 'mem0ai';

let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL.trim(),
    token: process.env.UPSTASH_REDIS_TOKEN.trim(),
  });
}

let mem0: any = null;
if (process.env.MEM0_API_KEY) {
  mem0 = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
}

const app = new Hono().basePath("/api");

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

app.post("/create-checkout-session", async (c) => {
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

app.post("/create-payment-intent", async (c) => {
  const { amount, userId } = await c.req.json();
  const walletUseCase = getWalletUseCase();

  try {
    const result = await walletUseCase.createPaymentIntent(amount, userId);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

app.post("/verify-payment-intent", async (c) => {
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

app.get("/verify-session", async (c) => {
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
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    
    // We recreate the use case here to ensure fresh repos, consistent with other routes
    const profileRepo = new DrizzleProfileRepository();
    const transactionRepo = new DrizzleTransactionRepository();
    const walletUseCase = new WalletUseCase(profileRepo, transactionRepo, stripe);
    
    const result = await walletUseCase.handleWebhookEvent(event);
    return c.json(result);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return c.json({ error: err.message }, 400);
  }
});

app.get("/diag", async (c) => {
  try {
    // Test with 'pg' driver explicitly FIRST
    const pgConnStr = (process.env.DATABASE_URL || "").trim();
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
      columnExists = dbRes.length > 0;
      columnsFound = dbRes as any;
      drizzleStatus = "success";
    } catch (err: any) {
      drizzleStatus = `failed: ${err.message}`;
    }
    
    const dbUrl = process.env.DATABASE_URL || "MISSING";
    const maskedUrl = dbUrl.replace(/:[^:@/]+@/, ":****@");
    
    return c.json({
      status: "online",
      environment: "vercel",
      database: maskedUrl,
      pgDriverStatus: pgStatus,
      drizzleStatus: drizzleStatus,
      columnExistsInDb: columnExists,
      columnsFound: columnsFound,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("DIAG ERROR:", err);
    return c.json({ error: err.message, stack: err.stack, dbUrlSet: !!process.env.DATABASE_URL }, 500);
  }
});

app.get("/session/init", async (c) => {
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

app.post("/session/save", async (c) => {
  const { userId, newHandle, transcript } = await c.req.json();
  if (!userId) return c.json({ error: "Missing userId" }, 400);

  try {
    if (redis && newHandle) {
      await redis.set(`handle:${userId}`, newHandle, { ex: 7200 }); // 2 hours TTL
    }
  } catch (err) {
    console.error("Redis save failed:", err);
  }

  try {
    if (mem0 && transcript && transcript.trim().length > 0) {
      await mem0.add(
        [{ role: 'assistant', content: transcript }],
        { user_id: userId }
      );
    }
  } catch (err) {
    console.error("Mem0 save failed:", err);
  }

  return c.json({ success: true });
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
