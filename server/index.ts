import "./loadEnv.js";
import "express-async-errors";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import sharp from "sharp";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { registerBackendServices } from "./backendServices.js";
import { registerBase44StudioRoutes } from "./base44Studio.js";
import { registerTlErpRoutes } from "./tlErpRoutes.js";
import { registerDeliveryHubRoutes } from "./deliveryHubRoutes.js";
import { getTlUploadRoot, getUploadDir } from "./paths.js";
import { getVisaRadarProService } from "./visaRadarPro.js";
import { randomUUID } from "node:crypto";
import { db, initDatabase } from "./db.js";
import { hashPassword, signToken, verifyPassword, verifyToken } from "./crypto.js";
import { ensureSuperAdmin, genReferralCode } from "./seed.js";
import {
  applySecurityMiddleware,
  authAdminBootstrapLimiter,
  authLoginLimiter,
  authRegisterLimiter,
  authSupabaseOauthLimiter,
  createAuthOriginGuard,
  createProductionCorsOptions,
} from "./middleware.js";
import { sanitizeEmail, sanitizeUserDisplayName } from "./stringUtil.js";
import { paramString } from "./reqParams.js";
import { vercelApiUrlRestore } from "./vercelUrlMiddleware.js";
import { customDomainMiddleware } from "./customDomainMiddleware.js";
import {
  resolveGeminiImageApiKey,
} from "./aiImageGeneration.js";

const DEFAULT_TRIAL_BALANCE = 1000;

async function migrateDeliveryHubStockFields() {
  try {
    // Check if stock_quantity column exists
    const checkResult = await db.prepare(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'delivery_hub_products' 
      AND column_name = 'stock_quantity'
    `).get();
    
    if (!checkResult) {
      console.log("[Migration] Adding stock_quantity and low_stock_threshold columns to delivery_hub_products table...");
      await db.prepare(`
        ALTER TABLE public.delivery_hub_products 
        ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0
      `).run();
      await db.prepare(`
        ALTER TABLE public.delivery_hub_products 
        ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5
      `).run();
      console.log("[Migration] Stock fields added successfully");
    } else {
      console.log("[Migration] Stock fields already exist, checking for NULL values...");
      // Update existing products that have NULL values
      const updateResult = await db.prepare(`
        UPDATE public.delivery_hub_products 
        SET stock_quantity = 0, low_stock_threshold = 5
        WHERE stock_quantity IS NULL OR low_stock_threshold IS NULL
      `).run();
      if (updateResult.changes > 0) {
        console.log(`[Migration] Updated ${updateResult.changes} products with default stock values`);
      }
    }

    // Check if sku column exists
    const skuCheckResult = await db.prepare(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'delivery_hub_products' 
      AND column_name = 'sku'
    `).get();
    
    if (!skuCheckResult) {
      console.log("[Migration] Adding sku column to delivery_hub_products table...");
      await db.prepare(`
        ALTER TABLE public.delivery_hub_products 
        ADD COLUMN sku VARCHAR(50)
      `).run();
      console.log("[Migration] SKU column added successfully");
    }
  } catch (error: any) {
    console.error("[Migration] Error adding stock fields:", error.message);
    // Don't throw - allow app to start even if migration fails
  }
}

async function fetchSupabaseUserFromAccessToken(accessToken: string): Promise<{
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string };
} | null> {
  const base = (
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  )
    .trim()
    .replace(/\/$/, "");
  const anon = (
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
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
  "lawyer",
  "acc",
  "public",
  "edu",
  "inventory",
  "members",
  "company",
  "academy",
  "gov",
  "legal_ai",
  "transport_logistics",
  "chat",
  "edu_print",
  "tools",
  "reminders",
]);

async function userHasActiveTrial(userId: string): Promise<boolean> {
  const u = (await db
    .prepare("SELECT trial_ends_at FROM users WHERE id = ?")
    .get(userId)) as { trial_ends_at: string | null } | undefined;
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
      mime.startsWith("image/") ||
      mime.includes("spreadsheet") ||
      mime.includes("excel") ||
      mime.includes("csv") ||
      n.endsWith(".pdf") ||
      n.endsWith(".jpg") ||
      n.endsWith(".jpeg") ||
      n.endsWith(".png") ||
      n.endsWith(".webp") ||
      n.endsWith(".xlsx") ||
      n.endsWith(".xls") ||
      n.endsWith(".csv");
    if (ok) cb(null, true);
    else cb(new Error("file_type"));
  },
});

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
app.use(cors(createProductionCorsOptions()));

// Custom domain middleware for Delivery Hub stores
app.use(customDomainMiddleware);

// Serve uploaded files statically
const uploadsDir = getUploadDir();
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filepath) => {
    const ext = path.extname(filepath).toLowerCase();
    // Set proper headers for video streaming
    if (['.mp4'].includes(ext)) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
    } else if (['.webm'].includes(ext)) {
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Accept-Ranges', 'bytes');
    } else if (['.mov'].includes(ext)) {
      res.setHeader('Content-Type', 'video/quicktime');
      res.setHeader('Accept-Ranges', 'bytes');
    } else if (['.ogg'].includes(ext)) {
      res.setHeader('Content-Type', 'video/ogg');
      res.setHeader('Accept-Ranges', 'bytes');
    }
    // Set proper headers for images
    if (['.png'].includes(ext)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    } else if (['.jpg', '.jpeg'].includes(ext)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    } else if (['.webp'].includes(ext)) {
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    } else if (['.svg'].includes(ext)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    } else if (['.gif'].includes(ext)) {
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

/** يعمل بدون انتظار قاعدة البيانات — للتحقق أن السيرفر يستمع وأن البروكسي يصل */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "smart-al-idara-pro" });
});

let dbReadyPromise: Promise<void> | null = null;

async function ensureDbReady(): Promise<void> {
  if (!dbReadyPromise) {
    dbReadyPromise = (async () => {
      await initDatabase();
      await ensureSuperAdmin();
    })().catch((e) => {
      dbReadyPromise = null;
      throw e;
    });
  }
  await dbReadyPromise;
}

app.get("/api/health/db", async (_req, res, next) => {
  try {
    await ensureDbReady();
    await db.prepare("SELECT 1 AS o").get();
    res.json({ ok: true, db: true });
  } catch (e) {
    next(e);
  }
});

app.use(async (_req, _res, next) => {
  try {
    await ensureDbReady();
    next();
  } catch (e) {
    next(e);
  }
});

const authOriginGuard = createAuthOriginGuard();
app.use("/api/auth", authOriginGuard);
app.use(express.json({ limit: "50mb" }));

// Register AI controller routes - DISABLED to use DB-based endpoint instead
// app.use("/api/ai", aiController);

const upload = multer({ dest: uploadDir, limits: { fileSize: 8 * 1024 * 1024 } });
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});
const uploadInternal = multer({
  dest: uploadDir,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname ?? "").toLowerCase();
    const mime = String(file.mimetype ?? "").toLowerCase();
    const ok =
      mime.startsWith("image/") ||
      mime.includes("pdf") ||
      mime.includes("spreadsheet") ||
      mime.includes("excel") ||
      mime.includes("csv") ||
      mime.includes("word") ||
      mime.includes("text") ||
      mime.includes("zip") ||
      name.endsWith(".pdf") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      name.endsWith(".csv") ||
      name.endsWith(".doc") ||
      name.endsWith(".docx") ||
      name.endsWith(".txt") ||
      name.endsWith(".zip");
    if (ok) cb(null, true);
    else cb(new Error("file_type"));
  },
});

const MAX_DEVICES = 3;

async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
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
    const rowOk = (await db.prepare("SELECT 1 AS o FROM users WHERE id = ?").get(p.sub)) as
      | { o: number }
      | undefined;
    if (!rowOk) {
      res.status(401).json({ error: "جلسة غير صالحة — أعد تسجيل الدخول", code: "SESSION_STALE" });
      return;
    }
    (req as express.Request & { userId: string; role: string }).userId = p.sub;
    (req as express.Request & { userId: string; role: string }).role = p.role;

    if (p.role !== "superadmin") {
      const urow = (await db
        .prepare("SELECT account_locked FROM users WHERE id = ?")
        .get(p.sub)) as { account_locked: number } | undefined;
      if (urow?.account_locked) {
        const path = req.path;
        const method = req.method;
        const allowed =
          path === "/api/me" ||
          path === "/api/subscription/request" ||
          path === "/api/subscription/status" ||
          path === "/api/visa/request-unlock" ||
          path === "/api/devices/remove" ||
          (path === "/api/support/messages" && (method === "GET" || method === "POST"));
        if (!allowed) {
          res.status(403).json({ error: "account_locked", code: "ACCOUNT_LOCKED" });
          return;
        }
      }
    }

    next();
  } catch (e) {
    next(e);
  }
}

async function platformSettingsEditor(req: express.Request, res: express.Response, next: express.NextFunction) {
  const role = (req as express.Request & { role: string }).role;
  if (role === "superadmin") {
    next();
    return;
  }
  const userId = (req as express.Request & { userId: string }).userId;
  const u = (await db.prepare("SELECT email, name FROM users WHERE id = ?").get(userId)) as
    | { email: string; name: string }
    | undefined;
  if (
    u &&
    (u.email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL || isPrimaryAdminUser(u.email, u.name))
  ) {
    next();
    return;
  }
  res.status(403).json({ error: "صلاحيات المشرف العام فقط" });
}

function superAdminOnly(req: express.Request, res: express.Response, next: express.NextFunction) {
  const r = (req as express.Request & { role: string }).role;
  if (r !== "superadmin") {
    res.status(403).json({ error: "صلاحيات المشرف العام فقط" });
    return;
  }
  next();
}

app.post("/api/auth/register", authRegisterLimiter, async (req, res) => {
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
      const refUser = await db
        .prepare("SELECT id FROM users WHERE referral_code = ? OR id = ?")
        .get(refRaw, refRaw) as { id: string } | undefined;
      if (refUser && refUser.id !== id) referredBy = refUser.id;
    }
    const code = await genReferralCode();
    const trialExplicitOff = startTrial === false;
    const trialIso = trialExplicitOff
      ? null
      : new Date(Date.now() + 5 * 86400000).toISOString();
    await db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, referred_by, referral_code, trial_ends_at, trial_balance) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?)`
    ).run(id, emailSafe, hashPassword(password), nameSafe, referredBy, code, trialIso, DEFAULT_TRIAL_BALANCE);
    if (deviceFingerprint) {
      await db.prepare(
        `INSERT INTO devices (id, user_id, fingerprint, label, last_seen) VALUES (?, ?, ?, ?, NOW())`
      ).run(randomUUID(), id, deviceFingerprint, deviceLabel ?? null);
    }
    const token = signToken({ sub: id, role: "user" });
    const emailLower = emailSafe;
    const waMsg = [
      "Smart Al-Idara Pro — تسجيل جديد",
      `البريد: ${emailLower}`,
      referredBy ? `بكود إحالة (مرجع)` : "",
      !trialExplicitOff ? "تجربة 5 أيام: مفعّلة" : "",
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

  let user = await db.prepare("SELECT * FROM users WHERE email = ?").get(emailRaw) as
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
      const refUser = await db
        .prepare("SELECT id FROM users WHERE referral_code = ? OR id = ?")
        .get(refRaw, refRaw) as { id: string } | undefined;
      if (refUser && refUser.id !== id) referredBy = refUser.id;
    }
    const code = await genReferralCode();
    const trialExplicitOff = startTrial === false;
    const trialIso = trialExplicitOff
      ? null
      : new Date(Date.now() + 5 * 86400000).toISOString();
    try {
      await db.prepare(
        `INSERT INTO users (id, email, password_hash, name, role, referred_by, referral_code, trial_ends_at, trial_balance) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?)`
      ).run(id, emailRaw, hashPassword(randomUUID()), name, referredBy, code, trialIso, DEFAULT_TRIAL_BALANCE);
      user = await db.prepare("SELECT * FROM users WHERE id = ?").get(id) as typeof user;
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
    const existing = await db
      .prepare("SELECT id FROM devices WHERE user_id = ? AND fingerprint = ?")
      .get(user.id, deviceFingerprint) as { id: string } | undefined;
    if (!existing) {
      if (!bypassDeviceLimit) {
        const count = await db
          .prepare("SELECT COUNT(*)::int as c FROM devices WHERE user_id = ?")
          .get(user.id) as { c: number };
        if (count.c >= MAX_DEVICES) {
          res.status(403).json({
            error: "تم تجاوز الحد الأقصى للأجهزة (3). اتصل بالدعم أو احذف جهازاً من الإعدادات.",
            code: "DEVICE_LIMIT",
          });
          return;
        }
      }
      await db.prepare(
        `INSERT INTO devices (id, user_id, fingerprint, label, last_seen) VALUES (?, ?, ?, ?, NOW())`
      ).run(randomUUID(), user.id, deviceFingerprint, deviceLabel ?? null);
    } else {
      await db.prepare(`UPDATE devices SET last_seen = NOW() WHERE id = ?`).run(existing.id);
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

app.post("/api/auth/login", authLoginLimiter, async (req, res) => {
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
  const user = await db
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
    const existing = await db
      .prepare("SELECT id FROM devices WHERE user_id = ? AND fingerprint = ?")
      .get(user.id, deviceFingerprint) as { id: string } | undefined;
    if (!existing) {
      if (!bypassDeviceLimit) {
        const count = await db
          .prepare("SELECT COUNT(*)::int as c FROM devices WHERE user_id = ?")
          .get(user.id) as { c: number };
        if (count.c >= MAX_DEVICES) {
          res.status(403).json({
            error: "تم تجاوز الحد الأقصى للأجهزة (3). اتصل بالدعم أو احذف جهازاً من الإعدادات.",
            code: "DEVICE_LIMIT",
          });
          return;
        }
      }
      await db.prepare(
        `INSERT INTO devices (id, user_id, fingerprint, label, last_seen) VALUES (?, ?, ?, ?, NOW())`
      ).run(randomUUID(), user.id, deviceFingerprint, deviceLabel ?? null);
    } else {
      await db.prepare(`UPDATE devices SET last_seen = NOW() WHERE id = ?`).run(existing.id);
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
app.post("/api/auth/admin-bootstrap", authAdminBootstrapLimiter, async (req, res) => {
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
  const user = await db
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

app.get("/api/me", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const user = await db
    .prepare(
      `SELECT id, email, name, role, whatsapp, referral_code, trial_ends_at, visa_unlock_approved, visa_unlock_requested_at, account_locked, trial_balance FROM users WHERE id = ?`
    )
    .get(userId) as
    | {
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
      }
    | undefined;
  if (!user) {
    res.status(401).json({ error: "المستخدم غير موجود", code: "USER_NOT_FOUND" });
    return;
  }
  const sub = await db
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
  const devices = await db
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

// Super Admin API endpoints to bypass RLS
// These endpoints allow Super Admin to manage all data across all users
app.get("/api/super-admin/inventory-products", authMiddleware, platformSettingsEditor, async (_req, res) => {
  try {
    // Get all inventory products (bypass RLS)
    const products = await db
      .prepare(`SELECT * FROM inventory_products ORDER BY name ASC`)
      .all();
    res.json(products);
  } catch (error) {
    console.error("[Super Admin] Error fetching inventory products:", error);
    res.status(500).json({ error: "Failed to fetch inventory products" });
  }
});

app.post("/api/super-admin/inventory-products", authMiddleware, platformSettingsEditor, async (req, res) => {
  try {
    const products = Array.isArray(req.body) ? req.body : [req.body];
    const insertedIds: string[] = [];
    const updatedIds: string[] = [];

    for (const product of products) {
      const { user_id, name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, unit_kind, cost_price, expiry_date, low_stock_alert } = product;
      
      if (!name || !user_id) {
        res.status(400).json({ error: "Missing required fields: name, user_id" });
        return;
      }
      
      // Check if product with same SKU or name already exists (UPSERT logic)
      const existingBySku = sku?.trim() 
        ? await db.prepare("SELECT id FROM inventory_products WHERE user_id = ? AND sku = ?").get(user_id, sku.trim())
        : null;
      const existingByName = await db.prepare("SELECT id FROM inventory_products WHERE user_id = ? AND name = ?").get(user_id, name.trim());
      const existingId = existingBySku?.id || existingByName?.id;
      
      if (existingId) {
        // Update existing product
        await db.prepare(
          `UPDATE inventory_products 
           SET name = ?, sku = ?, retail_type = ?, pieces_per_carton = ?, unit_price = ?, stock_pieces = ?, 
               unit_kind = ?, cost_price = ?, expiry_date = ?, low_stock_alert = ?, updated_at = NOW()
           WHERE id = ? AND user_id = ?`
        ).run(name, sku || null, retail_type || 'retail', pieces_per_carton || 1, unit_price || 0, stock_pieces || 0, unit_kind || 'piece', cost_price || 0, expiry_date || null, low_stock_alert || 10, existingId, user_id);
        updatedIds.push(existingId);
      } else {
        // Insert new product
        const id = randomUUID();
        await db.prepare(
          `INSERT INTO inventory_products (id, user_id, name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, unit_kind, cost_price, expiry_date, low_stock_alert, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`
        ).run(id, user_id, name, sku || null, retail_type || 'retail', pieces_per_carton || 1, unit_price || 0, stock_pieces || 0, unit_kind || 'piece', cost_price || 0, expiry_date || null, low_stock_alert || 10);
        insertedIds.push(id);
      }
    }
    
    res.json({ 
      inserted: insertedIds, 
      updated: updatedIds,
      message: `Successfully created ${insertedIds.length} product(s) and updated ${updatedIds.length} product(s)` 
    });
  } catch (error) {
    console.error("[Super Admin] Error creating/updating inventory product(s):", error);
    console.error("[Super Admin] Error details:", error instanceof Error ? error.message : String(error));
    console.error("[Super Admin] Stack:", error instanceof Error ? error.stack : undefined);
    res.status(500).json({ error: "Failed to create/update inventory product(s)", details: error instanceof Error ? error.message : String(error) });
  }
});

app.put("/api/super-admin/inventory-products/:id", authMiddleware, platformSettingsEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, unit_kind, cost_price, expiry_date, low_stock_alert } = req.body;
    
    if (!name) {
      res.status(400).json({ error: "Missing required field: name" });
      return;
    }
    
    await db.prepare(
      `UPDATE inventory_products 
       SET name = ?, sku = ?, retail_type = ?, pieces_per_carton = ?, unit_price = ?, stock_pieces = ?, 
           unit_kind = ?, cost_price = ?, expiry_date = ?, low_stock_alert = ?, updated_at = NOW()
       WHERE id = ?`
    ).run(name, sku || null, retail_type || 'retail', pieces_per_carton || 1, unit_price || 0, stock_pieces || 0, unit_kind || 'piece', cost_price || 0, expiry_date || null, low_stock_alert || 10, id);
    
    res.json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("[Super Admin] Error updating inventory product:", error);
    res.status(500).json({ error: "Failed to update inventory product" });
  }
});

app.delete("/api/super-admin/inventory-products/:id", authMiddleware, platformSettingsEditor, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.prepare(`DELETE FROM inventory_products WHERE id = ?`).run(id);
    
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("[Super Admin] Error deleting inventory product:", error);
    res.status(500).json({ error: "Failed to delete inventory product" });
  }
});

app.get("/api/super-admin/hr-employees", authMiddleware, platformSettingsEditor, async (_req, res) => {
  try {
    // Get all HR employees (bypass RLS)
    const employees = await db
      .prepare(`SELECT * FROM hr_employees ORDER BY created_at DESC`)
      .all();
    res.json(employees);
  } catch (error) {
    console.error("[Super Admin] Error fetching HR employees:", error);
    res.status(500).json({ error: "Failed to fetch HR employees" });
  }
});

app.post("/api/super-admin/hr-employees", authMiddleware, platformSettingsEditor, async (req, res) => {
  try {
    const { user_id, name, national_id, employee_id, work_number, role, salary, contract_type, contract_end, start_date, birth_date, marital_status, uniform_color, city, address, rib, bank_name } = req.body;
    
    if (!name || !user_id) {
      res.status(400).json({ error: "Missing required fields: name, user_id" });
      return;
    }
    
    const id = randomUUID();
    await db.prepare(
      `INSERT INTO hr_employees (id, user_id, name, national_id, employee_id, work_number, role, salary, contract_type, contract_end, start_date, birth_date, marital_status, uniform_color, city, address, rib, bank_name, created_at, updated_at, work_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 0)`
    ).run(id, user_id, name, national_id || null, employee_id || null, work_number || null, role || null, salary || null, contract_type || null, contract_end || null, start_date || null, birth_date || null, marital_status || null, uniform_color || null, city || null, address || null, rib || null, bank_name || null);
    
    res.json({ id, message: "Employee created successfully" });
  } catch (error) {
    console.error("[Super Admin] Error creating HR employee:", error);
    res.status(500).json({ error: "Failed to create HR employee" });
  }
});

app.put("/api/super-admin/hr-employees/:id", authMiddleware, platformSettingsEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, national_id, employee_id, work_number, role, salary, contract_type, contract_end, start_date, birth_date, marital_status, uniform_color, city, address, rib, bank_name } = req.body;
    
    if (!name) {
      res.status(400).json({ error: "Missing required field: name" });
      return;
    }
    
    await db.prepare(
      `UPDATE hr_employees 
       SET name = ?, national_id = ?, employee_id = ?, work_number = ?, role = ?, salary = ?, 
           contract_type = ?, contract_end = ?, start_date = ?, birth_date = ?, marital_status = ?, 
           uniform_color = ?, city = ?, address = ?, rib = ?, bank_name = ?, updated_at = NOW()
       WHERE id = ?`
    ).run(name, national_id || null, employee_id || null, work_number || null, role || null, salary || null, contract_type || null, contract_end || null, start_date || null, birth_date || null, marital_status || null, uniform_color || null, city || null, address || null, rib || null, bank_name || null, id);
    
    res.json({ message: "Employee updated successfully" });
  } catch (error) {
    console.error("[Super Admin] Error updating HR employee:", error);
    res.status(500).json({ error: "Failed to update HR employee" });
  }
});

app.delete("/api/super-admin/hr-employees/:id", authMiddleware, platformSettingsEditor, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.prepare(`DELETE FROM hr_employees WHERE id = ?`).run(id);
    
    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("[Super Admin] Error deleting HR employee:", error);
    res.status(500).json({ error: "Failed to delete HR employee" });
  }
});

app.get("/api/super-admin/hr-absence-records", authMiddleware, platformSettingsEditor, async (_req, res) => {
  try {
    // Get all HR absence records (bypass RLS)
    const records = await db
      .prepare(`SELECT * FROM hr_absence_records ORDER BY created_at DESC`)
      .all();
    res.json(records);
  } catch (error) {
    console.error("[Super Admin] Error fetching HR absence records:", error);
    res.status(500).json({ error: "Failed to fetch HR absence records" });
  }
});

app.post("/api/super-admin/hr-absence-records", authMiddleware, platformSettingsEditor, async (req, res) => {
  try {
    const { employee_id, from_date, to_date, reason, return_date, user_id } = req.body;
    
    if (!employee_id || !from_date || !to_date || !reason) {
      res.status(400).json({ error: "Missing required fields: employee_id, from_date, to_date, reason" });
      return;
    }
    
    const id = randomUUID();
    
    await db.prepare(`
      INSERT INTO hr_absence_records (id, employee_id, from_date, to_date, reason, return_date, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, employee_id, from_date, to_date, reason, return_date || null, user_id || null, new Date().toISOString());
    
    res.json({ id, employee_id, from_date, to_date, reason, return_date, user_id });
  } catch (error) {
    console.error("[Super Admin] Error creating HR absence record:", error);
    res.status(500).json({ error: "Failed to create HR absence record" });
  }
});

