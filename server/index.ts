import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import sharp from "sharp";
import { registerBackendServices } from "./backendServices.ts";
import { registerBase44StudioRoutes } from "./base44Studio.ts";
import { registerTlErpRoutes } from "./tlErpRoutes.ts";
import { getTlUploadRoot, getUploadDir } from "./paths.js";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { hashPassword, signToken, verifyPassword, verifyToken } from "./crypto.js";
import { ensureSuperAdmin, genReferralCode } from "./seed.js";
import {
  applySecurityMiddleware,
  authAdminBootstrapLimiter,
  authLoginLimiter,
  authRegisterLimiter,
  authSupabaseOauthLimiter,
  createAuthOriginGuard,
} from "./authSecurity.js";
import { sanitizeEmail, sanitizeUserDisplayName } from "./stringUtil.js";
import { paramString } from "./reqParams.js";
import { vercelApiUrlRestore } from "./vercelUrlMiddleware.js";

const DEFAULT_TRIAL_BALANCE = 1000;

async function fetchSupabaseUserFromAccessToken(accessToken: string): Promise<{
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string };
} | null> {
  const base = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  const anon = (process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  if (!base || !anon) return null;
  const r = await fetch(`${base}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anon,
    },
  });
  if (!r.ok) return null;
  return (await r.json()) as {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string; name?: string; avatar_url?: string };
  };
}

const REMEMBER_ME_MS =
  (Number(process.env.REMEMBER_ME_YEARS) || 5) * 365 * 864e5;
import { buildAdminWhatsappUrl } from "./notify.js";
import {
  FULL_MODULES_JSON,
  isPrimaryAdminUser,
  PRIMARY_ADMIN_SESSION_MS,
  SUBSCRIPTION_PERIOD_DAYS,
  SUPER_ADMIN_EMAIL,
} from "./admin-config.js";

/** وحدات التجربة المجانية (5 أيام) — بدون رادار التأشيرة */
const TRIAL_MODULE_IDS = new Set([
  "hr",
  "law",
  "acc",
  "public",
  "edu",
  "inventory",
  "members",
  "company",
  "academy",
  "gov",
  "legal_ai",
  "media_lab",
  "transport_logistics",
  "chat",
  "edu_print",
  "tools",
  "reminders",
]);

function userHasActiveTrial(userId: string): boolean {
  const u = db.prepare("SELECT trial_ends_at FROM users WHERE id = ?").get(userId) as
    | { trial_ends_at: string | null }
    | undefined;
  if (!u?.trial_ends_at) return false;
  const t = new Date(u.trial_ends_at).getTime();
  return Number.isFinite(t) && t > Date.now();
}

const uploadDir = getUploadDir();
const tlUploadRoot = getTlUploadRoot();
const uploadTl = multer({
  dest: tlUploadRoot,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const n = (file.originalname || "").toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();
    const ok =
      mime.includes("pdf") ||
      mime.includes("spreadsheet") ||
      mime.includes("excel") ||
      mime.includes("csv") ||
      n.endsWith(".pdf") ||
      n.endsWith(".xlsx") ||
      n.endsWith(".xls") ||
      n.endsWith(".csv");
    if (ok) cb(null, true);
    else cb(new Error("file_type"));
  },
});

ensureSuperAdmin();

/** GPT-4o vision — استخراج أصناف من صورة فاتورة / يدوي (يتطلب OPENAI_API_KEY) */
async function extractReceiptWithOpenAiVision(
  buffer: Buffer,
  mime: string
): Promise<{ product_name: string; quantity: number; unit_price: number }[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) throw new Error("no_key");
  let img = buffer;
  let mt = mime || "image/jpeg";
  try {
    img = await sharp(buffer)
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86 })
      .toBuffer();
    mt = "image/jpeg";
  } catch {
    /* استخدام الأصل */
  }
  const b64 = img.toString("base64");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Extract retail or handwritten inventory lines. Reply with JSON only: {"items":[{"product_name":string,"quantity":number,"unit_price":number}]}. quantity is integer >= 1. unit_price is numeric per unit.',
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract every product line: product name, quantity, and unit price.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mt};base64,${b64}`, detail: "high" },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    throw new Error(errTxt || `openai_${res.status}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: { items?: unknown };
  try {
    parsed = JSON.parse(raw) as { items?: unknown };
  } catch {
    return [];
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const out: { product_name: string; quantity: number; unit_price: number }[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.product_name ?? r.name ?? "").trim();
    const qty = Math.max(1, Math.floor(Number(r.quantity ?? r.qty ?? 1) || 1));
    const price = Math.max(0, Number(r.unit_price ?? r.price ?? 0) || 0);
    if (name.length < 1) continue;
    out.push({ product_name: name, quantity: qty, unit_price: price });
  }
  return out;
}

const app = express();
app.use(vercelApiUrlRestore);
applySecurityMiddleware(app);
app.use(cors({ origin: true, credentials: true }));
const authOriginGuard = createAuthOriginGuard();
app.use("/api/auth", authOriginGuard);
app.use(express.json({ limit: "12mb" }));

const upload = multer({ dest: uploadDir, limits: { fileSize: 8 * 1024 * 1024 } });
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

const MAX_DEVICES = 3;

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }
  const p = verifyToken(token);
  if (!p) {
    res.status(401).json({ error: "جلسة منتهية" });
    return;
  }
  (req as express.Request & { userId: string; role: string }).userId = p.sub;
  (req as express.Request & { userId: string; role: string }).role = p.role;

  if (p.role !== "superadmin") {
    const urow = db
      .prepare("SELECT account_locked FROM users WHERE id = ?")
      .get(p.sub) as { account_locked: number } | undefined;
    if (urow?.account_locked) {
      const path = req.path;
      const method = req.method;
      const allowed =
        path === "/api/me" ||
        (path === "/api/support/messages" && (method === "GET" || method === "POST"));
      if (!allowed) {
        res.status(403).json({ error: "account_locked", code: "ACCOUNT_LOCKED" });
        return;
      }
    }
  }

  next();
}

function superAdminOnly(req: express.Request, res: express.Response, next: express.NextFunction) {
  const r = (req as express.Request & { role: string }).role;
  if (r !== "superadmin") {
    res.status(403).json({ error: "صلاحيات المشرف العام فقط" });
    return;
  }
  next();
}

app.post("/api/auth/register", authRegisterLimiter, (req, res) => {
  const { email, password, name, deviceFingerprint, deviceLabel, referralCode, ref, startTrial } =
    req.body as {
      email?: string;
      password?: string;
      name?: string;
      deviceFingerprint?: string;
      deviceLabel?: string;
      referralCode?: string;
      ref?: string;
      startTrial?: boolean;
    };
  const emailSafe = sanitizeEmail(email ?? "");
  const nameSafe = sanitizeUserDisplayName(name ?? "");
  if (!emailSafe || !password || !nameSafe) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  if (password.length > 256) {
    res.status(400).json({ error: "كلمة المرور طويلة جداً" });
    return;
  }
  try {
    const id = randomUUID();
    const refRaw = String(referralCode ?? ref ?? "")
      .trim()
      .toUpperCase();
    let referredBy: string | null = null;
    if (refRaw.length > 0) {
      const refUser = db
        .prepare("SELECT id FROM users WHERE referral_code = ? OR id = ?")
        .get(refRaw, refRaw) as { id: string } | undefined;
      if (refUser && refUser.id !== id) referredBy = refUser.id;
    }
    const code = genReferralCode();
    const trialIso =
      startTrial === true ? new Date(Date.now() + 5 * 86400000).toISOString() : null;
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, referred_by, referral_code, trial_ends_at, trial_balance) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?)`
    ).run(id, emailSafe, hashPassword(password), nameSafe, referredBy, code, trialIso, DEFAULT_TRIAL_BALANCE);
    if (deviceFingerprint) {
      db.prepare(
        `INSERT INTO devices (id, user_id, fingerprint, label, last_seen) VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(randomUUID(), id, deviceFingerprint, deviceLabel ?? null);
    }
    const token = signToken({ sub: id, role: "user" });
    const emailLower = emailSafe;
    const waMsg = [
      "Smart Al-Idara Pro — تسجيل جديد",
      `البريد: ${emailLower}`,
      referredBy ? `بكود إحالة (مرجع)` : "",
      startTrial ? "تجربة 5 أيام: مفعّلة" : "",
    ]
      .filter(Boolean)
      .join("\n");
    res.json({
      token,
      user: {
        id,
        email: emailLower,
        name: nameSafe,
        role: "user",
        referral_code: code,
        trial_ends_at: trialIso,
        account_locked: false,
        trial_balance: DEFAULT_TRIAL_BALANCE,
      },
      whatsappNotifyUrl: buildAdminWhatsappUrl(waMsg),
    });
  } catch {
    res.status(400).json({ error: "البريد مستخدم مسبقاً" });
  }
});

app.post("/api/auth/supabase-oauth", authSupabaseOauthLimiter, async (req, res) => {
  const { access_token, deviceFingerprint, deviceLabel, referralCode, ref, startTrial } = req.body as {
    access_token?: string;
    deviceFingerprint?: string;
    deviceLabel?: string;
    referralCode?: string;
    ref?: string;
    startTrial?: boolean;
  };
  if (!access_token?.trim()) {
    res.status(400).json({ error: "رمز الدخول ناقص" });
    return;
  }
  const sbUser = await fetchSupabaseUserFromAccessToken(access_token.trim());
  if (!sbUser) {
    res.status(401).json({ error: "فشل التحقق من جلسة Supabase" });
    return;
  }
  const emailRaw = sanitizeEmail(String(sbUser.email ?? ""));
  if (!emailRaw) {
    res.status(400).json({ error: "البريد غير متوفر من مزود التسجيل" });
    return;
  }
  const meta = sbUser.user_metadata ?? {};
  const name = sanitizeUserDisplayName(
    String(meta.full_name ?? meta.name ?? emailRaw.split("@")[0] ?? "مستخدم")
  ) || "مستخدم";

  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(emailRaw) as
    | {
        id: string;
        email: string;
        password_hash: string;
        name: string;
        role: string;
        whatsapp?: string | null;
        account_locked?: number;
        trial_balance?: number;
      }
    | undefined;

  if (!user) {
    const id = randomUUID();
    const refRaw = String(referralCode ?? ref ?? "")
      .trim()
      .toUpperCase();
    let referredBy: string | null = null;
    if (refRaw.length > 0) {
      const refUser = db
        .prepare("SELECT id FROM users WHERE referral_code = ? OR id = ?")
        .get(refRaw, refRaw) as { id: string } | undefined;
      if (refUser && refUser.id !== id) referredBy = refUser.id;
    }
    const code = genReferralCode();
    const trialIso =
      startTrial === true ? new Date(Date.now() + 5 * 86400000).toISOString() : null;
    try {
      db.prepare(
        `INSERT INTO users (id, email, password_hash, name, role, referred_by, referral_code, trial_ends_at, trial_balance) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?)`
      ).run(id, emailRaw, hashPassword(randomUUID()), name, referredBy, code, trialIso, DEFAULT_TRIAL_BALANCE);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as typeof user;
    } catch (e) {
      console.error("[supabase-oauth insert]", e);
      res.status(500).json({ error: "تعذر إنشاء الحساب" });
      return;
    }
  }

  if (!user) {
    res.status(500).json({ error: "مستخدم غير موجود" });
    return;
  }

  const bypassDeviceLimit =
    user.role === "superadmin" ||
    user.email === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(user.email, user.name);

  if (deviceFingerprint) {
    const existing = db
      .prepare("SELECT id FROM devices WHERE user_id = ? AND fingerprint = ?")
      .get(user.id, deviceFingerprint) as { id: string } | undefined;
    if (!existing) {
      if (!bypassDeviceLimit) {
        const count = db
          .prepare("SELECT COUNT(*) as c FROM devices WHERE user_id = ?")
          .get(user.id) as { c: number };
        if (count.c >= MAX_DEVICES) {
          res.status(403).json({
            error: "تم تجاوز الحد الأقصى للأجهزة (3). اتصل بالدعم أو احذف جهازاً من الإعدادات.",
            code: "DEVICE_LIMIT",
          });
          return;
        }
      }
      db.prepare(
        `INSERT INTO devices (id, user_id, fingerprint, label, last_seen) VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(randomUUID(), user.id, deviceFingerprint, deviceLabel ?? null);
    } else {
      db.prepare(`UPDATE devices SET last_seen = datetime('now') WHERE id = ?`).run(existing.id);
    }
  }

  let sessionMs = (Number(process.env.JWT_EXPIRES_DAYS) || 365) * 864e5;
  if (bypassDeviceLimit) {
    sessionMs = PRIMARY_ADMIN_SESSION_MS;
  } else {
    sessionMs = REMEMBER_ME_MS;
  }
  const token = signToken({ sub: user.id, role: user.role }, { expiresInMs: sessionMs });
  const uFull = user as typeof user & { account_locked?: number; trial_balance?: number };
  const tb =
    typeof uFull.trial_balance === "number" && Number.isFinite(uFull.trial_balance)
      ? uFull.trial_balance
      : DEFAULT_TRIAL_BALANCE;
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      whatsapp: user.whatsapp ?? null,
      referral_code: (user as { referral_code?: string }).referral_code ?? null,
      trial_ends_at: (user as { trial_ends_at?: string | null }).trial_ends_at ?? null,
      account_locked: Boolean(uFull.account_locked),
      trial_balance: tb,
    },
  });
});

