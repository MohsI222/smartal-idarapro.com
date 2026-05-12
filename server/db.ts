import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient, PoolConfig } from "pg";
import { Pool } from "pg";

/** يقلّل ETIMEDOUT مع موزّعي Supabase عندما يفضّل النظام IPv6 ومساره غير مستقر */
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** يتطلبه اتصال Node/pg مع Supabase Pooler في كثير من البيئات */
export function normalizeDatabaseConnectionString(raw: string): string {
  const u = raw.trim();
  if (!u) return u;
  const lower = u.toLowerCase();
  const looksSupabase =
    lower.includes("supabase.co") ||
    lower.includes("supabase.com") ||
    lower.includes("pooler.supabase");
  if (!looksSupabase) return u;
  if (/sslmode=/i.test(u)) return u;
  return `${u}${u.includes("?") ? "&" : "?"}sslmode=require`;
}

function requireDatabaseUrl(): string {
  const u = normalizeDatabaseConnectionString(process.env.DATABASE_URL?.trim() ?? "");
  if (!u) {
    throw new Error(
      "DATABASE_URL مفقود. أضفوه في .env أو Vercel (مثال: postgres://user:pass@host:5432/dbname)"
    );
  }
  return u;
}

let poolInstance: Pool | null = null;

type PoolConfigWithPrepare = PoolConfig & { prepareThreshold?: number };

function poolMaxForUrl(connectionString: string, isSupabase: boolean): number {
  let max = Math.min(50, Math.max(1, Number(process.env.PG_POOL_MAX ?? 20) || 20));
  const lower = connectionString.toLowerCase();
  try {
    const qm = connectionString.indexOf("?");
    if (qm >= 0) {
      const params = new URLSearchParams(connectionString.slice(qm + 1));
      const cl = params.get("connection_limit");
      if (cl) {
        const n = parseInt(cl, 10);
        if (Number.isFinite(n) && n >= 1) max = Math.min(max, n);
      }
    }
  } catch {
    /* ignore */
  }
  if (isSupabase && lower.includes("pgbouncer=true") && !/connection_limit=/i.test(lower)) {
    max = Math.min(max, 5);
  }
  return max;
}

/** يزيل sslmode من الرابط عندما نمرّر `ssl` صريحاً لـ `pg` (يُجنّب SELF_SIGNED_CERT_IN_CHAIN مع Node 22+). */
function stripSslModeFromPostgresUrl(url: string): string {
  const q = url.indexOf("?");
  if (q < 0) return url;
  const base = url.slice(0, q);
  const qs = url.slice(q + 1);
  const params = qs.split("&").filter((p) => p.length > 0 && !/^sslmode=/i.test(p));
  if (params.length === 0) return base;
  return `${base}?${params.join("&")}`;
}

function buildPoolConfigForUrl(rawConnectionString: string): PoolConfigWithPrepare {
  const normalized = normalizeDatabaseConnectionString(rawConnectionString);
  const lower = normalized.toLowerCase();
  const isSupabase =
    lower.includes("supabase.com") || lower.includes("supabase.co") || lower.includes("pooler.supabase");
  const connectionString = isSupabase ? stripSslModeFromPostgresUrl(normalized) : normalized;
  const max = poolMaxForUrl(connectionString, isSupabase);
  const connectionTimeoutMillis = Math.min(
    120_000,
    Math.max(2000, Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 25_000) || 25_000)
  );
  const base: PoolConfigWithPrepare = {
    connectionString,
    max,
    connectionTimeoutMillis,
    /** Supabase / pooler TLS — تجنّب أخطاء الشهادة الذاتية مع rejectUnauthorized: false */
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  };
  if (isSupabase) base.prepareThreshold = 0;
  return base;
}

function requireInitDatabaseUrl(): string {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct) return normalizeDatabaseConnectionString(direct);
  return requireDatabaseUrl();
}

function buildPoolConfig(): PoolConfigWithPrepare {
  return buildPoolConfigForUrl(requireDatabaseUrl());
}

export function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool(buildPoolConfig());
  }
  return poolInstance;
}

let initPromise: Promise<void> | null = null;

/** ينفّذ schema.sql — يفضّل DIRECT_URL (منفذ 5432) لأن PgBouncer 6543 قد يقيّد بعض أوامر DDL الكبيرة. */
export async function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const schemaPath = path.join(__dirname, "schema.sql");
      const sql = fs.readFileSync(schemaPath, "utf8");
      const conn = requireInitDatabaseUrl();
      const cfg = buildPoolConfigForUrl(conn);
      const initPool = new Pool({ ...cfg, max: 1 });
      try {
        await initPool.query(sql);
      } catch (e) {
        console.error(
          "[db] initDatabase (schema) failed — check DIRECT_URL / DATABASE_URL, sslmode, and password from Supabase:",
          e instanceof Error ? e.message : e
        );
        throw e;
      } finally {
        await initPool.end().catch(() => undefined);
      }
    })();
  }
  await initPromise;
}

/** يحوّل `?` إلى $1,$2,... لـ node-pg */
export function toPgParams(sql: string, params: unknown[]): { text: string; values: unknown[] } {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

export function prepare(sql: string) {
  return {
    async get<T extends Record<string, unknown> = Record<string, unknown>>(
      ...params: unknown[]
    ): Promise<T | undefined> {
      const { text, values } = toPgParams(sql, params);
      const r = await getPool().query<T>(text, values);
      return r.rows[0] as T | undefined;
    },
    async all<T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]): Promise<T[]> {
      const { text, values } = toPgParams(sql, params);
      const r = await getPool().query<T>(text, values);
      return r.rows as T[];
    },
    async run(...params: unknown[]): Promise<{ changes: number }> {
      const { text, values } = toPgParams(sql, params);
      const r = await getPool().query(text, values);
      return { changes: r.rowCount ?? 0 };
    },
  };
}

/** نفس prepare لكن على اتصال معاملات (BEGIN … COMMIT). */
export function prepareWithClient(client: PoolClient, sql: string) {
  return {
    async get<T extends Record<string, unknown> = Record<string, unknown>>(
      ...params: unknown[]
    ): Promise<T | undefined> {
      const { text, values } = toPgParams(sql, params);
      const r = await client.query<T>(text, values);
      return r.rows[0] as T | undefined;
    },
    async all<T extends Record<string, unknown> = Record<string, unknown>>(...params: unknown[]): Promise<T[]> {
      const { text, values } = toPgParams(sql, params);
      const r = await client.query<T>(text, values);
      return r.rows as T[];
    },
    async run(...params: unknown[]): Promise<{ changes: number }> {
      const { text, values } = toPgParams(sql, params);
      const r = await client.query(text, values);
      return { changes: r.rowCount ?? 0 };
    },
  };
}

export async function exec(sql: string): Promise<void> {
  await getPool().query(sql);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/** واجهة موحّدة تشبه الاستخدام السابق: `await db.prepare(...).get()` */
export const db = {
  prepare,
  exec,
  withTransaction,
  prepareWithClient,
};
