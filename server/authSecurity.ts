import type { Express, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

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
  const explicit = (process.env.PUBLIC_APP_URL ?? process.env.VITE_PUBLIC_APP_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  const extra = (process.env.AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

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
    const host = String(req.headers.host ?? "").trim();

    if (!origin && !referer) {
      next();
      return;
    }

    const candidates: string[] = [];
    if (explicit) candidates.push(explicit);
    candidates.push(...extra);
    if (host) {
      candidates.push(`http://${host}`, `https://${host}`);
    }

    const okOrigin =
      !origin ||
      candidates.some((c) => c && (origin === c || origin.startsWith(c + "/")));
    let okReferer = !referer;
    if (referer && !okReferer) {
      try {
        const u = new URL(referer);
        const refBase = `${u.protocol}//${u.host}`.replace(/\/$/, "");
        okReferer = candidates.some((c) => c && (refBase === c || refBase.startsWith(c + "/")));
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
