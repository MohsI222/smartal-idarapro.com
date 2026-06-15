/**
 * يتحقق من أن السيرفر المحلي يستجيب وأن تسجيل الدخول ينجح (لا يطبع كلمات المرور).
 * تشغيل: npx tsx scripts/verify-local-login.ts
 */
import dotenv from "dotenv";
import path from "node:path";

const root = process.cwd();
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

const base = process.env.VERIFY_API_URL?.trim() || "http://127.0.0.1:4000";
const email = process.env.SUPER_ADMIN_EMAIL?.trim();
const password = process.env.SUPER_ADMIN_PASSWORD;

async function main() {
  const health = await fetch(`${base}/api/health`);
  if (!health.ok) {
    console.error("FAIL /api/health", health.status);
    process.exit(1);
  }

  const db = await fetch(`${base}/api/health/db`);
  const dbJson = (await db.json()) as { ok?: boolean; db?: boolean };
  if (!db.ok || !dbJson.ok || !dbJson.db) {
    console.error("FAIL /api/health/db", db.status, dbJson);
    process.exit(1);
  }

  if (!email || !password) {
    console.error("FAIL missing SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD in .env");
    process.exit(1);
  }

  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await login.json().catch(() => ({}));
  if (!login.ok) {
    console.error("FAIL /api/auth/login", login.status, body);
    process.exit(1);
  }
  console.log("OK localhost: health + db + login (super admin)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