app.post("/api/auth/login", authLoginLimiter, (req, res) => {
  const { email, password, deviceFingerprint, deviceLabel, rememberMe } = req.body as {
    email?: string;
    password?: string;
    deviceFingerprint?: string;
    deviceLabel?: string;
    rememberMe?: boolean;
  };
  const emailSafe = sanitizeEmail(email ?? "");
  if (!emailSafe || !password) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(emailSafe) as
    | {
        id: string;
        email: string;
        password_hash: string;
        name: string;
        role: string;
        whatsapp?: string | null;
      }
    | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: "بريد أو كلمة مرور خاطئة" });
    return;
  }

  const bypassDeviceLimit =
    user.role === "superadmin" ||
    user.email === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(user.email, user.name);

  if (deviceFingerprint) {
    const existing = db
      .prepare("SELECT id FROM devices WHERE user_id = ? AND fingerprint = ?")
      .get(user.id, deviceFingerprint) as { id: string } | undefined;
    if (!existing) {
      if (!bypassDeviceLimit) {
        const count = db
          .prepare("SELECT COUNT(*) as c FROM devices WHERE user_id = ?")
          .get(user.id) as { c: number };
        if (count.c >= MAX_DEVICES) {
          res.status(403).json({
            error: "تم تجاوز الحد الأقصى للأجهزة (3). اتصل بالدعم أو احذف جهازاً من الإعدادات.",
            code: "DEVICE_LIMIT",
          });
          return;
        }
      }
      db.prepare(
        `INSERT INTO devices (id, user_id, fingerprint, label, last_seen) VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(randomUUID(), user.id, deviceFingerprint, deviceLabel ?? null);
    } else {
      db.prepare(`UPDATE devices SET last_seen = datetime('now') WHERE id = ?`).run(existing.id);
    }
  }

  let sessionMs = (Number(process.env.JWT_EXPIRES_DAYS) || 365) * 864e5;
  if (bypassDeviceLimit) {
    sessionMs = PRIMARY_ADMIN_SESSION_MS;
  } else if (rememberMe === true) {
    sessionMs = REMEMBER_ME_MS;
  }
  const token = signToken({ sub: user.id, role: user.role }, { expiresInMs: sessionMs });
  const uFull = user as typeof user & { account_locked?: number; trial_balance?: number };
  const tb =
    typeof uFull.trial_balance === "number" && Number.isFinite(uFull.trial_balance)
      ? uFull.trial_balance
      : DEFAULT_TRIAL_BALANCE;
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      whatsapp: user.whatsapp ?? null,
      account_locked: Boolean(uFull.account_locked),
      trial_balance: tb,
    },
  });
});

/**
 * تسجيل دخول المشرف بدون كلمة مرور — يتطلب تطابق ADMIN_BOOTSTRAP_KEY (الخادم فقط).
 * يُستدعى من المتصفح الموثوق عند تفعيل VITE_ADMIN_BOOTSTRAP_KEY.
 */
app.post("/api/auth/admin-bootstrap", authAdminBootstrapLimiter, (req, res) => {
  const expected = process.env.ADMIN_BOOTSTRAP_KEY?.trim();
  if (!expected || expected.length < 16) {
    res.status(404).json({ error: "غير مفعّل" });
    return;
  }
  const sent = (req.headers["x-admin-bootstrap"] as string | undefined)?.trim();
  if (sent !== expected) {
    res.status(403).json({ error: "مرفوض" });
    return;
  }
  const user = db
    .prepare("SELECT id, email, name, role, whatsapp, trial_balance FROM users WHERE email = ?")
    .get(SUPER_ADMIN_EMAIL) as
    | {
        id: string;
        email: string;
        name: string;
        role: string;
        whatsapp: string | null;
        trial_balance?: number;
      }
    | undefined;
  if (!user || user.role !== "superadmin") {
    res.status(500).json({ error: "حساب المشرف غير جاهز" });
    return;
  }
  const token = signToken(
    { sub: user.id, role: user.role },
    { expiresInMs: PRIMARY_ADMIN_SESSION_MS }
  );
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      whatsapp: user.whatsapp ?? null,
      trial_balance:
        typeof user.trial_balance === "number" && Number.isFinite(user.trial_balance)
          ? user.trial_balance
          : DEFAULT_TRIAL_BALANCE,
    },
  });
});

app.get("/api/me", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const user = db
    .prepare(
      `SELECT id, email, name, role, whatsapp, referral_code, trial_ends_at, visa_unlock_approved, visa_unlock_requested_at, account_locked, trial_balance FROM users WHERE id = ?`
    )
    .get(userId) as {
    id: string;
    email: string;
    name: string;
    role: string;
    whatsapp: string | null;
    referral_code: string | null;
    trial_ends_at: string | null;
    visa_unlock_approved: number;
    visa_unlock_requested_at: string | null;
    account_locked: number;
    trial_balance?: number;
  };
  const sub = db
    .prepare(
      `SELECT id, plan_id, modules, payment_method, status, created_at, ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId) as
    | {
        id: string;
        plan_id: string;
        modules: string;
        payment_method: string;
        status: string;
        created_at: string;
        ends_at: string | null;
      }
    | undefined;
  const devices = db
    .prepare("SELECT id, fingerprint, label, last_seen FROM devices WHERE user_id = ?")
    .all(userId) as { id: string; fingerprint: string; label: string | null; last_seen: string }[];

  const isSuperAdmin =
    user.role === "superadmin" ||
    user.email === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(user.email, user.name);
  const maxDevices = isSuperAdmin ? 999 : MAX_DEVICES;

  const tb =
    typeof user.trial_balance === "number" && Number.isFinite(user.trial_balance)
      ? user.trial_balance
      : DEFAULT_TRIAL_BALANCE;

  res.json({
    user: { ...user, account_locked: Boolean(user.account_locked), trial_balance: tb },
    subscription: sub ?? null,
    devices,
    maxDevices,
  });
});

const brandingSettingsKey = (uid: string) => `user_branding_${uid}`;

type StoredBranding = {
  companyName: string;
  activityType: string;
  logoDataUrl: string;
  socialWebsite: string;
  socialFacebook: string;
  socialInstagram: string;
  socialLinkedin: string;
  socialTwitter: string;
};

