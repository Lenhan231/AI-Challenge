import { Redis } from "@upstash/redis";

export function getRedisClient() {
  // Support both Vercel's naming (KV_REST_API_*) and Upstash's naming (UPSTASH_REDIS_REST_*)
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Redis: KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set"
    );
  }

  return new Redis({ url, token });
}
