import { Profile, Transaction } from "./entities.js";

export interface ProfileRepository {
  getById(id: string): Promise<Profile | null>;
  create(profile: Partial<Profile>): Promise<void>;
  updateBalance(id: string, newBalance: number): Promise<void>;
}

export interface TransactionRepository {
  getByStripeSessionId(sessionId: string): Promise<Transaction | null>;
  getByUserId(userId: string): Promise<Transaction[]>;
  create(transaction: Partial<Transaction>): Promise<void>;
}