const emptyBranding = (): StoredBranding => ({
  companyName: "",
  activityType: "general",
  logoDataUrl: "",
  socialWebsite: "",
  socialFacebook: "",
  socialInstagram: "",
  socialLinkedin: "",
  socialTwitter: "",
});

function getStoredBranding(userId: string): StoredBranding {
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(brandingSettingsKey(userId)) as { value: string } | undefined;
  if (!row?.value) return emptyBranding();
  try {
    const branding = JSON.parse(row.value) as Record<string, unknown>;
    return {
      companyName: String(branding.companyName ?? ""),
      activityType: String(branding.activityType ?? "general"),
      logoDataUrl: String(branding.logoDataUrl ?? ""),
      socialWebsite: String(branding.socialWebsite ?? ""),
      socialFacebook: String(branding.socialFacebook ?? ""),
      socialInstagram: String(branding.socialInstagram ?? ""),
      socialLinkedin: String(branding.socialLinkedin ?? ""),
      socialTwitter: String(branding.socialTwitter ?? ""),
    };
  } catch {
    return emptyBranding();
  }
}

app.get("/api/user/branding", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  res.json({ branding: getStoredBranding(userId) });
});

app.put("/api/user/branding", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const prev = getStoredBranding(userId);
  const b = req.body as {
    companyName?: string;
    activityType?: string;
    logoDataUrl?: string | null;
    socialWebsite?: string;
    socialFacebook?: string;
    socialInstagram?: string;
    socialLinkedin?: string;
    socialTwitter?: string;
  };
  const soc = (s: string | undefined) => (typeof s === "string" ? s.slice(0, 500) : "");
  const logoIn = typeof b.logoDataUrl === "string" ? b.logoDataUrl : undefined;
  const logoNext =
    logoIn !== undefined ? (logoIn.startsWith("data:image") ? logoIn : "") : prev.logoDataUrl;
  if (logoNext.length > 600_000) {
    res.status(400).json({ error: "الشعار كبير جداً" });
    return;
  }
  const payload = JSON.stringify({
    companyName:
      b.companyName !== undefined ? String(b.companyName).slice(0, 200) : prev.companyName,
    activityType:
      b.activityType !== undefined
        ? String(b.activityType).slice(0, 64)
        : prev.activityType,
    logoDataUrl: logoNext,
    socialWebsite: b.socialWebsite !== undefined ? soc(b.socialWebsite) : prev.socialWebsite,
    socialFacebook: b.socialFacebook !== undefined ? soc(b.socialFacebook) : prev.socialFacebook,
    socialInstagram: b.socialInstagram !== undefined ? soc(b.socialInstagram) : prev.socialInstagram,
    socialLinkedin: b.socialLinkedin !== undefined ? soc(b.socialLinkedin) : prev.socialLinkedin,
    socialTwitter: b.socialTwitter !== undefined ? soc(b.socialTwitter) : prev.socialTwitter,
  });
  db.prepare(
    `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`
  ).run(brandingSettingsKey(userId), payload);
  res.json({ ok: true });
});

app.get("/api/dashboard/financial-summary", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const lawyerC = (
    db.prepare("SELECT COUNT(*) as c FROM lawyer_cases WHERE user_id = ?").get(userId) as { c: number }
  ).c;
  const accC = (
    db.prepare("SELECT COUNT(*) as c FROM accountant_reports WHERE user_id = ?").get(userId) as { c: number }
  ).c;
  const invC = (
    db.prepare("SELECT COUNT(*) as c FROM pos_invoices WHERE user_id = ?").get(userId) as { c: number }
  ).c;
  const docCount = lawyerC + accC + invC;

  const invoices = db
    .prepare(
      "SELECT total, paid, created_at, lines_json FROM pos_invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 500"
    )
    .all(userId) as { total: number; paid: number; created_at: string; lines_json: string }[];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const hourAgo = Date.now() - 3600000;

  let todayRevenue = 0;
  let hourRevenue = 0;
  let todayProfit = 0;
  let hourProfit = 0;

  for (const inv of invoices) {
    const ts = new Date(inv.created_at).getTime();
    const total = Number(inv.total) || 0;
    if (ts >= startOfToday) todayRevenue += total;
    if (ts >= hourAgo) hourRevenue += total;

    let lineProfitSum = 0;
    try {
      const lines = JSON.parse(inv.lines_json) as { line_profit?: number }[];
      if (Array.isArray(lines)) {
        for (const line of lines) lineProfitSum += Number(line.line_profit) || 0;
      }
    } catch {
      /* ignore */
    }
    if (ts >= startOfToday) todayProfit += lineProfitSum;
    if (ts >= hourAgo) hourProfit += lineProfitSum;
  }

  const dayMs = 86400000;
  const chart: { day: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday - i * dayMs);
    const d0 = d.getTime();
    const d1 = d0 + dayMs;
    let rev = 0;
    for (const inv of invoices) {
      const ts = new Date(inv.created_at).getTime();
      if (ts >= d0 && ts < d1) rev += Number(inv.total) || 0;
    }
    chart.push({
      day: d.toISOString().slice(0, 10),
      revenue: Math.round(rev * 100) / 100,
    });
  }

  res.json({
    docCount,
    todayRevenue: Math.round(todayRevenue * 100) / 100,
    hourRevenue: Math.round(hourRevenue * 100) / 100,
    todayNetProfit: Math.round(todayProfit * 100) / 100,
    hourNetProfit: Math.round(hourProfit * 100) / 100,
    salesCount: invC,
    chart,
  });
});

app.post("/api/devices/remove", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { deviceId } = req.body as { deviceId?: string };
  if (!deviceId) {
    res.status(400).json({ error: "معرف الجهاز مطلوب" });
    return;
  }
  const r = db.prepare("DELETE FROM devices WHERE id = ? AND user_id = ?").run(deviceId, userId);
  if (r.changes === 0) {
    res.status(404).json({ error: "الجهاز غير موجود" });
    return;
  }
  res.json({ ok: true });
});

app.post(
  "/api/subscription/request",
  authMiddleware,
  upload.single("receipt"),
  (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const { plan_id, payment_method, modules, billing_period } = req.body as {
      plan_id?: string;
      payment_method?: string;
      modules?: string;
      billing_period?: string;
    };
    const file = req.file;
    if (!plan_id || !payment_method || !modules) {
      res.status(400).json({ error: "بيانات الاشتراك ناقصة" });
      return;
    }
    const allowed = ["bank_transfer", "wafacash", "cashplus", "recharge"];
    if (!allowed.includes(payment_method)) {
      res.status(400).json({ error: "طريقة دفع غير مدعومة" });
      return;
    }
    const bp = billing_period === "yearly" ? "yearly" : "monthly";
    const receiptPath = file ? file.path : null;
    const id = randomUUID();
    db.prepare(
      `INSERT INTO subscriptions (id, user_id, plan_id, modules, payment_method, receipt_path, status, billing_period) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).run(id, userId, plan_id, modules, payment_method, receiptPath, bp);
    const u = db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string } | undefined;
    const msg = [
      "Smart Al-Idara Pro — طلب اشتراك",
      `البريد: ${u?.email ?? ""}`,
      `الخطة: ${plan_id}`,
      `الفترة: ${bp === "yearly" ? "سنوي" : "شهري"}`,
      `طريقة الدفع: ${payment_method}`,
    ].join("\n");
    res.json({ ok: true, subscriptionId: id, whatsappNotifyUrl: buildAdminWhatsappUrl(msg) });
  }
);

/** طلب تفعيل رادار التأشيرة (Premium +100 درهم) — ينتظر موافقة الأدمن */
app.post("/api/visa/request-unlock", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const u = db.prepare("SELECT email, name FROM users WHERE id = ?").get(userId) as
    | { email: string; name: string }
    | undefined;
  if (!u) {
    res.status(404).json({ error: "مستخدم غير موجود" });
    return;
  }
  db.prepare(`UPDATE users SET visa_unlock_requested_at = datetime('now') WHERE id = ?`).run(userId);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO subscriptions (id, user_id, plan_id, modules, payment_method, receipt_path, status, billing_period) VALUES (?, ?, 'visa_premium', ?, 'bank_transfer', NULL, 'pending', 'yearly')`
  ).run(id, userId, JSON.stringify(["visa"]));
  const msg = [
    "Smart Al-Idara Pro — طلب Premium رادار التأشيرة (+100 درهم تقريباً)",
    `البريد: ${u.email}`,
    `الاسم: ${u.name}`,
    "يحتاج موافقة يدوية من لوحة الأدمن بعد الدفع.",
  ].join("\n");
  res.json({ ok: true, subscriptionId: id, whatsappNotifyUrl: buildAdminWhatsappUrl(msg) });
});

