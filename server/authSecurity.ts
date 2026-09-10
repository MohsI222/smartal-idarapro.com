import type { CorsOptions } from "cors";
import type { Express, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

/** أصول معرّفة صراحة — مفيدة إذا لم تصل متغيرات VITE_* إلى دالة Vercel كما متوقع */
const CANONICAL_APP_ORIGINS = new Set([
  "https://smartal-idarapro.com",
  "https://www.smartal-idarapro.com",
  "https://smartal-idara.com",
  "https://www.smartal-idara.com",
]);

function collectEnvOriginBases(): string[] {
  const out: string[] = [];
  const push = (raw?: string) => {
    const t = raw?.trim().replace(/\/$/, "");
    if (!t) return;
    try {
      const withProto = t.startsWith("http") ? t : `https://${t}`;
      out.push(new URL(withProto).origin);
    } catch {
      /* ignore bad env */
    }
  };
  push(process.env.PUBLIC_APP_URL);
  push(process.env.VITE_PUBLIC_APP_URL);
  push(process.env.NEXT_PUBLIC_APP_URL);
  push(process.env.NEXT_PUBLIC_SITE_URL);
  for (const part of (process.env.AUTH_ALLOWED_ORIGINS ?? "").split(",")) push(part);
  const vu = process.env.VERCEL_URL?.trim();
  if (vu) push(`https://${vu}`);
  const vbu = process.env.VERCEL_BRANCH_URL?.trim();
  if (vbu) push(`https://${vbu}`);
  return out;
}

/**
 * Origins allowed for CORS (credentials) and for strict auth Origin/Referer checks.
 * Covers localhost, الإنتاج، نطاقات Vercel، والقيم المذكورة في البيئة.
 */
export function isTrustedBrowserOrigin(origin: string): boolean {
  const norm = origin.trim().replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(norm);
  } catch {
    return false;
  }
  if (CANONICAL_APP_ORIGINS.has(norm)) return true;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
  if (host.endsWith(".vercel.app")) return true;
  if (host.endsWith(".vercel.live")) return true;
  if (host === "smartal-idarapro.com" || host.endsWith(".smartal-idarapro.com")) return true;
  if (host === "smartal-idara.com" || host.endsWith(".smartal-idara.com")) return true;

  for (const base of collectEnvOriginBases()) {
    const b = base.replace(/\/$/, "");
    if (norm === b || norm.startsWith(`${b}/`)) return true;
  }
  return false;
}

/** CORS مع المصادقة (cookies / Authorization) — يعكس Origin فقط إذا كان موثوقاً */
export function createProductionCorsOptions(): CorsOptions {
  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isTrustedBrowserOrigin(origin)) {
        callback(null, origin);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  };
}

/** تقليل هجمات القوة الغاشمة على مسارات المصادقة */
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة — انتظر قليلاً ثم أعد المحاولة" },
});

export const authRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "عدد محاولات التسجيل تجاوز الحد — حاول لاحقاً" },
});

export const authSupabaseOauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "طلبات كثيرة — انتظر قليلاً" },
});

export const authAdminBootstrapLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "مرفوض — محاولات كثيرة" },
});

/**
 * يقلّل مخاطر CSRF بين المواقع على طلبات JSON للمصادقة: يتطلب Origin أو Referer متوافقاً مع الخادم،
 * أو غيابهما (تطبيقات أصلية / أدوات).
 */
export function createAuthOriginGuard(): RequestHandler {
  return (req, res, next) => {
    if (process.env.AUTH_STRICT_ORIGIN !== "true") {
      next();
      return;
    }
    if (req.method !== "POST" && req.method !== "PUT") {
      next();
      return;
    }
    const origin = String(req.headers.origin ?? "").trim().replace(/\/$/, "");
    const referer = String(req.headers.referer ?? "").trim();

    if (!origin && !referer) {
      next();
      return;
    }

    const okOrigin = !origin || isTrustedBrowserOrigin(origin);
    let okReferer = !referer;
    if (referer) {
      try {
        okReferer = isTrustedBrowserOrigin(new URL(referer).origin);
      } catch {
        okReferer = false;
      }
    }

    if (okOrigin && okReferer) {
      next();
      return;
    }
    res.status(403).json({ error: "رفض الطلب — مصدر غير موثوق" });
  };
}

export function applySecurityMiddleware(app: Express): void {
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
}
