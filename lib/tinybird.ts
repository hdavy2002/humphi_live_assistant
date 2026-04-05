/**
 * Tinybird Definitions for HumPhi
 *
 * Datasource: session_logs — every Live or AI session a user has
 * Endpoint:   user_session_logs — query a user's log history
 */

import {
  defineDatasource,
  defineEndpoint,
  Tinybird,
  node,
  t,
  p,
  engine,
  type InferRow,
  type InferParams,
  type InferOutputRow,
} from "@tinybirdco/sdk";

// ============================================================================
// Datasource
// ============================================================================

/**
 * session_logs — one row per HumPhi session (Live or AI chat)
 * Written on every session end from /api/session/save and /api/chat
 */
export const sessionLogs = defineDatasource("session_logs", {
  description: "HumPhi session usage log — tokens, cost, model, service per session",
  schema: {
    id:            t.string(),
    userId:        t.string(),
    service:       t.string().lowCardinality(),  // 'live' | 'chat'
    model:         t.string(),
    inputTokens:   t.uint32(),
    outputTokens:  t.uint32(),
    totalTokens:   t.uint32(),
    audioTokens:   t.uint32(),                   // live only: estimated audio input tokens (32/s)
    videoTokens:   t.uint32(),                   // live only: estimated video input tokens (263/s)
    cost:          t.float64(),
    status:        t.string().lowCardinality(),  // 'completed' | 'failed'
    durationSecs:  t.uint32(),                   // session wall-clock duration in seconds
    createdAt:     t.dateTime(),
  },
  engine: engine.mergeTree({
    // Primary sort: per-user time series — fastest for "get my recent sessions"
    sortingKey: ["userId", "createdAt"],
  }),
});

export type SessionLogRow = InferRow<typeof sessionLogs>;

// ============================================================================
// Endpoints
// ============================================================================

/**
 * user_session_logs — returns paginated session history for a single user
 * Supports optional service filter ('live' | 'chat' | all if omitted)
 */
export const userSessionLogs = defineEndpoint("user_session_logs", {
  description: "Get session log history for a user, ordered newest first",
  params: {
    userId:  p.string(),
    service: p.string().optional('all'),
    limit:   p.int32().optional(200),
  },
  nodes: [
    node({
      name: "endpoint",
      sql: `
        SELECT
          id,
          userId,
          service,
          model,
          inputTokens   AS input_tokens,
          outputTokens  AS output_tokens,
          totalTokens   AS total_tokens,
          audioTokens   AS audio_tokens,
          videoTokens   AS video_tokens,
          cost,
          status,
          durationSecs  AS duration_secs,
          createdAt     AS created_at
        FROM session_logs
        WHERE userId = {{String(userId, '')}}
        {% if String(service, 'all') != 'all' %}
          AND service = {{String(service, 'live')}}
        {% end %}
        ORDER BY createdAt DESC
        LIMIT {{Int32(limit, 200)}}
      `,
    }),
  ],
  output: {
    id:            t.string(),
    userId:        t.string(),
    service:       t.string(),
    model:         t.string(),
    input_tokens:  t.uint32(),
    output_tokens: t.uint32(),
    total_tokens:  t.uint32(),
    audio_tokens:  t.uint32(),
    video_tokens:  t.uint32(),
    cost:          t.float64(),
    status:        t.string(),
    duration_secs: t.uint32(),
    created_at:    t.dateTime(),
  },
});

export type UserSessionLogsParams  = InferParams<typeof userSessionLogs>;
export type UserSessionLogsOutput  = InferOutputRow<typeof userSessionLogs>;

// ============================================================================
// Client
// ============================================================================

export const tinybird = new Tinybird({
  datasources: { sessionLogs },
  pipes:       { userSessionLogs },
});
