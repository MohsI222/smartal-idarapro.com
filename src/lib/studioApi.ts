import { api } from "@/lib/api";

export type StudioCapabilities = { textToImage: boolean; openAiKeyConfigured: boolean };

export async function fetchStudioCapabilities(token: string | null): Promise<StudioCapabilities> {
  try {
    return await api<StudioCapabilities>("/studio/capabilities", { token });
  } catch {
    return { textToImage: false, openAiKeyConfigured: false };
  }
}

export async function requestStudioTextToImage(
  token: string | null,
  prompt: string,
  size: "1024x1024" | "1792x1024" | "1024x1792"
): Promise<string> {
  const r = await api<{ b64: string }>("/studio/text-to-image", {
    method: "POST",
    token,
    body: JSON.stringify({ prompt, size }),
  });
  return r.b64;
}
