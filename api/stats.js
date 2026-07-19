import { getRedisClient } from "./_lib/redis.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const redis = getRedisClient();

    // Count players by scanning for player:*:name keys
    // This is approximate but good enough for real-time stats
    const keys = await redis.keys("player:*:name");
    const playerCount = keys ? keys.length : 0;

    // Count resumes in voting pool
    const jobTitles = await redis.smembers("resumes:allJobTitles");
    const resumeCount = jobTitles ? jobTitles.length * 2 : 0; // 2 per job title (human + ai)

    return res.status(200).json({
      playerCount,
      resumeCount,
    });
  } catch (err) {
    console.error("[stats.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
