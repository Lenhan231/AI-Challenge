import { getRedisClient } from "../_lib/redis.js";
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
    const { playerId, jobTitle, text } = req.body;
    if (!playerId || !jobTitle || !text) {
      return res
        .status(400)
        .json({ error: "playerId, jobTitle, text required" });
    }

    const redis = getRedisClient();

    // Check if already submitted (idempotency)
    const alreadySubmitted = await redis.get(
      `player:${playerId}:submitted`
    );
    if (alreadySubmitted) {
      return res.status(200).json({
        ok: true,
        message: "Resume already submitted",
      });
    }

    // Store human resume
    const now = Date.now();
    const playerName = (await redis.get(`player:${playerId}:name`)) || playerId;

    await redis.hset(`resume:${jobTitle}:human`, {
      playerId,
      playerName,
      text,
      submittedAt: now.toString(),
    });

    // Mark as submitted
    await redis.set(`player:${playerId}:submitted`, "1");

    // Try to generate AI resume (only first success wins the lock)
    const aiLocked = await redis.hsetnx(
      `resume:${jobTitle}:ai:lock`,
      "generatedAt",
      now.toString()
    );

    if (aiLocked) {
      // This player won the lock; generate AI resume
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        // Fallback if key missing
        await redis.hset(`resume:${jobTitle}:ai`, {
          text: "[Lỗi: API key không cấu hình]",
          generatedAt: now.toString(),
          fallback: "1",
        });
      } else {
        const aiResult = await generateAIResume(jobTitle, geminiKey);
        await redis.hset(`resume:${jobTitle}:ai`, {
          text: aiResult.text,
          generatedAt: now.toString(),
          fallback: aiResult.fallback ? "1" : "0",
        });
      }

      // Mark job title as ready for voting
      await redis.sadd("resumes:allJobTitles", jobTitle);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[resume/submit.js]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
