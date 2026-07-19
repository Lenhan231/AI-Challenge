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
      // First time: build queue
      const jobTitles = await redis.smembers("resumes:allJobTitles");
      if (!jobTitles || jobTitles.length === 0) {
        return res.status(200).json({
          done: true,
          message: "No resumes available yet",
        });
      }

      // Expand to [jobTitle::human, jobTitle::ai] pairs and shuffle
      let allResumes = [];
      for (const jobTitle of jobTitles) {
        allResumes.push(`${jobTitle}::human`);
        allResumes.push(`${jobTitle}::ai`);
      }

      // Shuffle using a seed based on playerId (reproducible per player)
      const seed = playerId
        .split("")
        .reduce((s, c) => s + c.charCodeAt(0), 0);
      allResumes = shuffleWithSeed(allResumes, seed);

      // Remove player's own resume
      const playerJobTitle = await redis.get(`player:${playerId}:jobTitle`);
      if (playerJobTitle) {
        allResumes = allResumes.filter(
          (r) => r !== `${playerJobTitle}::human`
        );
      }

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
    const [jobTitle, type] = resumeId.split("::");

    // Check if already voted on this
    const seen = await redis.sismember(`vote:${playerId}:seen`, resumeId);
    if (seen) {
      // Skip and fetch next
      await redis.lpop(`vote:${playerId}:queue`);
      return handler(req, res); // Recursive call to get next unvoted
    }

    // Fetch resume text
    const resumeData = await redis.hgetall(
      `resume:${jobTitle}:${type}`
    );

    return res.status(200).json({
      done: false,
      resumeId,
      jobTitle,
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
