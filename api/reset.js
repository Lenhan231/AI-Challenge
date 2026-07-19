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

    // Clear ALL game data
    const patterns = [
      "player:*",           // player info
      "resume:*",           // resumes (both human and AI)
      "resumes:*",          // resume sets
      "votes:*",            // vote counters
      "vote:*",             // player vote tracking
      "ai:resume:counter"   // AI counter
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys && keys.length > 0) {
        for (const key of keys) {
          await redis.del(key);
        }
      }
    }

    return res.status(200).json({ ok: true, message: "All game data cleared" });
  } catch (err) {
    console.error("[reset.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
