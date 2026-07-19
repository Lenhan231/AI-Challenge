import { getRedisClient } from "../_lib/redis.js";

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

    // Get all human resume IDs
    const playerIds = await redis.smembers("resumes:human");
    const resumes = [];

    if (playerIds) {
      for (const playerId of playerIds) {
        const cvData = await redis.hgetall(`resume:human:${playerId}`);
        if (cvData) {
          resumes.push({ playerId, ...cvData });
        }
      }
    }

    return res.status(200).json({ resumes });
  } catch (err) {
    console.error("[cv/human.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