function countApprovedReferrals(referrerId: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT u.id) AS c FROM users u
     INNER JOIN subscriptions s ON s.user_id = u.id AND s.status = 'approved'
     WHERE u.referred_by = ?`
    )
    .get(referrerId) as { c: number };
  return Number(row?.c) || 0;
}

/** عند الوصول إلى 5 أو 10 إحالات مع اشتراك معتمد — طلب موافقة أدمن للمكافأة */
function maybeCreateReferralReward(referrerId: string): string | null {
  const c = countApprovedReferrals(referrerId);
  const milestones: { n: number; tier: string; label: string }[] = [
    { n: 5, tier: "5", label: "3 أشهر مجانية (بعد موافقة الأدمن)" },
    { n: 10, tier: "10", label: "6 أشهر مجانية (بعد موافقة الأدمن)" },
  ];
  for (const m of milestones) {
    if (c < m.n) continue;
    const ex = db
      .prepare("SELECT id FROM referral_rewards WHERE user_id = ? AND tier = ?")
      .get(referrerId, m.tier) as { id: string } | undefined;
    if (ex) continue;
    const rid = randomUUID();
    db.prepare(`INSERT INTO referral_rewards (id, user_id, tier, status) VALUES (?, ?, ?, 'pending')`).run(
      rid,
      referrerId,
      m.tier
    );
    const refUser = db.prepare(`SELECT email, name FROM users WHERE id = ?`).get(referrerId) as
      | { email: string; name: string }
      | undefined;
    return buildAdminWhatsappUrl(
      [
        "Smart Al-Idara Pro — عرض إحالة (للمراجعة)",
        `المُحيل: ${refUser?.email ?? ""} (${refUser?.name ?? ""})`,
        `عدد المشتركين المعتمدين عبر الإحالة: ${c}`,
        `المستوى: ${m.n} مشتركين — ${m.label}`,
        "يرجى المراجعة وإرسال التفاصيل لبريد الأدمن والموافقة من اللوحة.",
      ].join("\n")
    );
  }
  return null;
}

app.get("/api/subscription/status", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const sub = db
    .prepare(
      `SELECT id, plan_id, modules, payment_method, status, created_at, reviewed_at, ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId);
  res.json({ subscription: sub ?? null });
});

app.get("/api/admin/pending", authMiddleware, superAdminOnly, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, u.email, u.name as user_name FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE s.status = 'pending' ORDER BY s.created_at ASC`
    )
    .all();
  res.json({ pending: rows });
});

app.post("/api/admin/approve/:subId", authMiddleware, superAdminOnly, (req, res) => {
  const adminId = (req as express.Request & { userId: string }).userId;
  const subId = paramString(req.params.subId);
  const row = db
    .prepare(
      `SELECT id, user_id, plan_id, billing_period FROM subscriptions WHERE id = ? AND status = 'pending'`
    )
    .get(subId) as
    | {
        id: string;
        user_id: string;
        plan_id: string;
        billing_period: string | null;
      }
    | undefined;
  if (!row) {
    res.status(404).json({ error: "طلب غير موجود أو تمت معالجته" });
    return;
  }
  let periodMod = `+${SUBSCRIPTION_PERIOD_DAYS} days`;
  if (row.billing_period === "yearly") periodMod = "+365 days";
  if (row.plan_id === "visa_premium") {
    periodMod = "+365 days";
    db.prepare(`UPDATE users SET visa_unlock_approved = 1 WHERE id = ?`).run(row.user_id);
  }
  const r = db
    .prepare(
      `UPDATE subscriptions SET status = 'approved', reviewed_at = datetime('now'), reviewed_by = ?, ends_at = datetime('now', ?) WHERE id = ? AND status = 'pending'`
    )
    .run(adminId, periodMod, subId);
  if (r.changes === 0) {
    res.status(404).json({ error: "طلب غير موجود أو تمت معالجته" });
    return;
  }
  const refRow = db.prepare(`SELECT referred_by FROM users WHERE id = ?`).get(row.user_id) as
    | { referred_by: string | null }
    | undefined;
  let referralNotifyUrl: string | undefined;
  if (refRow?.referred_by) {
    const u = maybeCreateReferralReward(refRow.referred_by);
    if (u) referralNotifyUrl = u;
  }
  const userRow = db.prepare(`SELECT email, name FROM users WHERE id = ?`).get(row.user_id) as
    | { email: string; name: string }
    | undefined;
  const adminMsg = [
    "Smart Al-Idara Pro — تأكيد اشتراك",
    `الطلب: ${subId}`,
    `الخطة: ${row.plan_id}`,
    `المستخدم: ${userRow?.email ?? row.user_id}`,
    `الفترة: ${row.billing_period ?? "monthly"}`,
  ].join("\n");
  const adminWhatsAppAckUrl = buildAdminWhatsappUrl(adminMsg);
  res.json({ ok: true, referralNotifyUrl, adminWhatsAppAckUrl });
});

app.get("/api/admin/referral-rewards", authMiddleware, superAdminOnly, (_req, res) => {
  const rewards = db
    .prepare(
      `SELECT r.id, r.user_id, r.tier, r.status, r.created_at, u.email, u.name as user_name
       FROM referral_rewards r JOIN users u ON u.id = r.user_id
       WHERE r.status = 'pending' ORDER BY r.created_at ASC`
    )
    .all();
  res.json({ rewards });
});

app.post("/api/admin/referral-reward/approve/:rewardId", authMiddleware, superAdminOnly, (req, res) => {
  const rewardId = paramString(req.params.rewardId);
  const rw = db
    .prepare(`SELECT * FROM referral_rewards WHERE id = ? AND status = 'pending'`)
    .get(rewardId) as { id: string; user_id: string; tier: string } | undefined;
  if (!rw) {
    res.status(404).json({ error: "طلب غير موجود" });
    return;
  }
  const addDays = rw.tier === "10" ? 180 : rw.tier === "5" ? 90 : 30;
  const sub = db
    .prepare(
      `SELECT id, ends_at FROM subscriptions WHERE user_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1`
    )
    .get(rw.user_id) as { id: string; ends_at: string | null } | undefined;
  if (sub) {
    const baseMs = sub.ends_at ? new Date(sub.ends_at).getTime() : Date.now();
    const start = Math.max(baseMs, Date.now());
    const newEnd = new Date(start + addDays * 86400000).toISOString();
    db.prepare(`UPDATE subscriptions SET ends_at = ? WHERE id = ?`).run(newEnd, sub.id);
  }
  db.prepare(`UPDATE referral_rewards SET status = 'approved' WHERE id = ?`).run(rw.id);
  res.json({ ok: true });
});

app.post("/api/admin/reject/:subId", authMiddleware, superAdminOnly, (req, res) => {
  const adminId = (req as express.Request & { userId: string }).userId;
  const subId = paramString(req.params.subId);
  const r = db
    .prepare(
      `UPDATE subscriptions SET status = 'rejected', reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ? AND status = 'pending'`
    )
    .run(adminId, subId);
  if (r.changes === 0) {
    res.status(404).json({ error: "طلب غير موجود" });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/admin/users", authMiddleware, superAdminOnly, (_req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.created_at, u.trial_ends_at, u.account_locked,
        s.plan_id, s.status AS sub_status, s.ends_at AS sub_ends_at, s.payment_method
       FROM users u
       LEFT JOIN subscriptions s ON s.id = (
         SELECT id FROM subscriptions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
       )
       ORDER BY datetime(u.created_at) DESC`
    )
    .all();
  res.json({ users });
});

app.post("/api/admin/users/:targetUserId/locked", authMiddleware, superAdminOnly, (req, res) => {
  const adminId = (req as express.Request & { userId: string }).userId;
  const targetUserId = paramString(req.params.targetUserId);
  const locked = Boolean((req.body as { locked?: boolean }).locked);
  if (targetUserId === adminId) {
    res.status(400).json({ error: "cannot_lock_self" });
    return;
  }
  const target = db.prepare("SELECT role FROM users WHERE id = ?").get(targetUserId) as
    | { role: string }
    | undefined;
  if (!target) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (target.role === "superadmin") {
    res.status(400).json({ error: "cannot_lock_admin" });
    return;
  }
  db.prepare("UPDATE users SET account_locked = ? WHERE id = ?").run(locked ? 1 : 0, targetUserId);
  res.json({ ok: true });
});

/** يدوي: اشتراك «نشط» (معتمد + تاريخ انتهاء في المستقبل) أو «منتهٍ» (معتمد + انتهى) — تخزين محلي فقط */
app.post(
  "/api/admin/users/:targetUserId/subscription-access",
  authMiddleware,
  superAdminOnly,
  (req, res) => {
    const adminId = (req as express.Request & { userId: string }).userId;
    const targetUserId = paramString(req.params.targetUserId);
    const mode = (req.body as { mode?: string }).mode;
    if (mode !== "active" && mode !== "expired") {
      res.status(400).json({ error: "invalid_mode" });
      return;
    }
    const target = db.prepare("SELECT id, role FROM users WHERE id = ?").get(targetUserId) as
      | { id: string; role: string }
      | undefined;
    if (!target) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (target.role === "superadmin") {
      res.status(400).json({ error: "cannot_modify_superadmin" });
      return;
    }
    const sub = db
      .prepare(
        `SELECT id FROM subscriptions WHERE user_id = ? ORDER BY datetime(created_at) DESC LIMIT 1`
      )
      .get(targetUserId) as { id: string } | undefined;

    const nowMs = Date.now();
    const endsIso =
      mode === "active"
        ? new Date(nowMs + SUBSCRIPTION_PERIOD_DAYS * 86400000).toISOString()
        : new Date(nowMs - 86400000).toISOString();

    if (sub) {
      db.prepare(
        `UPDATE subscriptions SET status = 'approved', ends_at = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`
      ).run(endsIso, adminId, sub.id);
    } else {
      const sid = randomUUID();
      db.prepare(
        `INSERT INTO subscriptions (id, user_id, plan_id, modules, payment_method, status, reviewed_at, reviewed_by, ends_at)
         VALUES (?, ?, 'full_management', ?, 'admin_manual', 'approved', datetime('now'), ?, ?)`
      ).run(sid, targetUserId, FULL_MODULES_JSON, adminId, endsIso);
    }
    res.json({ ok: true });
  }
);

app.get("/api/admin/subscription-stats", authMiddleware, superAdminOnly, (_req, res) => {
  const rows = db
    .prepare(`SELECT ends_at FROM subscriptions WHERE status = 'approved'`)
    .all() as { ends_at: string | null }[];
  const now = Date.now();
  let activeSubscriptions = 0;
  let expiredSubscriptions = 0;
  for (const r of rows) {
    const t = r.ends_at ? new Date(r.ends_at).getTime() : 0;
    if (Number.isFinite(t) && t > now) activeSubscriptions++;
    else expiredSubscriptions++;
  }
  const trialRow = db
    .prepare(
      `SELECT COUNT(*) AS c FROM users WHERE trial_ends_at IS NOT NULL AND datetime(trial_ends_at) > datetime('now')`
    )
    .get() as { c: number };
  res.json({
    activeSubscriptions,
    expiredSubscriptions,
    activeTrials: trialRow.c,
  });
});

