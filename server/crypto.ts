import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SECRET = process.env.JWT_SECRET ?? "idara-dev-secret-change-in-production";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
  } catch {
    return false;
  }
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
