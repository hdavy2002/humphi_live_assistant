import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Trim to handle any accidental whitespace/newlines from Vercel env var editor
const connectionString = (process.env.DATABASE_URL || "").trim();

// Official Supabase + Drizzle pattern:
// https://supabase.com/docs/guides/database/drizzle
// - `prepare: false` is MANDATORY for Transaction pooler mode (port 6543)
// - SSL is handled by `sslmode=require` in the connection string URL itself
// - No explicit `ssl` option needed — it causes cert errors with the pooler
const client = postgres(connectionString, {
  prepare: false,
  max: 1, // 1 connection per serverless instance
});

export const db = drizzle(client, { schema });
