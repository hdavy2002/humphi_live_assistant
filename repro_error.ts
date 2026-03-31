import postgres from "postgres";
import dotenv from "dotenv";
import { join } from 'path';

dotenv.config({ path: join(process.cwd(), ".env.local") });

const sql = postgres(process.env.DATABASE_URL || "");

async function test() {
  try {
    console.log("Attempting failing query...");
    const result = await sql`
      select "id", "user_id", "amount", "type", "status", "description", "stripe_session_id", "created_at" 
      from "transactions" 
      where "transactions"."stripe_session_id" = 'pi_3TGzUAEYlJeHSSLh1UKoFP4C' 
      limit 1
    `;
    console.log("Query succeeded! Result:", result);
  } catch (error) {
    console.error("Query failed as expected:", error);
  } finally {
    await sql.end();
  }
}

test();