app.delete("/api/super-admin/hr-absence-records/:id", authMiddleware, platformSettingsEditor, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.prepare(`DELETE FROM hr_absence_records WHERE id = ?`).run(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error("[Super Admin] Error deleting HR absence record:", error);
    res.status(500).json({ error: "Failed to delete HR absence record" });
  }
});

app.get("/api/super-admin/shift-reports", authMiddleware, platformSettingsEditor, async (_req, res) => {
  try {
    // Get all shift reports (bypass RLS)
    const reports = await db
      .prepare(`SELECT * FROM shift_reports ORDER BY shift_date DESC`)
      .all();
    res.json(reports);
  } catch (error) {
    console.error("[Super Admin] Error fetching shift reports:", error);
    res.status(500).json({ error: "Failed to fetch shift reports" });
  }
});

app.post("/api/super-admin/shift-reports", authMiddleware, platformSettingsEditor, async (req, res) => {
  try {
    const { user_id, shift_date, shift_group, customer_name, customer_number, week, operations_log, sales_count, stock_add_count, stock_edit_count, total_operations, start_time } = req.body;
    
    if (!user_id || !shift_date || !shift_group) {
      res.status(400).json({ error: "Missing required fields: user_id, shift_date, shift_group" });
      return;
    }
    
    const id = randomUUID();
    
    // Safely handle all fields with proper null/undefined checks
    const customerName = customer_name !== null && customer_name !== undefined && customer_name !== "" ? String(customer_name) : null;
    const customerNumber = customer_number !== null && customer_number !== undefined && customer_number !== "" ? String(customer_number) : null;
    const weekValue = week !== null && week !== undefined && week !== "" ? String(week) : null;
    const operationsLog = operations_log !== null && operations_log !== undefined ? operations_log : [];
    const salesCount = sales_count !== null && sales_count !== undefined && !isNaN(Number(sales_count)) ? Number(sales_count) : 0;
    const stockAddCount = stock_add_count !== null && stock_add_count !== undefined && !isNaN(Number(stock_add_count)) ? Number(stock_add_count) : 0;
    const stockEditCount = stock_edit_count !== null && stock_edit_count !== undefined && !isNaN(Number(stock_edit_count)) ? Number(stock_edit_count) : 0;
    const totalOperations = total_operations !== null && total_operations !== undefined && !isNaN(Number(total_operations)) ? Number(total_operations) : 0;
    const startTime = start_time !== null && start_time !== undefined && start_time !== "" ? String(start_time) : new Date().toISOString();
    
    await db.prepare(
      `INSERT INTO shift_reports (id, user_id, shift_date, shift_group, start_time, customer_name, customer_number, week, operations_log, sales_count, stock_add_count, stock_edit_count, total_operations, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`
    ).run(id, user_id, shift_date, shift_group, startTime, customerName, customerNumber, weekValue, JSON.stringify(operationsLog), salesCount, stockAddCount, stockEditCount, totalOperations);
    
    res.json({ id, message: "Shift report created successfully" });
  } catch (error) {
    console.error("[Super Admin] Error creating shift report:", error);
    res.status(500).json({ error: "Failed to create shift report", details: error instanceof Error ? error.message : String(error) });
  }
});

app.put("/api/super-admin/shift-reports/:id", authMiddleware, platformSettingsEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, customer_number, week, operations_log, sales_count, stock_add_count, stock_edit_count, total_operations } = req.body;
    
    await db.prepare(
      `UPDATE shift_reports 
       SET customer_name = ?, customer_number = ?, week = ?, operations_log = ?, 
           sales_count = ?, stock_add_count = ?, stock_edit_count = ?, total_operations = ?, updated_at = NOW()
       WHERE id = ?`
    ).run(customer_name || null, customer_number || null, week || null, JSON.stringify(operations_log || []), sales_count || 0, stock_add_count || 0, stock_edit_count || 0, total_operations || 0, id);
    
    res.json({ message: "Shift report updated successfully" });
  } catch (error) {
    console.error("[Super Admin] Error updating shift report:", error);
    res.status(500).json({ error: "Failed to update shift report" });
  }
});

app.delete("/api/super-admin/shift-reports/:id", authMiddleware, platformSettingsEditor, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.prepare(`DELETE FROM shift_reports WHERE id = ?`).run(id);
    
    res.json({ message: "Shift report deleted successfully" });
  } catch (error) {
    console.error("[Super Admin] Error deleting shift report:", error);
    res.status(500).json({ error: "Failed to delete shift report" });
  }
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

async function getStoredBranding(userId: string): Promise<StoredBranding> {
  const row = (await db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(brandingSettingsKey(userId))) as { value: string } | undefined;
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

app.get("/api/user/branding", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  res.json({ branding: await getStoredBranding(userId) });
});

app.put("/api/user/branding", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const prev = await getStoredBranding(userId);
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
  await db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
  ).run(brandingSettingsKey(userId), payload);
  res.json({ ok: true });
});

app.get("/api/dashboard/financial-summary", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const lawyerC = (
    await db.prepare("SELECT COUNT(*)::int as c FROM lawyer_cases WHERE user_id = ?").get(userId) as { c: number }
  ).c;
  const accC = (
    await db.prepare("SELECT COUNT(*)::int as c FROM accountant_reports WHERE user_id = ?").get(userId) as { c: number }
  ).c;
  const invC = (
    await db.prepare("SELECT COUNT(*)::int as c FROM pos_invoices WHERE user_id = ?").get(userId) as { c: number }
  ).c;
  const docCount = lawyerC + accC + invC;

  const invoices = await db
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

app.post("/api/devices/remove", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { deviceId } = req.body as { deviceId?: string };
  if (!deviceId) {
    res.status(400).json({ error: "معرف الجهاز مطلوب" });
    return;
  }
  const r = await db.prepare("DELETE FROM devices WHERE id = ? AND user_id = ?").run(deviceId, userId);
  if (r.changes === 0) {
    res.status(404).json({ error: "الجهاز غير موجود" });
    return;
  }
  res.json({ ok: true });
});

/** Save user's custom AI API key with provider */
app.post("/api/user/ai-api-key", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { apiKey, provider } = req.body as { apiKey?: string; provider?: string };

  if (!apiKey || typeof apiKey !== "string") {
    res.status(400).json({ error: "مفتاح API مطلوب" });
    return;
  }

  if (apiKey.trim().length < 10) {
    res.status(400).json({ error: "مفتاح API غير صالح" });
    return;
  }

  // Auto-detect provider if not specified
  let detectedProvider = provider || 'gemini';
  if (!provider) {
    if (apiKey.startsWith('sk-')) {
      detectedProvider = 'openai';
    } else if (apiKey.startsWith('AIza')) {
      detectedProvider = 'gemini';
    } else if (apiKey.startsWith('gsk_')) {
      detectedProvider = 'groq';
    } else if (provider === 'pollinations') {
      detectedProvider = 'pollinations';
    }
  }

  try {
    await db.prepare("UPDATE users SET ai_api_key = ?, ai_provider = ? WHERE id = ?").run(
      apiKey.trim(), 
      detectedProvider, 
      userId
    );
    res.json({ success: true, provider: detectedProvider });
  } catch (error) {
    console.error("Error saving AI API key:", error);
    res.status(500).json({ error: "فشل حفظ مفتاح API" });
  }
});

/** Get user's custom AI API key (masked) and provider */
app.get("/api/user/ai-api-key", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;

  try {
    const user = await db.prepare("SELECT ai_api_key, ai_provider FROM users WHERE id = ?").get(userId) as
      | { ai_api_key: string | null; ai_provider: string | null }
      | undefined;

    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    // Return masked key for security and provider
    const hasKey = user.ai_api_key && user.ai_api_key.trim().length > 0;
    const provider = user.ai_provider || 'gemini';
    res.json({ hasKey, provider });
  } catch (error) {
    console.error("Error getting AI API key:", error);
    res.status(500).json({ error: "فشل جلب مفتاح API" });
  }
});

/** Remove user's custom AI API key */
app.delete("/api/user/ai-api-key", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;

  try {
    await db.prepare("UPDATE users SET ai_api_key = NULL, ai_provider = 'gemini' WHERE id = ?").run(userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing AI API key:", error);
    res.status(500).json({ error: "فشل حذف مفتاح API" });
  }
});

/** Test user's AI API key */
app.post("/api/user/ai-api-key/test", authMiddleware, async (req, res) => {
  const { apiKey, provider } = req.body as { apiKey?: string; provider?: string };

  if (!apiKey || typeof apiKey !== "string") {
    res.status(400).json({ error: "مفتاح API مطلوب" });
    return;
  }

  const detectedProvider = provider || 
    (apiKey.startsWith('sk-') ? 'openai' : 
     apiKey.startsWith('AIza') ? 'gemini' : 
     apiKey.startsWith('gsk_') ? 'groq' : 
     apiKey.startsWith('hf_') ? 'huggingface' : 'gemini');

  try {
    if (detectedProvider === 'gemini') {
      // Test with Gemini API
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent("Test");
      const response = result.response;

      if (response) {
        res.json({ valid: true, message: "مفتاح Gemini صالح" });
      } else {
        res.status(400).json({ valid: false, error: "مفتاح Gemini غير صالح" });
      }
    } else if (detectedProvider === 'groq') {
      // Test with Groq API
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 10,
        }),
      });

      if (response.ok) {
        res.json({ valid: true, message: "مفتاح Groq صالح" });
      } else {
        const error = await response.json();
        res.status(400).json({ valid: false, error: `مفتاح Groq غير صالح: ${error.error?.message || 'Unknown error'}` });
      }
    } else if (detectedProvider === 'openai') {
      // Test with OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 10,
        }),
      });

      if (response.ok) {
        res.json({ valid: true, message: "مفتاح OpenAI صالح" });
      } else {
        const error = await response.json();
        res.status(400).json({ valid: false, error: `مفتاح OpenAI غير صالح: ${error.error?.message || 'Unknown error'}` });
      }
    } else if (detectedProvider === 'huggingface') {
      // HuggingFace keys are generally valid format-wise
      res.json({ valid: true, message: "مفتاح HuggingFace صالح (تنسيق)" });
    } else {
      res.status(400).json({ valid: false, error: "مزود غير مدعوم" });
    }
  } catch (error: any) {
    console.error("AI API key test error:", error);

    if (error?.status === 401 || error?.message?.includes("401")) {
      res.status(401).json({ valid: false, error: "مفتاح API غير صالح (401 Unauthorized)" });
    } else if (error?.status === 429 || error?.message?.includes("429")) {
      res.status(429).json({ valid: false, error: "مفتاح API نفذت حصته (429 Quota Exceeded)" });
    } else {
      res.status(400).json({ valid: false, error: "فشل اختبار مفتاح API" });
    }
  }
});

app.post(
  "/api/subscription/request",
  authMiddleware,
  upload.single("receipt"),
  async (req, res) => {
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
    await db.prepare(
      `INSERT INTO subscriptions (id, user_id, plan_id, modules, payment_method, receipt_path, status, billing_period) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).run(id, userId, plan_id, modules, payment_method, receiptPath, bp);
    const u = await db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string } | undefined;
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
app.post("/api/visa/request-unlock", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const u = await db.prepare("SELECT email, name FROM users WHERE id = ?").get(userId) as
    | { email: string; name: string }
    | undefined;
  if (!u) {
    res.status(404).json({ error: "مستخدم غير موجود" });
    return;
  }
  await db.prepare(`UPDATE users SET visa_unlock_requested_at = NOW() WHERE id = ?`).run(userId);
  const id = randomUUID();
  await db.prepare(
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

async function countApprovedReferrals(referrerId: string): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COUNT(DISTINCT u.id)::int AS c FROM users u
     INNER JOIN subscriptions s ON s.user_id = u.id AND s.status = 'approved'
     WHERE u.referred_by = ?`
    )
    .get(referrerId)) as { c: number };
  return Number(row?.c) || 0;
}

