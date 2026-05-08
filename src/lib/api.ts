/**
 * API base للـ fetch: نفس المضيف → `/api` (مع `VITE_BASE_PATH` إن وُجد).
 * • التطوير (`npm run dev`): افتراضياً `/api` عبر proxy نحو Express على :4000 — يتجاهل `VITE_API_URL` ما لم تُضبط `VITE_API_FORCE_REMOTE=1`.
 * • الإنتاج (بناء Vite): يُستعمل `VITE_API_URL` إن وُجد (يُكمَّل بـ `/api`) لنفس الدومين أو الإنتاج.
 */
function viteBasePrefix(): string {
  const b = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "") || "";
  return b === "" ? "" : b;
}

function sameOriginApiPrefix(): string {
  const base = viteBasePrefix();
  const sub = "/api";
  if (!base) return sub;
  return `${base}${sub}`.replace(/\/{2,}/g, "/");
}

/** يطبيع القيمة إلى بادئة تنتهي بـ `/api` (بدون شرطة نهائية إضافية). */
export function normalizeApiUrlRoot(raw: string): string {
  let s = raw.trim().replace(/\/+$/, "");
  if (!s) return "";
  if (!/\/api$/i.test(s)) s = `${s}/api`;
  return s;
}

function envApiPrefixFromVite(): string | null {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) {
    let p = raw.replace(/\/+$/, "");
    if (!/\/api$/i.test(p)) p = `${p}/api`;
    return p.startsWith("/") ? p : `/${p}`;
  }
  return normalizeApiUrlRoot(raw);
}

/**
 * في `npm run dev` نستخدم افتراضياً `/api` (proxy → Express :4000) حتى يعمل تسجيل الدخول على localhost
 * حتى لو بقي `VITE_API_URL` في `.env` للإنتاج. للاختبار ضد API بعيد من المحلي: VITE_API_FORCE_REMOTE=1
 */
export function getApiUrlPrefix(): string {
  const forceRemote =
    import.meta.env.VITE_API_FORCE_REMOTE === "1" ||
    import.meta.env.VITE_API_FORCE_REMOTE === "true";

  if (import.meta.env.DEV && !forceRemote) {
    return sameOriginApiPrefix();
  }

  const fromEnv = envApiPrefixFromVite();
  if (fromEnv) return fromEnv;
  return sameOriginApiPrefix();
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

  const prefix = getApiUrlPrefix();
  const pathPart = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${prefix}${pathPart}`, { ...rest, headers });
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
        const st = res.statusText?.trim();
        throw new ApiError(st || `HTTP ${res.status}`, res.status);
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
