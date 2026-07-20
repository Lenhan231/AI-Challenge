import { getRedisClient } from "./_lib/redis.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const redis = getRedisClient();

  if (req.method === "GET") {
    // Get all resumes (human + AI)
    try {
      const playerIds = await redis.smembers("resumes:human");
      const aiIndices = await redis.smembers("resumes:ai");

      const human = [];
      if (playerIds) {
        for (const playerId of playerIds) {
          const cvData = await redis.hgetall(`resume:human:${playerId}`);
          if (cvData) {
            const resumeId = `human:${playerId}`;
            const hireCount = await redis.get(`votes:${resumeId}:hire`) || "0";
            const rejectCount = await redis.get(`votes:${resumeId}:reject`) || "0";
            const totalVotes = parseInt(hireCount) + parseInt(rejectCount);
            human.push({ playerId, ...cvData, hire: hireCount, reject: rejectCount, totalVotes });
          }
        }
      }

      const ai = [];
      if (aiIndices) {
        for (const index of aiIndices) {
          const cvData = await redis.hgetall(`resume:ai:${index}`);
          if (cvData) {
            const resumeId = `ai:${index}`;
            const hireCount = await redis.get(`votes:${resumeId}:hire`) || "0";
            const rejectCount = await redis.get(`votes:${resumeId}:reject`) || "0";
            const totalVotes = parseInt(hireCount) + parseInt(rejectCount);
            ai.push({ id: index, ...cvData, hire: hireCount, reject: rejectCount, totalVotes });
          }
        }
      }

      return res.status(200).json({ human, ai });
    } catch (err) {
      console.error("[cv.js GET]", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "POST") {
    // Delete resume
    try {
      const { type, id } = req.body;

      if (!type || !id) {
        return res.status(400).json({ error: "type and id required" });
      }

      if (type === "human") {
        await redis.del(`resume:human:${id}`);
        await redis.srem("resumes:human", id);
      } else if (type === "ai") {
        await redis.del(`resume:ai:${id}`);
        await redis.srem("resumes:ai", id);
      } else {
        return res.status(400).json({ error: "type must be 'human' or 'ai'" });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[cv.js POST]", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  res.writeHead(405);
  res.end("Method not allowed");
}