/** عند الوصول إلى 5 أو 10 إحالات مع اشتراك معتمد — طلب موافقة أدمن للمكافأة */
async function maybeCreateReferralReward(referrerId: string): Promise<string | null> {
  const c = await countApprovedReferrals(referrerId);
  const milestones: { n: number; tier: string; label: string }[] = [
    { n: 5, tier: "5", label: "3 أشهر مجانية (بعد موافقة الأدمن)" },
    { n: 10, tier: "10", label: "6 أشهر مجانية (بعد موافقة الأدمن)" },
  ];
  for (const m of milestones) {
    if (c < m.n) continue;
    const ex = await db
      .prepare("SELECT id FROM referral_rewards WHERE user_id = ? AND tier = ?")
      .get(referrerId, m.tier) as { id: string } | undefined;
    if (ex) continue;
    const rid = randomUUID();
    await db.prepare(`INSERT INTO referral_rewards (id, user_id, tier, status) VALUES (?, ?, ?, 'pending')`).run(
      rid,
      referrerId,
      m.tier
    );
    const refUser = await db.prepare(`SELECT email, name FROM users WHERE id = ?`).get(referrerId) as
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

app.get("/api/subscription/status", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const sub = await db
    .prepare(
      `SELECT id, plan_id, modules, payment_method, status, created_at, reviewed_at, ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId);
  res.json({ subscription: sub ?? null });
});

app.get("/api/admin/pending", authMiddleware, superAdminOnly, async (_req, res) => {
  const rows = await db
    .prepare(
      `SELECT s.*, u.email, u.name as user_name FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE s.status = 'pending' ORDER BY s.created_at ASC`
    )
    .all();
  res.json({ pending: rows });
});

app.post("/api/admin/approve/:subId", authMiddleware, superAdminOnly, async (req, res) => {
  const adminId = (req as express.Request & { userId: string }).userId;
  const subId = paramString(req.params.subId);
  const row = await db
    .prepare(
      `SELECT id, user_id, plan_id, modules, billing_period FROM subscriptions WHERE id = ? AND status = 'pending'`
    )
    .get(subId) as
    | {
        id: string;
        user_id: string;
        plan_id: string;
        modules: string;
        billing_period: string | null;
      }
    | undefined;
  if (!row) {
    res.status(404).json({ error: "طلب غير موجود أو تمت معالجته" });
    return;
  }
  const days =
    row.plan_id === "visa_premium" || row.billing_period === "yearly"
      ? 365
      : SUBSCRIPTION_PERIOD_DAYS;
  const endsAt = new Date(Date.now() + days * 86400000).toISOString();
  const unlockVisa =
    row.plan_id === "visa_premium" ||
    row.modules.includes('"visa"') ||
    row.plan_id === "libraries_plus" ||
    row.plan_id === "enterprises_schools";
  if (unlockVisa) {
    await db.prepare(`UPDATE users SET visa_unlock_approved = 1 WHERE id = ?`).run(row.user_id);
  }
  const r = await db
    .prepare(
      `UPDATE subscriptions SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?, ends_at = ? WHERE id = ? AND status = 'pending'`
    )
    .run(adminId, endsAt, subId);
  if (r.changes === 0) {
    res.status(404).json({ error: "طلب غير موجود أو تمت معالجته" });
    return;
  }
  const refRow = await db.prepare(`SELECT referred_by FROM users WHERE id = ?`).get(row.user_id) as
    | { referred_by: string | null }
    | undefined;
  let referralNotifyUrl: string | undefined;
  if (refRow?.referred_by) {
    const u = await maybeCreateReferralReward(refRow.referred_by);
    if (u) referralNotifyUrl = u;
  }
  const userRow = await db.prepare(`SELECT email, name FROM users WHERE id = ?`).get(row.user_id) as
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

app.get("/api/admin/referral-rewards", authMiddleware, superAdminOnly, async (_req, res) => {
  const rewards = await db
    .prepare(
      `SELECT r.id, r.user_id, r.tier, r.status, r.created_at, u.email, u.name as user_name
       FROM referral_rewards r JOIN users u ON u.id = r.user_id
       WHERE r.status = 'pending' ORDER BY r.created_at ASC`
    )
    .all();
  res.json({ rewards });
});

app.post("/api/admin/referral-reward/approve/:rewardId", authMiddleware, superAdminOnly, async (req, res) => {
  const rewardId = paramString(req.params.rewardId);
  const rw = await db
    .prepare(`SELECT * FROM referral_rewards WHERE id = ? AND status = 'pending'`)
    .get(rewardId) as { id: string; user_id: string; tier: string } | undefined;
  if (!rw) {
    res.status(404).json({ error: "طلب غير موجود" });
    return;
  }
  const addDays = rw.tier === "10" ? 180 : rw.tier === "5" ? 90 : 30;
  const sub = await db
    .prepare(
      `SELECT id, ends_at FROM subscriptions WHERE user_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1`
    )
    .get(rw.user_id) as { id: string; ends_at: string | null } | undefined;
  if (sub) {
    const baseMs = sub.ends_at ? new Date(sub.ends_at).getTime() : Date.now();
    const start = Math.max(baseMs, Date.now());
    const newEnd = new Date(start + addDays * 86400000).toISOString();
    await db.prepare(`UPDATE subscriptions SET ends_at = ? WHERE id = ?`).run(newEnd, sub.id);
  }
  await db.prepare(`UPDATE referral_rewards SET status = 'approved' WHERE id = ?`).run(rw.id);
  res.json({ ok: true });
});

app.post("/api/admin/reject/:subId", authMiddleware, superAdminOnly, async (req, res) => {
  const adminId = (req as express.Request & { userId: string }).userId;
  const subId = paramString(req.params.subId);
  const r = await db
    .prepare(
      `UPDATE subscriptions SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ? WHERE id = ? AND status = 'pending'`
    )
    .run(adminId, subId);
  if (r.changes === 0) {
    res.status(404).json({ error: "طلب غير موجود" });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/admin/users", authMiddleware, superAdminOnly, async (_req, res) => {
  const users = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.created_at, u.trial_ends_at, u.account_locked,
        s.plan_id, s.status AS sub_status, s.ends_at AS sub_ends_at, s.payment_method
       FROM users u
       LEFT JOIN subscriptions s ON s.id = (
         SELECT id FROM subscriptions WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
       )
       ORDER BY u.created_at DESC`
    )
    .all();
  res.json({ users });
});

app.post("/api/admin/users/:targetUserId/locked", authMiddleware, superAdminOnly, async (req, res) => {
  const adminId = (req as express.Request & { userId: string }).userId;
  const targetUserId = paramString(req.params.targetUserId);
  const locked = Boolean((req.body as { locked?: boolean }).locked);
  if (targetUserId === adminId) {
    res.status(400).json({ error: "cannot_lock_self" });
    return;
  }
  const target = await db.prepare("SELECT role FROM users WHERE id = ?").get(targetUserId) as
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
  await db.prepare("UPDATE users SET account_locked = ? WHERE id = ?").run(locked ? 1 : 0, targetUserId);
  res.json({ ok: true });
});

app.post(
  "/api/admin/users/:targetUserId/reset-devices",
  authMiddleware,
  superAdminOnly,
  async (req, res) => {
    const adminId = (req as express.Request & { userId: string }).userId;
    const targetUserId = paramString(req.params.targetUserId);
    if (targetUserId === adminId) {
      res.status(400).json({ error: "cannot_reset_self" });
      return;
    }
    const target = await db.prepare("SELECT id, role FROM users WHERE id = ?").get(targetUserId) as
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
    await db.prepare("DELETE FROM devices WHERE user_id = ?").run(targetUserId);
    res.json({ ok: true });
  }
);

/** يدوي: اشتراك «نشط» (معتمد + تاريخ انتهاء في المستقبل) أو «منتهٍ» (معتمد + انتهى) — تخزين محلي فقط */
app.post(
  "/api/admin/users/:targetUserId/subscription-access",
  authMiddleware,
  superAdminOnly,
  async (req, res) => {
    const adminId = (req as express.Request & { userId: string }).userId;
    const targetUserId = paramString(req.params.targetUserId);
    const mode = (req.body as { mode?: string }).mode;
    if (mode !== "active" && mode !== "expired") {
      res.status(400).json({ error: "invalid_mode" });
      return;
    }
    const target = await db.prepare("SELECT id, role FROM users WHERE id = ?").get(targetUserId) as
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
    const sub = await db
      .prepare(
        `SELECT id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(targetUserId) as { id: string } | undefined;

    const nowMs = Date.now();
    const endsIso =
      mode === "active"
        ? new Date(nowMs + SUBSCRIPTION_PERIOD_DAYS * 86400000).toISOString()
        : new Date(nowMs - 86400000).toISOString();

    if (sub) {
      await db.prepare(
        `UPDATE subscriptions SET status = 'approved', ends_at = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?`
      ).run(endsIso, adminId, sub.id);
    } else {
      const sid = randomUUID();
      await db.prepare(
        `INSERT INTO subscriptions (id, user_id, plan_id, modules, payment_method, status, reviewed_at, reviewed_by, ends_at)
         VALUES (?, ?, 'full_management', ?, 'admin_manual', 'approved', NOW(), ?, ?)`
      ).run(sid, targetUserId, FULL_MODULES_JSON, adminId, endsIso);
    }
    res.json({ ok: true });
  }
);

app.get("/api/admin/subscription-stats", authMiddleware, superAdminOnly, async (_req, res) => {
  const rows = await db
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
  const trialRow = await db
    .prepare(
      `SELECT COUNT(*)::int AS c FROM users WHERE trial_ends_at IS NOT NULL AND trial_ends_at > NOW()`
    )
    .get() as { c: number };
  res.json({
    activeSubscriptions,
    expiredSubscriptions,
    activeTrials: trialRow.c,
  });
});

app.get("/api/admin/support/inbox", authMiddleware, superAdminOnly, async (_req, res) => {
  const messages = await db
    .prepare(
      `SELECT m.id, m.user_id, m.from_admin, m.body, m.created_at, u.email, u.name AS user_name
       FROM support_messages m
       JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at DESC
       LIMIT 800`
    )
    .all();
  res.json({ messages });
});

app.post("/api/admin/support/reply", authMiddleware, superAdminOnly, async (req, res) => {
  const { userId, body } = req.body as { userId?: string; body?: string };
  const uid = typeof userId === "string" ? userId.trim() : "";
  const text = typeof body === "string" ? body.trim() : "";
  if (!uid || !text || text.length > 8000) {
    res.status(400).json({ error: "invalid" });
    return;
  }
  const exists = await db.prepare("SELECT id FROM users WHERE id = ?").get(uid) as { id: string } | undefined;
  if (!exists) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  const id = randomUUID();
  await db.prepare(`INSERT INTO support_messages (id, user_id, from_admin, body) VALUES (?, ?, 1, ?)`).run(
    id,
    uid,
    text
  );
  res.json({ ok: true, id });
});

app.get("/api/support/messages", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const messages = await db
    .prepare(
      `SELECT id, from_admin, body, created_at FROM support_messages WHERE user_id = ? ORDER BY created_at ASC`
    )
    .all(userId);
  res.json({ messages });
});

app.post("/api/support/messages", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const text = String((req.body as { body?: string }).body ?? "").trim();
  if (!text || text.length > 8000) {
    res.status(400).json({ error: "invalid_message" });
    return;
  }
  const id = randomUUID();
  await db.prepare(`INSERT INTO support_messages (id, user_id, from_admin, body) VALUES (?, ?, 0, ?)`).run(
    id,
    userId,
    text
  );
  res.json({ ok: true, id });
});

app.get("/api/internal/messages", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const messages = await db
    .prepare(
      `SELECT id, from_admin, body, attachment_name, attachment_path, created_at
       FROM internal_chat_messages
       WHERE user_id = ?
       ORDER BY created_at ASC`
    )
    .all(userId);
  res.json({
    messages: messages.map((m) => ({
      ...m,
      attachment_url: m.attachment_path ? `/api/internal/attachments/${m.id}` : null,
    })),
  });
});

app.post(
  "/api/internal/messages",
  authMiddleware,
  uploadInternal.single("attachment"),
  async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    const text = String((req.body as { body?: string }).body ?? "").trim();
    const file = req.file;
    if (!text && !file) {
      res.status(400).json({ error: "invalid_message" });
      return;
    }
    if (text.length > 8000) {
      res.status(400).json({ error: "invalid_message" });
      return;
    }
    const id = randomUUID();
    await db
      .prepare(
        `INSERT INTO internal_chat_messages (id, user_id, from_admin, body, attachment_name, attachment_path)
         VALUES (?, ?, 0, ?, ?, ?)`
      )
      .run(id, userId, text || null, file?.originalname ?? null, file?.path ?? null);
    res.json({ ok: true, id });
  }
);

app.get("/api/internal/attachments/:messageId", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const messageId = String(req.params.messageId ?? "").trim();
  if (!messageId) {
    res.status(400).json({ error: "invalid_message_id" });
    return;
  }
  const msg = await db
    .prepare(
      `SELECT attachment_name, attachment_path FROM internal_chat_messages WHERE id = ? AND user_id = ?`
    )
    .get(messageId, userId) as { attachment_name?: string | null; attachment_path?: string | null } | undefined;
  if (!msg || !msg.attachment_path) {
    res.status(404).json({ error: "attachment_not_found" });
    return;
  }
  const filePath = msg.attachment_path;
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "attachment_not_found" });
    return;
  }
  const attachmentName = msg.attachment_name ?? "attachment";
  res.setHeader("Content-Disposition", `attachment; filename="${attachmentName.replace(/"/g, "\"")}"`);
  res.sendFile(filePath);
});

/** تجميع مبيعات المخزون (pos_invoices) عبر كل المستخدمين — يطابق منطق /dashboard/financial-summary */
app.get("/api/admin/sales-analytics", authMiddleware, superAdminOnly, async (_req, res) => {
  const invoices = await db
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
    salesCount: invoices.length,
    chart,
  });
});

app.get("/api/hr/employees", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "hr"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = await db.prepare("SELECT * FROM hr_employees WHERE user_id = ?").all(userId);
  res.json({ employees: rows });
});

app.post("/api/hr/employees", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "hr"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    name: string;
    employee_id: string;
    work_number?: string;
    national_id?: string;
    role: string;
    salary: number;
    work_days?: number;
    contract_type: string;
    contract_end?: string | null;
    start_date?: string;
    birth_date?: string;
    marital_status?: string;
    uniform_color?: string;
    city?: string;
    address?: string;
    rib?: string;
    bank_name?: string;
  };
  const id = randomUUID();
  await db.prepare(
    `INSERT INTO hr_employees (
      id, user_id, name, employee_id, work_number, national_id, role, salary, work_days, contract_type, contract_end,
      start_date, birth_date, marital_status, uniform_color, city, address, rib, bank_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    b.name,
    b.employee_id,
    b.work_number ?? b.employee_id,
    b.national_id ?? "",
    b.role,
    b.salary,
    Number(b.work_days ?? 0) || 0,
    b.contract_type,
    b.contract_end ?? null,
    b.start_date ?? "",
    b.birth_date ?? "",
    b.marital_status ?? "",
    b.uniform_color ?? "",
    b.city ?? "",
    b.address ?? "",
    b.rib ?? "",
    b.bank_name ?? ""
  );
  res.json({ id });
});

app.patch("/api/hr/employees/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const id = paramString(req.params.id);
  if (!(await moduleAllowed(userId, "hr"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    name: string;
    employee_id: string;
    work_number?: string;
    national_id?: string;
    role: string;
    salary: number;
    work_days?: number;
    contract_type: string;
    contract_end?: string | null;
    start_date?: string;
    birth_date?: string;
    marital_status?: string;
    uniform_color?: string;
    city?: string;
    address?: string;
    rib?: string;
    bank_name?: string;
  };
  const r = await db
    .prepare(
      `UPDATE hr_employees
       SET name = ?, employee_id = ?, work_number = ?, national_id = ?, role = ?, salary = ?, work_days = ?, contract_type = ?, contract_end = ?,
           start_date = ?, birth_date = ?, marital_status = ?, uniform_color = ?, city = ?, address = ?, rib = ?, bank_name = ?
       WHERE id = ? AND user_id = ?`
    )
    .run(
      b.name,
      b.employee_id,
      b.work_number ?? b.employee_id,
      b.national_id ?? "",
      b.role,
      b.salary,
      Number(b.work_days ?? 0) || 0,
      b.contract_type,
      b.contract_end ?? null,
      b.start_date ?? "",
      b.birth_date ?? "",
      b.marital_status ?? "",
      b.uniform_color ?? "",
      b.city ?? "",
      b.address ?? "",
      b.rib ?? "",
      b.bank_name ?? "",
      id,
      userId
    );
  if (r.changes === 0) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }
  res.json({ ok: true });
});

app.delete("/api/hr/employees/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const id = paramString(req.params.id);
  if (!(await moduleAllowed(userId, "hr"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  
  // Delete employee's permissions first
  try {
    await db.prepare("DELETE FROM permissions WHERE employee_id = ?").run(id);
  } catch (permErr) {
    // Don't fail if permissions table doesn't exist or other error
    console.error("[HR] Error deleting permissions:", permErr);
  }
  
  const r = await db.prepare("DELETE FROM hr_employees WHERE id = ? AND user_id = ?").run(id, userId);
  if (r.changes === 0) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/hr/employees/:id/parse-document", authMiddleware, uploadMemory.single("file"), async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    if (!(await moduleAllowed(userId, "hr"))) {
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
      res.status(415).json({ error: "نوع غير مدعوم. استعمل PDF أو Word." });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "فشل القراءة" });
    }
  }
);

app.patch("/api/hr/metrics/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const id = paramString(req.params.id);
  if (!(await moduleAllowed(userId, "hr"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    week_label: string;
    production: number;
    logistics: number;
    quality: number;
  };
  const r = await db
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

app.get("/api/hr/metrics", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "hr"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  let rows = await db
    .prepare("SELECT * FROM production_metrics WHERE user_id = ? ORDER BY week_label")
    .all(userId) as Record<string, unknown>[];
  if (rows.length === 0) {
    const weeks = ["أسبوع 1", "أسبوع 2", "أسبوع 3", "أسبوع 4"];
    for (let i = 0; i < weeks.length; i++) {
      const id = randomUUID();
      await db.prepare(
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
    rows = await db
      .prepare("SELECT * FROM production_metrics WHERE user_id = ? ORDER BY week_label")
      .all(userId) as Record<string, unknown>[];
  }
  res.json({ metrics: rows });
});

async function getUserGateFlags(userId: string): Promise<{ bypass: boolean }> {
  const u = (await db
    .prepare("SELECT role, email, name FROM users WHERE id = ?")
    .get(userId)) as { role: string; email: string; name: string } | undefined;
  if (!u) return { bypass: false };
  const bypass =
    u.role === "superadmin" ||
    u.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(u.email, u.name);
  return { bypass };
}

async function moduleAllowed(userId: string, mod: string): Promise<boolean> {
  if ((await getUserGateFlags(userId)).bypass) return true;
  /** رادار التأشيرة: مدمج في الخطة أو موافقة الأدمن (visa_unlock_approved) */
  if (mod === "visa") {
    const sub = (await db
      .prepare(
        `SELECT modules, ends_at, status FROM subscriptions WHERE user_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1`
      )
      .get(userId)) as { modules: string; ends_at: string | null; status: string } | undefined;
    if (sub) {
      if (sub.ends_at) {
        const end = new Date(sub.ends_at).getTime();
        if (!Number.isFinite(end) || end <= Date.now()) {
          /* expired — fall through */
        } else {
          try {
            const mods = JSON.parse(sub.modules) as string[];
            if (Array.isArray(mods) && mods.includes("visa")) return true;
          } catch {
            /* ignore */
          }
        }
      } else {
        try {
          const mods = JSON.parse(sub.modules) as string[];
          if (Array.isArray(mods) && mods.includes("visa")) return true;
        } catch {
          /* ignore */
        }
      }
    }
    const u = (await db.prepare("SELECT visa_unlock_approved FROM users WHERE id = ?").get(userId)) as
      | { visa_unlock_approved: number }
      | undefined;
    return Boolean(u?.visa_unlock_approved);
  }
  if ((await userHasActiveTrial(userId)) && TRIAL_MODULE_IDS.has(mod)) return true;
  const sub = (await db
    .prepare(
      `SELECT modules, ends_at FROM subscriptions WHERE user_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId)) as { modules: string; ends_at: string | null } | undefined;
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

async function aiGenerateAllowed(userId: string, moduleName: string): Promise<boolean> {
  if ((await getUserGateFlags(userId)).bypass) return true;
  switch (moduleName) {
    case "legalAi":
      return (
        (await moduleAllowed(userId, "legal_ai")) ||
        (await moduleAllowed(userId, "law")) ||
        (await moduleAllowed(userId, "public"))
      );
    case "law":
      return await moduleAllowed(userId, "law");
    case "public":
      return await moduleAllowed(userId, "public");
    case "exam":
      return await moduleAllowed(userId, "edu");
    case "hrContract":
      return await moduleAllowed(userId, "hr");
    default:
      return false;
  }
}

app.get("/api/law/cases", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "law"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = await db.prepare("SELECT * FROM lawyer_cases WHERE user_id = ?").all(userId);
  res.json({ cases: rows });
});

app.post("/api/law/cases", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "law"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as { title: string; client_name: string; deadline?: string };
  const id = randomUUID();
  await db.prepare(
    `INSERT INTO lawyer_cases (id, user_id, title, client_name, deadline) VALUES (?, ?, ?, ?, ?)`
  ).run(id, userId, b.title, b.client_name, b.deadline ?? null);
  res.json({ id });
});

app.get("/api/acc/reports", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "acc"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = await db.prepare("SELECT * FROM accountant_reports WHERE user_id = ?").all(userId);
  res.json({ reports: rows });
});

