import { getRedisClient } from "./_lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const redis = getRedisClient();
    const phase = (await redis.get("game:phase")) || "lobby";
    const deadline = (await redis.get("game:phaseDeadline")) || null;
    const startedAt = (await redis.get("game:phaseStartedAt")) || null;

    return res.status(200).json({
      phase,
      deadline: deadline ? parseInt(deadline) : null,
      startedAt: startedAt ? parseInt(startedAt) : null,
    });
  } catch (err) {
    console.error("[phase.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
