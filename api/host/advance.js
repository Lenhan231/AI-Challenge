import { getRedisClient } from "../_lib/redis.js";

const PHASE_DURATIONS = {
  writing: 2 * 60 * 1000, // 2 minutes
  voting: 8 * 60 * 1000, // 8 minutes
  results: 10 * 60 * 1000, // 10 minutes for results display
};

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
    const { toPhase, durationSec } = req.body;

    if (!toPhase) {
      return res.status(400).json({ error: "toPhase required" });
    }

    if (!["writing", "voting", "results"].includes(toPhase)) {
      return res
        .status(400)
        .json({
          error: "toPhase must be writing, voting, or results",
        });
    }

    const redis = getRedisClient();
    const now = Date.now();
    const duration =
      (durationSec ? durationSec * 1000 : PHASE_DURATIONS[toPhase]) || 0;
    const deadline = now + duration;

    await redis.set("game:phase", toPhase);
    await redis.set("game:phaseDeadline", deadline.toString());
    await redis.set("game:phaseStartedAt", now.toString());

    return res.status(200).json({
      ok: true,
      phase: toPhase,
      deadline,
      durationMs: duration,
    });
  } catch (err) {
    console.error("[host/advance.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