app.post("/api/acc/reports", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "acc"))) {
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
  await db.prepare(
    `INSERT INTO accountant_reports (id, user_id, title, period, amount, notes, entry_type) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, b.title, b.period, b.amount ?? null, b.notes ?? null, flow);
  res.json({ id });
});

app.patch("/api/acc/reports/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const id = paramString(req.params.id);
  if (!(await moduleAllowed(userId, "acc"))) {
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
  const r = await db
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

app.get("/api/reminders", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const rows = await db.prepare("SELECT * FROM reminders WHERE user_id = ?").all(userId);
  res.json({ reminders: rows });
});

app.post("/api/reminders", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const b = req.body as {
    channel: string;
    target: string;
    message: string;
    due_at: string;
  };
  const id = randomUUID();
  await db.prepare(
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
    const subj = ctx.subject || name || "المادة";
    const lvl = ctx.level || "";
    const line = locale.startsWith("ar")
      ? `أسئلة مقترحة (إرشادية) في «${subj}»${lvl ? ` — المستوى: ${lvl}` : ""} — وفق إطار 51.17؛ راجع المنسق البيداغوجي.`
      : locale.startsWith("fr")
        ? `Questions indicatives — « ${subj} »${lvl ? `, niveau : ${lvl}` : ""} — cadre 51.17 ; relecture pédagogique requise.`
        : `Sample assessment items for "${subj}"${lvl ? ` (level: ${lvl})` : ""} — align to Morocco framework; pedagogical review required.`;
    return `${line}\n1) … (5 نقط)\n2) … (5 نقط)\n3) … (10 نقط)\n4) … (10 نقط)`;
  }
  if (module === "legalAi") {
    const who = ctx.fullName || name;
    const subj = ctx.requestType || ctx.requestTypeLabel || "";
    if (locale.startsWith("ar"))
      return `مسودة إرشادية (المملكة المغربية): الموضوع: ${subj || "طلب إداري"}. يُذكر صاحب الطلب ${who}${ctx.address ? `، العنوان: ${ctx.address}` : ""}. يُستند إلى التشريع المغربي الجاري به العمل؛ يُراجع النص قبل الإيداع.`;
    if (locale.startsWith("fr"))
      return `Ébauche indicative (Royaume du Maroc) : objet ${subj || "demande administrative"}, partie ${who}. Droit marocain en vigueur ; révision avant dépôt.`;
    if (locale === "es")
      return `Borrador orientativo (Reino de Marruecos): asunto ${subj || "solicitud"}, parte ${who}. Legislación marroquí aplicable; revisión antes del depósito.`;
    return `Indicative draft (Kingdom of Morocco): matter ${subj || "administrative request"}, party ${who}. Grounded in applicable Moroccan law; review before filing.`;
  }
  if (module === "hrContract") {
    const emp = ctx.employee || ctx.name || "—";
    if (ctx.docKind === "dismissal_grounds") {
      const hint = (ctx.groundsHint || "").trim() || "—";
      if (locale.startsWith("ar"))
        return `مسودة أسس فصل إرشادية (المغرب): توسيع الملاحظات الموجزة أدناه إلى صياغة رسمية محايدة تتوافق مع أحكام مدونة الشغل؛ دون إحداث وقائع غير مذكورة. ملاحظات: ${hint}. يُراجع من المحامي.`;
      if (locale.startsWith("fr"))
        return `Motifs de licenciement (Maroc) : à partir de ces notes factuelles, rédiger un texte formel et sobre, cadre Code du travail ; n’inventez pas de faits. Notes : ${hint}. Révision juridique requise.`;
      return `Morocco dismissal grounds draft: expand factual notes into formal, code-grounded language; do not invent facts. Notes: ${hint}. Legal review required.`;
    }
    if (ctx.docKind === "internal_rules_polish") {
      const raw = (ctx.rulesExcerpt || "").trim().slice(0, 2000) || "—";
      if (locale.startsWith("ar"))
        return `العناية بالنص الداخلي للمؤسسة: حوّل النقاط أدناه إلى فق رات لائحة داخلية بلغة إدارية عربية فصحى مناسبة للشركات في المغرب، دون مخالفة ظاهرة لمدونة الشغل. المصدر: ${raw}`;
      if (locale.startsWith("fr"))
        return `Règlement intérieur (Maroc) : reformuler le texte brut en articles/clauses lisibles, ton professionnel, droit marocain du travail en tête. Texte : ${raw}`;
      return `Internal work rules (Morocco): rewrite the following bullet/notes into clear policy clauses; professional tone. Source: ${raw}`;
    }
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
  const labourMorocco =
    "Ground the text in the Moroccan Labour Code (Book One of Dahir 1-03-19 as amended), CNSS/AMO rules where relevant, legal working hours, trial periods, and applicable collective agreements. Do not fabricate facts. Recommend legal review before signature.";
  const educationMorocco =
    "Align with Morocco Framework Law 51.17 on education and training and official competency frameworks where relevant. Use clear formal language suitable for classroom assessment; include numbered questions and suggested marks when appropriate. No markdown.";
  const base = `You are a legal and administrative drafting assistant for the Kingdom of Morocco (Smart Al-Idara Pro). Module: ${module}. Locale: ${locale}. User data (JSON): ${json}. Produce concise formal text in the user's language only, no markdown, max 400 words.`;

  if (module === "law" || module === "public" || module === "legalAi") {
    return `${base} ${moroccanLaw} If existingDraft or userNotes is present, refine and complete the request body for filing — preserve factual data; do not duplicate the formal recipient line unnecessarily; use structured paragraphs.`;
  }
  if (module === "exam") {
    return `You are an expert Moroccan teacher / pedagogy assessor. Locale: ${locale}. User data (JSON): ${json}. ${educationMorocco} Output numbered exam questions (plain text only). If subject or level is provided, match difficulty. Prefer 4–8 items unless context asks otherwise. Max 650 words.`;
  }
  if (module === "hrContract") {
    if (ctx.docKind === "dismissal_grounds") {
      return `You are an HR and labour-law writing assistant (Morocco). Locale: ${locale}. JSON: ${json}. Expand groundsHint into formal termination grounds: neutral, factual tone; categories under the Labour Code (serious misconduct, economic, etc.) only as hypotheses if they fit the notes — never invent incidents. Max 320 words. Plain text.`;
    }
    if (ctx.docKind === "internal_rules_polish") {
      return `You are drafting internal company policy prose for Morocco. Locale: ${locale}. JSON: ${json}. Rewrite rulesExcerpt into coherent numbered articles suitable for internal handbook; professional tone; respect Labour Code minima. Max 500 words. Plain text.`;
    }
    return `${base} ${labourMorocco} Deliver a single complete employment contract body with numbered articles where helpful.`;
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
  if (!(await aiGenerateAllowed(userId, module))) {
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
  const maxTokens =
    module === "mediaLab" ? 420 : module === "exam" || module === "hrContract" ? 1400 : module === "legalAi" ? 1200 : 900;
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

app.get("/api/studio/capabilities", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const allowed = await aiGenerateAllowed(userId, "mediaLab");
  const user = await db.prepare("SELECT ai_api_key FROM users WHERE id = ?").get(userId) as
    | { ai_api_key: string | null }
    | undefined;
  const openAiKeyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const geminiKeyConfigured = Boolean(
    resolveGeminiImageApiKey(user?.ai_api_key, process.env.GEMINI_API_KEY)
  );
  const textToImage = Boolean(allowed && (openAiKeyConfigured || geminiKeyConfigured));
  res.json({ textToImage, openAiKeyConfigured, geminiKeyConfigured });
});

app.post("/api/studio/text-to-image", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await aiGenerateAllowed(userId, "mediaLab"))) {
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

/** Google Gemini AI - Administrative Chatbot */
app.post("/api/ai/chat", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { message, locale } = req.body as { message?: string; locale?: string };

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "الرسالة ناقصة" });
    return;
  }

  // Check if user has valid subscription (not just "ai" module)
  const user = await db.prepare("SELECT role, email, name, ai_api_key, ai_provider FROM users WHERE id = ?").get(userId) as
    | { role: string; email: string; name: string; ai_api_key: string | null; ai_provider: string | null }
    | undefined;
  if (!user) {
    res.status(403).json({ error: "المستخدم غير موجود" });
    return;
  }

  const isSuperAdmin = user.role === "superadmin" ||
    user.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(user.email, user.name);

  if (!isSuperAdmin) {
    const sub = await db.prepare(
      `SELECT status, ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(userId) as { status: string; ends_at: string | null } | undefined;

    if (!sub || sub.status !== "approved") {
      res.status(403).json({ error: "الاشتراك غير مفعّل. يرجى تفعيل اشتراكك للوصول إلى المساعد الذكي." });
      return;
    }

    if (sub.ends_at) {
      const end = new Date(sub.ends_at).getTime();
      if (Number.isFinite(end) && end <= Date.now()) {
        res.status(403).json({ error: "انتهى الاشتراك. يرجى تجديد اشتراكك للوصول إلى المساعد الذكي." });
        return;
      }
    }
  }

  // Professional System Prompt for Smart Al-Idara Pro
  const SYSTEM_INSTRUCTION = `
أَنْتَ الخَبِير الإِدَارِي والمُسَاعِد الذَّكِي المُعْتَمَد لِمَنَصَّة "سْمَارْت الإِدَارَة بْرُو" (Smart Al-Idara Pro).
مُهِمَّتُكَ هِيَ مَسَاعَدَة المُدَرَاء، المَسْؤُولِين، والمُوَظَّفِينَ فِي تَدْبِير أَعْمَالِهِم اليَوْمِيَّة بِكُلِّ احْتِرَافِيَّة.

شُرُوط الإِجَابَة:
1. الجَوْدَة والمِهْنِيَّة: يَجِب أَن تَكُونَ الإِجَابَات دَقِيقَة، مَبْنِيَّة عَلَى أُسُس تَدْبِيرِيَّة حَدِيثَة، وَمُنَظَّمَة فَقَرَات أَوْ نُقَاط.
2. اللُّغَة: أَجِب بِنَفْس اللُّغَة الَّتِي كَتَبَ بِهَا المُسْتَخْدِم (العَرَبِيَّة الفُصْحَى هِيَ الأَسَاس لِلشَّأْن الإِدَارِي، أَوِ الدَّارِجَة المَغْرِبِيَّة المِهْنِيَّة إِذَا طُلِبَ ذَلِك).
3. الهُوِيَّة: لاَ تَذْكُر أَبَداً أَنَّكَ نَمُوذَج جُوجِل (Gemini). أَنْتَ دَائِماً "مُسَاعِد سْمَارْت الإِدَارَة بْرُو الذَّكِي".
4. السِّيَاق: رَكِّز عَلَى تَقْدِيم حُلُول عَمَلِيَّة (تَقَارِير، جَدَاوِل زَمَنِيَّة، رَسَائِل إِيلِكْتُرُونِيَّة إِدَارِيَّة، نَمَاذِج تَقْيِيم الأَدَاء).
`;

  // Use user's custom API key if available, otherwise fallback to system key
  let provider = user.ai_provider || 'gemini';
  const apiKey = user.ai_api_key?.trim() || process.env.GEMINI_API_KEY?.trim();
  
  console.log('AI Chat Debug - User ID:', userId);
  console.log('AI Chat Debug - Provider from DB:', user.ai_provider);
  console.log('AI Chat Debug - API Key from DB:', user.ai_api_key ? 'EXISTS' : 'NULL');
  console.log('AI Chat Debug - Final Provider:', provider);
  console.log('AI Chat Debug - Final API Key:', apiKey ? 'EXISTS' : 'NULL');
  
  // Auto-detect provider from key prefix if provider is not set correctly
  if (apiKey && !user.ai_provider) {
    if (apiKey.startsWith('sk-')) provider = 'openai';
    else if (apiKey.startsWith('AIza')) provider = 'gemini';
    else if (apiKey.startsWith('gsk_')) provider = 'groq';
    else if (apiKey.startsWith('hf_')) provider = 'huggingface';
    else if (apiKey.startsWith('key_')) provider = 'together';
    console.log('AI Chat Debug - Auto-detected Provider:', provider);
  }
  
  if (!apiKey) {
    console.log('AI Chat Debug - No API key available, returning error');
    res.status(503).json({ error: "خدمة الذكاء الاصطناعي غير مفعّلة. يرجى إضافة مفتاح API في الإعدادات." });
    return;
  }

  // For Gemini provider, use Google SDK directly (DEFAULT)
  if (provider === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: SYSTEM_INSTRUCTION
      });

      const currentDate = new Date();
      const dateStr = currentDate.toLocaleDateString('ar-MA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const contextPrompt = locale === "ar-MA" || locale === "ar"
        ? `[معلومات النظام الهامة: التاريخ الحالي اليوم هو ${dateStr} ونحن الآن في سنة 2026 ميلادية. أجب دائماً بناءً على هذا التاريخ الحالي بدقة وموثوقية وتجنب تماماً الإشارة إلى سنة 2024].`
        : `[Important System Information: Today's date is ${currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} and we are now in the year 2026. Always answer based on this current date accurately and reliably, avoid any reference to the year 2024].`;

      const fullPrompt = `${contextPrompt}\n\nسؤال المستخدم: ${message}`;
      const result = await model.generateContent(fullPrompt);
      const reply = result.response.text() || '';
      res.json({ reply, provider: 'gemini' });
      return;
    } catch (error) {
      console.error('Gemini chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'فشل الاتصال بـ Google Gemini';
      res.status(500).json({ error: `فشل الاتصال بـ Gemini: ${errorMessage}` });
      return;
    }
  }

  // For OpenAI provider, use OpenAI API
  if (provider === 'openai') {
    try {
      const openaiKey = apiKey;
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: message }],
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Check if response is HTML (Cloudflare error)
        if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
          throw new Error('فشل الاتصال بخادم OpenAI - قد يكون هناك مشكلة في الشبكة أو الحماية');
        }
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.error?.message || 'OpenAI API error');
        } catch {
          throw new Error('فشل الاتصال بخادم OpenAI');
        }
      }

      const data = await response.json();
      const reply = data.choices[0]?.message?.content || '';
      res.json({ reply, provider: 'openai' });
      return;
    } catch (error) {
      console.error('OpenAI chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'فشل الاتصال بـ OpenAI';
      res.status(500).json({ error: `فشل الاتصال بـ OpenAI: ${errorMessage}` });
      return;
    }
  }

  // For Groq provider, use Groq API
  if (provider === 'groq') {
    try {
      const groqKey = apiKey;
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: message }],
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Check if response is HTML (Cloudflare error)
        if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
          throw new Error('فشل الاتصال بخادم Groq - قد يكون هناك مشكلة في الشبكة أو الحماية');
        }
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.error?.message || 'Groq API error');
        } catch {
          throw new Error('فشل الاتصال بخادم Groq');
        }
      }

      const data = await response.json();
      const reply = data.choices[0]?.message?.content || '';
      res.json({ reply, provider: 'groq' });
      return;
    } catch (error) {
      console.error('Groq chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'فشل الاتصال بـ Groq';
      res.status(500).json({ error: `فشل الاتصال بـ Groq: ${errorMessage}` });
      return;
    }
  }

  // For Together AI provider, use Together AI API
  if (provider === 'together') {
    try {
      const togetherKey = apiKey;
      console.log('Together AI Chat - Attempting connection with key:', togetherKey.substring(0, 10) + '...');
      
      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${togetherKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: message }
          ],
          max_tokens: 1000,
        }),
      });

      console.log('Together AI Chat - Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Together AI Chat - Error response:', errorText);
        
        // Check if response is HTML (Cloudflare error)
        if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
          throw new Error('فشل الاتصال بخادم Together AI - قد يكون هناك مشكلة في الشبكة أو الحماية');
        }
        try {
          const error = JSON.parse(errorText);
          const errorMsg = error.error?.message || error.message || 'Together AI API error';
          console.log('Together AI Chat - Parsed error:', errorMsg);
          throw new Error(errorMsg);
        } catch (parseError) {
          console.log('Together AI Chat - Parse error:', parseError);
          throw new Error('فشل الاتصال بخادم Together AI - ' + errorText.substring(0, 200));
        }
      }

      const data = await response.json();
      const reply = data.choices[0]?.message?.content || '';
      res.json({ reply, provider: 'together' });
      return;
    } catch (error) {
      console.error('Together AI chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'فشل الاتصال بـ Together AI';
      res.status(500).json({ error: `فشل الاتصال بـ Together AI: ${errorMessage}` });
      return;
    }
  }

  // If provider is unknown or not set, return error
  if (provider === 'huggingface') {
    res.status(400).json({ error: "HuggingFace غير مدعوم للمحادثة حالياً. يرجى استخدام Gemini أو Groq أو OpenAI أو Together AI." });
    return;
  }
  
  res.status(400).json({ error: `مزود الذكاء الاصطناعي غير معروف: ${provider}. يرجى اختيار مزود صالح (gemini, openai, groq, together).` });
});

/** Google Gemini AI - Document Summarization */
app.post("/api/ai/summarize", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { content, locale } = req.body as { content?: string; locale?: string };

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "محتوى الوثيقة ناقص" });
    return;
  }

  // Check if user has valid subscription (not just "ai" module)
  const user = await db.prepare("SELECT role, email, name FROM users WHERE id = ?").get(userId) as
    | { role: string; email: string; name: string }
    | undefined;
  if (!user) {
    res.status(403).json({ error: "المستخدم غير موجود" });
    return;
  }
  
  const isSuperAdmin = user.role === "superadmin" || 
    user.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(user.email, user.name);
  
  if (!isSuperAdmin) {
    const sub = await db.prepare(
      `SELECT status, ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(userId) as { status: string; ends_at: string | null } | undefined;
    
    if (!sub || sub.status !== "approved") {
      res.status(403).json({ error: "الاشتراك غير مفعّل. يرجى تفعيل اشتراكك للوصول إلى المساعد الذكي." });
      return;
    }
    
    if (sub.ends_at) {
      const end = new Date(sub.ends_at).getTime();
      if (Number.isFinite(end) && end <= Date.now()) {
        res.status(403).json({ error: "انتهى الاشتراك. يرجى تجديد اشتراكك للوصول إلى المساعد الذكي." });
        return;
      }
    }
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: "خدمة الذكاء الاصطناعي غير مفعّلة" });
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('ar-MA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const systemPrompt = locale === "ar-MA" || locale === "ar"
      ? `[معلومات النظام الهامة: التاريخ الحالي اليوم هو ${dateStr} ونحن الآن في سنة 2026 ميلادية. أجب دائماً بناءً على هذا التاريخ الحالي بدقة وموثوقية وتجنب تماماً الإشارة إلى سنة 2024].
         
         لخص الوثيقة التالية إلى نقاط واضحة ومهنية. ركز على المعلومات الأساسية والأرقام والتواريخ المهمة.
         استخدم الدارجة المغربية أو العربية الفصحى. اجعل التلخيص سهل القراءة والفهم.`
      : `[Important System Information: Today's date is ${currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} and we are now in the year 2026. Always answer based on this current date accurately and reliably, avoid any reference to the year 2024].
         
         Summarize the following document into clear, professional bullet points. Focus on key information, numbers, and important dates.
         Make the summary easy to read and understand.`;

    const fullPrompt = `${systemPrompt}\n\nمحتوى الوثيقة:\n${content}`;
    const result = await model.generateContent(fullPrompt);

    const response = result.response;
    const text = response.text();

    res.json({ summary: text });
  } catch (error: any) {
    console.error("Gemini summarize error:", error);
    const errorMessage = error?.message || String(error);
    console.error("Error details:", errorMessage);
    
    res.status(500).json({ 
      error: (locale?.startsWith("ar") ?? false) 
        ? "فشل في تلخيص الوثيقة. الخدمة قد تكون مشغولة حالياً. يرجى المحاولة مرة أخرى لاحقاً."
        : "Failed to summarize document. The service may be busy. Please try again later.",
      details: errorMessage
    });
  }
});

/** Google Gemini AI - OCR for ID Cards and Documents */
app.post("/api/ai/ocr", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { imageData, locale, documentType } = req.body as {
    imageData?: string;
    locale?: string;
    documentType?: "id_card" | "document" | "general";
  };

  if (!imageData || typeof imageData !== "string") {
    res.status(400).json({ error: "بيانات الصورة ناقصة" });
    return;
  }

  // Check if user has valid subscription (not just "ai" module)
  const user = await db.prepare("SELECT role, email, name FROM users WHERE id = ?").get(userId) as
    | { role: string; email: string; name: string }
    | undefined;
  if (!user) {
    res.status(403).json({ error: "المستخدم غير موجود" });
    return;
  }
  
  const isSuperAdmin = user.role === "superadmin" || 
    user.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(user.email, user.name);
  
  if (!isSuperAdmin) {
    const sub = await db.prepare(
      `SELECT status, ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(userId) as { status: string; ends_at: string | null } | undefined;
    
    if (!sub || sub.status !== "approved") {
      res.status(403).json({ error: "الاشتراك غير مفعّل. يرجى تفعيل اشتراكك للوصول إلى المساعد الذكي." });
      return;
    }
    
    if (sub.ends_at) {
      const end = new Date(sub.ends_at).getTime();
      if (Number.isFinite(end) && end <= Date.now()) {
        res.status(403).json({ error: "انتهى الاشتراك. يرجى تجديد اشتراكك للوصول إلى المساعد الذكي." });
        return;
      }
    }
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: "خدمة الذكاء الاصطناعي غير مفعّلة" });
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('ar-MA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const dateContext = locale === "ar-MA" || locale === "ar"
      ? `[معلومات النظام الهامة: التاريخ الحالي اليوم هو ${dateStr} ونحن الآن في سنة 2026 ميلادية. أجب دائماً بناءً على هذا التاريخ الحالي بدقة وموثوقية وتجنب تماماً الإشارة إلى سنة 2024].`
      : `[Important System Information: Today's date is ${currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} and we are now in the year 2026. Always answer based on this current date accurately and reliably, avoid any reference to the year 2024].`;

    let systemPrompt = "";
    if (documentType === "id_card") {
      systemPrompt = locale === "ar-MA" || locale === "ar"
        ? `${dateContext}
           
           أنت خبير في قراءة البطاقات الوطنية المغربية. استخرج المعلومات بدقة عالية من الصورة.
           يجب أن تُرجع JSON فقط بالتنسيق التالي:
           {
             "firstName": "الاسم الشخصي",
             "lastName": "اسم العائلة",
             "nationalId": "رقم البطاقة الوطنية",
             "dateOfBirth": "تاريخ الميلاد (YYYY-MM-DD)",
             "placeOfBirth": "مكان الولادة",
             "address": "العنوان الكامل",
             "gender": "الجنس (ذكر/أنثى)"
           }
           تأكد من عدم وجود أخطاء إملائية. استخرج النص بالعربية والفرنسية كما هو مكتوب.`
        : `${dateContext}
           
           You are an expert in reading Moroccan national ID cards. Extract information with high accuracy from the image.
           Return ONLY JSON in the following format:
           {
             "firstName": "First name",
             "lastName": "Last name",
             "nationalId": "National ID number",
             "dateOfBirth": "Date of birth (YYYY-MM-DD)",
             "placeOfBirth": "Place of birth",
             "address": "Full address",
             "gender": "Gender (male/female)"
           }
           Ensure no typos. Extract text in Arabic and French as written.`;
    } else {
      systemPrompt = locale === "ar-MA" || locale === "ar"
        ? `استخرج جميع النصوص من الصورة بدقة عالية. يدعم العربية والفرنسية والإنجليزية والإسبانية.
           ركز على الأرقام والتواريخ والأسماء والعناوين. أرجع النص المستخرج فقط.`
        : `Extract all text from the image with high accuracy. Supports Arabic, French, English, and Spanish.
           Focus on numbers, dates, names, and addresses. Return only the extracted text.`;
    }

    const imagePart = {
      inlineData: {
        data: imageData.split(",")[1],
        mimeType: "image/jpeg",
      },
    };

    const result = await model.generateContent([systemPrompt, imagePart]);

    const response = result.response;
    const text = response.text();

    if (documentType === "id_card") {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          res.json({ extracted: jsonData });
        } else {
          res.json({ extracted: { rawText: text } });
        }
      } catch {
        res.json({ extracted: { rawText: text } });
      }
    } else {
      res.json({ extracted: { text } });
    }
  } catch (error: any) {
    console.error("Gemini OCR error:", error);
    const errorMessage = error?.message || String(error);
    console.error("Error details:", errorMessage);
    
    res.status(500).json({ 
      error: (locale?.startsWith("ar") ?? false) 
        ? "فشل في معالجة الصورة. الخدمة قد تكون مشغولة حالياً. يرجى المحاولة مرة أخرى لاحقاً."
        : "Failed to process image. The service may be busy. Please try again later.",
      details: errorMessage
    });
  }
});

