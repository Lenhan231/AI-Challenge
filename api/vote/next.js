import { getRedisClient } from "../_lib/redis.js";

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
    const { playerId } = req.query;
    if (!playerId) {
      return res.status(400).json({ error: "playerId query param required" });
    }

    const redis = getRedisClient();

    // Get or build voting queue for this player
    let queue = await redis.lrange(`vote:${playerId}:queue`, 0, -1);

    if (!queue || queue.length === 0) {
      // First time: build queue from human + AI resumes
      const humanIds = await redis.smembers("resumes:human");
      const aiIds = await redis.smembers("resumes:ai");

      if ((!humanIds || humanIds.length === 0) && (!aiIds || aiIds.length === 0)) {
        return res.status(200).json({
          done: true,
          message: "Chưa có resume nào. Chờ mọi người viết...",
        });
      }

      // Build list of all resumes
      let allResumes = [];
      if (humanIds) {
        allResumes = allResumes.concat(humanIds.map((id) => `human:${id}`));
      }
      if (aiIds) {
        allResumes = allResumes.concat(aiIds.map((id) => `ai:${id}`));
      }

      // Shuffle using seed based on playerId
      const seed = playerId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
      allResumes = shuffleWithSeed(allResumes, seed);

      // Remove player's own resume if exists
      allResumes = allResumes.filter((r) => r !== `human:${playerId}`);

      // Build queue in Redis
      if (allResumes.length > 0) {
        await redis.rpush(`vote:${playerId}:queue`, ...allResumes);
      }

      queue = allResumes;
    }

    // Get next card from queue
    if (!queue || queue.length === 0) {
      return res.status(200).json({
        done: true,
        message: "Hết bài rồi!",
      });
    }

    const resumeId = queue[0];
    const [type, id] = resumeId.split(":");

    // Check if already voted
    const seen = await redis.sismember(`vote:${playerId}:seen`, resumeId);
    if (seen) {
      // Skip and fetch next
      await redis.lpop(`vote:${playerId}:queue`);
      return handler(req, res); // Recursive
    }

    // Fetch resume text
    let resumeData;
    if (type === "human") {
      resumeData = await redis.hgetall(`resume:human:${id}`);
    } else {
      resumeData = await redis.hgetall(`resume:ai:${id}`);
    }

    return res.status(200).json({
      done: false,
      resumeId,
      text: resumeData?.text || "[Không tìm thấy dữ liệu resume]",
    });
  } catch (err) {
    console.error("[vote/next.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Simple seeded shuffle (Fisher-Yates)
function shuffleWithSeed(arr, seed) {
  const copy = [...arr];
  let random = seed;

  for (let i = copy.length - 1; i > 0; i--) {
    random = (random * 9301 + 49297) % 233280;
    const j = Math.floor((random / 233280) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}
