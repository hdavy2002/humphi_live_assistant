import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
let rawRedisUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_URL || "").trim();
let rawRedisToken = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_TOKEN || "").trim();

// Fix common misconfigurations where https:// is duplicated or placeholder text was appended
rawRedisUrl = rawRedisUrl.replace(/^https?:\/\/(https?:\/\/)/, "$1").replace("our-url.upstash.io", "");

if (rawRedisUrl && rawRedisToken) {
  redis = new Redis({
    url: rawRedisUrl,
    token: rawRedisToken,
  });
}

const PROFILE_TTL_SECONDS = 300; // 5 minutes

/**
 * Fetches a value from Redis cache or populates it via the provided fallback.
 */
export async function getOrSet<T>(
  key: string,
  fallback: () => Promise<T>,
  ttl: number = PROFILE_TTL_SECONDS
): Promise<T> {
  if (!redis) {
    return fallback();
  }

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      return cached;
    }
  } catch (err) {
    console.warn("[Cache] Redis GET failed, falling back to DB:", err);
  }

  const fresh = await fallback();

  try {
    if (fresh !== null && fresh !== undefined) {
      await redis.set(key, fresh, { ex: ttl });
    }
  } catch (err) {
    console.warn("[Cache] Redis SET failed:", err);
  }

  return fresh;
}

/**
 * Invalidates a cached key. Call this after any write that changes the cached data.
 */
export async function invalidate(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.warn("[Cache] Redis DEL failed:", err);
  }
}

/** Typed helpers for profile and wallet keys */
export const cacheKeys = {
  profile: (userId: string) => `user:profile:${userId}`,
};
