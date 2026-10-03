
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please ensure GEMINI_API_KEY is set in the environment.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Trích xuất văn bản thô từ tài liệu (OCR).
 */
export async function extractText(base64Data: string, mimeType: string): Promise<string> {
  const ai = getAI();
  const data = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

  const prompt = `Trích xuất toàn bộ văn bản từ ${mimeType === 'application/pdf' ? 'tài liệu PDF' : 'hình ảnh'} này một cách chính xác nhất. Chỉ trả về nội dung văn bản thô, không thêm lời giải thích hay định dạng khác.`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { mimeType, data } },
        { text: prompt }
      ],
    },
  });

  return response.text || "";
}

/**
 * Dịch văn bản sang ngôn ngữ đích.
 */
export async function translateText(text: string, targetLang: string): Promise<string> {
  const ai = getAI();
  
  const prompt = `Dịch văn bản sau đây sang ${targetLang}. Giữ nguyên cấu trúc xuống dòng nếu có. Không thêm bất kỳ lời bình luận nào khác.
  
  Văn bản cần dịch:
  ${text}`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text || "";
}
