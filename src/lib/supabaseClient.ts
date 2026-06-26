import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
const supabaseAnonKey = typeof rawKey === "string" ? rawKey.trim() : "";

const isValidUrl = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(supabaseUrl);
const isJwtKey = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(supabaseAnonKey);
const isPublishableKey = /^sb_publishable_[A-Za-z0-9_-]{20,80}$/.test(supabaseAnonKey);
const isValidKey = isJwtKey || isPublishableKey;

export const isSupabaseConfigured = Boolean(supabaseUrl) && Boolean(supabaseAnonKey) && isValidUrl && isValidKey;

if (import.meta.env.DEV) {
  if (!supabaseUrl) {
    console.error("[supabase] VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is missing — set in .env / Vercel.");
  } else if (!isValidUrl) {
    console.error("[supabase] Supabase URL looks malformed:", supabaseUrl, "— expected https://<project-ref>.supabase.co");
  }
  if (!supabaseAnonKey) {
    console.error("[supabase] VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is missing — set in .env / Vercel.");
  } else if (!isValidKey) {
    console.error("[supabase] VITE_SUPABASE_ANON_KEY does not look like a valid Supabase key.", "Expected either a JWT (eyJ...xxx.yyy.zzz) or a publishable key (sb_publishable_...).", "Got prefix:", supabaseAnonKey.slice(0, 12) + (supabaseAnonKey.length > 12 ? "…" : ""));
  }
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type InventoryItem = {
  id: string;
  name?: string | null;
  sku?: string | null;
  barcode?: string | null;
  reference?: string | null;
  quantity?: number | null;
  stock_pieces?: number | null;
  unit?: string | null;
  created_at?: string | null;
};

export type ProductionRequestRow = {
  id: string;
  title?: string | null;
  product_id?: string | null;
  target_quantity?: number | null;
  quantity?: number | null;
  status?: string | null;
  requested_by?: string | null;
  assigned_to?: string | null;
  bom_items?: Array<{ material_id: string; quantity: number; name?: string; reference?: string }> | null;
  created_at?: string | null;
};

export type LogisticsQueueItem = {
  id: string;
  title?: string | null;
  product_id?: string | null;
  assigned_to?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export type HrStaffRow = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  employee_id?: string | null;
  role?: string | null;
  department?: string | null;
};

function ensureClient() {
  if (!supabase) throw new Error("Supabase not configured");
  return supabase;
}

export async function fetchInventory() {
  const client = ensureClient();
  const { data, error } = await client.from("inventory").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data as InventoryItem[];
}

export async function reserveMaterial(materialId: string, qty: number) {
  const client = ensureClient();
  const { data, error } = await client.from("inventory").select("id,quantity").eq("id", materialId).single();
  if (error) throw error;
  const current = Number((data as any).quantity || 0);
  const next = Math.max(0, current - qty);
  const { error: upd } = await client.from("inventory").update({ quantity: next }).eq("id", materialId);
  if (upd) throw upd;
  return { previous: current, next };
}

export async function fetchProductsAwaitingQA() {
  const client = ensureClient();
  const { data, error } = await client.from("products").select("*").eq("status", "awaiting_qc");
  if (error) throw error;
  return data as any[];
}

export async function confirmProductQA(productId: string) {
  const client = ensureClient();
  const { error } = await client.from("products").update({ status: "ready_for_shipping" }).eq("id", productId);
  if (error) throw error;
  const { error: e2 } = await client.from("logistics_queue").insert([{ product_id: productId, created_at: new Date().toISOString(), status: "pending" }]);
  if (e2) throw e2;
  return true;
}

export async function fetchHrStaff() {
  const client = ensureClient();
  const { data, error } = await client.from("hr_staff").select("*");
  if (error) {
    console.warn("[supabase] fetchHrStaff failed", error);
    return [];
  }
  return (Array.isArray(data) ? data : []) as HrStaffRow[];
}

export async function enqueueLogistics(productId: string, assignedTo?: string) {
  const client = ensureClient();
  const payload: Record<string, string> = {
    product_id: productId,
    created_at: new Date().toISOString(),
    status: "scheduled",
  };
  if (assignedTo) payload.assigned_to = assignedTo;
  const { error } = await client.from("logistics_queue").insert([payload]);
  if (error) throw error;
  return true;
}

export async function createProductionRequest(payload: {
  title: string;
  target_quantity: number;
  status?: string;
  requested_by?: string;
  bom_items: Array<{ material_id: string; quantity: number; name?: string; reference?: string }>;
}) {
  const client = ensureClient();
  const { data, error } = await client.from("production_requests").insert([
    {
      title: payload.title,
      target_quantity: payload.target_quantity,
      status: payload.status ?? "pending",
      requested_by: payload.requested_by ?? "system",
      bom_items: payload.bom_items,
      created_at: new Date().toISOString(),
    },
  ]).select("*").single();
  if (error) throw error;
  const inserted = data as ProductionRequestRow | null;
  if (inserted?.id) {
    try {
      await enqueueLogistics(inserted.id, payload.requested_by ?? "inventory-module");
    } catch (enqueueError) {
      console.warn("[supabase] enqueueLogistics failed", enqueueError);
    }
  }
  return inserted;
}

export async function fetchProductionRequests() {
  const client = ensureClient();
  const { data, error } = await client.from("production_requests").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProductionRequestRow[];
}

export async function fetchLogisticsQueue() {
  const client = ensureClient();
  const { data, error } = await client.from("logistics_queue").select("*").order("created_at", { ascending: false });
  if (error) {
    console.warn("[supabase] fetchLogisticsQueue failed", error);
    return [];
  }
  return (Array.isArray(data) ? data : []) as LogisticsQueueItem[];
}

export async function assignLogisticsItem(logisticsId: string, assignedTo: string) {
  const client = ensureClient();
  const { error } = await client.from("logistics_queue").update({ assigned_to: assignedTo, status: "scheduled" }).eq("id", logisticsId);
  if (error) throw error;
  return true;
}
