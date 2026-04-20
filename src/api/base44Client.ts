const TOKEN_KEY = "idara_token";

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export type Base44InvokeResult = {
  data?: {
    status?: string;
    frames?: string[];
    video_url?: string;
    error?: string;
    details?: string;
    assembly_instructions?: string;
    engine?: string;
    duration_sec?: number;
    ratio?: string;
  };
  error?: string;
};

async function base44InvokeFunction(
  name: string,
  payload: Record<string, unknown>
): Promise<Base44InvokeResult> {
  const token = getToken();
  const res = await fetch(`/api/studio/base44/functions/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const raw = (await res.json().catch(() => ({}))) as Base44InvokeResult & { error?: string };
  if (!res.ok) {
    throw new Error(raw.error || raw.data?.error || `invoke_${res.status}`);
  }
  return raw;
}

export type Base44User = { role: string; email?: string; name?: string };

export const base44 = {
  auth: {
    me: async (): Promise<Base44User | null> => {
      const token = getToken();
      if (!token) return null;
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return null;
      const j = (await res.json()) as { user?: Base44User };
      return j.user ?? null;
    },
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }: { file: File }) => {
        const token = getToken();
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/studio/base44/upload", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        const j = (await res.json()) as { file_url?: string; error?: string };
        if (!res.ok || !j.file_url) throw new Error(j.error || "upload_failed");
        if (!j.file_url.startsWith("http") && !j.file_url.startsWith("/")) {
          throw new Error("invalid_file_url");
        }
        return { file_url: j.file_url };
      },
      GenerateImage: async (opts: { prompt: string; size?: string; existing_image_urls?: string[] }) => {
        const token = getToken();
        const res = await fetch("/api/studio/base44/generate-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(opts),
        });
        const j = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !j.url) throw new Error(j.error || "generate_failed");
        return { url: j.url };
      },
      InvokeLLM: async (opts: {
        prompt: string;
        file_urls?: string[];
        response_json_schema?: unknown;
      }): Promise<unknown> => {
        const token = getToken();
        const res = await fetch("/api/studio/base44/invoke-llm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(opts),
        });
        const j: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const err = (j as { error?: string } | null)?.error ?? "llm_failed";
          throw new Error(err);
        }
        return j;
      },
    },
  },
  functions: {
    invoke: base44InvokeFunction,
  },
  generateBuiltInVideo: async (payload: {
    image_url: string;
    prompt: string;
    ratio?: string;
    duration?: number;
    motion_score?: number;
  }): Promise<Base44InvokeResult> => {
    return base44InvokeFunction("generateBuiltInVideo", payload as Record<string, unknown>);
  },
};
