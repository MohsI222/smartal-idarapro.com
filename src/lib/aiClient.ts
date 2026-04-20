import { api } from "@/lib/api";

export async function requestAiGenerate(
  token: string | null,
  module: string,
  locale: string,
  context: Record<string, string>
): Promise<string> {
  const r = await api<{ text: string }>("/ai/generate", {
    method: "POST",
    token,
    body: JSON.stringify({ module, locale, context }),
  });
  return r.text;
}
