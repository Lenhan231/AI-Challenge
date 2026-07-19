import { getRedisClient } from "../_lib/redis.js";
import { JOB_TITLES } from "../_lib/jobTitles.js";

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
    const { playerId } = req.body;
    if (!playerId) {
      return res.status(400).json({ error: "playerId required" });
    }

    const redis = getRedisClient();

    // Check if already assigned
    const existing = await redis.get(`player:${playerId}:jobTitle`);
    if (existing) {
      return res.status(200).json({ jobTitle: existing });
    }

    // Atomic INCR to get next pool index
    const index = await redis.incr("jobs:nextIndex");
    const jobTitle = JOB_TITLES[(index - 1) % JOB_TITLES.length];

    // Try to claim this job title with HSETNX (only first player to write for this job wins)
    // This ensures 1 human + 1 AI resume per job title, avoiding overwrites
    const claimed = await redis.hsetnx(
      `resume:${jobTitle}:claimed`,
      "owner",
      playerId
    );

    if (!claimed) {
      // Job title already claimed by someone else, try next one
      // Recursively assign next index
      const nextIndex = (index % JOB_TITLES.length) + 1;
      const nextJobTitle = JOB_TITLES[(nextIndex - 1) % JOB_TITLES.length];
      const nextClaimed = await redis.hsetnx(
        `resume:${nextJobTitle}:claimed`,
        "owner",
        playerId
      );

      if (!nextClaimed) {
        // If next also taken, fall back to index-based cycling
        // For simplicity in 30-player limit, just use the original index
        // (pool size is 40, so most players should get unique slots)
        await redis.set(`player:${playerId}:jobTitle`, jobTitle);
        return res.status(200).json({ jobTitle });
      }

      await redis.set(`player:${playerId}:jobTitle`, nextJobTitle);
      return res.status(200).json({ jobTitle: nextJobTitle });
    }

    await redis.set(`player:${playerId}:jobTitle`, jobTitle);
    return res.status(200).json({ jobTitle });
  } catch (err) {
    console.error("[resume/assign.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
