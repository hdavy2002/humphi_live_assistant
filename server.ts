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
// Using any for mem0 as it might not have proper types or might be a CommonJS module
const { MemoryClient } = require('mem0ai');

let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL,
    token: process.env.UPSTASH_REDIS_TOKEN,
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

// API Routes
app.post("/api/create-checkout-session", async (c) => {
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

app.get("/api/session/init", async (c) => {
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

app.post("/api/session/save", async (c) => {
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
