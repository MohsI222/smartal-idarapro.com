import { api } from "@/lib/api";

/** يضمن أن الخادم يستقبل قيمًا نصية صالحة (تفادي undefined/أرقام تكسر التحقق أو الـ prompt). */
export function stringifyAiContext(ctx: Record<string, string | number | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx)) {
    out[k] = v === undefined || v === null ? "" : String(v);
  }
  return out;
}

export async function requestAiGenerate(
  token: string | null,
  module: string,
  locale: string,
  context: Record<string, string | number | undefined | null>
): Promise<string> {
  const r = await api<{ text: string }>("/ai/generate", {
    method: "POST",
    token,
    body: JSON.stringify({ module, locale, context: stringifyAiContext(context) }),
  });
  if (typeof r.text !== "string" || !r.text.trim()) {
    throw new Error("empty_ai_response");
  }
  return r.text.trim();
}
