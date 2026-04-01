import { Inngest } from "inngest";
import { poolDb as db } from "../../src/infrastructure/db/client.js";
import { profiles, wallets } from "../../src/infrastructure/db/schema.js";
import { eq, sql } from "drizzle-orm";
import { invalidate, cacheKeys } from "./cache.js";
import Stripe from "stripe";
import { MemoryClient } from "mem0ai";

// Initialize the Inngest client
export const inngest = new Inngest({ id: "humphi-ai-addons" });

// Define the provisioning function using Inngest v4 signature (2 arguments)
export const provisionUser = inngest.createFunction(
  { 
    id: "provision-new-user", 
    name: "Provision New User",
    triggers: [
      { event: "clerk/user.created" },
      { event: "neon/user.created" }
    ]
  },
  async ({ event, step }) => {
    const { data } = event;
    const isNeon = event.name === "neon/user.created";
    const userId = (data as any).id;
    const email = isNeon 
      ? (data as any).email 
      : (data as any).email_addresses?.[0]?.email_address;

    if (!userId) {
      console.error("No userId found in Clerk event data");
      return;
    }

    await step.run("seed-profile-and-wallet", async () => {
      console.log(`Provisioning profile and wallet for user: ${userId}`);
      
      await db.transaction(async (tx) => {
        // 1. Create Profile
        await tx.insert(profiles).values({
          id: userId,
          email: email || null,
        }).onConflictDoNothing();

        // 2. Create Wallet
        await tx.insert(wallets).values({
          userId: userId,
          balance: "0.00",
        }).onConflictDoNothing();
      });
    });

    await step.run("init-mem0", async () => {
      // Placeholder for Mem0 initialization if needed
      console.log(`Initializing Mem0 for user: ${userId}`);
    });

    await step.run("send-welcome-email", async () => {
      // Placeholder for email logic
      console.log(`Sending welcome email to: ${email}`);
    });

    // ----------------------------------------------------
    // PHASE 4: User Retention Drip Logic
    // ----------------------------------------------------
    
    // Wait for 24 hours to give the user time to explore the app
    await step.sleep("wait-24-hours", "24h");
    
    // Check if the user has used their credits (by checking if their balance dropped or usage transactions exist)
    const hasUsedApp = await step.run("check-user-engagement", async () => {
       const txRows = await db.execute(
         sql`SELECT id FROM transactions ts JOIN wallets w ON ts.wallet_id = w.id WHERE w.user_id = ${userId} AND ts.type = 'usage' LIMIT 1`
       );
       return (txRows as unknown as any[]).length > 0;
    });

    // If they haven't used the app, send a follow-up drip email
    if (!hasUsedApp) {
      await step.run("send-engagement-drip-email", async () => {
         console.log(`Sending engagement drip email to: ${email} (User has not used the app within 24 hours)`);
         // Actual email dispatch logic (e.g. Resend, Sendgrid) would go here
      });
    }

  }
);

// ---------------------------------------------------------------
// 2. Async Stripe Webhook Handler
//    Triggered by our /api/webhook route after signature verification.
//    Handles payment processing with automatic retries & idempotency.
// ---------------------------------------------------------------
export const processStripeWebhook = inngest.createFunction(
  {
    id: "process-stripe-webhook",
    name: "Process Stripe Webhook",
    triggers: [{ event: "stripe/payment.succeeded" }],
    // Prevent hammering DB with concurrent events
    concurrency: { limit: 5 },
  },
  async ({ event, step }) => {
    const { sessionId, userId, amount } = event.data as {
      sessionId: string;
      userId: string;
      amount: number;
    };

    await step.run("check-idempotency", async () => {
      // Check if already processed to prevent double-crediting
      const existing = await db.execute(
        sql`SELECT id FROM transactions WHERE provider_session_id = ${sessionId} LIMIT 1`
      );
      if ((existing as unknown as any[]).length > 0) {
        console.log(`[Inngest] Already processed session: ${sessionId}`);
        return { alreadyProcessed: true };
      }
    });

    const newBalance = await step.run("update-wallet-balance", async () => {
      const walletRows = await db.execute(
        sql`SELECT id, balance FROM wallets WHERE user_id = ${userId} LIMIT 1`
      );
      const wallet = (walletRows as unknown as any[])[0];
      if (!wallet) throw new Error(`Wallet not found for userId: ${userId}`);

      const currentBalance = parseFloat(wallet.balance ?? "0");
      const updated = currentBalance + amount;

      await db.execute(
        sql`UPDATE wallets SET balance = ${updated} WHERE id = ${wallet.id}`
      );

      // Create transaction
      await db.execute(
        sql`INSERT INTO transactions (wallet_id, amount, type, status, provider_session_id, metadata)
            VALUES (${wallet.id}, ${amount}, 'topup', 'completed', ${sessionId}, ${JSON.stringify({ userId, description: 'Stripe Top-up: ' + sessionId })})
            ON CONFLICT (provider_session_id) DO NOTHING`
      );

      return updated;
    });

    await step.run("invalidate-profile-cache", async () => {
      await invalidate(cacheKeys.profile(userId));
      console.log(`[Cache] Invalidated profile cache for: ${userId}`);
    });

    console.log(`[Inngest] Wallet updated. User: ${userId}, New balance: ${newBalance}`);
    return { success: true, userId, newBalance };
  }
);

