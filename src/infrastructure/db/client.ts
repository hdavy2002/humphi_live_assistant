import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Clean the connection string of any SSL/Workaround parameters that might interfere with manual SSL config
// Also trim to remove any trailing newlines from the Vercel env var editor
const connectionString = (process.env.DATABASE_URL || "").trim()
  .replace(/[?&]sslmode=[^&]*/g, "")
  .replace(/[?&]workaround=[^&]*/g, "");

// Suppress "self-signed certificate in certificate chain" errors in Vercel/Serverless
// by explicitly setting rejectUnauthorized: false.
// We MUST remove sslmode from the connection string for this to take effect reliably.
const client = postgres(connectionString, {
  prepare: false, // MANDATORY for Supabase Transaction Pooler (port 6543)
  ssl: { rejectUnauthorized: false }, 
  max: 1, 
});

export const db = drizzle(client, { schema });
