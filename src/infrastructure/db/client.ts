import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

function getCleanConnectionString(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    // Remove parameters that override manual SSL/driver settings
    url.searchParams.delete('sslmode');
    url.searchParams.delete('workaround');
    return url.toString();
  } catch (err) {
    // Fallback if URL is malformed but contains info
    return rawUrl.trim();
  }
}

const connectionString = getCleanConnectionString(process.env.DATABASE_URL || "");

// Suppress "self-signed certificate in certificate chain" errors in Vercel/Serverless
// by explicitly setting rejectUnauthorized: false.
const client = postgres(connectionString, {
  prepare: false, // MANDATORY for Supabase Transaction Pooler (port 6543)
  ssl: { rejectUnauthorized: false }, 
  max: 1, 
});

export const db = drizzle(client, { schema });
