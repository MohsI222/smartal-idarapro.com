/**
 * API base للـ fetch: نفس المضيف → `/api` (مع `VITE_BASE_PATH` إن وُجد).
 * • التطوير (`npm run dev`): افتراضياً `/api` عبر proxy نحو Express على :4000 — يتجاهل `VITE_API_URL` ما لم تُضبط `VITE_API_FORCE_REMOTE=1`.
 * • الإنتاج: إن كان `VITE_API_URL` يشير إلى دومين آخر (معاينة، أو خطأ **www مقابل بدون www**)
 *   يُستعمل `/api` على **نفس منشأ الصفحة** حتى لا تفشل طلبات CORS (preflight لا يقبل إعادة التوجيه).
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

/** خطأ نسخ شائع في متغيرات البيئة (.com.th بدلاً من .com) لدومين المشروع */
function sanitizeViteApiUrlRaw(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/smartal-idara/i.test(t) && /\.com\.th\b/i.test(t)) {
    return t.replace(/\.com\.th\b/gi, ".com");
  }
  return t;
}

function envApiPrefixFromVite(): string | null {
  const raw = sanitizeViteApiUrlRaw(import.meta.env.VITE_API_URL?.trim() ?? "");
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) {
    let p = raw.replace(/\/+$/, "");
    if (!/\/api$/i.test(p)) p = `${p}/api`;
    return p.startsWith("/") ? p : `/${p}`;
  }
  return normalizeApiUrlRoot(raw);
}

function stripLeadingWww(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

/**
 * الصفحة على www والـ API مضبوط على apex (أو العكس) ⇒ منشآن مختلفان لسياسة المتصفّح:
 * طلبات fetch تعرّض لإعادة توجيه على OPTIONS فتفشل (Redirect not allowed for preflight).
 */
function isApexWwwOnlyMismatch(apiOrigin: string, pageOrigin: string): boolean {
  try {
    const a = new URL(apiOrigin);
    const p = new URL(pageOrigin);
    if (a.origin === p.origin) return false;
    return stripLeadingWww(a.hostname) === stripLeadingWww(p.hostname);
  } catch {
    return false;
  }
}

function apiAbsoluteOrigin(fromEnvEndsWithApi: string): string {
  const root = fromEnvEndsWithApi.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  return new URL(root).origin;
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
  if (!fromEnv) {
    return sameOriginApiPrefix();
  }

  if (typeof window !== "undefined" && /^https?:\/\//i.test(fromEnv)) {
    try {
      const apiOrigin = apiAbsoluteOrigin(fromEnv);
      const pageOrigin = window.location.origin;

      if (isApexWwwOnlyMismatch(apiOrigin, pageOrigin)) {
        return sameOriginApiPrefix();
      }

      if (apiOrigin !== pageOrigin) {
        const allowCross =
          import.meta.env.VITE_API_CROSS_ORIGIN === "1" ||
          import.meta.env.VITE_API_CROSS_ORIGIN === "true";
        if (!allowCross) {
          return sameOriginApiPrefix();
        }
      }
    } catch {
      /* اسقط إلى fromEnv */
    }
  }

  return fromEnv;
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
