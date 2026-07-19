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
    // Get next resume to vote on
    try {
      const url = new URL(req.url, `http://localhost`);
      const playerId = url.searchParams.get("playerId");

      if (!playerId) {
        return res.status(400).json({ error: "playerId required" });
      }

      // Build queue for this player (first time)
      let queue = await redis.lrange(`vote:${playerId}:queue`, 0, -1);

      if (!queue || queue.length === 0) {
        // First time - create shuffled queue
        const humanIds = await redis.smembers("resumes:human");
        const aiIds = await redis.smembers("resumes:ai");

        const allIds = [];
        if (humanIds) {
          humanIds.forEach(id => allIds.push(`human:${id}`));
        }
        if (aiIds) {
          aiIds.forEach(id => allIds.push(`ai:${id}`));
        }

        // Shuffle with seeded random (per playerId)
        const seed = playerId.charCodeAt(0);
        allIds.sort(() => (Math.sin(seed++) - 0.5) * 1.5);

        // Remove player's own resume
        const ownResumeId = `human:${playerId}`;
        const filteredIds = allIds.filter(id => id !== ownResumeId);

        // Push to queue
        if (filteredIds.length > 0) {
          await redis.rpush(`vote:${playerId}:queue`, ...filteredIds);
        }
        queue = filteredIds;
      }

      // Get next unvoted resume
      let resumeId;
      while (queue.length > 0) {
        resumeId = queue.shift();
        const seen = await redis.sismember(`vote:${playerId}:seen`, resumeId);
        if (!seen) break;
      }

      if (!resumeId) {
        return res.status(200).json({ done: true });
      }

      // Get resume text
      const [type, id] = resumeId.split(":");
      const cvData = await redis.hgetall(
        type === "human" ? `resume:human:${id}` : `resume:ai:${id}`
      );

      if (!cvData || !cvData.text) {
        return res.status(404).json({ error: "Resume not found" });
      }

      return res.status(200).json({
        resumeId,
        text: cvData.text,
        done: false,
      });
    } catch (err) {
      console.error("[vote.js GET]", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "POST") {
    // Submit vote
    try {
      const { playerId, resumeId, decision } = req.body;

      if (!playerId || !resumeId || !decision) {
        return res.status(400).json({ error: "playerId, resumeId, decision required" });
      }

      if (!["hire", "reject"].includes(decision)) {
        return res.status(400).json({ error: "decision must be hire or reject" });
      }

      // Check if already voted
      const alreadyVoted = await redis.sismember(`vote:${playerId}:seen`, resumeId);
      if (alreadyVoted) {
        return res.status(409).json({ error: "Already voted on this resume" });
      }

      // Mark as voted
      await redis.sadd(`vote:${playerId}:seen`, resumeId);

      // Remove from queue
      await redis.lpop(`vote:${playerId}:queue`);

      // Increment counters
      const [type] = resumeId.split(":");
      const decisionKey = decision === "hire" ? "Hire" : "Reject";

      await redis.incr(`votes:global:${type}${decisionKey}`);
      await redis.incr(`votes:${resumeId}:${decision}`);

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[vote.js POST]", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  res.writeHead(405);
  res.end("Method not allowed");
}
