import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Normalize connection string for Supabase / Vercel
let connectionString = (process.env.DATABASE_URL || "").trim();

// Ensure sslmode=require is present for Supabase, but only if it's not already there
if (connectionString && !connectionString.includes("sslmode=")) {
  connectionString += (connectionString.includes("?") ? "&" : "?") + "sslmode=require";
}

// In serverless environments, we create a single, shared client
// but we MUST disable prepared statements if using the Supabase Transaction Pooler (port 6543)
const client = postgres(connectionString, { 
  prepare: false, // MANDATORY for Supabase transaction pooler
  connect_timeout: 10, // 10 seconds
  idle_timeout: 5, // Close idle connections after 10 seconds
  max: 1 // Only 1 connection per serverless function instance to avoid saturating pool
});

export const db = drizzle(client, { schema });
