import { Profile, Transaction } from "./entities.js";

export interface ProfileRepository {
  getById(id: string): Promise<Profile | null>;
  updateBalance(id: string, newBalance: number): Promise<void>;
}

export interface TransactionRepository {
  getByStripeSessionId(sessionId: string): Promise<Transaction | null>;
  create(transaction: Partial<Transaction>): Promise<void>;
}
