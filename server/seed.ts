import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { hashPassword } from "./crypto.js";

export function genReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 40; attempt++) {
    let s = "";
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    const ex = db.prepare("SELECT 1 FROM users WHERE referral_code = ?").get(s);
    if (!ex) return s;
  }
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

/** يملأ referral_code للحسابات القديمة */
export function backfillReferralCodes() {
  const rows = db.prepare("SELECT id FROM users WHERE referral_code IS NULL OR referral_code = ''").all() as {
    id: string;
  }[];
  for (const r of rows) {
    const code = genReferralCode();
    try {
      db.prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(code, r.id);
    } catch {
      /* تجاهل تعارض نادر */
    }
  }
}
import {
  FULL_MODULES_JSON,
  SUPER_ADMIN_DISPLAY_NAME,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_WHATSAPP,
  getSuperAdminPassword,
} from "./admin-config.js";

/** حذف جميع المستخدمين والبيانات المرتبطة (يُستدعى من db:reset فقط عادة). */
export function purgeAllUserData() {
  db.exec(`
    DELETE FROM pos_invoices;
    DELETE FROM inventory_products;
    DELETE FROM visa_user_profile;
    DELETE FROM visa_appointment_status;
    DELETE FROM subscriptions;
    DELETE FROM devices;
    DELETE FROM hr_employees;
    DELETE FROM lawyer_cases;
    DELETE FROM accountant_reports;
    DELETE FROM reminders;
    DELETE FROM production_metrics;
    DELETE FROM users;
  `);
  console.log("[idara] تم مسح جميع الحسابات والبيانات المرتبطة من قاعدة البيانات.");
}

/**
 * يضمن وجود مشرف عام بالبريد المعرّف، واشتراك معتمد (approved) بجميع الأقسام.
 */
export function ensureSuperAdmin() {
  const pass = getSuperAdminPassword();

  let row = db
    .prepare("SELECT id, role FROM users WHERE email = ?")
    .get(SUPER_ADMIN_EMAIL) as { id: string; role: string } | undefined;

  if (!row) {
    const id = randomUUID();
    const refCode = genReferralCode();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, whatsapp, referral_code) VALUES (?, ?, ?, ?, 'superadmin', ?, ?)`
    ).run(
      id,
      SUPER_ADMIN_EMAIL,
      hashPassword(pass),
      SUPER_ADMIN_DISPLAY_NAME,
      SUPER_ADMIN_WHATSAPP,
      refCode
    );
    row = { id, role: "superadmin" };
    console.log(`[idara] تم إنشاء Super Admin: ${SUPER_ADMIN_EMAIL} — واتساب: ${SUPER_ADMIN_WHATSAPP}`);
  } else if (row.role !== "superadmin") {
    db.prepare(`UPDATE users SET role = 'superadmin' WHERE id = ?`).run(row.id);
    console.log(`[idara] تم ترقية الحساب إلى Super Admin: ${SUPER_ADMIN_EMAIL}`);
  }

  db.prepare(
    `UPDATE users SET whatsapp = ?, name = ?, password_hash = ?, role = 'superadmin' WHERE id = ?`
  ).run(SUPER_ADMIN_WHATSAPP, SUPER_ADMIN_DISPLAY_NAME, hashPassword(pass), row.id);

  const sub = db
    .prepare(
      `SELECT id, status FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(row.id) as { id: string; status: string } | undefined;

  if (!sub) {
    const sid = randomUUID();
    db.prepare(
      `INSERT INTO subscriptions (id, user_id, plan_id, modules, payment_method, receipt_path, status, reviewed_at, reviewed_by, ends_at)
       VALUES (?, ?, 'full', ?, 'bank_transfer', NULL, 'approved', datetime('now'), ?, datetime('now', '+3650 days'))`
    ).run(sid, row.id, FULL_MODULES_JSON, row.id);
    console.log(`[idara] تم تفعيل اشتراك معتمد فوراً (جميع الأقسام) للمستخدم ${SUPER_ADMIN_EMAIL}`);
  } else if (sub.status !== "approved") {
    db.prepare(
      `UPDATE subscriptions SET status = 'approved', plan_id = 'full', modules = ?, payment_method = 'bank_transfer',
       reviewed_at = datetime('now'), reviewed_by = ?, ends_at = datetime('now', '+3650 days') WHERE id = ?`
    ).run(FULL_MODULES_JSON, row.id, sub.id);
    console.log(`[idara] تم تحديث الاشتراك إلى approved للمستخدم ${SUPER_ADMIN_EMAIL}`);
  } else {
    db.prepare(
      `UPDATE subscriptions SET plan_id = 'full', modules = ?, reviewed_at = datetime('now'), reviewed_by = ?,
       ends_at = datetime('now', '+3650 days') WHERE id = ?`
    ).run(FULL_MODULES_JSON, row.id, sub.id);
  }

  console.log(
    `[idara] Super Admin جاهز: ${SUPER_ADMIN_EMAIL} | واتساب: ${SUPER_ADMIN_WHATSAPP} | اشتراك: approved`
  );

  backfillReferralCodes();
  ensureDefaultAppSettings();
}

/** إعدادات المنصة الافتراضية (روابط التواصل والدفع) — لا تُحذف عند مسح المستخدمين */
export function ensureDefaultAppSettings() {
  const defaults: [string, string][] = [
    ["social_whatsapp", "https://wa.me/2127802970"],
    ["social_facebook", "https://www.facebook.com/"],
    ["social_instagram", "https://www.instagram.com/"],
    ["social_tiktok", "https://www.tiktok.com/"],
    ["social_youtube", "https://www.youtube.com/@SmartAlIdaraPro"],
    ["social_linkedin", "https://www.linkedin.com/"],
    ["youtube_channel_id", ""],
    ["bank_name", "—"],
    ["bank_rib", "—"],
    ["bank_iban", "—"],
    ["bank_holder", "LAHCEN EL MOUTAOUAKIL"],
  ];
  for (const [k, v] of defaults) {
    const exists = db.prepare("SELECT 1 FROM app_settings WHERE key = ?").get(k);
    if (!exists) {
      db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run(k, v);
    }
  }
}