app.get("/api/admin/support/inbox", authMiddleware, superAdminOnly, (_req, res) => {
  const messages = db
    .prepare(
      `SELECT m.id, m.user_id, m.from_admin, m.body, m.created_at, u.email, u.name AS user_name
       FROM support_messages m
       JOIN users u ON u.id = m.user_id
       ORDER BY datetime(m.created_at) DESC
       LIMIT 800`
    )
    .all();
  res.json({ messages });
});

app.post("/api/admin/support/reply", authMiddleware, superAdminOnly, (req, res) => {
  const { userId, body } = req.body as { userId?: string; body?: string };
  const uid = typeof userId === "string" ? userId.trim() : "";
  const text = typeof body === "string" ? body.trim() : "";
  if (!uid || !text || text.length > 8000) {
    res.status(400).json({ error: "invalid" });
    return;
  }
  const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(uid) as { id: string } | undefined;
  if (!exists) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  const id = randomUUID();
  db.prepare(`INSERT INTO support_messages (id, user_id, from_admin, body) VALUES (?, ?, 1, ?)`).run(
    id,
    uid,
    text
  );
  res.json({ ok: true, id });
});

app.get("/api/support/messages", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const messages = db
    .prepare(
      `SELECT id, from_admin, body, created_at FROM support_messages WHERE user_id = ? ORDER BY datetime(created_at) ASC`
    )
    .all(userId);
  res.json({ messages });
});

app.post("/api/support/messages", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const text = String((req.body as { body?: string }).body ?? "").trim();
  if (!text || text.length > 8000) {
    res.status(400).json({ error: "invalid_message" });
    return;
  }
  const id = randomUUID();
  db.prepare(`INSERT INTO support_messages (id, user_id, from_admin, body) VALUES (?, ?, 0, ?)`).run(
    id,
    userId,
    text
  );
  res.json({ ok: true, id });
});

/** تجميع مبيعات المخزون (pos_invoices) عبر كل المستخدمين — يطابق منطق /dashboard/financial-summary */
app.get("/api/admin/sales-analytics", authMiddleware, superAdminOnly, (_req, res) => {
  const invoices = db
    .prepare(
      "SELECT total, paid, created_at, lines_json FROM pos_invoices ORDER BY created_at DESC LIMIT 8000"
    )
    .all() as { total: number; paid: number; created_at: string; lines_json: string }[];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const hourAgo = Date.now() - 3600000;

  let todayRevenue = 0;
  let hourRevenue = 0;
  let todayProfit = 0;
  let hourProfit = 0;

  for (const inv of invoices) {
    const ts = new Date(inv.created_at).getTime();
    const total = Number(inv.total) || 0;
    if (ts >= startOfToday) todayRevenue += total;
    if (ts >= hourAgo) hourRevenue += total;

    let lineProfitSum = 0;
    try {
      const lines = JSON.parse(inv.lines_json) as { line_profit?: number }[];
      if (Array.isArray(lines)) {
        for (const line of lines) lineProfitSum += Number(line.line_profit) || 0;
      }
    } catch {
      /* ignore */
    }
    if (ts >= startOfToday) todayProfit += lineProfitSum;
    if (ts >= hourAgo) hourProfit += lineProfitSum;
  }

  const dayMs = 86400000;
  const chart: { day: string; revenue: number; profit: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday - i * dayMs);
    const d0 = d.getTime();
    const d1 = d0 + dayMs;
    let rev = 0;
    let prof = 0;
    for (const inv of invoices) {
      const ts = new Date(inv.created_at).getTime();
      if (ts < d0 || ts >= d1) continue;
      rev += Number(inv.total) || 0;
      try {
        const lines = JSON.parse(inv.lines_json) as { line_profit?: number }[];
        if (Array.isArray(lines)) {
          for (const line of lines) prof += Number(line.line_profit) || 0;
        }
      } catch {
        /* ignore */
      }
    }
    chart.push({
      day: d.toISOString().slice(0, 10),
      revenue: Math.round(rev * 100) / 100,
      profit: Math.round(prof * 100) / 100,
    });
  }

  res.json({
    invoiceCount: invoices.length,
    todayRevenue: Math.round(todayRevenue * 100) / 100,
    hourRevenue: Math.round(hourRevenue * 100) / 100,
    todayNetProfit: Math.round(todayProfit * 100) / 100,
    hourNetProfit: Math.round(hourProfit * 100) / 100,
    chart,
  });
});

/** HR + modules data (scoped to user) */
app.get("/api/hr/employees", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "hr")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = db.prepare("SELECT * FROM hr_employees WHERE user_id = ?").all(userId);
  res.json({ employees: rows });
});

app.post("/api/hr/employees", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "hr")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    name: string;
    employee_id: string;
    role: string;
    salary: number;
    contract_type: string;
    contract_end?: string;
  };
  const id = randomUUID();
  db.prepare(
    `INSERT INTO hr_employees (id, user_id, name, employee_id, role, salary, contract_type, contract_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    b.name,
    b.employee_id,
    b.role,
    b.salary,
    b.contract_type,
    b.contract_end ?? null
  );
  res.json({ id });
});

app.patch("/api/hr/employees/:id", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const id = paramString(req.params.id);
  if (!moduleAllowed(userId, "hr")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    name: string;
    employee_id: string;
    role: string;
    salary: number;
    contract_type: string;
    contract_end?: string | null;
  };
  const r = db
    .prepare(
      `UPDATE hr_employees SET name = ?, employee_id = ?, role = ?, salary = ?, contract_type = ?, contract_end = ? WHERE id = ? AND user_id = ?`
    )
    .run(
      b.name,
      b.employee_id,
      b.role,
      b.salary,
      b.contract_type,
      b.contract_end ?? null,
      id,
      userId
    );
  if (r.changes === 0) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }
  res.json({ ok: true });
});

app.patch("/api/hr/metrics/:id", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const id = paramString(req.params.id);
  if (!moduleAllowed(userId, "hr")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    week_label: string;
    production: number;
    logistics: number;
    quality: number;
  };
  const r = db
    .prepare(
      `UPDATE production_metrics SET week_label = ?, production = ?, logistics = ?, quality = ? WHERE id = ? AND user_id = ?`
    )
    .run(b.week_label, b.production, b.logistics, b.quality, id, userId);
  if (r.changes === 0) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/hr/metrics", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "hr")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  let rows = db
    .prepare("SELECT * FROM production_metrics WHERE user_id = ? ORDER BY week_label")
    .all(userId) as Record<string, unknown>[];
  if (rows.length === 0) {
    const weeks = ["أسبوع 1", "أسبوع 2", "أسبوع 3", "أسبوع 4"];
    for (let i = 0; i < weeks.length; i++) {
      const id = randomUUID();
      db.prepare(
        `INSERT INTO production_metrics (id, user_id, week_label, production, logistics, quality) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        userId,
        weeks[i],
        60 + i * 8 + Math.random() * 10,
        55 + i * 5,
        88 + Math.random() * 5
      );
    }
    rows = db
      .prepare("SELECT * FROM production_metrics WHERE user_id = ? ORDER BY week_label")
      .all(userId) as Record<string, unknown>[];
  }
  res.json({ metrics: rows });
});

function getUserGateFlags(userId: string): { bypass: boolean } {
  const u = db.prepare("SELECT role, email, name FROM users WHERE id = ?").get(userId) as
    | { role: string; email: string; name: string }
    | undefined;
  if (!u) return { bypass: false };
  const bypass =
    u.role === "superadmin" ||
    u.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(u.email, u.name);
  return { bypass };
}

function moduleAllowed(userId: string, mod: string): boolean {
  if (getUserGateFlags(userId).bypass) return true;
  /** رادار التأشيرة: لا يُفتح إلا بعد موافقة الأدمن (عمود visa_unlock_approved) */
  if (mod === "visa") {
    const u = db.prepare("SELECT visa_unlock_approved FROM users WHERE id = ?").get(userId) as
      | { visa_unlock_approved: number }
      | undefined;
    return Boolean(u?.visa_unlock_approved);
  }
  if (userHasActiveTrial(userId) && TRIAL_MODULE_IDS.has(mod)) return true;
  const sub = db
    .prepare(
      `SELECT modules, ends_at FROM subscriptions WHERE user_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId) as { modules: string; ends_at: string | null } | undefined;
  if (!sub) return false;
  if (sub.ends_at) {
    const end = new Date(sub.ends_at).getTime();
    if (!Number.isFinite(end) || end <= Date.now()) return false;
  }
  try {
    const mods = JSON.parse(sub.modules) as string[];
    return Array.isArray(mods) && mods.includes(mod);
  } catch {
    return false;
  }
}

function aiGenerateAllowed(userId: string, moduleName: string): boolean {
  if (getUserGateFlags(userId).bypass) return true;
  switch (moduleName) {
    case "mediaLab":
      return moduleAllowed(userId, "media_lab");
    case "legalAi":
      return (
        moduleAllowed(userId, "legal_ai") ||
        moduleAllowed(userId, "law") ||
        moduleAllowed(userId, "public")
      );
    case "law":
      return moduleAllowed(userId, "law");
    case "public":
      return moduleAllowed(userId, "public");
    case "exam":
      return moduleAllowed(userId, "edu");
    case "hrContract":
      return moduleAllowed(userId, "hr");
    default:
      return false;
  }
}

app.get("/api/law/cases", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "law")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = db.prepare("SELECT * FROM lawyer_cases WHERE user_id = ?").all(userId);
  res.json({ cases: rows });
});

app.post("/api/law/cases", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "law")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as { title: string; client_name: string; deadline?: string };
  const id = randomUUID();
  db.prepare(
    `INSERT INTO lawyer_cases (id, user_id, title, client_name, deadline) VALUES (?, ?, ?, ?, ?)`
  ).run(id, userId, b.title, b.client_name, b.deadline ?? null);
  res.json({ id });
});

app.get("/api/acc/reports", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "acc")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = db.prepare("SELECT * FROM accountant_reports WHERE user_id = ?").all(userId);
  res.json({ reports: rows });
});

app.post("/api/acc/reports", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "acc")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    title: string;
    period: string;
    amount?: number;
    notes?: string;
    entry_type?: string;
  };
  const id = randomUUID();
  const flow = b.entry_type === "income" ? "income" : "expense";
  db.prepare(
    `INSERT INTO accountant_reports (id, user_id, title, period, amount, notes, entry_type) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, b.title, b.period, b.amount ?? null, b.notes ?? null, flow);
  res.json({ id });
});

