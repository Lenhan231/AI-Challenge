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
  // Alternate between high-quality and lower-quality resumes to add realism
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

  const prompt = qualityPrompt;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[Gemini] API error: ${response.status}, fallback to generic resume`
      );
      return { text: FALLBACK_RESUME, fallback: true };
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

    if (!text.trim()) {
      console.warn("[Gemini] Empty response, fallback to generic resume");
      return { text: FALLBACK_RESUME, fallback: true };
    }

    return { text: text.trim(), fallback: false };
  } catch (err) {
    console.error(
      `[Gemini] Error: ${err.message}, fallback to generic resume`
    );
    return { text: FALLBACK_RESUME, fallback: true };
  }
}
