import { Redis } from "@upstash/redis";

export function getRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Redis: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN not set"
    );
  }

  return new Redis({ url, token });
}
