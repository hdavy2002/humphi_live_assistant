import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePool } from 'drizzle-orm/neon-serverless';
import * as schema from './schema.js';

// Required for serverless environments to use WebSockets for connection pooling
if (process.env.NODE_ENV === 'development') {
  neonConfig.fetchConnectionCache = true;
}

const connectionString = process.env.DATABASE_URL || "";

// HTTP client (Best for fast, single-query serverless envs)
const sql = neon(connectionString);
export const db = drizzleHttp(sql, { schema });

// Pool client (Better for transactions and long-lived tasks like Inngest)
const pool = new Pool({ connectionString });
export const poolDb = drizzlePool(pool, { schema });
