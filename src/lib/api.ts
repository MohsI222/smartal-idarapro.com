/**
 * API base for `fetch`. Same host → always `/api` from origin root (valid even when the SPA uses `VITE_BASE_PATH`).
 * Override with full URL only when the API is on another host, e.g. `https://api.example.com/api`.
 */
export function getApiUrlPrefix(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (!raw) return "/api";
  return raw.replace(/\/$/, "");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit & { token?: string | null }
): Promise<T> {
  const { token, ...rest } = init ?? {};
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(rest.headers ?? {}),
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getApiUrlPrefix()}${path}`, { ...rest, headers });
  const text = await res.text();
  const trimmed = text.trimStart();
  if (
    res.ok &&
    (trimmed.startsWith("<!") || trimmed.toLowerCase().startsWith("<html"))
  ) {
    throw new ApiError(
      "Received HTML instead of API JSON. Set VITE_API_URL to your Node API (e.g. https://api.example.com/api) in the build environment and redeploy, or reverse-proxy /api to the API host.",
      502
    );
  }
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text) as object;
    } catch {
      if (!res.ok) {
        throw new ApiError(res.statusText || "Request failed", res.status);
      }
      throw new ApiError("Invalid JSON from API", res.status);
    }
  }
  if (!res.ok) {
    const msg = (data as { error?: string }).error ?? res.statusText;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export function getDeviceFingerprint(): string {
  const key = "idara_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
