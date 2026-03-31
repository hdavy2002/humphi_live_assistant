import postgres from "postgres";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(process.cwd(), ".env.local") });

const sql = postgres(process.env.DATABASE_URL || "");

async function inspect() {
  try {
    console.log("Inspecting transactions table details...");
    
    const info = await sql`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
      ORDER BY ordinal_position;
    `;

    console.table(info);

    const count = await sql`SELECT COUNT(*) FROM transactions`;
    console.log("Total transactions:", count[0].count);

  } catch (error) {
    console.error("Inspection failed:", error);
  } finally {
    await sql.end();
  }
}

inspect();
