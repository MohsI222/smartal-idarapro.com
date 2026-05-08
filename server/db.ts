import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient, PoolConfig } from "pg";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function requireDatabaseUrl(): string {
  const u = process.env.DATABASE_URL?.trim();
  if (!u) {
    throw new Error(
      "DATABASE_URL مفقود. أضفوه في .env أو Vercel (مثال: postgres://user:pass@host:5432/dbname)"
    );
  }
  return u;
}

let poolInstance: Pool | null = null;

type PoolConfigWithPrepare = PoolConfig & { prepareThreshold?: number };

function buildPoolConfigForUrl(connectionString: string): PoolConfigWithPrepare {
  const lower = connectionString.toLowerCase();
  const isSupabase = lower.includes("supabase.com") || lower.includes("supabase.co");
  const max = Math.min(50, Math.max(1, Number(process.env.PG_POOL_MAX ?? 20) || 20));
  const base: PoolConfigWithPrepare = {
    connectionString,
    max,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  };
  if (isSupabase) base.prepareThreshold = 0;
  return base;
}

function requireInitDatabaseUrl(): string {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct) return direct;
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
