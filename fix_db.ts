import postgres from "postgres";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(process.cwd(), ".env.local") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = postgres(connectionString);

async function run() {
  try {
    console.log("Checking for 'stripe_session_id' column in 'transactions' table...");
    
    // Check if column exists
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      AND column_name = 'stripe_session_id'
    `;

    if (columns.length === 0) {
      console.log("Column missing. Adding 'stripe_session_id' to 'transactions'...");
      await sql`ALTER TABLE transactions ADD COLUMN stripe_session_id TEXT UNIQUE`;
      console.log("Column added successfully!");
    } else {
      console.log("Column 'stripe_session_id' already exists.");
    }

    // Also check if wallet_balance is numeric (it should be, but let's be safe)
    console.log("Ensuring wallet_balance defaults to 0...");
    await sql`ALTER TABLE profiles ALTER COLUMN wallet_balance SET DEFAULT 0`;
    
  } catch (error) {
    console.error("Database migration failed:", error);
  } finally {
    await sql.end();
  }
}

run();
