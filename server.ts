import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { WalletUseCase } from "./src/application/use-cases";
import { DrizzleProfileRepository, DrizzleTransactionRepository } from "./src/infrastructure/repositories";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const profileRepo = new DrizzleProfileRepository();
const transactionRepo = new DrizzleTransactionRepository();
const walletUseCase = new WalletUseCase(profileRepo, transactionRepo, stripe);

const app = new Hono();

// Global Error Handler for JSON APIs
app.onError((err, c) => {
  console.error(`[Server Error]: ${err.message}`, err);
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: err.message || "Internal Server Error" }, 500);
  }
  return c.text("Internal Server Error", 500);
});

// Custom 404 for APIs to prevent falling back to HTML
app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: `Not Found: ${c.req.method} ${c.req.path}` }, 404);
  }
  // Let Vite or static server handle non-API 404s (SPA fallback)
});

// API Routes
app.post("/api/create-checkout-session", async (c) => {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  
  try {
    const body = await c.req.json().catch(() => ({}));
    const { amount, userId } = body;
    
    if (!amount || !userId) {
      return c.json({ error: "Missing amount or userId" }, 400);
    }

    const sessionId = await walletUseCase.createCheckoutSession(amount, userId, appUrl);
    return c.json({ id: sessionId });
  } catch (err: any) {
    console.error("[Checkout Session Error]:", err);
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
    // Skip Vite for API requests that didn't match
    if (c.req.path.startsWith("/api/")) {
      return next();
    }
    
    const req = c.req.raw;
    const res = (c.env as any)?.outgoing || (c as any).res;
    
    return new Promise((resolve) => {
      vite.middlewares(req as any, res as any, () => {
        resolve(next());
      });
    });
  });
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use("/assets/*", serveStatic({ root: distPath }));
  app.get("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) {
      return next();
    }
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