/** Google Gemini AI - Image Generation (using Imagen) */
app.post("/api/ai/image", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { prompt } = req.body as { prompt?: string };
  
  // Support header-based API keys (from the new hybrid system)
  const headerOpenAIKey = req.headers['x-openai-api-key'] as string;
  const headerGeminiKey = req.headers['x-gemini-api-key'] as string;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    res.status(400).json({ error: "الوصف ناقص" });
    return;
  }

  // Check if user has valid subscription (not just "ai" module)
  const user = await db.prepare("SELECT role, email, name, ai_api_key, ai_provider FROM users WHERE id = ?").get(userId) as
    | { role: string; email: string; name: string; ai_api_key: string | null; ai_provider: string | null }
    | undefined;
  if (!user) {
    res.status(403).json({ error: "المستخدم غير موجود" });
    return;
  }
  
  const isSuperAdmin = user.role === "superadmin" || 
    user.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(user.email, user.name);
  
  if (!isSuperAdmin) {
    const sub = await db.prepare(
      `SELECT status, ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(userId) as { status: string; ends_at: string | null } | undefined;
    
    if (!sub || sub.status !== "approved") {
      res.status(403).json({ error: "الاشتراك غير مفعّل. يرجى تفعيل اشتراكك للوصول إلى المساعد الذكي." });
      return;
    }
    
    if (sub.ends_at) {
      const end = new Date(sub.ends_at).getTime();
      if (Number.isFinite(end) && end <= Date.now()) {
        res.status(403).json({ error: "انتهى الاشتراك. يرجى تجديد اشتراكك للوصول إلى المساعد الذكي." });
        return;
      }
    }
  }

  // Priority: Use Pollinations.ai as default (free, no API key required)
  // Only use paid APIs if user explicitly provides valid keys
  let finalProvider = 'pollinations';
  let apiKey = null;
  
  // Check for user-provided API keys (from headers first, then from database)
  if (headerOpenAIKey && headerOpenAIKey.trim().length > 15) {
    finalProvider = 'openai';
    apiKey = headerOpenAIKey.trim();
  } else if (headerGeminiKey && headerGeminiKey.trim().length > 15) {
    finalProvider = 'gemini';
    apiKey = headerGeminiKey.trim();
  } else if (user.ai_api_key && user.ai_api_key.trim().length > 15) {
    apiKey = user.ai_api_key.trim();
    // Auto-detect provider from key
    if (user.ai_provider) {
      finalProvider = user.ai_provider;
    } else {
      if (apiKey.startsWith('sk-')) finalProvider = 'openai';
      else if (apiKey.startsWith('AIza')) finalProvider = 'gemini';
      else if (apiKey.startsWith('gsk_')) finalProvider = 'groq';
      else if (apiKey.startsWith('hf_')) finalProvider = 'huggingface';
      else if (apiKey.startsWith('key_')) finalProvider = 'together';
    }
    console.log('Using API key from database for user:', userId, 'Provider:', finalProvider);
  } else if (process.env.GEMINI_API_KEY?.trim()) {
    finalProvider = 'gemini';
    apiKey = process.env.GEMINI_API_KEY.trim();
    console.log('Using GEMINI_API_KEY from environment as fallback');
  } else if (process.env.OPENAI_API_KEY?.trim()) {
    finalProvider = 'openai';
    apiKey = process.env.OPENAI_API_KEY.trim();
    console.log('Using OPENAI_API_KEY from environment as fallback');
  }
  
  // Always try Pollinations.ai first (free, reliable)
  try {
    // Translate Arabic to English for better image generation
    let englishPrompt = prompt;
    console.log('Pollinations AI - Generating image for prompt:', prompt.substring(0, 50) + '...');
    
    try {
      const translationRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent('Translate this Arabic text to English for image generation. Return ONLY the English translation: ' + prompt)}`);
      const translatedText = await translationRes.text();
      if (translatedText && translatedText.trim()) {
        englishPrompt = translatedText.trim();
        console.log('Pollinations AI - Translated prompt:', englishPrompt.substring(0, 50) + '...');
      }
    } catch (e) {
      console.log("Pollinations AI - Translation failed, using original prompt");
    }

    const encodedPrompt = encodeURIComponent(englishPrompt);
    const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
    
    console.log('Pollinations AI - Fetching image from:', imageUrl);
    
    // Fetch image as arraybuffer
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'Accept': 'image/*',
      }
    });
    
    console.log('Pollinations AI - Response status:', imageResponse.status);
    console.log('Pollinations AI - Content-Type:', imageResponse.headers.get('content-type'));
    
    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.log('Pollinations AI - Error response:', errorText.substring(0, 200));
      throw new Error(`Pollinations returned status ${imageResponse.status}`);
    }
    
    const buffer = await imageResponse.arrayBuffer();
    
    if (buffer.byteLength === 0) {
      throw new Error('Empty image buffer from Pollinations');
    }
    
    console.log('Pollinations AI - Buffer size:', buffer.byteLength);
    
    // Check content type to ensure it's an image
    const contentType = imageResponse.headers.get('content-type');
    if (contentType && !contentType.startsWith('image/')) {
      console.log('Pollinations returned non-image content:', contentType);
      // Try to convert anyway if it's not HTML error page
      if (contentType.includes('text/html')) {
        throw new Error('Pollinations returned HTML error page instead of image');
      }
    }
    
    // Use sharp to optimize and convert to base64 with better error handling
    try {
      const sharp = (await import('sharp')).default;
      const optimizedBuffer = await sharp(Buffer.from(buffer))
        .toFormat('jpeg', { quality: 85 })
        .toBuffer();
      
      const base64 = optimizedBuffer.toString('base64');
      
      console.log('Pollinations AI - Successfully generated image');
      res.json({ b64: base64, imageUrl: `data:image/jpeg;base64,${base64}`, provider: 'Pollinations AI (Free)' });
      return;
    } catch (sharpError) {
      console.error('Sharp processing error:', sharpError);
      // Fallback: convert buffer directly to base64 without sharp optimization
      const base64 = Buffer.from(buffer).toString('base64');
      console.log('Pollinations AI - Using raw buffer conversion');
      res.json({ b64: base64, imageUrl: `data:image/jpeg;base64,${base64}`, provider: 'Pollinations AI (Raw)' });
      return;
    }
  } catch (pollinationsError) {
    console.error('Pollinations.ai image generation error:', pollinationsError);
    
    // If Pollinations fails and we have a paid API key, try that as fallback
    if (finalProvider !== 'pollinations' && apiKey) {
      // For OpenAI provider (header or DB key)
      if (finalProvider === 'openai') {
        const openaiKey = headerOpenAIKey || user.ai_api_key?.trim() || process.env.OPENAI_API_KEY?.trim();
        if (!openaiKey) {
          res.status(503).json({ error: "خدمة الذكاء الاصطناعي غير مفعّلة. يرجى إضافة مفتاح API في الإعدادات." });
          return;
        }
        
        try {
          const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'dall-e-3',
              prompt: prompt,
              n: 1,
              size: '1024x1024',
              response_format: 'b64_json',
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API error');
          }

          const data = await response.json();
          const b64 = data.data[0]?.b64_json;
          if (b64) {
            res.json({ b64, provider: 'OpenAI DALL-E 3' });
            return;
          } else {
            throw new Error('No image data returned');
          }
        } catch (error) {
          console.error('OpenAI image generation error:', error);
          // Fallback to pollinations.ai
          try {
            let englishPrompt = prompt;
            try {
              const translationRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent('Translate this Arabic text to English for image generation. Return ONLY the English translation: ' + prompt)}`);
              const translatedText = await translationRes.text();
              if (translatedText && translatedText.trim()) {
                englishPrompt = translatedText.trim();
              }
            } catch (e) {
              console.log("Translation failed, using original prompt");
            }

            const encodedPrompt = encodeURIComponent(englishPrompt);
            const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
            
            const imageResponse = await fetch(imageUrl);
            
            if (!imageResponse.ok) {
              throw new Error(`Pollinations returned status ${imageResponse.status}`);
            }
            
            const buffer = await imageResponse.arrayBuffer();
            
            if (buffer.byteLength === 0) {
              throw new Error('Empty image buffer from Pollinations');
            }
            
            const sharp = (await import('sharp')).default;
            const optimizedBuffer = await sharp(Buffer.from(buffer))
              .toFormat('jpeg', { quality: 85 })
              .toBuffer();
            
            const base64 = optimizedBuffer.toString('base64');
            res.json({ b64: base64, imageUrl: `data:image/jpeg;base64,${base64}`, provider: 'Pollinations AI (OpenAI Fallback)' });
            return;
          } catch (fallbackError) {
            console.error('Pollinations fallback error:', fallbackError);
            res.status(500).json({ error: 'فشل الاتصال بـ OpenAI والبديل المجاني' });
            return;
          }
        }
      }
      
      // For Gemini provider
      if (finalProvider === 'gemini') {
        try {
          const { generateGeminiImageViaRest, extractGeminiInlineImageData } = await import('./aiImageGeneration');
          const models = ['imagen-3.0-generate-001', 'imagen-3.0-generate-001:generate-image', 'gemini-2.0-flash-exp'];
          
          for (const model of models) {
            try {
              const result = await generateGeminiImageViaRest(apiKey, model, prompt);
              const b64 = extractGeminiInlineImageData(result);
              if (b64) {
                res.json({ b64, provider: `Gemini ${model}` });
                return;
              }
            } catch (modelError) {
              console.log(`Gemini model ${model} failed:`, modelError);
              continue;
            }
          }
          
          // All Gemini models failed, fallback to Pollinations
          throw new Error('All Gemini models failed');
        } catch (error) {
          console.error('Gemini image generation error:', error);
          // Fallback to pollinations.ai
          try {
            let englishPrompt = prompt;
            try {
              const translationRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent('Translate this Arabic text to English for image generation. Return ONLY the English translation: ' + prompt)}`);
              const translatedText = await translationRes.text();
              if (translatedText && translatedText.trim()) {
                englishPrompt = translatedText.trim();
              }
            } catch (e) {
              console.log("Translation failed, using original prompt");
            }

            const encodedPrompt = encodeURIComponent(englishPrompt);
            const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
            
            const imageResponse = await fetch(imageUrl);
            
            if (!imageResponse.ok) {
              throw new Error(`Pollinations returned status ${imageResponse.status}`);
            }
            
            const buffer = await imageResponse.arrayBuffer();
            
            if (buffer.byteLength === 0) {
              throw new Error('Empty image buffer from Pollinations');
            }
            
            const sharp = (await import('sharp')).default;
            const optimizedBuffer = await sharp(Buffer.from(buffer))
              .toFormat('jpeg', { quality: 85 })
              .toBuffer();
            
            const base64 = optimizedBuffer.toString('base64');
            res.json({ b64: base64, imageUrl: `data:image/jpeg;base64,${base64}`, provider: 'Pollinations AI (Gemini Fallback)' });
            return;
          } catch (fallbackError) {
            console.error('Pollinations fallback error:', fallbackError);
            res.status(500).json({ error: 'فشل الاتصال بـ Gemini والبديل المجاني' });
            return;
          }
        }
      }
      
      // For Together AI provider
      if (finalProvider === 'together') {
        try {
          console.log('Together AI Image - Attempting connection with key:', apiKey.substring(0, 10) + '...');
          
          // Translate Arabic to English for better image generation
          let englishPrompt = prompt;
          try {
            const translationRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent('Translate this Arabic text to English for image generation. Return ONLY the English translation: ' + prompt)}`);
            const translatedText = await translationRes.text();
            if (translatedText && translatedText.trim()) {
              englishPrompt = translatedText.trim();
            }
          } catch (e) {
            console.log("Translation failed, using original prompt");
          }

          console.log('Together AI Image - Sending request with prompt:', englishPrompt.substring(0, 100) + '...');
          
          const response = await fetch('https://api.together.xyz/v1/images/generations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'black-forest-labs/FLUX.1-schnell',
              prompt: englishPrompt,
              width: 1024,
              height: 1024,
              steps: 4,
              n: 1,
              response_format: 'b64_json',
            }),
          });

          console.log('Together AI Image - Response status:', response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.log('Together AI Image - Error response:', errorText);
            
            try {
              const error = JSON.parse(errorText);
              const errorMsg = error.error?.message || error.message || 'Together AI API error';
              console.log('Together AI Image - Parsed error:', errorMsg);
              throw new Error(errorMsg);
            } catch (parseError) {
              console.log('Together AI Image - Parse error:', parseError);
              throw new Error('فشل الاتصال بخادم Together AI - ' + errorText.substring(0, 200));
            }
          }

          const data = await response.json();
          const b64 = data.data?.[0]?.b64_json;
          if (b64) {
            res.json({ b64, provider: 'Together AI FLUX.1' });
            return;
          } else {
            throw new Error('No image data returned from Together AI');
          }
        } catch (error) {
          console.error('Together AI image generation error:', error);
          // Fallback to pollinations.ai
          try {
            let englishPrompt = prompt;
            try {
              const translationRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent('Translate this Arabic text to English for image generation. Return ONLY the English translation: ' + prompt)}`);
              const translatedText = await translationRes.text();
              if (translatedText && translatedText.trim()) {
                englishPrompt = translatedText.trim();
              }
            } catch (e) {
              console.log("Translation failed, using original prompt");
            }

            const encodedPrompt = encodeURIComponent(englishPrompt);
            const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
            
            const imageResponse = await fetch(imageUrl);
            
            if (!imageResponse.ok) {
              throw new Error(`Pollinations returned status ${imageResponse.status}`);
            }
            
            const buffer = await imageResponse.arrayBuffer();
            
            if (buffer.byteLength === 0) {
              throw new Error('Empty image buffer from Pollinations');
            }
            
            const sharp = (await import('sharp')).default;
            const optimizedBuffer = await sharp(Buffer.from(buffer))
              .toFormat('jpeg', { quality: 85 })
              .toBuffer();
            
            const base64 = optimizedBuffer.toString('base64');
            res.json({ b64: base64, imageUrl: `data:image/jpeg;base64,${base64}`, provider: 'Pollinations AI (Together AI Fallback)' });
            return;
          } catch (fallbackError) {
            console.error('Pollinations fallback error:', fallbackError);
            res.status(500).json({ error: 'فشل الاتصال بـ Together AI والبديل المجاني' });
            return;
          }
        }
      }
    }
    
    // If we get here, Pollinations failed and no fallback worked
    res.status(500).json({ error: 'فشل توليد الصورة. الخدمة قد تكون مشغولة حالياً. يرجى المحاولة مرة أخرى لاحقاً.' });
    return;
  }
});

