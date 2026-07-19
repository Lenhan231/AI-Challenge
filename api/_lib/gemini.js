const FALLBACK_RESUME = `CV - Ứng Viên Nhân Viên May

THÔNG TIN CÁ NHÂN
- Kỹ năng may vá cơ bản
- Kinh nghiệm làm việc được yêu cầu
- Tham vọng phát triển sự nghiệp

KINH NGHIỆM LÀM VIỆC
- Làm việc với các loại vải khác nhau
- Hợp tác trong môi trường xưởng may
- Hoàn thành các đơn hàng đúng hạn chót

ĐIỂM MẠNH
- Khả năng may vá tỉ mỉ
- Chịu áp lực công việc tốt
- Giao tiếp hiệu quả với đồng đội`;

export async function generateAIResume(jobTitle, geminiKey, isQualityVariation = false) {
  if (!geminiKey) {
    console.warn("[AI] No API key provided, using fallback");
    return { text: FALLBACK_RESUME, fallback: true };
  }

  const groqKey = process.env.GROQ_API_KEY;

  // Simulate a human resume written in ~2 minutes - skills & traits only, NO personal info, plain text
  const qualityPrompt = isQualityVariation
    ? `Viết CV rất ngắn tiếng Việt cho "${jobTitle}" (40-60 từ). Plain text, KHÔNG markdown.
Không có: tên, sinh năm, địa chỉ, điện thoại.
Chỉ: kinh nghiệm, kỹ năng, tính cách. Không dùng **, đầu dòng hay format.`
    : `Viết CV ngắn tiếng Việt cho "${jobTitle}" (60-80 từ). Plain text, KHÔNG markdown hoặc ** hoặc -.
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
        const groqResume = await generateViaGroq(jobTitle, groqKey, isQualityVariation);
        if (!groqResume.fallback) {
          return groqResume;
        }
      }

      return { text: FALLBACK_RESUME, fallback: true };
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

    if (!text.trim()) {
      console.warn("[Gemini] Empty response, fallback to generic resume");
      return { text: FALLBACK_RESUME, fallback: true };
    }

    console.log(`[Gemini] ✅ Generated resume for ${jobTitle}`);
    return { text: text.trim(), fallback: false };
  } catch (err) {
    console.error(`[Gemini] Error: ${err.message}, trying Groq fallback...`);

    // Try Groq as fallback
    if (groqKey) {
      console.log(`[Groq] Attempting fallback...`);
      const groqResume = await generateViaGroq(jobTitle, groqKey, isQualityVariation);
      if (!groqResume.fallback) {
        return groqResume;
      }
    }

    return { text: FALLBACK_RESUME, fallback: true };
  }
}

async function generateViaGroq(jobTitle, groqKey, isQualityVariation) {
  const qualityPrompt = isQualityVariation
    ? `Viết CV plain text cho "${jobTitle}" (40-60 từ). Không **, không -, không markdown. Chỉ: kinh nghiệm, kỹ năng, tính cách.`
    : `Viết CV plain text cho "${jobTitle}" (60-80 từ). Không **, không -, không markdown. Chỉ: kinh nghiệm, kỹ năng, điểm mạnh.`;

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
      return { text: FALLBACK_RESUME, fallback: true };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      return { text: FALLBACK_RESUME, fallback: true };
    }

    console.log(`[Groq] ✅ Generated resume for ${jobTitle}`);
    return { text, fallback: false };
  } catch (err) {
    console.error(`[Groq] Error: ${err.message}`);
    return { text: FALLBACK_RESUME, fallback: true };
  }
}
