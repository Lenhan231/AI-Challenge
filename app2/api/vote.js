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
        // First time - select 4 random AI + 4 random human resumes
        const humanIds = await redis.smembers("resumes:human") || [];
        const aiIds = await redis.smembers("resumes:ai") || [];

        // Remove player's own resume
        const filteredHumanIds = humanIds.filter(id => id !== playerId);
        const filteredAiIds = aiIds;

        // Shuffle helper with seeded random
        const seededShuffle = (arr, seed) => {
          const shuffled = [...arr];
          let s = seed;
          for (let i = shuffled.length - 1; i > 0; i--) {
            s = (s * 9301 + 49297) % 233280; // Linear congruential generator
            const j = Math.abs(s) % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        };

        // Pick 4 random human resumes
        const humanSeed = playerId.charCodeAt(0) * 1000;
        const shuffledHuman = seededShuffle(filteredHumanIds, humanSeed);
        const selected4Human = shuffledHuman.slice(0, 4);

        // Pick 4 random AI resumes
        const aiSeed = (playerId.charCodeAt(1) || 1) * 2000;
        const shuffledAi = seededShuffle(filteredAiIds, aiSeed);
        const selected4Ai = shuffledAi.slice(0, 4);

        // Combine: 4 human + 4 AI
        const combined8 = [];
        selected4Human.forEach(id => combined8.push(`human:${id}`));
        selected4Ai.forEach(id => combined8.push(`ai:${id}`));

        // Final shuffle of all 8
        const finalSeed = (playerId.charCodeAt(2) || 2) * 3000;
        const shuffledFinal = seededShuffle(combined8, finalSeed);

        // Push to queue
        if (shuffledFinal && shuffledFinal.length > 0) {
          await redis.rpush(`vote:${playerId}:queue`, ...shuffledFinal);
        }
        queue = shuffledFinal;
      }

      // Get voted count
      const votedCount = await redis.scard(`vote:${playerId}:seen`) || 0;

      // Check if player has voted on 8 resumes
      if (votedCount >= 8) {
        return res.status(200).json({ done: true, votedCount: 8, total: 8 });
      }

      // Get next unvoted resume from the fixed queue
      let resumeId;
      while (queue.length > 0) {
        resumeId = queue.shift();
        const seen = await redis.sismember(`vote:${playerId}:seen`, resumeId);
        if (!seen) break;
      }

      if (!resumeId) {
        return res.status(200).json({ done: true, votedCount, total: 8 });
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
        votedCount,
        total: 8,
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
