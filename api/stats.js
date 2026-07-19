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

    // Count players
    const playerKeys = await redis.keys("player:*:name");
    const playerCount = playerKeys ? playerKeys.length : 0;

    // Count human and AI resumes
    const humanResumes = await redis.smembers("resumes:human");
    const aiResumes = await redis.smembers("resumes:ai");
    const humanCount = humanResumes ? humanResumes.length : 0;
    const aiCount = aiResumes ? aiResumes.length : 0;
    const totalResumes = humanCount + aiCount;

    return res.status(200).json({
      playerCount,
      humanCount,
      aiCount,
      totalResumes,
    });
  } catch (err) {
    console.error("[stats.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
