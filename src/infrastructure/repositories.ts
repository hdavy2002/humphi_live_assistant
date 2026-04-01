import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { profiles, transactions, wallets } from "./db/schema.js";
import { Profile, Transaction } from "../domain/entities.js";
import { ProfileRepository, TransactionRepository } from "../domain/repositories.js";

export class DrizzleProfileRepository implements ProfileRepository {
  async getById(id: string): Promise<Profile | null> {
    const result = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        walletBalance: wallets.balance,
        updatedAt: profiles.updatedAt
      })
      .from(profiles)
      .leftJoin(wallets, eq(profiles.id, wallets.userId))
      .where(eq(profiles.id, id))
      .limit(1);

    if (result.length === 0) return null;
    const p = result[0];
    return {
      id: p.id,
      email: p.email,
      walletBalance: parseFloat(p.walletBalance || "0"),
      updatedAt: p.updatedAt,
    };
  }

  async create(profile: Partial<Profile>): Promise<void> {
    await db.insert(profiles).values({
      id: profile.id!,
      email: profile.email || "",
    });
  }

  async updateBalance(id: string, newBalance: number): Promise<void> {
    await db.update(wallets).set({ balance: newBalance.toString() }).where(eq(wallets.userId, id));
  }
}

export class DrizzleTransactionRepository implements TransactionRepository {
  async getByStripeSessionId(sessionId: string): Promise<Transaction | null> {
    try {
      const result = await db.select().from(transactions).where(eq(transactions.providerSessionId, sessionId)).limit(1);
      if (result.length === 0) return null;
      const t = result[0];
      return {
        id: t.id,
        walletId: t.walletId,
        amount: parseFloat(t.amount),
        type: t.type,
        status: t.status,
        providerSessionId: t.providerSessionId,
        metadata: t.metadata,
        createdAt: t.createdAt,
      };
    } catch (err: any) {
      console.error("Repository error [getByStripeSessionId]:", err.message);
      if (err.message?.includes("column") && err.message?.includes("stripe_session_id")) {
        throw new Error("Missing 'stripe_session_id' column in database. Please run the SQL migration.");
      }
      if (err.message?.includes("connect") || err.message?.includes("timeout")) {
        throw new Error("Database connection error. If using Neon, ensure your DATABASE_URL uses the correct pooler port.");
      }
      throw err;
    }
  }

  async getByUserId(userId: string): Promise<Transaction[]> {
    const result = await db
      .select({
        id: transactions.id,
        walletId: transactions.walletId,
        amount: transactions.amount,
        type: transactions.type,
        status: transactions.status,
        providerSessionId: transactions.providerSessionId,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .innerJoin(wallets, eq(transactions.walletId, wallets.id))
      .where(eq(wallets.userId, userId));

    return result.map(t => ({
      id: t.id,
      walletId: t.walletId,
      amount: parseFloat(t.amount),
      type: t.type,
      status: t.status,
      providerSessionId: t.providerSessionId,
      metadata: null, // Default if not in select
      createdAt: t.createdAt,
    }));
  }

  async create(transaction: Partial<Transaction>): Promise<void> {
    // If walletId is missing but we have metadata with userId (from Inngest/Webhook), resolve it
    let walletId = transaction.walletId;
    
    if (!walletId) {
      // Fallback: This repository might be called with metadata containing userId
      const metadata = transaction.metadata as any;
      const userId = metadata?.userId;
      if (userId) {
        const w = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
        if (w.length > 0) walletId = w[0].id;
      }
    }

    if (!walletId) throw new Error("walletId is required to create a transaction");

    await db.insert(transactions).values({
      walletId: walletId,
      amount: transaction.amount!.toString(),
      type: transaction.type!,
      status: transaction.status!,
      providerSessionId: transaction.providerSessionId || null,
      metadata: transaction.metadata || null,
    });
  }
}
