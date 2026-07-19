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

  if (req.method === "GET") {
    // Get current phase
    try {
      const redis = getRedisClient();
      const phase = await redis.get("game:phase") || "writing";
      return res.status(200).json({ phase });
    } catch (err) {
      console.error("[phase.js GET]", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "POST") {
    // Set phase (host only)
    try {
      const { phase } = req.body;
      if (!["writing", "voting", "results"].includes(phase)) {
        return res.status(400).json({ error: "Invalid phase" });
      }

      const redis = getRedisClient();
      await redis.set("game:phase", phase);
      return res.status(200).json({ ok: true, phase });
    } catch (err) {
      console.error("[phase.js POST]", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  res.writeHead(405);
  res.end("Method not allowed");
}