/** AI Text-to-Speech (TTS) */
app.post("/api/ai/tts", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { text, locale } = req.body as { text?: string; locale?: string };

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "النص مطلوب" });
    return;
  }

  // Check user subscription
  const user = await db.prepare("SELECT role, email, name, ai_api_key, ai_provider FROM users WHERE id = ?").get(userId) as
    | { role: string; email: string; name: string; ai_api_key: string | null; ai_provider: string | null }
    | undefined;
  if (!user) {
    res.status(403).json({ error: "المستخدم غير موجود" });
    return;
  }

  const isSuperAdmin = user.role === "superadmin" || 
    user.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(user.email, user.name);

  if (!isSuperAdmin) {
    const sub = await db.prepare(
      `SELECT status, ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(userId) as { status: string; ends_at: string | null } | undefined;
    
    if (!sub || sub.status !== "approved") {
      res.status(403).json({ error: "الاشتراك غير مفعّل" });
      return;
    }
    
    if (sub.ends_at) {
      const end = new Date(sub.ends_at).getTime();
      if (Number.isFinite(end) && end <= Date.now()) {
        res.status(403).json({ error: "انتهى الاشتراك" });
        return;
      }
    }
  }

  const provider = user.ai_provider || 'openai';
  const apiKey = user.ai_api_key?.trim() || process.env.OPENAI_API_KEY?.trim();

  // For OpenAI provider
  if (provider === 'openai' && apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: 'alloy',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Check if response is HTML (Cloudflare error)
        if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
          throw new Error('فشل الاتصال بخادم OpenAI - قد يكون هناك مشكلة في الشبكة أو الحماية');
        }
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.error?.message || 'OpenAI TTS error');
        } catch {
          throw new Error('فشل الاتصال بخادم OpenAI');
        }
      }

      const audioBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(audioBuffer).toString('base64');
      res.json({ audio: base64, provider: 'OpenAI TTS' });
      return;
    } catch (error) {
      console.error('OpenAI TTS error:', error);
      const errorMessage = error instanceof Error ? error.message : 'فشل الاتصال بـ OpenAI';
      res.status(500).json({ error: `فشل الاتصال بـ OpenAI TTS: ${errorMessage}` });
      return;
    }
  }

  // For Gemini provider (using Google Cloud TTS)
  if (provider === 'gemini' && apiKey) {
    try {
      // Gemini doesn't have direct TTS, use Google Cloud TTS with the same key
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text: text },
          voice: {
            languageCode: locale === 'ar-MA' || locale === 'ar-SA' ? 'ar-SA' : 'en-US',
            ssmlGender: 'NEUTRAL',
          },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.error?.message || 'Google TTS error');
        } catch {
          throw new Error('فشل الاتصال بخادم Google TTS');
        }
      }

      const data = await response.json();
      const audioBase64 = data.audioContent;
      res.json({ audio: audioBase64, provider: 'Google TTS' });
      return;
    } catch (error) {
      console.error('Google TTS error:', error);
      const errorMessage = error instanceof Error ? error.message : 'فشل الاتصال بـ Google TTS';
      res.status(500).json({ error: `فشل الاتصال بـ Google TTS: ${errorMessage}` });
      return;
    }
  }

  // If provider is not supported for TTS
  res.status(400).json({ error: `المزود ${provider} غير مدعوم لتحويل النص إلى صوت. يرجى استخدام OpenAI أو Gemini.` });
});

/** AI Speech-to-Text (STT) */
app.post("/api/ai/stt", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { audio } = req.body as { audio?: string };

  if (!audio || typeof audio !== "string") {
    res.status(400).json({ error: "الصوت مطلوب" });
    return;
  }

  // Check user subscription
  const user = await db.prepare("SELECT role, email, name, ai_api_key, ai_provider FROM users WHERE id = ?").get(userId) as
    | { role: string; email: string; name: string; ai_api_key: string | null; ai_provider: string | null }
    | undefined;
  if (!user) {
    res.status(403).json({ error: "المستخدم غير موجود" });
    return;
  }

  const isSuperAdmin = user.role === "superadmin" || 
    user.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(user.email, user.name);

  if (!isSuperAdmin) {
    const sub = await db.prepare(
      `SELECT status, ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(userId) as { status: string; ends_at: string | null } | undefined;
    
    if (!sub || sub.status !== "approved") {
      res.status(403).json({ error: "الاشتراك غير مفعّل" });
      return;
    }
    
    if (sub.ends_at) {
      const end = new Date(sub.ends_at).getTime();
      if (Number.isFinite(end) && end <= Date.now()) {
        res.status(403).json({ error: "انتهى الاشتراك" });
        return;
      }
    }
  }

  const provider = user.ai_provider || 'openai';
  const apiKey = user.ai_api_key?.trim() || process.env.OPENAI_API_KEY?.trim();

  if (provider === 'openai' && apiKey) {
    try {
      const audioBuffer = Buffer.from(audio, 'base64');
      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer]), 'audio.webm');
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI STT error');
      }

      const data = await response.json();
      res.json({ text: data.text, provider: 'OpenAI Whisper' });
      return;
    } catch (error) {
      console.error('OpenAI STT error:', error);
    }
  }

  res.status(503).json({ error: "خدمة تحويل الصوت إلى نص غير متاحة. يرجى إضافة مفتاح OpenAI." });
});

/** AI Video Generation */
app.post("/api/ai/video", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    res.status(400).json({ error: "الوصف مطلوب" });
    return;
  }

  // Check user subscription
  const user = await db.prepare("SELECT role, email, name, ai_api_key, ai_provider FROM users WHERE id = ?").get(userId) as
    | { role: string; email: string; name: string; ai_api_key: string | null; ai_provider: string | null }
    | undefined;
  if (!user) {
    res.status(403).json({ error: "المستخدم غير موجود" });
    return;
  }

  const isSuperAdmin = user.role === "superadmin" || 
    user.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(user.email, user.name);

  if (!isSuperAdmin) {
    const sub = await db.prepare(
      `SELECT status, ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(userId) as { status: string; ends_at: string | null } | undefined;
    
    if (!sub || sub.status !== "approved") {
      res.status(403).json({ error: "الاشتراك غير مفعّل" });
      return;
    }
    
    if (sub.ends_at) {
      const end = new Date(sub.ends_at).getTime();
      if (Number.isFinite(end) && end <= Date.now()) {
        res.status(403).json({ error: "انتهى الاشتراك" });
        return;
      }
    }
  }

  // Use pollinations.ai for free video generation
  const encodedPrompt = encodeURIComponent(prompt);
  const videoUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=1024&height=576&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;
  res.json({ videoUrl, provider: 'Pollinations AI (Free)' });
});

/** إعدادات المنصة (عامة) — روابط التواصل ومعلومات الدفع */
app.get("/api/settings/public", async (_req, res) => {
  const rows = await db.prepare("SELECT key, value FROM app_settings").all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json({ settings });
});

app.put("/api/settings/platform", authMiddleware, platformSettingsEditor, async (req, res) => {
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
    await db.prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
    ).run(k, v);
  }
  res.json({ ok: true });
});

async function hasModuleAccess(userId: string, moduleId: string): Promise<boolean> {
  const user = await db.prepare("SELECT role, email, name FROM users WHERE id = ?").get(userId) as
    | { role: string; email: string; name: string }
    | undefined;
  if (!user) return false;
  
  const isSuperAdmin = user.role === "superadmin" || 
    user.email?.toLowerCase() === SUPER_ADMIN_EMAIL ||
    isPrimaryAdminUser(user.email, user.name);
  if (isSuperAdmin) return true;
  
  const sub = await db.prepare(
    `SELECT modules, status, ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  ).get(userId) as { modules: string; status: string; ends_at: string | null } | undefined;
  
  if (!sub || sub.status !== "approved") return false;
  
  if (sub.ends_at) {
    const end = new Date(sub.ends_at).getTime();
    if (Number.isFinite(end) && end <= Date.now()) return false;
  }
  
  try {
    const modules = JSON.parse(sub.modules) as string[];
    return Array.isArray(modules) && modules.includes(moduleId);
  } catch {
    return false;
  }
}

