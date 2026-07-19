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

  // Simulate a human resume written in ~2 minutes
  const qualityPrompt = isQualityVariation
    ? `Viết một bản CV/Resume tiếng Việt cho vị trí "${jobTitle}" như thể một người viết nhanh trong 2 phút (80-120 từ).
Format đơn giản:
- Tên & thông tin cơ bản (1-2 dòng)
- Kinh nghiệm (1-2 dòng)
- Điểm mạnh (1 dòng)

Viết ngắn gọn, thiếu một số chi tiết, không quá formal nhưng vẫn có lý.`
    : `Viết một bản CV/Resume tiếng Việt cho vị trí "${jobTitle}" như thể một người viết cẩn thận trong 2 phút (100-150 từ).
Format:
- Tên, ngày sinh, liên hệ (2-3 dòng)
- Kinh nghiệm chính (2-3 dòng)
- Điểm mạnh (2 dòng)

Viết professional nhưng simple, chỉ đủ thông tin cần thiết.`;

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
    ? `Viết một bản CV/Resume tiếng Việt cho vị trí "${jobTitle}" như thể một người viết nhanh trong 2 phút (80-120 từ). Viết ngắn gọn, thiếu chi tiết nhưng vẫn có lý.`
    : `Viết một bản CV/Resume tiếng Việt cho vị trí "${jobTitle}" như thể một người viết cẩn thận trong 2 phút (100-150 từ). Viết professional nhưng simple.`;

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
