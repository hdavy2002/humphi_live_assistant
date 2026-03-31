import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// On Vercel, env vars are injected natively — no dotenv needed.
// Using empty string fallback so the function doesn't crash on startup;
// it will fail naturally at query time with a clear connection error.
const connectionString = process.env.DATABASE_URL || "";
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