app.patch("/api/acc/reports/:id", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const id = paramString(req.params.id);
  if (!moduleAllowed(userId, "acc")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    title: string;
    period: string;
    amount?: number | null;
    notes?: string | null;
    entry_type?: string;
  };
  const flow = b.entry_type === "income" ? "income" : "expense";
  const r = db
    .prepare(
      `UPDATE accountant_reports SET title = ?, period = ?, amount = ?, notes = ?, entry_type = ? WHERE id = ? AND user_id = ?`
    )
    .run(b.title, b.period, b.amount ?? null, b.notes ?? null, flow, id, userId);
  if (r.changes === 0) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/reminders", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const rows = db.prepare("SELECT * FROM reminders WHERE user_id = ?").all(userId);
  res.json({ reminders: rows });
});

app.post("/api/reminders", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const b = req.body as {
    channel: string;
    target: string;
    message: string;
    due_at: string;
  };
  const id = randomUUID();
  db.prepare(
    `INSERT INTO reminders (id, user_id, channel, target, message, due_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, b.channel, b.target, b.message, b.due_at);
  res.json({ id, note: "في الإنتاج: ربط Twilio / SendGrid / WhatsApp Business API" });
});

function mockAiText(
  module: string,
  locale: string,
  ctx: Record<string, string>
): string {
  const name = ctx.name || "—";
  const city = ctx.city || "—";
  const amount = ctx.amount || "";
  if (module === "public") {
    if (locale.startsWith("ar"))
      return `مسودة آلية: يُذكر الطرف ${name}، بمدينة ${city}${amount ? `، عن مبلغ ${amount} درهم` : ""}. يُراجع النص من طرف الكاتب العمومي قبل التوقيع.`;
    if (locale.startsWith("fr"))
      return `Ébauche auto : partie ${name}, ${city}${amount ? `, montant ${amount} MAD` : ""}. Révision par l’officier requise.`;
    if (locale === "es")
      return `Borrador automático: parte ${name}, ${city}${amount ? `, importe ${amount} MAD` : ""}. Revisión del fedatario obligatoria.`;
    return `Auto-draft: party ${name}, ${city}${amount ? `, amount ${amount} MAD` : ""}. Notarial review required.`;
  }
  if (module === "exam") {
    if (locale.startsWith("ar")) return `سؤال مقترح حول «${name}» — يُخصص للمستوى والمادة حسب جدولك.`;
    if (locale.startsWith("fr")) return `Question suggérée sur « ${name} » — adaptez au niveau et à la matière.`;
    if (locale === "es") return `Pregunta sugerida sobre «${name}» — adapte nivel y asignatura.`;
    return `Suggested question on "${name}" — adapt to level and subject.`;
  }
  if (module === "legalAi") {
    if (locale.startsWith("ar"))
      return `مسودة إرشادية (المملكة المغربية): يُذكر الطرف ${name} بـ ${city}. يُستند إلى التشريع المغربي الجاري به العمل؛ يُراجع النص قبل الإيداع.`;
    if (locale.startsWith("fr"))
      return `Ébauche indicative (Royaume du Maroc) : partie ${name}, ${city}. Fondée sur le droit marocain en vigueur ; révision avant dépôt.`;
    if (locale === "es")
      return `Borrador orientativo (Reino de Marruecos): parte ${name}, ${city}. Basado en la legislación marroquí vigente; revisión antes del depósito.`;
    return `Indicative draft (Kingdom of Morocco): party ${name}, ${city}. Grounded in applicable Moroccan law; review before filing.`;
  }
  if (module === "hrContract") {
    const emp = ctx.employee || ctx.name || "—";
    if (locale.startsWith("ar"))
      return `مسودة عقد عمل (مغرب): بين ${ctx.employer || "المشغّل"} والموظف ${emp} — المسمى ${ctx.jobTitle || "—"}، الأجر ${ctx.salaryGross || "—"} درهم، نوع ${ctx.contractType || "CDI"}. يُراجع لدى المحامي قبل التوقيع.`;
    if (locale.startsWith("fr"))
      return `Projet de contrat de travail (Maroc) : ${ctx.employer || "Employeur"} / ${emp}, poste ${ctx.jobTitle || "—"}, salaire ${ctx.salaryGross || "—"} MAD, ${ctx.contractType || "CDI"}. Révision juridique requise.`;
    return `Employment contract draft (Morocco): ${ctx.employer || "Employer"} / ${emp}, role ${ctx.jobTitle || "—"}, salary ${ctx.salaryGross || "—"} MAD, ${ctx.contractType || "CDI"}. Legal review required.`;
  }
  if (module === "mediaLab") {
    const topic = ctx.prompt || ctx.topic || name;
    if (locale.startsWith("ar"))
      return `مقترح إشهاري لـ «${topic}»: عنوان قصير جذّاب، ألوان زاهية (أزرق ملكي + برتقالي ذهبي)، دعوة واضحة للاتصال، ومشهد فيديو مدته حتى 60 ثانية: لقطات منتج/خدمة + شعار في الختام.`;
    if (locale.startsWith("fr"))
      return `Proposition promo « ${topic} » : accroche courte, couleurs vives (bleu royal + orange), appel à l’action, storyboard vidéo ≤ 60 s : plans produit/service + logo final.`;
    if (locale === "es")
      return `Propuesta promocional «${topic}»: titular breve, colores vivos (azul real + naranja), llamada a la acción, guion de vídeo ≤ 60 s: planos + logo final.`;
    return `Promo brief for "${topic}": short headline, bold colors (royal blue + orange), clear CTA, ≤60s video storyboard: product shots + closing logo.`;
  }
  return `Context: ${name}, ${city}. (Smart Al-Idara Pro — AI assist)`;
}

function buildAiPrompt(module: string, locale: string, ctx: Record<string, string>): string {
  const json = JSON.stringify(ctx);
  const moroccanLaw =
    "Ground the draft in Moroccan law in force: Constitution (2011). Cite and apply as relevant: Dahir 1-58-250 (Code of Civil Procedure) for civil matters; Moroccan criminal procedure codes for penal matters; Law 03-12 (administrative justice); specialized codes and dahirs. Ensure wording supports formal admissibility (form and substance) before Moroccan courts and administrations.";
  const base = `You are a legal and administrative drafting assistant for the Kingdom of Morocco (Smart Al-Idara Pro). Module: ${module}. Locale: ${locale}. User data (JSON): ${json}. Produce concise formal text in the user's language only, no markdown, max 400 words.`;
  if (module === "law" || module === "public" || module === "legalAi") {
    return `${base} ${moroccanLaw}`;
  }
  if (module === "mediaLab") {
    const fmt = ctx.format;
    if (fmt === "logo_brief_vector") {
      return `You are a principal brand designer. Locale: ${locale}. JSON context: ${json}. Deliver a professional logo system brief: naming idea, symbolic meaning, primary palette (hex), typography pairing, geometric construction, clear-space rules, misuse warnings, and three lockup descriptions (wordmark, emblem, stacked). Plain text only, no markdown, max 220 words.`;
    }
    return `You are a senior creative director for premium cinematic ads. Locale: ${locale}. JSON context: ${json}. Produce high-fidelity, broadcast-ready ideas. Plain text only, no markdown, max 220 words. Output: (1) headline; (2) two punchy taglines; (3) five cinematic shots with lighting and lens notes (≤60s total). If format is ad_script_60s, add a full second-by-second script-to-video outline: VO line + on-screen visual + transition for each second 1–60.`;
  }
  return base;
}

/** تخزين مؤقت قصير لردود mediaLab فقط — يقلل زمن التكرار دون تخزين بيانات قانونية حساسة */
const mediaLabAiCache = new Map<string, { text: string; exp: number }>();
const MEDIA_AI_CACHE_MS = 90_000;

function stableContextKey(ctx: Record<string, string>): string {
  const keys = Object.keys(ctx).sort();
  return keys.map((k) => `${k}:${ctx[k] ?? ""}`).join("|");
}

app.post("/api/ai/generate", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { module, locale, context } = req.body as {
    module?: string;
    locale?: string;
    context?: Record<string, string>;
  };
  if (!module || !context || typeof context !== "object") {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  if (!aiGenerateAllowed(userId, module)) {
    res.status(403).json({ error: "القسم غير مفعّل أو انتهى الاشتراك" });
    return;
  }
  const loc = locale ?? "ar-MA";
  const mediaKey = module === "mediaLab" ? `${loc}:${stableContextKey(context)}` : "";
  if (module === "mediaLab" && mediaKey) {
    const hit = mediaLabAiCache.get(mediaKey);
    if (hit && hit.exp > Date.now()) {
      res.json({ text: hit.text });
      return;
    }
  }
  const maxTokens = module === "mediaLab" ? 420 : 900;
  const key = process.env.OPENAI_API_KEY;
  if (key) {
    try {
      const prompt = buildAiPrompt(module, loc, context);
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: module === "mediaLab" ? 0.65 : 0.7,
        }),
      });
      const json = (await r.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json?.choices?.[0]?.message?.content?.trim();
      if (text) {
        if (module === "mediaLab" && mediaKey) {
          mediaLabAiCache.set(mediaKey, { text, exp: Date.now() + MEDIA_AI_CACHE_MS });
          if (mediaLabAiCache.size > 80) {
            const now = Date.now();
            for (const [k, v] of mediaLabAiCache) {
              if (v.exp <= now) mediaLabAiCache.delete(k);
            }
          }
        }
        res.json({ text });
        return;
      }
    } catch {
      /* fallback mock */
    }
  }
  const fallback = mockAiText(module, loc, context);
  if (module === "mediaLab" && mediaKey) {
    mediaLabAiCache.set(mediaKey, { text: fallback, exp: Date.now() + MEDIA_AI_CACHE_MS });
  }
  res.json({ text: fallback });
});

