import { createHmac, randomBytes, scryptSync, timingSafeEqual, pbkdf2Sync } from "node:crypto";
import bcrypt from "bcryptjs";

const SECRET = process.env.JWT_SECRET ?? "idara-dev-secret-change-in-production";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  console.log("[verifyPassword] Hash length:", stored.length, "format:", stored.substring(0, 30) + "...");
  
  // Try scrypt first (new format: salt:hash)
  const [salt, hash] = stored.split(":");
  if (salt && hash && salt.length === 32 && hash.length === 128) {
    try {
      const test = scryptSync(password, salt, 64).toString("hex");
      return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
    } catch {
      // Fall through to other formats
    }
  }

  // Try bcrypt (Supabase legacy format: $2b$...)
  if (stored.startsWith("$2b$") || stored.startsWith("$2a$")) {
    try {
      return bcrypt.compareSync(password, stored);
    } catch {
      return false;
    }
  }

  // Try Supabase PBKDF2 format (60 hex chars)
  // Supabase uses PBKDF2 with SHA256, 100000 iterations
  if (stored.length === 60 && /^[a-f0-9]{60}$/i.test(stored)) {
    console.log("[verifyPassword] Trying PBKDF2 format");
    try {
      // Try different salt/hash splits
      const splits = [16, 20, 24, 32];
      for (const saltLen of splits) {
        const salt = stored.substring(0, saltLen);
        const expectedHash = stored.substring(saltLen);
        const derivedKey = pbkdf2Sync(password, salt, 100000, expectedHash.length / 2, 'sha256').toString('hex');
        if (derivedKey === expectedHash) {
          console.log("[verifyPassword] PBKDF2 match with salt length:", saltLen);
          return true;
        }
      }
      console.log("[verifyPassword] PBKDF2 no match");
    } catch (e) {
      console.log("[verifyPassword] PBKDF2 error:", e);
    }
  }

  return false;
}

/** مدة الجلسة الافتراضية: سنة — تقليل طلبات إعادة تسجيل الدخول (يمكن ضبطها عبر JWT_EXPIRES_DAYS) */
const TOKEN_MS =
  (Number(process.env.JWT_EXPIRES_DAYS) || 365) * 864e5;

export function signToken(
  payload: { sub: string; role: string },
  opts?: { expiresInMs?: number }
): string {
  const ms = opts?.expiresInMs ?? TOKEN_MS;
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + ms })
  ).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string): { sub: string; role: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
  if (expected !== sig) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      sub: string;
      role: string;
      exp: number;
    };
    if (p.exp < Date.now()) return null;
    return { sub: p.sub, role: p.role };
  } catch {
    return null;
  }
}