app.post("/api/auto-real-estate/save", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const hasAccess = await hasModuleAccess(userId, "auto_real_estate");
  if (!hasAccess) {
    res.status(403).json({ error: "ليس لديك صلاحية الوصول إلى هذا القسم" });
    return;
  }
  const data = req.body as Record<string, unknown>;
  await db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`
  ).run(`auto_real_estate_${userId}`, JSON.stringify(data));
  res.json({ ok: true });
});

app.get("/api/auto-real-estate/load", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const hasAccess = await hasModuleAccess(userId, "auto_real_estate");
  if (!hasAccess) {
    res.status(403).json({ error: "ليس لديك صلاحية الوصول إلى هذا القسم" });
    return;
  }
  const row = await db.prepare("SELECT value FROM app_settings WHERE key = ?").get(`auto_real_estate_${userId}`) as { value: string } | undefined;
  res.json({ data: row?.value ? JSON.parse(row.value) : null });
});

// Supabase auto_real_estate endpoints for super admin
app.get("/api/supabase/auto-real-estate", authMiddleware, async (req, res) => {
  try {
    const userId = (req as express.Request & { userId: string }).userId;
    const user = await db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string } | undefined;
    
    // Only allow super admin to access this endpoint
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
    
    // Get super admin's Supabase user ID - SUPER ADMIN SEES ONLY THEIR OWN DATA
    const superAdminSupabaseId = 'f13bed00-cd13-4075-8716-d9939ea8ba16'; // lahcenm534@gmail.com
    
    // Filter by user_id to ensure data isolation - super admin sees only their own data
    const response = await fetch(`${supabaseUrl}/rest/v1/auto_real_estate?select=*&user_id=eq.${superAdminSupabaseId}&order=created_at.desc`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }

    const data = await response.json();
    res.json({ data });
  } catch (error) {
    console.error("Error fetching auto_real_estate:", error);
    res.status(500).json({ error: "فشل جلب البيانات" });
  }
});

app.post("/api/supabase/auto-real-estate", authMiddleware, async (req, res) => {
  try {
    const userId = (req as express.Request & { userId: string }).userId;
    const user = await db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string } | undefined;
    
    // Only allow super admin to access this endpoint
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }

    const item = req.body;
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
    
    console.log('[AutoRealEstate API] Supabase URL:', supabaseUrl);
    console.log('[AutoRealEstate API] Supabase Key available:', !!supabaseKey);
    console.log('[AutoRealEstate API] Request body:', item);
    
    // Get super admin's Supabase user ID
    const superAdminSupabaseId = 'f13bed00-cd13-4075-8716-d9939ea8ba16'; // lahcenm534@gmail.com
    
    const dbItem = {
      user_id: superAdminSupabaseId, // Use actual super admin user ID - CRITICAL
      type: item.type,
      brand_or_title: item.brandOrTitle,
      plate_or_address: item.plateOrAddress,
      specs: item.specs || '',
      price: item.price || 0,
      status: item.status || 'Available',
      expiry_date: item.expiryDate || null,
      image: item.image || null,
      color: item.color || null,
      fuel: item.fuel || null,
      mileage: item.mileage || null,
      defects: item.defects || null,
      rent_start: item.rentStart || null,
      rent_end: item.rentEnd || null,
      prop_type: item.propType || null,
      commercial_type: item.commercialType || null,
      floor_num: item.floorNum || null,
      total_floors: item.totalFloors || null,
      rooms: item.rooms || null,
      bathrooms: item.bathrooms || null,
      amenities: item.amenities || null,
      zoning: item.zoning || null,
      sqm: item.sqm || null,
    };
    
    // CRITICAL: Ensure user_id is never null
    if (!dbItem.user_id) {
      console.error('[AutoRealEstate API] CRITICAL: user_id is null, setting to super admin ID');
      dbItem.user_id = superAdminSupabaseId;
    }

    console.log('[AutoRealEstate API] Sending to Supabase:', dbItem);
    console.log('[AutoRealEstate API] user_id value:', dbItem.user_id);
    console.log('[AutoRealEstate API] user_id type:', typeof dbItem.user_id);
    
    // Final verification before sending
    if (!dbItem.user_id) {
      throw new Error('CRITICAL: user_id is still null before sending to Supabase');
    }

    const jsonBody = JSON.stringify(dbItem);
    console.log('[AutoRealEstate API] JSON body length:', jsonBody.length);
    console.log('[AutoRealEstate API] JSON body preview:', jsonBody.substring(0, 200));

    const response = await fetch(`${supabaseUrl}/rest/v1/auto_real_estate`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: jsonBody,
    });

    console.log('[AutoRealEstate API] Supabase response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AutoRealEstate API] Supabase error:', response.status, errorText);
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log('[AutoRealEstate API] Response text length:', responseText.length);
    
    let data;
    if (responseText.length > 0) {
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[AutoRealEstate API] JSON parse error:', parseError);
        console.error('[AutoRealEstate API] Response text:', responseText);
        throw new Error('Failed to parse Supabase response');
      }
    } else {
      data = null;
    }
    
    console.log('[AutoRealEstate API] Success:', data);
    res.json({ data });
  } catch (error) {
    console.error("[AutoRealEstate API] Error saving auto_real_estate:", error);
    res.status(500).json({ error: "فشل حفظ البيانات", details: error instanceof Error ? error.message : String(error) });
  }
});

app.put("/api/supabase/auto-real-estate/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as express.Request & { userId: string }).userId;
    const user = await db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string } | undefined;
    
    // Only allow super admin to access this endpoint
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }

    const { id } = req.params;
    const item = req.body;
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
    
    console.log('[AutoRealEstate API PUT] Updating record ID:', id);
    console.log('[AutoRealEstate API PUT] Request body:', item);
    
    // Get super admin's Supabase user ID - SUPER ADMIN CAN ONLY UPDATE THEIR OWN DATA
    const superAdminSupabaseId = 'f13bed00-cd13-4075-8716-d9939ea8ba16'; // lahcenm534@gmail.com
    
    const dbItem = {
      user_id: superAdminSupabaseId, // Use actual super admin user ID
      type: item.type,
      brand_or_title: item.brandOrTitle,
      plate_or_address: item.plateOrAddress,
      specs: item.specs || '',
      price: item.price || 0,
      status: item.status || 'Available',
      expiry_date: item.expiryDate || null,
      image: item.image || null,
      color: item.color || null,
      fuel: item.fuel || null,
      mileage: item.mileage || null,
      defects: item.defects || null,
      rent_start: item.rentStart || null,
      rent_end: item.rentEnd || null,
      prop_type: item.propType || null,
      commercial_type: item.commercialType || null,
      floor_num: item.floorNum || null,
      total_floors: item.totalFloors || null,
      rooms: item.rooms || null,
      bathrooms: item.bathrooms || null,
      amenities: item.amenities || null,
      zoning: item.zoning || null,
      sqm: item.sqm || null,
    };

    console.log('[AutoRealEstate API PUT] dbItem:', dbItem);
    
    // Filter by both id AND user_id to ensure super admin can only update their own records
    const url = `${supabaseUrl}/rest/v1/auto_real_estate?id=eq.${id}&user_id=eq.${superAdminSupabaseId}`;
    console.log('[AutoRealEstate API PUT] Supabase URL:', url);
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(dbItem),
    });

    console.log('[AutoRealEstate API PUT] Supabase response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AutoRealEstate API PUT] Supabase error:', response.status, errorText);
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log('[AutoRealEstate API PUT] Response text length:', responseText.length);
    
    let data;
    if (responseText.length > 0) {
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[AutoRealEstate API PUT] JSON parse error:', parseError);
        console.error('[AutoRealEstate API PUT] Response text:', responseText);
        data = null;
      }
    } else {
      data = null;
    }
    
    console.log('[AutoRealEstate API PUT] Success:', data);
    res.json({ data });
  } catch (error) {
    console.error("[AutoRealEstate API PUT] Error updating auto_real_estate:", error);
    res.status(500).json({ error: "فشل تحديث البيانات", details: error instanceof Error ? error.message : String(error) });
  }
});

app.delete("/api/supabase/auto-real-estate/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as express.Request & { userId: string }).userId;
    const user = await db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string } | undefined;
    
    // Only allow super admin to access this endpoint
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }

    const { id } = req.params;
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
    
    // Get super admin's Supabase user ID - SUPER ADMIN CAN ONLY DELETE THEIR OWN DATA
    const superAdminSupabaseId = 'f13bed00-cd13-4075-8716-d9939ea8ba16'; // lahcenm534@gmail.com
    
    // Filter by both id AND user_id to ensure super admin can only delete their own records
    const response = await fetch(`${supabaseUrl}/rest/v1/auto_real_estate?id=eq.${id}&user_id=eq.${superAdminSupabaseId}`, {
      method: 'DELETE',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting auto_real_estate:", error);
    res.status(500).json({ error: "فشل حذف البيانات" });
  }
});

/** ملف تأشيرة — بيانات محفوظة للحجز التلقائي */
app.get("/api/visa/profile", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const row = await db
    .prepare("SELECT * FROM visa_user_profile WHERE user_id = ?")
    .get(userId) as Record<string, unknown> | undefined;
  res.json({ profile: row ?? null });
});

app.post("/api/visa/profile", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
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
  const ex = await db.prepare("SELECT user_id FROM visa_user_profile WHERE user_id = ?").get(userId);
  if (ex) {
    await db.prepare(
      `UPDATE visa_user_profile SET full_name = ?, passport_no = ?, phone = ?, email = ?, extra_json = ?, updated_at = NOW() WHERE user_id = ?`
    ).run(
      b.full_name ?? "",
      b.passport_no ?? "",
      b.phone ?? "",
      b.email ?? "",
      b.extra_json ?? "{}",
      userId
    );
  } else {
    await db.prepare(
      `INSERT INTO visa_user_profile (user_id, full_name, passport_no, phone, email, extra_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`
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
app.get("/api/visa/appointment-status", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = await db
    .prepare("SELECT center_id, status, updated_at FROM visa_appointment_status WHERE user_id = ?")
    .all(userId) as { center_id: string; status: string; updated_at: string }[];
  res.json({ rows });
});

app.post("/api/visa/appointment-status/:centerId/refresh", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const centerId = paramString(req.params.centerId).trim();
  if (!centerId) {
    res.status(400).json({ error: "مرجع المركز ناقص" });
    return;
  }
  const prev = await db
    .prepare("SELECT status FROM visa_appointment_status WHERE user_id = ? AND center_id = ?")
    .get(userId, centerId) as { status: string } | undefined;
  const order: Array<"open" | "closed" | "soon"> = ["open", "closed", "soon"];
  const prevStatus = (prev?.status as "open" | "closed" | "soon") ?? "soon";
  const idx = order.indexOf(prevStatus);
  const next = order[(idx + 1) % 3];
  const now = new Date().toISOString();
  await db.prepare(
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

/** رادار التأشيرة الاحترافي - تحكم ومراقبة */
app.get("/api/visa/radar/status", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const radar = getVisaRadarProService();
  const status = radar.getStatus();
  res.json(status);
});

app.post("/api/visa/radar/start", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const radar = getVisaRadarProService();
  console.log("🚀 [API] Starting Visa Radar Pro for user:", userId);
  
  try {
    // Ensure radar is enabled
    radar.updateConfig({ enabled: true });
    console.log("✅ [API] Radar config updated to enabled");
    
    await radar.startRadar();
    console.log("✅ [API] Radar started successfully");
    
    const status = radar.getStatus();
    console.log("📊 [API] Current radar status:", JSON.stringify(status, null, 2));
    
    res.json({ success: true, message: "تم تشغيل الرادار الاحترافي بنجاح", status });
  } catch (error) {
    console.error("❌ [API] Failed to start radar:", error);
    res.status(500).json({ error: "فشل تشغيل الرادار", details: String(error) });
  }
});

app.post("/api/visa/radar/stop", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const radar = getVisaRadarProService();
  radar.stopRadar();
  res.json({ success: true, message: "تم إيقاف الرادار" });
});

app.post("/api/visa/radar/check-now", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const radar = getVisaRadarProService();
  const { centerId } = req.body as { centerId?: string };
  
  try {
    if (centerId) {
      const { getCenterById } = await import("./visaRadarConfig.js");
      const center = getCenterById(centerId);
      if (!center) {
        res.status(404).json({ error: "المركز غير موجود" });
        return;
      }
      const result = await radar.checkCenterSlots(center);
      res.json({ success: true, result });
    } else {
      res.status(400).json({ error: "يجب تحديد المركز" });
    }
  } catch (error) {
    res.status(500).json({ error: "فشل الفحص", details: String(error) });
  }
});

app.post("/api/visa/radar/config", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const radar = getVisaRadarProService();
  const { baseCheckInterval, extremeModeInterval, telegramBotToken, telegramChatId, whatsappEnabled, whatsappNumber, enabled } = req.body as {
    baseCheckInterval?: number;
    extremeModeInterval?: number;
    telegramBotToken?: string;
    telegramChatId?: string;
    whatsappEnabled?: boolean;
    whatsappNumber?: string;
    enabled?: boolean;
  };
  
  radar.updateConfig({
    baseCheckInterval,
    extremeModeInterval,
    telegramBotToken,
    telegramChatId,
    whatsappEnabled,
    whatsappNumber,
    enabled
  });
  
  res.json({ success: true, message: "تم تحديث إعدادات الرادار" });
});

app.post("/api/visa/radar/clear-detections", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const radar = getVisaRadarProService();
  radar.clearDetections();
  res.json({ success: true, message: "تم مسح سجل الكشوفات" });
});

app.post("/api/visa/radar/clear-logs", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const radar = getVisaRadarProService();
  radar.clearLogs();
  res.json({ success: true, message: "تم مسح سجل السجلات" });
});

app.get("/api/visa/radar/patterns", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const radar = getVisaRadarProService();
  const patterns = radar.getHistoricalPatterns();
  res.json({ patterns });
});

app.get("/api/visa/radar/centers", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "visa"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const { getEnabledCenters } = await import("./visaRadarConfig.js");
  const centers = getEnabledCenters();
  res.json({ centers });
});

/** مخزون ونقاط بيع */
app.get("/api/inventory/products", authMiddleware, async (req, res) => {
  try {
    const userId = (req as express.Request & { userId: string }).userId;
    if (!(await moduleAllowed(userId, "inventory"))) {
      res.status(403).json({ error: "القسم غير مفعّل" });
      return;
    }
    // Deduplicate products by keeping only the latest version of each product (by id)
    // This prevents duplicate entries in the UI
    const rows = await db.prepare(`
      SELECT DISTINCT ON (id) * FROM inventory_products 
      WHERE user_id = ? 
      ORDER BY id, created_at DESC
    `).all(userId);
    res.json({ products: rows });
  } catch (error) {
    console.error("[api/inventory/products GET] Error:", error);
    console.error("[api/inventory/products GET] Error details:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "فشل تحميل المنتجات", details: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/inventory/products", authMiddleware, async (req, res) => {
  try {
    const userId = (req as express.Request & { userId: string }).userId;
    if (!(await moduleAllowed(userId, "inventory"))) {
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
    const ppc = Math.max(1, Number(b.pieces_per_carton) || 1);
    const unitKind = (b.unit_kind?.trim() || "piece").slice(0, 24);
    const cost = Math.max(0, Number(b.cost_price) || 0);
    const expiry = b.expiry_date?.trim() ? b.expiry_date.trim().slice(0, 10) : null;
    const lowAlert = Math.max(0, Math.floor(Number(b.low_stock_alert) ?? 10) || 10);
    
    // Check if product with same SKU or name already exists (UPSERT logic)
    const existingBySku = b.sku?.trim() 
      ? await db.prepare("SELECT id FROM inventory_products WHERE user_id = ? AND sku = ?").get(userId, b.sku.trim())
      : null;
    const existingByName = await db.prepare("SELECT id FROM inventory_products WHERE user_id = ? AND name = ?").get(userId, b.name.trim());
    const existingId = existingBySku?.id || existingByName?.id;
    
    if (existingId) {
      // Update existing product
      await db.prepare(
        `UPDATE inventory_products SET name = ?, sku = ?, retail_type = ?, pieces_per_carton = ?, unit_price = ?, stock_pieces = ?, unit_kind = ?, cost_price = ?, expiry_date = ?, low_stock_alert = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`
      ).run(
        b.name.trim(),
        b.sku?.trim() ?? "",
        b.retail_type?.trim() || "retail",
        ppc,
        Number(b.unit_price) || 0,
        Math.max(0, Number(b.stock_pieces) || 0),
        unitKind,
        cost,
        expiry,
        lowAlert,
        existingId,
        userId
      );
      res.json({ id: existingId, updated: true });
    } else {
      // Insert new product
      const id = randomUUID();
      await db.prepare(
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
      res.json({ id, updated: false });
    }
  } catch (error) {
    console.error("[api/inventory/products POST] Error:", error);
    console.error("[api/inventory/products POST] Error details:", error instanceof Error ? error.message : String(error));
    console.error("[api/inventory/products POST] Stack:", error instanceof Error ? error.stack : undefined);
    res.status(500).json({ error: "فشل إنشاء المنتج", details: error instanceof Error ? error.message : String(error) });
  }
});

// Batch import endpoint for regular users (not Super Admin)
app.post("/api/inventory/products/batch", authMiddleware, async (req, res) => {
  try {
    const userId = (req as express.Request & { userId: string }).userId;
    if (!(await moduleAllowed(userId, "inventory"))) {
      res.status(403).json({ error: "القسم غير مفعّل" });
      return;
    }
    
    const products = Array.isArray(req.body) ? req.body : [req.body];
    const insertedIds: string[] = [];
    const updatedIds: string[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let idx = 0; idx < products.length; idx++) {
      const product = products[idx];
      const { name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, unit_kind, cost_price, expiry_date, low_stock_alert } = product;
      
      if (!name?.trim()) {
        errors.push({ index: idx, error: "اسم المنتج مطلوب" });
        continue;
      }
      
      const ppc = Math.max(1, Number(pieces_per_carton) || 1);
      const unitKind = (unit_kind?.trim() || "piece").slice(0, 24);
      const cost = Math.max(0, Number(cost_price) || 0);
      const expiry = expiry_date?.trim() ? expiry_date.trim().slice(0, 10) : null;
      const lowAlert = Math.max(0, Math.floor(Number(low_stock_alert) ?? 10) || 10);
      
      try {
        // Check if product with same SKU or name already exists (UPSERT logic)
        const existingBySku = sku?.trim() 
          ? await db.prepare("SELECT id FROM inventory_products WHERE user_id = ? AND sku = ?").get(userId, sku.trim())
          : null;
        const existingByName = await db.prepare("SELECT id FROM inventory_products WHERE user_id = ? AND name = ?").get(userId, name.trim());
        const existingId = existingBySku?.id || existingByName?.id;
        
        if (existingId) {
          // Update existing product
          await db.prepare(
            `UPDATE inventory_products SET name = ?, sku = ?, retail_type = ?, pieces_per_carton = ?, unit_price = ?, stock_pieces = ?, unit_kind = ?, cost_price = ?, expiry_date = ?, low_stock_alert = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`
          ).run(
            name.trim(),
            sku?.trim() ?? "",
            retail_type?.trim() || "retail",
            ppc,
            Number(unit_price) || 0,
            Math.max(0, Number(stock_pieces) || 0),
            unitKind,
            cost,
            expiry,
            lowAlert,
            existingId,
            userId
          );
          if (existingId) updatedIds.push(existingId);
        } else {
          // Insert new product
          const id = randomUUID();
          await db.prepare(
            `INSERT INTO inventory_products (id, user_id, name, sku, retail_type, pieces_per_carton, unit_price, stock_pieces, unit_kind, cost_price, expiry_date, low_stock_alert, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`
          ).run(
            id,
            userId,
            name.trim(),
            sku?.trim() ?? "",
            retail_type?.trim() || "retail",
            ppc,
            Number(unit_price) || 0,
            Math.max(0, Number(stock_pieces) || 0),
            unitKind,
            cost,
            expiry,
            lowAlert
          );
          insertedIds.push(id);
        }
      } catch (err) {
        console.error(`[api/inventory/products/batch] Error processing product ${idx}:`, err);
        errors.push({ index: idx, error: err instanceof Error ? err.message : String(err) });
      }
    }
    
    res.json({ 
      inserted: insertedIds, 
      updated: updatedIds,
      errors,
      message: `Successfully created ${insertedIds.length} product(s) and updated ${updatedIds.length} product(s)` + (errors.length > 0 ? ` with ${errors.length} error(s)` : "")
    });
  } catch (error) {
    console.error("[api/inventory/products/batch] Error:", error);
    console.error("[api/inventory/products/batch] Error details:", error instanceof Error ? error.message : String(error));
    console.error("[api/inventory/products/batch] Stack:", error instanceof Error ? error.stack : undefined);
    res.status(500).json({ error: "فشل الاستيراد الجماعي", details: error instanceof Error ? error.message : String(error) });
  }
});

app.patch("/api/inventory/products/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
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
  try {
    // Check if product exists first
    const existing = await db.prepare("SELECT id FROM inventory_products WHERE id = ? AND user_id = ?").get(id, userId);
    if (!existing) {
      res.status(404).json({ error: "المنتج غير موجود" });
      return;
    }

    const r = await db
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
      res.status(404).json({ error: "لم يتم تحديث المنتج" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("[api/inventory/products/:id] Error:", error);
    res.status(500).json({ error: "فشل تحديث المنتج" });
  }
});

app.delete("/api/inventory/products/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as express.Request & { userId: string }).userId;
    if (!(await moduleAllowed(userId, "inventory"))) {
      res.status(403).json({ error: "القسم غير مفعّل" });
      return;
    }
    const id = paramString(req.params.id);
    const r = await db
      .prepare(`DELETE FROM inventory_products WHERE id = ? AND user_id = ?`)
      .run(id, userId);
    if (r.changes === 0) {
      res.status(404).json({ error: "غير موجود" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("[api/inventory/products DELETE] Error:", error);
    res.status(500).json({ error: "فشل حذف المنتج" });
  }
});

/** استخراج نص من PDF أو DOCX للمخزون (OCR الذكاء يكمّل على العميل للصور) */
app.post(
  "/api/inventory/extract-document-text",
  authMiddleware,
  uploadMemory.single("file"),
  async (req, res) => {
    const userId = (req as express.Request & { userId: string }).userId;
    if (!(await moduleAllowed(userId, "inventory"))) {
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
    if (!(await moduleAllowed(userId, "inventory"))) {
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

app.post("/api/inventory/stock-add", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as { product_id?: string; add_pieces?: number };
  if (!b.product_id || !Number.isFinite(Number(b.add_pieces))) {
    res.status(400).json({ error: "بيانات ناقصة" });
    return;
  }
  const add = Math.floor(Number(b.add_pieces));
  try {
    const r = await db
      .prepare(
        `UPDATE inventory_products SET stock_pieces = stock_pieces + ? WHERE id = ? AND user_id = ?`
      )
      .run(add, b.product_id, userId);
    if (r.changes === 0) {
      res.status(404).json({ error: "المنتج غير موجود" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("[api/inventory/stock-add] Error:", error);
    res.status(500).json({ error: "فشل تحديث المخزون" });
  }
});

app.post("/api/inventory/sale", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
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
  const product = await db
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
  await db.prepare(`UPDATE inventory_products SET stock_pieces = stock_pieces - ? WHERE id = ?`).run(qty, product.id);
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
  await db.prepare(
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
app.post("/api/inventory/sale-batch", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
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

  try {
    const out = await db.withTransaction(async (client) => {
      const pq = (sql: string) => db.prepareWithClient(client, sql);
      const linesOut: LineOut[] = [];
      let grandTotal = 0;
      for (const row of b.lines!) {
        if (!row.product_id || !Number.isFinite(Number(row.qty_pieces))) {
          throw new Error("بيانات ناقصة");
        }
        const qty = Math.max(1, Math.floor(Number(row.qty_pieces)));
        const product = (await pq(
          "SELECT * FROM inventory_products WHERE id = ? AND user_id = ?"
        ).get(row.product_id, userId)) as
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
        await pq(`UPDATE inventory_products SET stock_pieces = stock_pieces - ? WHERE id = ?`).run(qty, product.id);
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
      await pq(
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
      return { invId, grandTotal, credit };
    });
    res.json({ id: out.invId, total: out.grandTotal, credit: out.credit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "فشل البيع";
    if (msg === "الكمية غير متوفرة في المخزون" || msg === "المنتج غير موجود" || msg === "بيانات ناقصة") {
      res.status(400).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

app.get("/api/inventory/invoices", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = await db
    .prepare("SELECT * FROM pos_invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 200")
    .all(userId);
  res.json({ invoices: rows });
});

app.put("/api/inventory/invoices/:id/void", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }

  const invoiceId = req.params.id;

  try {
    // Get the invoice details to restore stock
    const invoice = await db
      .prepare("SELECT lines_json FROM pos_invoices WHERE id = ? AND user_id = ?")
      .get(invoiceId, userId) as { lines_json: string } | undefined;

    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    // Parse lines to restore stock
    const lines = JSON.parse(invoice.lines_json || "[]");

    // Restore stock for each line
    for (const line of lines) {
      if (line.product_id && line.qty_pieces) {
        await db
          .prepare("UPDATE inventory_products SET stock_pieces = stock_pieces + ? WHERE id = ? AND user_id = ?")
          .run(line.qty_pieces, line.product_id, userId);
      }
    }

    // Mark invoice as voided
    await db
      .prepare("UPDATE pos_invoices SET status = 'voided' WHERE id = ? AND user_id = ?")
      .run(invoiceId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error voiding invoice:", error);
    res.status(500).json({ error: "Failed to void invoice" });
  }
});

function parseProductionRequestRow(row: Record<string, unknown>) {
  return {
    ...row,
    bom_items: (() => {
      const raw = row.bom_items_json;
      if (typeof raw !== "string" || !raw.trim()) return [];
      try {
        return JSON.parse(raw) as unknown[];
      } catch {
        return [];
      }
    })(),
  };
}

app.get("/api/inventory/production-requests", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = (await db
    .prepare("SELECT * FROM production_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 200")
    .all(userId)) as Record<string, unknown>[];
  res.json({ requests: rows.map(parseProductionRequestRow) });
});

app.post("/api/inventory/production-requests", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as {
    title?: string;
    target_quantity?: number;
    status?: string;
    requested_by?: string;
    bom_items?: Array<{ material_id: string; quantity: number; name?: string; reference?: string; source?: string }>;
  };
  const bom = Array.isArray(b.bom_items) ? b.bom_items : [];
  if (!bom.length) {
    res.status(400).json({ error: "أضف مواد للإنتاج أولاً" });
    return;
  }
  const id = randomUUID();
  const title = (b.title ?? "طلب إنتاج").trim().slice(0, 240);
  const targetQty = Math.max(
    1,
    Number(b.target_quantity) || bom.reduce((s, i) => s + Math.max(1, Number(i.quantity) || 1), 0)
  );
  const requestedBy = (b.requested_by ?? "inventory-module").trim().slice(0, 120);
  const status = (b.status ?? "pending").trim().slice(0, 40);
  const bomJson = JSON.stringify(
    bom.map((item) => ({
      material_id: String(item.material_id),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      name: item.name?.trim() ?? "",
      reference: item.reference?.trim() ?? "",
      source: item.source?.trim() ?? "inventory_products",
    }))
  );
  await db.prepare(
    `INSERT INTO production_requests (id, user_id, title, target_quantity, status, requested_by, bom_items_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`
  ).run(id, userId, title, targetQty, status, requestedBy, bomJson);
  const logId = randomUUID();
  await db.prepare(
    `INSERT INTO logistics_queue (id, user_id, production_request_id, product_id, assigned_to, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'scheduled', NOW())`
  ).run(logId, userId, id, id, requestedBy);
  const row = (await db.prepare("SELECT * FROM production_requests WHERE id = ? AND user_id = ?").get(id, userId)) as
    | Record<string, unknown>
    | undefined;
  res.json({ request: row ? parseProductionRequestRow(row) : { id, title, target_quantity: targetQty, status } });
});

app.get("/api/inventory/logistics-queue", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const rows = await db
    .prepare("SELECT * FROM logistics_queue WHERE user_id = ? ORDER BY created_at DESC LIMIT 200")
    .all(userId);
  res.json({ items: rows });
});

app.patch("/api/inventory/logistics-queue/:id/assign", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const logisticsId = paramString(req.params.id);
  const assignedTo = String((req.body as { assigned_to?: string }).assigned_to ?? "").trim();
  if (!assignedTo) {
    res.status(400).json({ error: "اختر الموظف المكلف" });
    return;
  }
  const r = await db
    .prepare(
      `UPDATE logistics_queue SET assigned_to = ?, status = 'scheduled' WHERE id = ? AND user_id = ?`
    )
    .run(assignedTo, logisticsId, userId);
  if (r.changes === 0) {
    res.status(404).json({ error: "عنصر اللوجستيك غير موجود" });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/inventory/production-reserve", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as { product_id?: string; quantity?: number; source?: string };
  const productId = String(b.product_id ?? "").trim();
  const qty = Math.max(1, Math.floor(Number(b.quantity) || 1));
  if (!productId) {
    res.status(400).json({ error: "معرف المادة مطلوب" });
    return;
  }
  const row = (await db
    .prepare("SELECT id, stock_pieces FROM inventory_products WHERE id = ? AND user_id = ?")
    .get(productId, userId)) as { id: string; stock_pieces: number } | undefined;
  if (!row) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }
  const current = Math.max(0, Number(row.stock_pieces) || 0);
  if (current < qty) {
    res.status(400).json({ error: "الكمية غير متوفرة في المخزون" });
    return;
  }
  const next = current - qty;
  await db.prepare("UPDATE inventory_products SET stock_pieces = ? WHERE id = ? AND user_id = ?").run(next, productId, userId);
  res.json({ ok: true, previous: current, next });
});

app.delete("/api/inventory/production-requests/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const requestId = paramString(req.params.id);
  const r = await db
    .prepare("DELETE FROM production_requests WHERE id = ? AND user_id = ?")
    .run(requestId, userId);
  if (r.changes === 0) {
    res.status(404).json({ error: "طلب الإنتاج غير موجود" });
    return;
  }
  // Also delete related logistics queue items
  await db.prepare("DELETE FROM logistics_queue WHERE production_request_id = ? AND user_id = ?")
    .run(requestId, userId);
  res.json({ ok: true });
});

app.post("/api/inventory/production-requests/batch-delete", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as { ids?: string[] };
  const ids = Array.isArray(b.ids) ? b.ids.map(String).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "قائمة المعرفات فارغة" });
    return;
  }
  const placeholders = ids.map(() => "?").join(",");
  const r = await db
    .prepare(`DELETE FROM production_requests WHERE id IN (${placeholders}) AND user_id = ?`)
    .run(...ids, userId);
  // Also delete related logistics queue items
  await db.prepare(`DELETE FROM logistics_queue WHERE production_request_id IN (${placeholders}) AND user_id = ?`)
    .run(...ids, userId);
  res.json({ ok: true, deleted: r.changes });
});

app.delete("/api/inventory/logistics-queue/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const logisticsId = paramString(req.params.id);
  const r = await db
    .prepare("DELETE FROM logistics_queue WHERE id = ? AND user_id = ?")
    .run(logisticsId, userId);
  if (r.changes === 0) {
    res.status(404).json({ error: "عنصر اللوجستيك غير موجود" });
    return;
  }
  res.json({ ok: true });
});

// Inventory Activity Logs API - Server-side storage with user isolation
app.get("/api/inventory/activity-logs", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const { shiftId, date } = req.query;
  let query = "SELECT * FROM inventory_activity_logs WHERE user_id = ?";
  const params: any[] = [userId];
  
  if (shiftId) {
    query += " AND shift_id = ?";
    params.push(String(shiftId));
  }
  if (date) {
    query += " AND date = ?";
    params.push(String(date));
  }
  
  query += " ORDER BY timestamp DESC LIMIT 200";
  
  const rows = await db.prepare(query).all(...params);
  res.json({ logs: rows });
});

app.post("/api/inventory/activity-logs", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const { 
    timestamp, date, time, shift_id, shift_name, 
    action_type, product_id, product_name, quantity, notes 
  } = req.body;
  
  if (!timestamp || !date || !time || !shift_id || !shift_name || !action_type) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  
  const id = randomUUID();
  await db.prepare(
    `INSERT INTO inventory_activity_logs (id, user_id, timestamp, date, time, shift_id, shift_name, action_type, product_id, product_name, quantity, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`
  ).run(id, userId, String(timestamp), String(date), String(time), String(shift_id), String(shift_name), String(action_type), product_id || null, product_name || null, quantity || null, notes || null);
  
  res.json({ id, message: "Activity log created successfully" });
});

app.delete("/api/inventory/activity-logs/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const logId = paramString(req.params.id);
  const r = await db
    .prepare("DELETE FROM inventory_activity_logs WHERE id = ? AND user_id = ?")
    .run(logId, userId);
  if (r.changes === 0) {
    res.status(404).json({ error: "Activity log not found" });
    return;
  }
  res.json({ ok: true });
});

// Exported Documents API - Server-side storage with user isolation
app.get("/api/exported-documents", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { kind } = req.query;
  let query = "SELECT * FROM exported_documents WHERE user_id = ?";
  const params: any[] = [userId];
  
  if (kind) {
    query += " AND document_kind = ?";
    params.push(String(kind));
  }
  
  query += " ORDER BY export_timestamp DESC LIMIT 100";
  
  const rows = await db.prepare(query).all(...params);
  res.json({ documents: rows });
});

app.post("/api/exported-documents", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { document_kind, title, filename, file_size, export_timestamp, metadata } = req.body;
  
  if (!document_kind || !title || !filename || !export_timestamp) {
    res.status(400).json({ error: "Missing required fields: document_kind, title, filename, export_timestamp" });
    return;
  }
  
  const id = randomUUID();
  await db.prepare(
    `INSERT INTO exported_documents (id, user_id, document_kind, title, filename, file_size, export_timestamp, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`
  ).run(id, userId, String(document_kind), String(title), String(filename), file_size || null, String(export_timestamp), metadata ? JSON.stringify(metadata) : '{}');
  
  res.json({ id, message: "Exported document recorded successfully" });
});

app.delete("/api/exported-documents/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const docId = paramString(req.params.id);
  const r = await db
    .prepare("DELETE FROM exported_documents WHERE id = ? AND user_id = ?")
    .run(docId, userId);
  if (r.changes === 0) {
    res.status(404).json({ error: "Exported document not found" });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/inventory/logistics-queue/batch-delete", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  if (!(await moduleAllowed(userId, "inventory"))) {
    res.status(403).json({ error: "القسم غير مفعّل" });
    return;
  }
  const b = req.body as { ids?: string[] };
  const ids = Array.isArray(b.ids) ? b.ids.map(String).filter(Boolean) : [];
  if (!ids.length) {
    res.status(400).json({ error: "قائمة المعرفات فارغة" });
    return;
  }
  const placeholders = ids.map(() => "?").join(",");
  const r = await db
    .prepare(`DELETE FROM logistics_queue WHERE id IN (${placeholders}) AND user_id = ?`)
    .run(...ids, userId);
  res.json({ ok: true, deleted: r.changes });
});

registerTlErpRoutes(app, authMiddleware, moduleAllowed, { uploadTl, tlUploadRoot });
registerBase44StudioRoutes(app, { authMiddleware, uploadDir, aiGenerateAllowed });
registerBackendServices(app, authMiddleware);
registerDeliveryHubRoutes(app, authMiddleware);

/** TTS API endpoint - using browser Web Speech API (client-side only) */
app.post("/api/tts", async (_req, res) => {
  // TTS is now handled client-side using Web Speech API
  // This endpoint exists for compatibility but returns a message directing to client-side
  res.status(501).json({
    error: "TTS is handled client-side using Web Speech API",
    message: "Please use the browser's native speech synthesis instead of this endpoint"
  });
});

/** Media Library API - إدارة الفيديوهات والصور */
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      // Images
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/svg+xml',
      // Videos
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم. يرجى رفع صور (PNG, JPG, WEBP) أو فيديوهات (MP4, WEBM)'));
    }
  }
});

// جلب جميع الفيديوهات والصور
app.get("/api/media-library", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  try {
    const rows = await db.prepare(`
      SELECT * FROM media_library 
      WHERE user_id = ? 
      ORDER BY sort_order ASC, created_at DESC
    `).all(userId);
    res.json({ items: rows });
  } catch (error) {
    console.error("[api] Error fetching media library:", error);
    res.status(500).json({ error: "فشل في جلب المكتبة" });
  }
});

// جلب الفيديوهات العامة للعرض في صفحة الدخول (بدون تسجيل)
app.get("/api/media-library/public", async (_req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT id, type, title, url, youtube_video_id, file_path, file_name, file_mime, sort_order
      FROM media_library 
      WHERE is_public = 1
      ORDER BY sort_order ASC, created_at DESC
      LIMIT 10
    `).all();
    res.json({ items: rows });
  } catch (error) {
    console.error("[api] Error fetching public media library:", error);
    res.status(500).json({ error: "فشل في جلب المكتبة العامة" });
  }
});

// إضافة عنصر جديد (YouTube أو رابط خارجي)
app.post("/api/media-library", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { type, title, url, youtube_video_id, is_public } = req.body as {
    type?: string;
    title?: string;
    url?: string;
    youtube_video_id?: string;
    is_public?: string;
  };

  if (!type || !title) {
    res.status(400).json({ error: "النوع والعنوان مطلوبان" });
    return;
  }

  if (type === "youtube" && !youtube_video_id) {
    res.status(400).json({ error: "معرف فيديو YouTube مطلوب" });
    return;
  }

  if (type === "external" && !url) {
    res.status(400).json({ error: "الرابط مطلوب" });
    return;
  }

  try {
    const id = randomUUID();
    const maxOrder = await db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) as max_order 
      FROM media_library 
      WHERE user_id = ?
    `).get(userId) as { max_order: number };
    
    const isPublic = is_public === "1" ? 1 : 0;
    
    await db.prepare(`
      INSERT INTO media_library (id, user_id, type, title, url, youtube_video_id, sort_order, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, type, title, url || null, youtube_video_id || null, maxOrder.max_order + 1, isPublic);

    const item = await db.prepare(`
      SELECT * FROM media_library WHERE id = ?
    `).get(id);

    res.json({ item });
  } catch (error) {
    console.error("[api] Error adding media item:", error);
    res.status(500).json({ error: "فشل في إضافة العنصر" });
  }
});