app.get("/api/studio/capabilities", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const allowed = aiGenerateAllowed(userId, "mediaLab");
  const openAiKeyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const textToImage = Boolean(allowed && openAiKeyConfigured);
  res.json({ textToImage, openAiKeyConfigured });
});

app.post("/api/studio/text-to-image", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!aiGenerateAllowed(userId, "mediaLab")) {
    res.status(403).json({ error: "القسم غير مفعّل أو انتهى الاشتراك" });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: "توليد الصور غير مفعّل على الخادم" });
    return;
  }
  const body = req.body as { prompt?: string; size?: string };
  const prompt = (body.prompt ?? "").trim().slice(0, 4000);
  if (!prompt.length) {
    res.status(400).json({ error: "الوصف ناقص" });
    return;
  }
  const sizeRaw = body.size ?? "1024x1024";
  const size =
    sizeRaw === "1792x1024" || sizeRaw === "1024x1792" || sizeRaw === "1024x1024"
      ? sizeRaw
      : "1024x1024";
  try {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
        quality: "hd",
        response_format: "b64_json",
      }),
    });
    const json = (await r.json()) as {
      data?: { b64_json?: string }[];
      error?: { message?: string };
    };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      const msg = json.error?.message ?? `openai_images_${r.status}`;
      res.status(r.ok ? 502 : r.status).json({ error: msg });
      return;
    }
    res.json({ b64 });
  } catch {
    res.status(500).json({ error: "فشل الاتصال بتوليد الصورة" });
  }
});

/** إعدادات المنصة (عامة) — روابط التواصل ومعلومات الدفع */
app.get("/api/settings/public", (_req, res) => {
  const rows = db.prepare("SELECT key, value FROM app_settings").all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json({ settings });
});

app.put("/api/settings/platform", authMiddleware, superAdminOnly, (req, res) => {
  const body = req.body as Record<string, unknown>;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  const allowed = new Set([
    "social_whatsapp",
    "social_facebook",
    "social_instagram",
    "social_tiktok",
    "social_youtube",
    "social_linkedin",
    "youtube_channel_id",
    "bank_name",
    "bank_rib",
    "bank_iban",
    "bank_holder",
  ]);
  for (const [k, v] of Object.entries(body)) {
    if (!allowed.has(k) || typeof v !== "string") continue;
    db.prepare(
      `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`
    ).run(k, v);
  }
  res.json({ ok: true });
});

/** ملف تأشيرة — بيانات محفوظة للحجز التلقائي */
app.get("/api/visa/profile", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "visa")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const row = db
    .prepare("SELECT * FROM visa_user_profile WHERE user_id = ?")
    .get(userId) as Record<string, unknown> | undefined;
  res.json({ profile: row ?? null });
});

app.post("/api/visa/profile", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "visa")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    full_name?: string;
    passport_no?: string;
    phone?: string;
    email?: string;
    extra_json?: string;
  };
  const ex = db.prepare("SELECT user_id FROM visa_user_profile WHERE user_id = ?").get(userId);
  if (ex) {
    db.prepare(
      `UPDATE visa_user_profile SET full_name = ?, passport_no = ?, phone = ?, email = ?, extra_json = ?, updated_at = datetime('now') WHERE user_id = ?`
    ).run(
      b.full_name ?? "",
      b.passport_no ?? "",
      b.phone ?? "",
      b.email ?? "",
      b.extra_json ?? "{}",
      userId
    );
  } else {
    db.prepare(
      `INSERT INTO visa_user_profile (user_id, full_name, passport_no, phone, email, extra_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      userId,
      b.full_name ?? "",
      b.passport_no ?? "",
      b.phone ?? "",
      b.email ?? "",
      b.extra_json ?? "{}"
    );
  }
  res.json({ ok: true });
});

/** حالة مواعيد التأشيرة — مرجع مركزي لكل مستخدم (تحديث من زر التحديث) */
app.get("/api/visa/appointment-status", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "visa")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = db
    .prepare("SELECT center_id, status, updated_at FROM visa_appointment_status WHERE user_id = ?")
    .all(userId) as { center_id: string; status: string; updated_at: string }[];
  res.json({ rows });
});

app.post("/api/visa/appointment-status/:centerId/refresh", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "visa")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const centerId = paramString(req.params.centerId).trim();
  if (!centerId) {
    res.status(400).json({ error: "مرجع المركز ناقص" });
    return;
  }
  const prev = db
    .prepare("SELECT status FROM visa_appointment_status WHERE user_id = ? AND center_id = ?")
    .get(userId, centerId) as { status: string } | undefined;
  const order: Array<"open" | "closed" | "soon"> = ["open", "closed", "soon"];
  const prevStatus = (prev?.status as "open" | "closed" | "soon") ?? "soon";
  const idx = order.indexOf(prevStatus);
  const next = order[(idx + 1) % 3];
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO visa_appointment_status (user_id, center_id, status, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, center_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`
  ).run(userId, centerId, next, now);
  const changed = prevStatus !== next;
  res.json({
    center_id: centerId,
    previous_status: prevStatus,
    status: next,
    updated_at: now,
    changed,
  });
});

/** مخزون ونقاط بيع */
app.get("/api/inventory/products", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "inventory")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = db.prepare("SELECT * FROM inventory_products WHERE user_id = ? ORDER BY name").all(userId);
  res.json({ products: rows });
});

