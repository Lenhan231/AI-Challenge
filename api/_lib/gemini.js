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

export async function generateAIResume(jobTitle, apiKey, isQualityVariation = false) {
  if (!apiKey) {
    console.warn("[AI] API key not provided, using fallback");
    return { text: FALLBACK_RESUME, fallback: true };
  }

  // Alternate between high-quality and lower-quality resumes
  const qualityPrompt = isQualityVariation
    ? `Viết một bản CV/Resume tiếng Việt cho vị trí "${jobTitle}" với chất lượng trung bình (150-200 từ).
Format:
- Tiêu đề: Tên vị trí
- Thông tin cá nhân (3-4 dòng)
- Kinh nghiệm (2 items)
- Điểm mạnh (2-3 items)

Viết realistic nhưng không quá chi tiết, có thể thiếu một số thông tin chuyên môn cụ thể.`
    : `Viết một bản CV/Resume tiếng Việt ngắn gọn (150-200 từ) cho vị trí "${jobTitle}".
Format:
- Tiêu đề: Tên vị trí
- Thông tin cá nhân (3-4 dòng)
- Kinh nghiệm (2-3 items)
- Điểm mạnh (3 items)

Hãy viết professional, chi tiết, không quá dài. Không thêm ghi chú hay phần cấu trúc.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    console.log(`[AI] Requesting via Groq: ${jobTitle} (quality: ${isQualityVariation ? "medium" : "high"})`);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768", // Groq's fast model
        messages: [
          {
            role: "user",
            content: qualityPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[AI] API error ${response.status}: ${errorText.substring(0, 200)}`
      );
      return { text: FALLBACK_RESUME, fallback: true };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      console.warn("[AI] Empty response, fallback to generic resume");
      return { text: FALLBACK_RESUME, fallback: true };
    }

    console.log(`[AI] ✅ Generated resume for ${jobTitle}`);
    return { text, fallback: false };
  } catch (err) {
    console.error(`[AI] Error: ${err.message}`);
    return { text: FALLBACK_RESUME, fallback: true };
  }
}
