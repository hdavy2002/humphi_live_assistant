import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Normalize connection string - strip sslmode from URL so our explicit ssl option takes full control.
// If sslmode=require is in the URL it overrides rejectUnauthorized:false causing cert errors.
let connectionString = (process.env.DATABASE_URL || "").trim()
  .replace(/[?&]sslmode=[^&]*/g, "") // remove sslmode param
  .replace(/[?&]workaround=[^&]*/g, ""); // remove vercel workaround param (not a valid postgres param)

// In serverless environments, we create a single, shared client
// but we MUST disable prepared statements if using the Supabase Transaction Pooler (port 6543)
const client = postgres(connectionString, { 
  prepare: false, // MANDATORY for Supabase transaction pooler
  ssl: { rejectUnauthorized: false }, // Supabase pooler uses self-signed cert in cert chain
  connect_timeout: 15, // 15 seconds
  idle_timeout: 10, // Close idle connections after 10 seconds
  max: 1 // Only 1 connection per serverless function instance to avoid saturating pool
});

export const db = drizzle(client, { schema });
