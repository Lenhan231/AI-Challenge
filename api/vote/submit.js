import { getRedisClient } from "../_lib/redis.js";

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
    const { playerId, resumeId, decision } = req.body;

    if (!playerId || !resumeId || !decision) {
      return res.status(400).json({ error: "playerId, resumeId, decision required" });
    }

    if (!["hire", "reject"].includes(decision)) {
      return res.status(400).json({ error: "decision must be hire or reject" });
    }

    const redis = getRedisClient();

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
    const [type, id] = resumeId.split(":");
    const isAI = type === "ai";
    const decisionKey = decision === "hire" ? "Hire" : "Reject";

    await redis.incr(`votes:global:${type}${decisionKey}`);
    await redis.incr(`votes:${resumeId}:${decision}`);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[vote/submit.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
