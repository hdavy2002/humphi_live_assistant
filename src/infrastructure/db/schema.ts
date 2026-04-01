import { pgTable, uuid, text, numeric, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey().notNull(), // This is the Clerk userId
  email: text("email"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const wallets = pgTable("wallets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").unique().notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  currency: text("currency").default("USD").notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: "cascade" }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  type: text("type").notNull(), // 'topup' or 'usage'
  status: text("status").default("pending").notNull(), // 'completed', 'pending', 'failed'
  providerSessionId: text("provider_session_id").unique(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    walletIdIdx: index("wallet_id_idx").on(table.walletId),
    createdAtIdx: index("transactions_created_at_idx").on(table.createdAt),
  };
});

export const recordings = pgTable("recordings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  transcription: text("transcription"),
  summary: text("summary"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("recordings_user_id_idx").on(table.userId),
  };
});

export const memorySessions = pgTable("memory_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  mem0UserId: text("mem0_user_id").notNull(), // External ID for Mem0
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("memory_sessions_user_id_idx").on(table.userId),
  };
});