// رفع ملف من الجهاز
app.post("/api/media-library/upload", authMiddleware, (req, res, next) => {
  mediaUpload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "حجم الملف كبير جداً. الحد الأقصى 100MB" });
      }
      return res.status(400).json({ error: `خطأ في رفع الملف: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message || "خطأ في رفع الملف" });
    }
    next();
  });
}, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { title, is_public } = req.body as { title?: string; is_public?: string };
  const file = req.file;

  console.log("[api] Upload request:", {
    userId,
    title,
    is_public,
    file: file ? { name: file.originalname, size: file.size, mimetype: file.mimetype } : null
  });

  if (!file) {
    console.log("[api] Upload error: File is required");
    res.status(400).json({ error: "الملف مطلوب" });
    return;
  }

  if (!title) {
    console.log("[api] Upload error: Title is required");
    res.status(400).json({ error: "العنوان مطلوب" });
    return;
  }

  try {
    const id = randomUUID();
    const ext = path.extname(file.originalname) || "";
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const safeFileName = `${timestamp}-${randomSuffix}${ext}`;
    const uploadDir = getUploadDir();
    
    // إنشاء مجلد uploads إذا لم يكن موجوداً
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("[api] Created upload directory:", uploadDir);
    }
    
    const filePath = path.join(uploadDir, safeFileName);

    console.log("[api] Saving file to:", filePath);

    // حفظ الملف
    fs.writeFileSync(filePath, file.buffer);

    const maxOrder = await db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) as max_order 
      FROM media_library 
      WHERE user_id = ?
    `).get(userId) as { max_order: number };

    const type = file.mimetype.startsWith("video/") ? "video" : "image";
    const isPublic = is_public === "1" || is_public === undefined || is_public === null ? 1 : 0;
    const webUrl = `/uploads/${safeFileName}`;

    console.log("[api] Inserting into database:", {
      id,
      userId,
      type,
      title,
      filePath,
      webUrl,
      isPublic
    });

    await db.prepare(`
      INSERT INTO media_library (id, user_id, type, title, url, file_path, file_name, file_mime, sort_order, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, type, title, webUrl, filePath, safeFileName, file.mimetype, maxOrder.max_order + 1, isPublic);

    const item = await db.prepare(`
      SELECT * FROM media_library WHERE id = ?
    `).get(id);

    console.log("[api] Upload successful:", item);
    res.json({ item });
  } catch (error) {
    console.error("[api] Error uploading file:", error);
    res.status(500).json({ error: "فشل في رفع الملف" });
  }
});

// تعديل عنصر
app.put("/api/media-library/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const itemId = paramString(req.params.id);
  const { title, url, youtube_video_id, is_public } = req.body as {
    title?: string;
    url?: string;
    youtube_video_id?: string;
    is_public?: string;
  };

  try {
    const existing = await db.prepare(`
      SELECT * FROM media_library WHERE id = ? AND user_id = ?
    `).get(itemId, userId);

    if (!existing) {
      res.status(404).json({ error: "العنصر غير موجود" });
      return;
    }

    const isPublic = is_public === "1" ? 1 : 0;

    await db.prepare(`
      UPDATE media_library 
      SET title = COALESCE(?, title),
          url = COALESCE(?, url),
          youtube_video_id = COALESCE(?, youtube_video_id),
          is_public = COALESCE(?, is_public),
          updated_at = NOW()
      WHERE id = ? AND user_id = ?
    `).run(title || null, url || null, youtube_video_id || null, isPublic, itemId, userId);

    const item = await db.prepare(`
      SELECT * FROM media_library WHERE id = ?
    `).get(itemId);

    res.json({ item });
  } catch (error) {
    console.error("[api] Error updating media item:", error);
    res.status(500).json({ error: "فشل في تعديل العنصر" });
  }
});

// حذف عنصر
app.delete("/api/media-library/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const itemId = paramString(req.params.id);

  try {
    const existing = await db.prepare(`
      SELECT * FROM media_library WHERE id = ? AND user_id = ?
    `).get(itemId, userId);

    if (!existing) {
      res.status(404).json({ error: "العنصر غير موجود" });
      return;
    }

    // حذف الملف من القرص إذا كان موجوداً
    if (existing.file_path && fs.existsSync(existing.file_path as string)) {
      fs.unlinkSync(existing.file_path as string);
    }

    await db.prepare(`
      DELETE FROM media_library WHERE id = ? AND user_id = ?
    `).run(itemId, userId);

    res.json({ ok: true });
  } catch (error) {
    console.error("[api] Error deleting media item:", error);
    res.status(500).json({ error: "فشل في حذف العنصر" });
  }
});

// إعادة ترتيب العناصر
app.post("/api/media-library/reorder", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { items } = req.body as { items: { id: string; sort_order: number }[] };

  if (!Array.isArray(items)) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  try {
    for (const item of items) {
      await db.prepare(`
        UPDATE media_library SET sort_order = ? WHERE id = ? AND user_id = ?
      `).run(item.sort_order, item.id, userId);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("[api] Error reordering media items:", error);
    res.status(500).json({ error: "فشل في إعادة الترتيب" });
  }
});

/** Academy Media API - إدارة ملفات أكاديمية التدريب */
const academyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      // Images
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/svg+xml',
      // Videos
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم. يرجى رفع صور (PNG, JPG, WEBP) أو فيديوهات (MP4, WEBM)'));
    }
  }
});

// جلب ملفات الأكاديمية للمستخدم
app.get("/api/academy-media", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  try {
    const rows = await db.prepare(`
      SELECT * FROM academy_media 
      WHERE user_id = ? 
      ORDER BY sort_order ASC, created_at DESC
    `).all(userId);
    res.json({ items: rows });
  } catch (error) {
    console.error("[api] Error fetching academy media:", error);
    res.status(500).json({ error: "فشل في جلب ملفات الأكاديمية" });
  }
});

// رفع ملف للأكاديمية
app.post("/api/academy-media/upload", authMiddleware, (req, res, next) => {
  academyUpload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "حجم الملف كبير جداً. الحد الأقصى 100MB" });
      }
      return res.status(400).json({ error: `خطأ في رفع الملف: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message || "خطأ في رفع الملف" });
    }
    next();
  });
}, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { title, description } = req.body as { title?: string; description?: string };
  const file = req.file;

  console.log("[api] Academy upload request:", {
    userId,
    title,
    description,
    file: file ? { name: file.originalname, size: file.size, mimetype: file.mimetype } : null
  });

  if (!file) {
    console.log("[api] Academy upload error: File is required");
    res.status(400).json({ error: "الملف مطلوب" });
    return;
  }

  try {
    const id = randomUUID();
    const ext = path.extname(file.originalname) || "";
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const safeFileName = `${timestamp}-${randomSuffix}${ext}`;
    const uploadDir = getUploadDir();
    
    // إنشاء مجلد uploads إذا لم يكن موجوداً
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("[api] Created upload directory:", uploadDir);
    }
    
    const filePath = path.join(uploadDir, safeFileName);

    console.log("[api] Saving academy file to:", filePath);

    // حفظ الملف
    fs.writeFileSync(filePath, file.buffer);

    const maxOrder = await db.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) as max_order 
      FROM academy_media 
      WHERE user_id = ?
    `).get(userId) as { max_order: number };

    const type = file.mimetype.startsWith("video/") ? "video" : "image";
    const webUrl = `/uploads/${safeFileName}`;

    console.log("[api] Inserting academy media into database:", {
      id,
      userId,
      type,
      title,
      description,
      filePath,
      webUrl
    });

    await db.prepare(`
      INSERT INTO academy_media (id, user_id, type, title, description, url, file_path, file_name, file_mime, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, type, title || null, description || null, webUrl, filePath, safeFileName, file.mimetype, maxOrder.max_order + 1);

    const item = await db.prepare(`
      SELECT * FROM academy_media WHERE id = ?
    `).get(id);

    console.log("[api] Academy upload successful:", item);
    res.json({ item });
  } catch (error) {
    console.error("[api] Error uploading academy file:", error);
    res.status(500).json({ error: "فشل في رفع الملف" });
  }
});

// حذف ملف من الأكاديمية
app.delete("/api/academy-media/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const itemId = paramString(req.params.id);

  try {
    const existing = await db.prepare(`
      SELECT * FROM academy_media WHERE id = ? AND user_id = ?
    `).get(itemId, userId);

    if (!existing) {
      res.status(404).json({ error: "العنصر غير موجود" });
      return;
    }

    // حذف الملف من القرص إذا كان موجوداً
    if (existing.file_path && fs.existsSync(existing.file_path as string)) {
      fs.unlinkSync(existing.file_path as string);
    }

    // حذف الصورة المصغرة إذا كانت موجودة
    if (existing.thumbnail_path && fs.existsSync(existing.thumbnail_path as string)) {
      fs.unlinkSync(existing.thumbnail_path as string);
    }

    await db.prepare(`
      DELETE FROM academy_media WHERE id = ? AND user_id = ?
    `).run(itemId, userId);

    res.json({ ok: true });
  } catch (error) {
    console.error("[api] Error deleting academy media item:", error);
    res.status(500).json({ error: "فشل في حذف العنصر" });
  }
});

// تحديث بيانات ملف في الأكاديمية
app.put("/api/academy-media/:id", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const itemId = paramString(req.params.id);
  const { title, description } = req.body as { title?: string; description?: string };

  try {
    const existing = await db.prepare(`
      SELECT * FROM academy_media WHERE id = ? AND user_id = ?
    `).get(itemId, userId);

    if (!existing) {
      res.status(404).json({ error: "العنصر غير موجود" });
      return;
    }

    await db.prepare(`
      UPDATE academy_media 
      SET title = ?, description = ?, updated_at = NOW()
      WHERE id = ? AND user_id = ?
    `).run(title || null, description || null, itemId, userId);

    const updated = await db.prepare(`
      SELECT * FROM academy_media WHERE id = ?
    `).get(itemId);

    res.json({ item: updated });
  } catch (error) {
    console.error("[api] Error updating academy media item:", error);
    res.status(500).json({ error: "فشل في تحديث العنصر" });
  }
});

// رفع فيديو للمنتج
app.post("/api/inventory/product-video", authMiddleware, (req, res, next) => {
  academyUpload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "حجم الملف كبير جداً. الحد الأقصى 100MB" });
      }
      return res.status(400).json({ error: `خطأ في رفع الملف: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message || "خطأ في رفع الملف" });
    }
    next();
  });
}, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const file = req.file;

  console.log("[api] Product video upload request:", {
    userId,
    file: file ? { name: file.originalname, size: file.size, mimetype: file.mimetype } : null
  });

  if (!file) {
    console.log("[api] Product video upload error: File is required");
    res.status(400).json({ error: "الملف مطلوب" });
    return;
  }

  if (!file.mimetype.startsWith("video/")) {
    res.status(400).json({ error: "يجب أن يكون الملف فيديو" });
    return;
  }

  try {
    const ext = path.extname(file.originalname) || "";
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const safeFileName = `${timestamp}-${randomSuffix}${ext}`;
    const uploadDir = getUploadDir();
    
    // إنشاء مجلد uploads إذا لم يكن موجوداً
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("[api] Created upload directory:", uploadDir);
    }
    
    const filePath = path.join(uploadDir, safeFileName);

    console.log("[api] Saving product video to:", filePath);

    // حفظ الملف
    fs.writeFileSync(filePath, file.buffer);

    const webUrl = `/uploads/${safeFileName}`;

    console.log("[api] Product video upload successful:", {
      filePath,
      webUrl,
      fileName: safeFileName,
      mime: file.mimetype
    });

    res.json({ 
      video_url: webUrl,
      video_file_path: filePath,
      video_file_name: safeFileName,
      video_mime: file.mimetype
    });
  } catch (error) {
    console.error("[api] Error uploading product video:", error);
    res.status(500).json({ error: "فشل في رفع الملف" });
  }
});

// إعادة ترتيب ملفات الأكاديمية
app.post("/api/academy-media/reorder", authMiddleware, async (req, res) => {
  const userId = (req as express.Request & { userId: string }).userId;
  const { items } = req.body as { items: { id: string; sort_order: number }[] };

  if (!Array.isArray(items)) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  try {
    for (const item of items) {
      await db.prepare(`
        UPDATE academy_media SET sort_order = ? WHERE id = ? AND user_id = ?
      `).run(item.sort_order, item.id, userId);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("[api] Error reordering academy media items:", error);
    res.status(500).json({ error: "فشل في إعادة الترتيب" });
  }
});

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const errObj = err && typeof err === "object" ? (err as Record<string, unknown>) : null;
  const code = errObj && typeof errObj.code === "string" ? errObj.code : "";
  const msg = err instanceof Error ? err.message : String(err);
  const lowerMsg = msg.toLowerCase();

  if (
    code === "28P01" ||
    code === "28000" ||
    lowerMsg.includes("password authentication failed") ||
    lowerMsg.includes("no password supplied")
  ) {
    console.error("[api] database auth failed:", code || msg, req.method, req.path);
    res.status(503).json({
      error:
        "فشل الاتصال بقاعدة البيانات — تحقق من كلمة مرور Postgres في Supabase Settings → Database، وحدّث DATABASE_URL و DIRECT_URL في .env ثم أعد تشغيل npm run dev",
    });
    return;
  }

  if (code === "ENOTFOUND" || lowerMsg.includes("getaddrinfo") || lowerMsg.includes("not found")) {
    console.error("[api] database dns failed:", code || msg, req.method, req.path);
    res.status(503).json({
      error:
        "فشل حل اسم مضيف قاعدة البيانات — تأكد من DATABASE_URL أو DIRECT_URL وأن جهازك متصل بالإنترنت ثم أعد تشغيل npm run dev",
    });
    return;
  }

  if (code === "ETIMEDOUT" || code === "ECONNREFUSED" || msg.includes("timeout") || msg.includes("نتهت مهلة")) {
    console.error("[api] database unreachable:", code || msg, req.method, req.path);
    res.status(503).json({
      error:
        "قاعدة البيانات غير متاحة — تحقق من DATABASE_URL / DIRECT_URL، الشبكة، أو نفّذ: npm run db:schema",
    });
    return;
  }
  console.error("[api]", err);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = Number(process.env.PORT ?? 4000);
if (!process.env.VERCEL) {
  // Run migration before starting server
  (async () => {
    try {
      await initDatabase();
      await migrateDeliveryHubStockFields();
      app.listen(PORT, () => {
        console.log(`Smart Al-Idara Pro API http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error("Failed to initialize database:", error);
      process.exit(1);
    }
  })();
}
export default app;
