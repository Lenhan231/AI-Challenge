const FALLBACK_RESUME = `CV - Ứng Viên Không Tên

THÔNG TIN CÁ NHÂN
- Kỹ năng chuyên môn cơ bản
- Kinh nghiệm làm việc được yêu cầu
- Tham vọng phát triển sự nghiệp

KINH NGHIỆM LÀM VIỆC
- Làm việc với các công nghệ hiện đại
- Hợp tác trong môi trường đa văn hóa
- Hoàn thành các dự án theo đúng hạn chót

ĐIỂM MẠNH
- Khả năng học hỏi nhanh
- Chịu áp lực công việc tốt
- Giao tiếp hiệu quả với đồng đội`;

export async function generateAIResume(jobTitle, geminiKey) {
  const prompt = `Viết một bản CV/Resume tiếng Việt ngắn gọn (150-200 từ) cho vị trí "${jobTitle}".
Format:
- Tiêu đề: Tên vị trí
- Thông tin cá nhân (3-4 dòng)
- Kinh nghiệm (2-3 items)
- Điểm mạnh (3 items)

Hãy viết realistic, professional, không quá dài. Không thêm ghi chú hay phần cấu trúc.`;

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
