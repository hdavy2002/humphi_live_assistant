/**
 * One-time backfill script — copies existing usage rows from Neon → Tinybird.
 *
 * Run once from project root:
 *   npx ts-node --esm scripts/backfill-tinybird.ts
 *
 * Requires DATABASE_URL and TINYBIRD_API_KEY in .env.local
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const TINYBIRD_API_KEY = process.env.TINYBIRD_API_KEY || '';
const DATABASE_URL     = process.env.DATABASE_URL || '';

if (!TINYBIRD_API_KEY) { console.error('Missing TINYBIRD_API_KEY'); process.exit(1); }
if (!DATABASE_URL)     { console.error('Missing DATABASE_URL');     process.exit(1); }

const sql = neon(DATABASE_URL);

async function main() {
  console.log('[Backfill] Fetching all usage rows from Neon...');

  const rows = await sql`
    SELECT
      t.id,
      t.amount,
      t.status,
      t.metadata,
      t.created_at,
      w.user_id
    FROM transactions t
    JOIN wallets w ON t.wallet_id = w.id
    WHERE t.type = 'usage'
    ORDER BY t.created_at ASC
  `;

  console.log(`[Backfill] Found ${rows.length} rows. Sending to Tinybird...`);

  // Tinybird accepts NDJSON — one JSON object per line, all in one POST
  const ndjson = rows.map((r: any) => {
    const meta = r.metadata || {};
    return JSON.stringify({
      id:           r.id,
      userId:       meta.userId || r.user_id,
      service:      meta.service      || 'live',
      model:        meta.model        || 'gemini',
      inputTokens:  meta.inputTokens  ?? meta.tokens?.input  ?? 0,
      outputTokens: meta.outputTokens ?? meta.tokens?.output ?? 0,
      totalTokens:  meta.tokens?.total ?? ((meta.inputTokens ?? 0) + (meta.outputTokens ?? 0)),
      cost:         Math.abs(parseFloat(r.amount || '0')),
      status:       r.status || 'completed',
      createdAt:    new Date(r.created_at).toISOString(),
    });
  }).join('\n');

  const res = await fetch('https://api.tinybird.co/v0/events?name=session_logs', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${TINYBIRD_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: ndjson,
  });

  const body = await res.text();
  if (res.ok) {
    console.log(`[Backfill] Done. Tinybird response:`, body);
  } else {
    console.error(`[Backfill] Tinybird error ${res.status}:`, body);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
