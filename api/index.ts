import { Hono } from "hono";
import { handle } from "hono/vercel";
import Stripe from "stripe";
import { WalletUseCase } from "@/src/application/use-cases";
import { DrizzleProfileRepository, DrizzleTransactionRepository } from "@/src/infrastructure/repositories";

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
    const protocol = host?.includes("localhost") ? "http" : "https";
    appUrl = `${protocol}://${host}`;
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

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
