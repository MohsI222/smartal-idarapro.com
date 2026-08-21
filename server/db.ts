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
  const raw = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
  const u = normalizeDatabaseConnectionString(raw);
  if (!u) {
    throw new Error(
      "DATABASE_URL أو DIRECT_URL مفقود. أضفوهما في .env أو Vercel (مثال: postgres://user:pass@host:5432/dbname)"
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

function isTransientDbError(e: unknown): boolean {
  const err = e && typeof e === "object" ? (e as Record<string, unknown>) : null;
  const code = err && typeof err.code === "string" ? err.code : "";
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    msg.includes("timeout") ||
    msg.includes("connection terminated")
  );
}

/** ينفّذ schema.sql — يفضّل DIRECT_URL (منفذ 5432) لأن PgBouncer 6543 قد يقيّد بعض أوامر DDL الكبيرة. */
export async function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const schemaPath = path.join(__dirname, "schema.sql");
      const sql = fs.readFileSync(schemaPath, "utf8");
      const conn = requireInitDatabaseUrl();
      const cfg = buildPoolConfigForUrl(conn);
      const maxAttempts = Math.max(1, Number(process.env.PG_INIT_RETRIES ?? 3) || 3);
      let lastErr: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const initPool = new Pool({ ...cfg, max: 1 });
        try {
          await initPool.query(sql);

          // Add social media fields to delivery_hub_stores if they don't exist
          try {
            await initPool.query(`
              ALTER TABLE public.delivery_hub_stores
              ADD COLUMN IF NOT EXISTS facebook_url TEXT,
              ADD COLUMN IF NOT EXISTS instagram_url TEXT,
              ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
              ADD COLUMN IF NOT EXISTS youtube_url TEXT
            `);
            console.log("[db] Added social media fields to delivery_hub_stores");
          } catch (alterErr) {
            // If the table doesn't exist or other error, log but don't fail
            console.warn("[db] Could not add social media fields (table may not exist yet):", alterErr instanceof Error ? alterErr.message : alterErr);
          }

          // Add custom_domain field to delivery_hub_stores if it doesn't exist
          try {
            await initPool.query(`
              ALTER TABLE public.delivery_hub_stores
              ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE
            `);
            console.log("[db] Added custom_domain field to delivery_hub_stores");
          } catch (alterErr) {
            console.warn("[db] Could not add custom_domain field:", alterErr instanceof Error ? alterErr.message : alterErr);
          }

          // Create delivery_hub_owners table if it doesn't exist
          try {
            await initPool.query(`
              CREATE TABLE IF NOT EXISTS public.delivery_hub_owners (
                app_user_id TEXT PRIMARY KEY,
                owner_id TEXT UNIQUE NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
              );
              CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_hub_owners_owner ON public.delivery_hub_owners(owner_id);
              ALTER TABLE public.delivery_hub_owners ENABLE ROW LEVEL SECURITY;
            `);
            console.log("[db] Created delivery_hub_owners table");
          } catch (ownersErr) {
            console.warn("[db] Could not create delivery_hub_owners table:", ownersErr instanceof Error ? ownersErr.message : ownersErr);
          }

          // Create demo store for public access if it doesn't exist
          let demoStoreId: string | null = null;
          try {
            // First, try to get existing demo store
            const existingStoreResult = await initPool.query(`
              SELECT id FROM public.delivery_hub_stores WHERE slug = 'demo-store' LIMIT 1
            `);
            if (existingStoreResult.rows.length > 0) {
              demoStoreId = existingStoreResult.rows[0].id;
              console.log("[db] Found existing demo store:", demoStoreId);
            } else {
              // Create new demo store
              const insertResult = await initPool.query(`
                INSERT INTO public.delivery_hub_stores (id, user_id, name, slug, tagline, theme, banner_url, is_active)
                VALUES (
                  '00000000-0000-0000-0000-000000000001',
                  '00000000-0000-0000-0000-000000000001',
                  'متجر التميز والسرعة',
                  'demo-store',
                  'أسرع توصيل بأفضل جودة 🚀',
                  'neon-modern',
                  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=60',
                  true
                )
                ON CONFLICT (slug) DO NOTHING
                RETURNING id
              `);
              if (insertResult.rows.length > 0) {
                demoStoreId = insertResult.rows[0].id;
                console.log("[db] Created demo store:", demoStoreId);
              }
            }
          } catch (demoStoreErr) {
            console.warn("[db] Could not create demo store:", demoStoreErr instanceof Error ? demoStoreErr.message : demoStoreErr);
          }

          // Add updated_at column to inventory_products if it doesn't exist
          try {
            await initPool.query(`
              ALTER TABLE public.inventory_products 
              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
            `);
            console.log("[db] Added updated_at column to inventory_products");
          } catch (alterErr) {
            console.warn("[db] Could not add updated_at column to inventory_products:", alterErr instanceof Error ? alterErr.message : alterErr);
          }

          // Create function and trigger for updated_at on inventory_products
          try {
            await initPool.query(`
              CREATE OR REPLACE FUNCTION update_inventory_products_updated_at()
              RETURNS TRIGGER AS $$
              BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
              END;
              $$ LANGUAGE plpgsql
            `);
            await initPool.query(`
              DROP TRIGGER IF EXISTS trigger_update_inventory_products_updated_at ON public.inventory_products
            `);
            await initPool.query(`
              CREATE TRIGGER trigger_update_inventory_products_updated_at
                BEFORE UPDATE ON public.inventory_products
                FOR EACH ROW
                EXECUTE FUNCTION update_inventory_products_updated_at()
            `);
            console.log("[db] Created updated_at trigger for inventory_products");
          } catch (triggerErr) {
            console.warn("[db] Could not create updated_at trigger for inventory_products:", triggerErr instanceof Error ? triggerErr.message : triggerErr);
          }

          // Create demo products for demo store if they don't exist
          if (demoStoreId) {
            try {
              await initPool.query(`
                INSERT INTO public.delivery_hub_products (id, store_id, title, category, description, price, original_price, image_url, in_stock, sort_order, stock_quantity, low_stock_threshold)
                VALUES 
                  (
                    '00000000-0000-0000-0000-000000000002',
                    $1,
                    'برجر لحم مشوي فاخر',
                    'أطباق رئيسية',
                    'برجر لحم طازج مع جبنة وصلصة خاصة',
                    45,
                    60,
                    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=60',
                    true,
                    0,
                    50,
                    5
                  ),
                  (
                    '00000000-0000-0000-0000-000000000003',
                    $1,
                    'بيتزا مارغريتا',
                    'بيتزا',
                    'عجينة رقيقة مع جبنة موزاريلا وصلصة طماطم طازجة',
                    65,
                    null,
                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=60',
                    true,
                    1,
                    30,
                    5
                  ),
                  (
                    '00000000-0000-0000-0000-000000000004',
                    $1,
                    'عصير طبيعي مثلج',
                    'مشروبات',
                    'عصير فواكه طازج بدون سكر مضاف',
                    20,
                    25,
                    'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=800&q=60',
                    true,
                    2,
                    100,
                    10
                  )
                ON CONFLICT (id) DO NOTHING
              `, [demoStoreId]);
              console.log("[db] Created demo products");
            } catch (demoProductsErr) {
              console.warn("[db] Could not create demo products:", demoProductsErr instanceof Error ? demoProductsErr.message : demoProductsErr);
            }
          }

          return;
        } catch (e) {
          lastErr = e;
          const retryable = isTransientDbError(e) && attempt < maxAttempts;
          console.error(
            `[db] initDatabase (schema) attempt ${attempt}/${maxAttempts} failed — check DIRECT_URL / DATABASE_URL, sslmode, and password from Supabase:`,
            e instanceof Error ? e.message : e
          );
          if (!retryable) break;
          await new Promise((r) => setTimeout(r, Math.min(8000, 1500 * attempt)));
        } finally {
          await initPool.end().catch(() => undefined);
        }
      }
      initPromise = null;
      throw lastErr;
    })();
  }
  try {
    await initPromise;
  } catch (e) {
    initPromise = null;
    throw e;
  }
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
