const STORAGE_PREFIX = "idara_auth_rl_";

type Bucket = { count: number; resetAt: number };

function readBucket(key: string): Bucket {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { count: 0, resetAt: 0 };
    const j = JSON.parse(raw) as Bucket;
    if (typeof j.count !== "number" || typeof j.resetAt !== "number") return { count: 0, resetAt: 0 };
    return j;
  } catch {
    return { count: 0, resetAt: 0 };
  }
}

function writeBucket(key: string, b: Bucket) {
  try {
    sessionStorage.setItem(key, JSON.stringify(b));
  } catch {
    /* private mode / quota */
  }
}

/**
 * Limite côté navigateur les tentatives de connexion / inscription (complément au rate limiting serveur).
 * Fenêtre glissante 15 min, max 10 tentatives par type.
 */
export function consumeAuthAttempt(kind: "login" | "register"): { ok: true } | { ok: false; retryAfterMs: number } {
  const windowMs = 15 * 60 * 1000;
  const max = 10;
  const key = `${STORAGE_PREFIX}${kind}`;
  const now = Date.now();
  let b = readBucket(key);
  if (b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
  }
  if (b.count >= max) {
    return { ok: false, retryAfterMs: Math.max(0, b.resetAt - now) };
  }
  b.count += 1;
  writeBucket(key, b);
  return { ok: true };
}
