import { getRedisClient } from "./_lib/redis.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const redis = getRedisClient();

    // Fetch all vote counters
    const aiHire = parseInt(
      (await redis.get("votes:global:aiHire")) || "0"
    );
    const aiReject = parseInt(
      (await redis.get("votes:global:aiReject")) || "0"
    );
    const humanHire = parseInt(
      (await redis.get("votes:global:humanHire")) || "0"
    );
    const humanReject = parseInt(
      (await redis.get("votes:global:humanReject")) || "0"
    );

    const aiTotal = aiHire + aiReject;
    const humanTotal = humanHire + humanReject;

    const aiHireRate = aiTotal > 0 ? ((aiHire / aiTotal) * 100).toFixed(1) : 0;
    const humanHireRate =
      humanTotal > 0 ? ((humanHire / humanTotal) * 100).toFixed(1) : 0;

    const totalVotes = aiTotal + humanTotal;

    return res.status(200).json({
      aiHire,
      aiReject,
      aiTotal,
      aiHireRate: parseFloat(aiHireRate),
      humanHire,
      humanReject,
      humanTotal,
      humanHireRate: parseFloat(humanHireRate),
      totalVotes,
    });
  } catch (err) {
    console.error("[results.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
