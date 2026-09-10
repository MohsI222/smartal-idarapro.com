function normalizeKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const GEMINI_IMAGE_MODELS = [
  "imagen-3.0-generate-001",
  "imagen-3.0-generate-001:generate-image",
  "gemini-2.0-flash-exp",
] as const;

export function resolveGeminiImageApiKey(
  userApiKey: string | null | undefined,
  systemApiKey: string | null | undefined
): string | null {
  return normalizeKey(userApiKey) ?? normalizeKey(systemApiKey);
}

export function getPreferredGeminiImageModels(): readonly string[] {
  return GEMINI_IMAGE_MODELS;
}

export function shouldFallbackToOpenAiImageGeneration(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String(error ?? "");

  const normalized = message.toLowerCase();
  return Boolean(
    normalized.includes("not found") ||
      normalized.includes("404") ||
      normalized.includes("unsupported") ||
      normalized.includes("model") ||
      normalized.includes("quota") ||
      normalized.includes("429") ||
      normalized.includes("permission") ||
      normalized.includes("apikey") ||
      normalized.includes("api key") ||
      normalized.includes("internal") ||
      normalized.includes("deadline") ||
      normalized.includes("timeout") ||
      normalized.includes("overloaded") ||
      normalized.includes("unavailable") ||
      normalized.includes("500") ||
      normalized.includes("503")
  );
}

type GeminiCandidatePart = {
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
  inline_data?: {
    data?: string;
    mime_type?: string;
  };
  text?: string;
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiCandidatePart[];
  };
};

type GeminiImageResponse = {
  candidates?: GeminiCandidate[];
};

export function extractGeminiInlineImageData(payload: GeminiImageResponse | null | undefined): string | null {
  const candidates = payload?.candidates ?? [];

  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      const mimeType = (
        part.inlineData?.mimeType ??
        part.inline_data?.mime_type ??
        ""
      ).toLowerCase();
      const data = (
        part.inlineData?.data ??
        part.inline_data?.data ??
        ""
      ).trim();
      if (data && mimeType.startsWith("image/")) {
        return data;
      }
    }
  }

  return null;
}

export async function generateGeminiImageViaRest(
  apiKey: string,
  modelName: string,
  prompt: string
): Promise<GeminiImageResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  const json = (await response.json().catch(() => ({}))) as GeminiImageResponse & {
    error?: { message?: string; code?: number; status?: string };
  };

  if (!response.ok) {
    const details = json.error?.message || json.error?.status || `gemini_image_http_${response.status}`;
    throw new Error(details);
  }

  return json;
}
