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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const profileRepo = new DrizzleProfileRepository();
const transactionRepo = new DrizzleTransactionRepository();
const walletUseCase = new WalletUseCase(profileRepo, transactionRepo, stripe);

const app = new Hono();

// API Routes
app.post("/api/create-checkout-session", async (c) => {
  const { amount, userId } = await c.req.json();
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  
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
