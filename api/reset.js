import { getRedisClient } from "./_lib/redis.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const redis = getRedisClient();

    // Reset all vote counters (keep CVs)
    const keys = await redis.keys("votes:*");
    if (keys && keys.length > 0) {
      for (const key of keys) {
        await redis.del(key);
      }
    }

    // Reset player vote tracking
    const playerVoteKeys = await redis.keys("vote:*");
    if (playerVoteKeys && playerVoteKeys.length > 0) {
      for (const key of playerVoteKeys) {
        await redis.del(key);
      }
    }

    return res.status(200).json({ ok: true, message: "Vote stats reset, CVs preserved" });
  } catch (err) {
    console.error("[reset.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
