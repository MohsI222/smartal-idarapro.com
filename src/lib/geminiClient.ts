import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";

export async function sendAiChatMessage(
  token: string | null,
  message: string,
  locale: string
): Promise<string> {
  const r = await api<{ reply: string }>("/ai/chat", {
    method: "POST",
    token,
    body: JSON.stringify({ message, locale }),
  });
  if (typeof r.reply !== "string" || !r.reply.trim()) {
    throw new Error("empty_ai_response");
  }
  return r.reply.trim();
}

export async function summarizeDocument(
  token: string | null,
  content: string,
  locale: string
): Promise<string> {
  const r = await api<{ summary: string }>("/ai/summarize", {
    method: "POST",
    token,
    body: JSON.stringify({ content, locale }),
  });
  if (typeof r.summary !== "string" || !r.summary.trim()) {
    throw new Error("empty_ai_response");
  }
  return r.summary.trim();
}

export async function performGeminiOcr(
  token: string | null,
  imageData: string,
  locale: string,
  documentType: "id_card" | "document" | "general" = "general"
): Promise<any> {
  const r = await api<{ extracted: any }>("/ai/ocr", {
    method: "POST",
    token,
    body: JSON.stringify({ imageData, locale, documentType }),
  });
  return r.extracted;
}

export async function generateImageWithGemini(
  token: string | null,
  prompt: string,
  locale: string
): Promise<string> {
  const r = await api<{ b64?: string; error?: string; description?: string }>("/ai/image", {
    method: "POST",
    token,
    body: JSON.stringify({ prompt, locale }),
  });
  
  if (r.error) {
    throw new Error(r.error);
  }
  
  if (r.b64) {
    return r.b64;
  }
  
  throw new Error("image_generation_failed");
}
