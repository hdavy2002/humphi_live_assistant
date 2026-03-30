import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().notNull(),
  email: text("email"),
  walletBalance: numeric("wallet_balance").default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  amount: numeric("amount").notNull(),
  type: text("type").notNull(), // 'topup' or 'usage'
  status: text("status").notNull(), // 'completed', 'pending', 'failed'
  description: text("description"),
  stripeSessionId: text("stripe_session_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
