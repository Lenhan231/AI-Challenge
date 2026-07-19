import { getRedisClient } from "../_lib/redis.js";
import { GAME_JOB_TITLE } from "../_lib/jobTitles.js";
import { generateAIResume } from "../_lib/gemini.js";

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
    const { playerId, text } = req.body;
    if (!playerId || !text) {
      return res.status(400).json({ error: "playerId, text required" });
    }

    const redis = getRedisClient();

    // Check if already submitted
    const alreadySubmitted = await redis.get(`player:${playerId}:submitted`);
    if (alreadySubmitted) {
      return res.status(200).json({ ok: true, message: "Resume already submitted" });
    }

    // Store human resume
    const now = Date.now();
    const playerName = (await redis.get(`player:${playerId}:name`)) || playerId;

    await redis.hset(`resume:human:${playerId}`, {
      playerName,
      text,
      submittedAt: now.toString(),
    });

    // Add to human resumes set
    await redis.sadd("resumes:human", playerId);

    // Mark as submitted
    await redis.set(`player:${playerId}:submitted`, "1");

    // Generate 1-3 AI resumes (random)
    const aiCount = Math.floor(Math.random() * 3) + 1; // 1-3
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      console.warn("[resume/submit] GEMINI_API_KEY not set, skipping AI generation");
    } else {
      for (let i = 0; i < aiCount; i++) {
        // Try to generate AI resume
        try {
          const isQualityVariation = i % 2 === 1; // Alternate quality
          const aiResult = await generateAIResume(GAME_JOB_TITLE, geminiKey, isQualityVariation, i);

          // Store AI resume with unique index
          const aiIndex = await redis.incr("ai:resume:counter");
          await redis.hset(`resume:ai:${aiIndex}`, {
            text: aiResult.text,
            generatedAt: now.toString(),
            fallback: aiResult.fallback ? "1" : "0",
          });

          // Add to AI resumes set
          await redis.sadd("resumes:ai", aiIndex.toString());
        } catch (err) {
          console.error(`[resume/submit] Error generating AI resume ${i}:`, err.message);
        }
      }
    }

    return res.status(200).json({ ok: true, aiCount });
  } catch (err) {
    console.error("[resume/submit.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
