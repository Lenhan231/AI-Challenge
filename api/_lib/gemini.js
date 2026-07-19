const FALLBACK_RESUMES = [
  `Kinh nghiệm:
- Làm việc 3-4 năm tại nhà máy may
- Khâu may áo thun, đồng phục
- Thành thạo máy may công nghiệp

Kỹ năng:
- Cẩn thận, tỉ mỉ trong công việc
- Chịu áp lực tốt
- Hợp tác hiệu quả với đồng đội`,
  `Kinh nghiệm:
- 5 năm may công sở và đồng phục
- Thành thạo máy may Juki, Brother
- Cắt may, đo vải chính xác

Kỹ năng:
- Kiên nhẫn, tỉ mỉ
- Luôn hoàn thành đúng hạn
- Giao tiếp tốt với quản lý`,
  `2 năm làm việc tại xưởng may chuyên may khâu đặc biệt. Thêu tay, cắt vải, may áo công sở. Máy may công nghiệp thành thạo. Chịu áp lực, hợp tác tốt, chú ý chất lượng.`,
  `Kinh nghiệm may áo 4 năm, may quần áo nữ, vest, đồng phục. Kỹ năng đa dạng vải cotton, lụa, vải dệt. Máy may công nghiệp thành thạo. Cẩn thận, giao tiếp tốt.`
];

export async function generateAIResume(jobTitle, geminiKey, isQualityVariation = false, seed = 0) {
  if (!geminiKey) {
    console.warn("[AI] No API key provided, using fallback");
    return { text: FALLBACK_RESUME, fallback: true };
  }

  const groqKey = process.env.GROQ_API_KEY;

  // Add diversity: different specialties to avoid duplicate resumes
  const specialties = ["cắt may", "khâu đặc biệt", "kiểm chất lượng", "may áo công sở", "may thêu"];
  const specialty = specialties[seed % specialties.length];

  // Simulate a human resume written in ~2 minutes - skills & traits only, NO personal info, plain text
  const qualityPrompt = isQualityVariation
    ? `Viết CV rất ngắn tiếng Việt cho "${jobTitle}" chuyên ${specialty} (40-60 từ). Plain text, KHÔNG markdown.
Không có: tên, sinh năm, địa chỉ, điện thoại.
Chỉ: kinh nghiệm, kỹ năng, tính cách. Không dùng **, đầu dòng hay format.`
    : `Viết CV ngắn tiếng Việt cho "${jobTitle}" chuyên ${specialty} (60-80 từ). Plain text, KHÔNG markdown hoặc ** hoặc -.
Chỉ viết: kinh nghiệm, kỹ năng, điểm mạnh. Không có thông tin cá nhân.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    console.log(`[Gemini] Requesting: ${jobTitle} (quality: ${isQualityVariation ? "medium" : "high"})`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: qualityPrompt }] }],
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Gemini] API error ${response.status}, trying Groq fallback...`
      );

      // Try Groq as fallback
      if (groqKey) {
        console.log(`[Groq] Attempting fallback...`);
        const specialties = ["cắt may", "khâu đặc biệt", "kiểm chất lượng", "may áo công sở", "may thêu"];
        const specialty = specialties[seed % specialties.length];
        const groqResume = await generateViaGroq(jobTitle, groqKey, isQualityVariation, specialty);
        if (!groqResume.fallback) {
          return groqResume;
        }
      }

      const fallback = FALLBACK_RESUMES[Math.floor(Math.random() * FALLBACK_RESUMES.length)];
      return { text: fallback, fallback: true };
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

    if (!text.trim()) {
      console.warn("[Gemini] Empty response, fallback to generic resume");
      const fallback = FALLBACK_RESUMES[Math.floor(Math.random() * FALLBACK_RESUMES.length)];
      return { text: fallback, fallback: true };
    }

    console.log(`[Gemini] ✅ Generated resume for ${jobTitle}`);
    return { text: text.trim(), fallback: false };
  } catch (err) {
    console.error(`[Gemini] Error: ${err.message}, trying Groq fallback...`);

    // Try Groq as fallback
    if (groqKey) {
      console.log(`[Groq] Attempting fallback...`);
      const specialties = ["cắt may", "khâu đặc biệt", "kiểm chất lượng", "may áo công sở", "may thêu"];
      const specialty = specialties[seed % specialties.length];
      const groqResume = await generateViaGroq(jobTitle, groqKey, isQualityVariation, specialty);
      if (!groqResume.fallback) {
        return groqResume;
      }
    }

    return { text: FALLBACK_RESUME, fallback: true };
  }
}

async function generateViaGroq(jobTitle, groqKey, isQualityVariation, specialty = "chung chung") {
  const qualityPrompt = isQualityVariation
    ? `Viết CV plain text cho "${jobTitle}" chuyên ${specialty} (40-60 từ). Không **, không -, không markdown. Chỉ: kinh nghiệm, kỹ năng, tính cách.`
    : `Viết CV plain text cho "${jobTitle}" chuyên ${specialty} (60-80 từ). Không **, không -, không markdown. Chỉ: kinh nghiệm, kỹ năng, điểm mạnh.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: qualityPrompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Groq] Failed, using fallback`);
      const fallback = FALLBACK_RESUMES[Math.floor(Math.random() * FALLBACK_RESUMES.length)];
      return { text: fallback, fallback: true };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      const fallback = FALLBACK_RESUMES[Math.floor(Math.random() * FALLBACK_RESUMES.length)];
      return { text: fallback, fallback: true };
    }

    console.log(`[Groq] ✅ Generated resume for ${jobTitle}`);
    return { text, fallback: false };
  } catch (err) {
    console.error(`[Groq] Error: ${err.message}`);
    return { text: FALLBACK_RESUME, fallback: true };
  }
}
