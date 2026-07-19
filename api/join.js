import { getRedisClient } from "./_lib/redis.js";

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
    const { playerId, name } = req.body;

    if (!playerId || !name) {
      return res
        .status(400)
        .json({ error: "playerId and name required" });
    }

    const redis = getRedisClient();

    // Check if MSSV already exists (dedup multiple refreshes)
    const existingPlayerId = await redis.get(`mssv:${name}`);
    let finalPlayerId = playerId;

    if (existingPlayerId) {
      // Use existing playerId for this MSSV
      finalPlayerId = existingPlayerId;
    } else {
      // New MSSV - create mapping
      await redis.set(`mssv:${name}`, playerId);
    }

    // Store player name
    await redis.set(`player:${finalPlayerId}:name`, name);

    return res.status(200).json({ playerId: finalPlayerId, name });
  } catch (err) {
    console.error("[join.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