// ---------------------------------------------------------------
// 3. Background Mem0 Memory Sync
//    Triggered by /api/session/save so the response is instant.
// ---------------------------------------------------------------
export const syncMem0 = inngest.createFunction(
  {
    id: "sync-mem0-memory",
    name: "Sync Mem0 Memory",
    triggers: [{ event: "session/completed" }],
  },
  async ({ event, step }) => {
    const { userId, transcript } = event.data as {
      userId: string;
      transcript: string;
    };

    await step.run("add-to-mem0", async () => {
      if (!process.env.MEM0_API_KEY) {
        console.log("[Inngest][Mem0] MEM0_API_KEY not set, skipping.");
        return;
      }
      const mem0 = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
      await mem0.add(
        [{ role: "assistant", content: transcript }],
        { user_id: userId }
      );
      console.log(`[Inngest][Mem0] Memory synced for user: ${userId}`);
    });
  }
);

// ---------------------------------------------------------------
// 4. Session Billing Handler
//    Triggered by /api/session/save.
//    Calculates cost based on token usage: $1/1M input, $4/1M output.
// ---------------------------------------------------------------
export const processSessionBilling = inngest.createFunction(
  {
    id: "process-session-billing",
    name: "Process Session Billing",
    triggers: [{ event: "session/completed" }],
  },
  async ({ event, step }) => {
    const { userId, tokens } = event.data as {
      userId: string;
      tokens: { input: number; output: number };
    };

    if (!tokens || (tokens.input === 0 && tokens.output === 0)) {
      console.log(`[Inngest][Billing] No tokens used for user: ${userId}, skipping billing.`);
      return;
    }

    // Rates: $1/1M input, $4/1M output
    const inputCost = tokens.input * 0.000001;
    const outputCost = tokens.output * 0.000004;
    const totalCost = inputCost + outputCost;

    const newBalance = await step.run("deduct-session-cost", async () => {
      const walletRows = await db.execute(
        sql`SELECT id, balance FROM wallets WHERE user_id = ${userId} LIMIT 1`
      );
      const wallet = (walletRows as unknown as any[])[0];
      if (!wallet) throw new Error(`Wallet not found for billing. User: ${userId}`);

      const currentBalance = parseFloat(wallet.balance ?? "0");
      const updated = Math.max(0, currentBalance - totalCost);

      await db.execute(
        sql`UPDATE wallets SET balance = ${updated} WHERE id = ${wallet.id}`
      );

      // Create usage transaction
      await db.execute(
        sql`INSERT INTO transactions (wallet_id, amount, type, status, metadata)
            VALUES (${wallet.id}, ${-totalCost}, 'usage', 'completed', ${JSON.stringify({ 
              tokens, 
              details: `Gemini Live Session: ${tokens.input} input, ${tokens.output} output tokens` 
            })})`
      );

      return updated;
    });

    await step.run("invalidate-profile-cache", async () => {
      await invalidate(cacheKeys.profile(userId));
    });

    console.log(`[Inngest][Billing] Deducted $${totalCost.toFixed(6)} from user: ${userId}. New balance: $${newBalance.toFixed(2)}`);
    return { success: true, userId, totalCost, newBalance };
  }
);