app.post("/api/inventory/products", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "inventory")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    name: string;
    sku?: string;
    retail_type?: string;
    pieces_per_carton?: number;
    unit_price?: number;
    stock_pieces?: number;
    unit_kind?: string;
    cost_price?: number;
    expiry_date?: string | null;
    low_stock_alert?: number;
  };
  if (!b.name?.trim()) {
    res.status(400).json({ error: "اسم المنتج مطلوب" });
    return;
  }
  const id = randomUUID();
  const ppc = Math.max(1, Number(b.pieces_per_carton) || 1);
  const unitKind = (b.unit_kind?.trim() || "piece").slice(0, 24);
  const cost = Math.max(0, Number(b.cost_price) || 0);
  const expiry = b.expiry_date?.trim() ? b.expiry_date.trim().slice(0, 10) : null;
  const lowAlert = Math.max(0, Math.floor(Number(b.low_stock_alert) ?? 10) || 10);
  db.prepare(
    `INSERT INTO inventory_products (id, user_id, name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, unit_kind, cost_price, expiry_date, low_stock_alert) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    b.name.trim(),
    b.sku?.trim() ?? "",
    b.retail_type?.trim() || "retail",
    ppc,
    Number(b.unit_price) || 0,
    Math.max(0, Number(b.stock_pieces) || 0),
    unitKind,
    cost,
    expiry,
    lowAlert
  );
  res.json({ id });
});

app.patch("/api/inventory/products/:id", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "inventory")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const id = paramString(req.params.id);
  const b = req.body as {
    name?: string;
    sku?: string;
    retail_type?: string;
    pieces_per_carton?: number;
    unit_price?: number;
    stock_pieces?: number;
    unit_kind?: string;
    cost_price?: number;
    expiry_date?: string | null;
    low_stock_alert?: number;
  };
  const r = db
    .prepare(
      `UPDATE inventory_products SET name = COALESCE(?, name), sku = COALESCE(?, sku), retail_type = COALESCE(?, retail_type),
       pieces_per_carton = COALESCE(?, pieces_per_carton), unit_price = COALESCE(?, unit_price), stock_pieces = COALESCE(?, stock_pieces),
       unit_kind = COALESCE(?, unit_kind), cost_price = COALESCE(?, cost_price),
       expiry_date = COALESCE(?, expiry_date), low_stock_alert = COALESCE(?, low_stock_alert)
       WHERE id = ? AND user_id = ?`
    )
    .run(
      b.name ?? null,
      b.sku ?? null,
      b.retail_type ?? null,
      b.pieces_per_carton ?? null,
      b.unit_price ?? null,
      b.stock_pieces ?? null,
      b.unit_kind ?? null,
      b.cost_price ?? null,
      b.expiry_date ?? null,
      b.low_stock_alert ?? null,
      id,
      userId
    );
  if (r.changes === 0) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }
  res.json({ ok: true });
});

/** استخراج نص من PDF أو DOCX للمخزون (OCR الذكاء يكمّل على العميل للصور) */
app.post(
  "/api/inventory/extract-document-text",
  authMiddleware,
  uploadMemory.single("file"),
  async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    if (!moduleAllowed(userId, "inventory")) {
      res.status(403).json({ error: "القسم غير مفعّل" });
      return;
    }
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "ملف مفقود" });
      return;
    }
    const name = (file.originalname || "").toLowerCase();
    const mime = file.mimetype || "";
    try {
      if (mime === "application/pdf" || name.endsWith(".pdf")) {
        const data = await pdfParse(file.buffer);
        res.json({ text: (data.text || "").trim() });
        return;
      }
      if (
        mime.includes("wordprocessingml") ||
        mime.includes("msword") ||
        name.endsWith(".docx") ||
        name.endsWith(".doc")
      ) {
        const r = await mammoth.extractRawText({ buffer: file.buffer });
        res.json({ text: (r.value || "").trim() });
        return;
      }
      res.status(415).json({ error: "نوع غير مدعوم للخادم — استخدم صورة أو Excel من الجهاز" });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "فشل القراءة" });
    }
  }
);

/** استخراج أصناف جاهزة من صورة (GPT-4o vision) — JSON منسّق */
app.post(
  "/api/inventory/vision-extract-receipt",
  authMiddleware,
  uploadMemory.single("file"),
  async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    if (!moduleAllowed(userId, "inventory")) {
      res.status(403).json({ error: "القسم غير مفعّل" });
      return;
    }
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "ملف مفقود" });
      return;
    }
    const mime = file.mimetype || "";
    if (!mime.startsWith("image/")) {
      res.status(415).json({ error: "يُقبل صورة فقط" });
      return;
    }
    try {
      const items = await extractReceiptWithOpenAiVision(file.buffer, mime);
      res.json({ items });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل الرؤية";
      if (msg === "no_key") {
        res.status(503).json({ error: "مفتاح OpenAI غير مضبوط — OPENAI_API_KEY" });
        return;
      }
      res.status(500).json({ error: msg });
    }
  }
);

app.post("/api/inventory/stock-add", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "inventory")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as { product_id?: string; add_pieces?: number };
  if (!b.product_id || !Number.isFinite(Number(b.add_pieces))) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  const add = Math.max(0, Math.floor(Number(b.add_pieces)));
  const r = db
    .prepare(
      `UPDATE inventory_products SET stock_pieces = stock_pieces + ? WHERE id = ? AND user_id = ?`
    )
    .run(add, b.product_id, userId);
  if (r.changes === 0) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/inventory/sale", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "inventory")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    product_id?: string;
    qty_pieces?: number;
    customer_name?: string;
    paid?: number;
    due_at?: string | null;
  };
  if (!b.product_id || !Number.isFinite(Number(b.qty_pieces))) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  const qty = Math.max(1, Math.floor(Number(b.qty_pieces)));
  const product = db
    .prepare("SELECT * FROM inventory_products WHERE id = ? AND user_id = ?")
    .get(b.product_id, userId) as
    | {
        id: string;
        name: string;
        unit_price: number;
        stock_pieces: number;
        cost_price?: number;
      }
    | undefined;
  if (!product) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }
  if (product.stock_pieces < qty) {
    res.status(400).json({ error: "الكمية غير متوفرة في المخزون" });
    return;
  }
  const lineTotal = qty * product.unit_price;
  const costUnit = Math.max(0, Number(product.cost_price) || 0);
  const lineProfit = qty * (product.unit_price - costUnit);
  const paid = Math.max(0, Number(b.paid) || 0);
  const credit = Math.max(0, lineTotal - paid);
  db.prepare(`UPDATE inventory_products SET stock_pieces = stock_pieces - ? WHERE id = ?`).run(qty, product.id);
  const invId = randomUUID();
  const lines = JSON.stringify([
    {
      product_id: product.id,
      name: product.name,
      qty_pieces: qty,
      unit_price: product.unit_price,
      cost_price: costUnit,
      line_total: lineTotal,
      line_profit: lineProfit,
    },
  ]);
  db.prepare(
    `INSERT INTO pos_invoices (id, user_id, customer_name, lines_json, total, paid, credit, due_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    invId,
    userId,
    b.customer_name?.trim() ?? "",
    lines,
    lineTotal,
    paid,
    credit,
    credit > 0 ? (b.due_at ?? null) : null
  );
  res.json({ id: invId, total: lineTotal, credit });
});

/** بيع متعدد الأسطر في فاتورة واحدة (مسودة البيع السريع) */
app.post("/api/inventory/sale-batch", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "inventory")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    lines?: { product_id?: string; qty_pieces?: number; line_total?: number }[];
    customer_name?: string;
    paid?: number;
    due_at?: string | null;
    /** تجاوز إداري لمجموع الفاتورة (يُحفظ في pos_invoices.total) */
    override_total?: number | null;
  };
  if (!Array.isArray(b.lines) || b.lines.length === 0) {
    res.status(400).json({ error: "القائمة فارغة" });
    return;
  }

  type LineOut = {
    product_id: string;
    name: string;
    qty_pieces: number;
    unit_price: number;
    cost_price: number;
    line_total: number;
    line_profit: number;
  };

  const linesOut: LineOut[] = [];
  let grandTotal = 0;

  try {
    db.exec("BEGIN IMMEDIATE");
    for (const row of b.lines) {
      if (!row.product_id || !Number.isFinite(Number(row.qty_pieces))) {
        throw new Error("بيانات ناقصة");
      }
      const qty = Math.max(1, Math.floor(Number(row.qty_pieces)));
      const product = db
        .prepare("SELECT * FROM inventory_products WHERE id = ? AND user_id = ?")
        .get(row.product_id, userId) as
        | {
            id: string;
            name: string;
            unit_price: number;
            stock_pieces: number;
            cost_price?: number;
          }
        | undefined;
      if (!product) {
        throw new Error("المنتج غير موجود");
      }
      if (product.stock_pieces < qty) {
        throw new Error("الكمية غير متوفرة في المخزون");
      }
      const costUnit = Math.max(0, Number(product.cost_price) || 0);
      const defaultLine = qty * product.unit_price;
      let lineTotal = defaultLine;
      if (row.line_total != null && Number.isFinite(Number(row.line_total)) && Number(row.line_total) >= 0) {
        lineTotal = Math.round(Number(row.line_total) * 100) / 100;
      }
      const lineProfit = lineTotal - qty * costUnit;
      db.prepare(`UPDATE inventory_products SET stock_pieces = stock_pieces - ? WHERE id = ?`).run(qty, product.id);
      linesOut.push({
        product_id: product.id,
        name: product.name,
        qty_pieces: qty,
        unit_price: product.unit_price,
        cost_price: costUnit,
        line_total: lineTotal,
        line_profit: lineProfit,
      });
      grandTotal += lineTotal;
    }

    const ov = b.override_total;
    if (ov != null && Number.isFinite(Number(ov)) && Number(ov) >= 0) {
      grandTotal = Math.round(Number(ov) * 100) / 100;
    }

    const paid = Math.max(0, Number(b.paid) || 0);
    const credit = Math.max(0, grandTotal - paid);
    const invId = randomUUID();
    const linesJson = JSON.stringify(linesOut);
    db.prepare(
      `INSERT INTO pos_invoices (id, user_id, customer_name, lines_json, total, paid, credit, due_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      invId,
      userId,
      (b.customer_name ?? "").trim(),
      linesJson,
      grandTotal,
      paid,
      credit,
      credit > 0 ? (b.due_at ?? null) : null
    );
    db.exec("COMMIT");
    res.json({ id: invId, total: grandTotal, credit });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    const msg = err instanceof Error ? err.message : "فشل البيع";
    if (msg === "الكمية غير متوفرة في المخزون" || msg === "المنتج غير موجود" || msg === "بيانات ناقصة") {
      res.status(400).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

app.get("/api/inventory/invoices", authMiddleware, (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "inventory")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = db
    .prepare("SELECT * FROM pos_invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 200")
    .all(userId);
  res.json({ invoices: rows });
});

registerTlErpRoutes(app, authMiddleware, moduleAllowed, { uploadTl, tlUploadRoot });
registerBase44StudioRoutes(app, { authMiddleware, uploadDir, aiGenerateAllowed });
registerBackendServices(app, authMiddleware);

/** معالجة صور احترافية (Sharp) — يتطلب قسم media_lab */
app.post("/api/media/enhance-image", authMiddleware, upload.single("image"), async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!moduleAllowed(userId, "media_lab")) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const file = (req as express.Request & { file?: Express.Multer.File }).file;
  if (!file) {
    res.status(400).json({ error: "ملف الصورة ناقص" });
    return;
  }
  const removeBg = String((req.body as { removeBg?: string })?.removeBg ?? "") === "1";
  try {
    const meta = await sharp(file.path).metadata();
    const w0 = meta.width ?? 1024;
    const h0 = meta.height ?? 1024;
    const longEdge = Math.max(w0, h0);
    /** رفع دقة ذكي للصور الصغيرة + حد أقصى للطباعة */
    let target = Math.min(4096, Math.max(1800, longEdge < 900 ? longEdge * 2.35 : longEdge < 1600 ? longEdge * 1.42 : longEdge));
    let pipeline = sharp(file.path)
      .rotate()
      .resize({
        width: target,
        height: target,
        fit: "inside",
        withoutEnlargement: false,
        kernel: sharp.kernel.lanczos3,
      });
    /** تقليل ضوضاء خفيف ثم تحسين تباين */
    pipeline = pipeline.median(3);
    pipeline = pipeline.modulate({ brightness: 1.05, saturation: 1.12 });
    pipeline = pipeline.sharpen(0.85, 1, 1.45);
    if (removeBg) {
      pipeline = meta.hasAlpha ? pipeline.ensureAlpha() : pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });
    }
    const outBuf = await pipeline.png({ compressionLevel: 6, adaptiveFiltering: true }).toBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("X-Processed-By", "Smart-Al-Idara-Pro");
    res.send(outBuf);
  } catch (e) {
    console.error("[media/enhance-image]", e);
    res.status(500).json({ error: "فشل معالجة الصورة" });
  } finally {
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
  }
});

const PORT = Number(process.env.PORT ?? 4000);
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Smart Al-Idara Pro API http://localhost:${PORT}`);
  });
}
export default app;
