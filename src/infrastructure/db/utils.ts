import { sql } from "drizzle-orm";
import { poolDb as db } from "./client.js";

/**
 * Executes a database operation within a transaction that sets the 'app.user_id' 
 * session variable for Postgres Row Level Security (RLS).
 * 
 * @param userId - The Clerk user ID to set for RLS scope.
 * @param callback - The database logic to execute (receives a transaction-aware client).
 * @returns The result of the callback.
 */
export async function withRLS<T>(
  userId: string,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Set the session variable. 'LOCAL' ensures it's scoped to this transaction only.
    // We use a safe parameterized query to prevent injection.
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
    
    return await callback(tx);
  });
}
