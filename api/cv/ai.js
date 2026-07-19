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

    // Get all AI resume IDs
    const aiIndices = await redis.smembers("resumes:ai");
    const resumes = [];

    if (aiIndices) {
      for (const index of aiIndices) {
        const cvData = await redis.hgetall(`resume:ai:${index}`);
        if (cvData) {
          const resumeId = `ai:${index}`;
          const hireCount = await redis.get(`votes:${resumeId}:hire`) || "0";
          const rejectCount = await redis.get(`votes:${resumeId}:reject`) || "0";
          const totalVotes = parseInt(hireCount) + parseInt(rejectCount);
          resumes.push({ id: index, ...cvData, hireCount, rejectCount, totalVotes });
        }
      }
    }

    return res.status(200).json({ resumes });
  } catch (err) {
    console.error("[cv/ai.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
