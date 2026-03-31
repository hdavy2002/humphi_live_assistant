import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { profiles, transactions } from "./db/schema.js";
import { Profile, Transaction } from "../domain/entities.js";
import { ProfileRepository, TransactionRepository } from "../domain/repositories.js";

export class DrizzleProfileRepository implements ProfileRepository {
  async getById(id: string): Promise<Profile | null> {
    const result = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    if (result.length === 0) return null;
    const p = result[0];
    return {
      id: p.id,
      email: p.email,
      walletBalance: parseFloat(p.walletBalance || "0"),
      updatedAt: p.updatedAt,
    };
  }

  async updateBalance(id: string, newBalance: number): Promise<void> {
    await db.update(profiles).set({ walletBalance: newBalance.toString() }).where(eq(profiles.id, id));
  }
}

export class DrizzleTransactionRepository implements TransactionRepository {
  async getByStripeSessionId(sessionId: string): Promise<Transaction | null> {
    const result = await db.select().from(transactions).where(eq(transactions.stripeSessionId, sessionId)).limit(1);
    if (result.length === 0) return null;
    const t = result[0];
    return {
      id: t.id,
      userId: t.userId,
      amount: parseFloat(t.amount),
      type: t.type,
      status: t.status,
      description: t.description,
      stripeSessionId: t.stripeSessionId,
      createdAt: t.createdAt,
    };
  }

  async create(transaction: Partial<Transaction>): Promise<void> {
    await db.insert(transactions).values({
      userId: transaction.userId!,
      amount: transaction.amount!.toString(),
      type: transaction.type!,
      status: transaction.status!,
      stripeSessionId: transaction.stripeSessionId,
      description: transaction.description,
    });
  }
}
