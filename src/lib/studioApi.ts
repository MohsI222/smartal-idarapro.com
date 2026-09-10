import { api } from "@/lib/api";
import { generateImageWithGemini } from "@/lib/geminiClient";

export type StudioCapabilities = { textToImage: boolean; openAiKeyConfigured: boolean; geminiKeyConfigured: boolean };

export async function fetchStudioCapabilities(token: string | null): Promise<StudioCapabilities> {
  try {
    return await api<StudioCapabilities>("/studio/capabilities", { token });
  } catch {
    return { textToImage: false, openAiKeyConfigured: false, geminiKeyConfigured: false };
  }
}

export async function requestStudioTextToImage(
  token: string | null,
  prompt: string,
  size: "1024x1024" | "1792x1024" | "1024x1792",
  useGemini: boolean = true
): Promise<string> {
  if (useGemini) {
    try {
      return await generateImageWithGemini(token, prompt, "en-US");
    } catch (error) {
      // Fallback to OpenAI if Gemini fails
      console.warn("Gemini image generation failed, falling back to OpenAI:", error);
    }
  }
  
  const r = await api<{ b64: string }>("/studio/text-to-image", {
    method: "POST",
    token,
    body: JSON.stringify({ prompt, size }),
  });
  return r.b64;
}
