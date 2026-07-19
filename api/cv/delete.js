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
    const { type, id } = req.body; // type: 'human' or 'ai', id: playerId or index

    if (!type || !id) {
      return res.status(400).json({ error: "type and id required" });
    }

    const redis = getRedisClient();

    if (type === "human") {
      // Delete human resume
      await redis.del(`resume:human:${id}`);
      await redis.srem("resumes:human", id);
    } else if (type === "ai") {
      // Delete AI resume
      await redis.del(`resume:ai:${id}`);
      await redis.srem("resumes:ai", id);
    } else {
      return res.status(400).json({ error: "type must be 'human' or 'ai'" });
    }

    return res.status(200).json({ ok: true, message: `Deleted ${type} resume` });
  } catch (err) {
    console.error("[cv/delete.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
