import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getApiUrlPrefix } from "@/lib/api";

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

// Singleton Supabase client instance to prevent auth lock timeouts
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  
  // Return existing singleton instance if available
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  // Create new instance with auth configuration to prevent lock timeouts
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // Increase lock timeout to prevent "Lock was not released within 5000ms" warnings
      lockTimeout: 10000,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  
  return supabaseInstance;
}

// Export as named export for backward compatibility
export const supabase = getSupabaseClient();

// Service role client for Super Admin operations (bypasses RLS)
// This should only be used server-side or for Super Admin operations
const rawServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseServiceKey = typeof rawServiceKey === "string" ? rawServiceKey.trim() : "";

export const supabaseService: SupabaseClient | null = (isSupabaseConfigured && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
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

export async function fetchInventory(userId?: string) {
  // Use Express API to bypass RLS and ensure consistent data access
  // This ensures we can read products saved via Express API batch endpoint
  try {
    const token = localStorage.getItem("idara_token");
    if (!token) {
      console.warn("[fetchInventory] No token found, falling back to Supabase client");
      return fetchInventorySupabase(userId);
    }

    const response = await fetch(`${getApiUrlPrefix()}/inventory/products`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn("[fetchInventory] Express API failed, falling back to Supabase client");
      return fetchInventorySupabase(userId);
    }

    const data = await response.json();
    console.log("[fetchInventory] Fetched", data.products?.length || 0, "products via Express API");
    return (Array.isArray(data.products) ? data.products : []) as InventoryItem[];
  } catch (error) {
    console.error("[fetchInventory] Express API error, falling back to Supabase client:", error);
    return fetchInventorySupabase(userId);
  }
}

// Fallback to Supabase client for backward compatibility
async function fetchInventorySupabase(userId?: string) {
  const client = ensureClient();
  let query = client.from("inventory_products").select("*").order("name", { ascending: true });

  // Add user_id filter for security - only fetch products belonging to current user
  // OR products with missing user_id (to allow fixing orphaned products)
  if (userId) {
    query = query.or(`user_id.eq.${userId},user_id.is.null`);
  }

  console.log("[fetchInventorySupabase] Fetching products with user_id:", userId, "or null");
  const { data, error } = await query;
  if (error) {
    console.error("[fetchInventorySupabase] Error:", JSON.stringify(error, null, 2));
    return [];
  }
  console.log("[fetchInventorySupabase] Fetched", data?.length || 0, "products");
  return (Array.isArray(data) ? data : []) as InventoryItem[];
}

export async function reserveMaterial(materialId: string, qty: number, userId?: string) {
  const client = ensureClient();
  let query = client.from("inventory_products").select("id,stock_pieces,user_id").eq("id", materialId);
  
  // Add user_id filter for security
  if (userId) {
    query = query.eq("user_id", userId);
  }
  
  const { data, error } = await query.single();
  if (error) throw error;
  
  // Verify ownership
  if (userId && (data as any).user_id !== userId) {
    throw new Error("Unauthorized: Product does not belong to current user");
  }
  
  const current = Number((data as any).stock_pieces || 0);
  const next = Math.max(0, current - qty);
  
  let updateQuery = client.from("inventory_products").update({ stock_pieces: next }).eq("id", materialId);
  if (userId) {
    updateQuery = updateQuery.eq("user_id", userId);
  }
  
  const { error: upd } = await updateQuery;
  if (upd) throw upd;
  return { previous: current, next };
}

export async function fetchProductsAwaitingQA(userId?: string) {
  const client = ensureClient();
  let query = client.from("inventory_products").select("*").eq("status", "awaiting_qc");
  
  // Add user_id filter for security
  if (userId) {
    query = query.eq("user_id", userId);
  }
  
  const { data, error } = await query;
  if (error) {
    console.warn("[supabase] fetchProductsAwaitingQA failed", error);
    return [];
  }
  return (Array.isArray(data) ? data : []) as any[];
}

export async function confirmProductQA(productId: string, userId?: string) {
  const client = ensureClient();
  let updateQuery = client.from("inventory_products").update({ status: "ready_for_shipping" }).eq("id", productId);
  
  // Add user_id filter for security
  if (userId) {
    updateQuery = updateQuery.eq("user_id", userId);
  }
  
  const { error } = await updateQuery;
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
  if (error) {
    console.warn("[supabase] fetchProductionRequests failed", error);
    return [];
  }
  return (Array.isArray(data) ? data : []) as ProductionRequestRow[];
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

export async function deleteLogisticsQueueItem(logisticsId: string) {
  const client = ensureClient();
  console.log("deleteLogisticsQueueItem - logisticsId:", logisticsId);
  const { error } = await client.from("logistics_queue").delete().eq("id", logisticsId);
  if (error) {
    console.error("Supabase Error Details - deleteLogisticsQueueItem:", JSON.stringify(error, null, 2));
    throw error;
  }
  console.log("deleteLogisticsQueueItem - success");
  return true;
}

export async function deleteProductionRequest(requestId: string) {
  const client = ensureClient();
  console.log("deleteProductionRequest - requestId:", requestId);
  const { error } = await client.from("production_requests").delete().eq("id", requestId);
  if (error) {
    console.error("Supabase Error Details - deleteProductionRequest:", JSON.stringify(error, null, 2));
    throw error;
  }
  console.log("deleteProductionRequest - success");
  return true;
}

export async function deleteSelectedLogisticsQueueItems(ids: string[]) {
  const client = ensureClient();
  console.log("deleteSelectedLogisticsQueueItems - ids:", ids);
  const { error } = await client.from("logistics_queue").delete().in("id", ids);
  if (error) {
    console.error("Supabase Error Details - deleteSelectedLogisticsQueueItems:", JSON.stringify(error, null, 2));
    throw error;
  }
  console.log("deleteSelectedLogisticsQueueItems - success");
  return true;
}

export async function deleteSelectedProductionRequests(ids: string[]) {
  const client = ensureClient();
  console.log("deleteSelectedProductionRequests - ids:", ids);
  const { error } = await client.from("production_requests").delete().in("id", ids);
  if (error) {
    console.error("Supabase Error Details - deleteSelectedProductionRequests:", JSON.stringify(error, null, 2));
    throw error;
  }
  console.log("deleteSelectedProductionRequests - success");
  return true;
}

export async function updateProductStock(productId: string, stockChange: number, userId?: string) {
  const client = ensureClient();
  let query = client.from("inventory_products").select("id,stock_pieces,user_id").eq("id", productId);
  
  // Add user_id filter for security
  if (userId) {
    query = query.eq("user_id", userId);
  }
  
  const { data, error } = await query.maybeSingle();
  
  // Handle case where product is not found gracefully
  if (error) {
    console.error("[updateProductStock] Error fetching product:", JSON.stringify(error, null, 2));
    throw error;
  }
  
  if (!data) {
    console.error("[updateProductStock] Product not found with user_id:", productId, "user_id:", userId);
    
    // Fallback: Try to fetch without user_id filter (for products with missing user_id)
    if (userId) {
      console.log("[updateProductStock] Attempting fallback without user_id filter");
      const fallbackQuery = client.from("inventory_products").select("id,stock_pieces,user_id").eq("id", productId);
      const { data: fallbackData, error: fallbackError } = await fallbackQuery.maybeSingle();
      
      if (fallbackError) {
        console.error("[updateProductStock] Fallback error:", JSON.stringify(fallbackError, null, 2));
        throw new Error("Product not found or unauthorized");
      }
      
      if (!fallbackData) {
        throw new Error("Product not found");
      }
      
      console.log("[updateProductStock] Fallback successful, product found:", fallbackData);
      
      // Update the product and fix user_id if missing
      const current = Number((fallbackData as any).stock_pieces || 0);
      const next = Math.max(0, current + stockChange);
      
      const updatePayload: any = { stock_pieces: next };
      // Fix user_id if it's missing
      if (!(fallbackData as any).user_id) {
        updatePayload.user_id = userId;
        console.log("[updateProductStock] Fixing missing user_id for product:", productId);
      }
      
      const { error: upd } = await client.from("inventory_products").update(updatePayload).eq("id", productId);
      if (upd) {
        console.error("[updateProductStock] Error updating product (fallback):", JSON.stringify(upd, null, 2));
        throw upd;
      }
      return { previous: current, next };
    }
    
    throw new Error("Product not found");
  }
  
  // Verify ownership
  if (userId && (data as any).user_id !== userId) {
    throw new Error("Unauthorized: Product does not belong to current user");
  }
  
  const current = Number((data as any).stock_pieces || 0);
  const next = Math.max(0, current + stockChange);
  
  let updateQuery = client.from("inventory_products").update({ stock_pieces: next }).eq("id", productId);
  if (userId) {
    updateQuery = updateQuery.eq("user_id", userId);
  }
  
  const { error: upd } = await updateQuery;
  if (upd) {
    console.error("[updateProductStock] Error updating product:", JSON.stringify(upd, null, 2));
    throw upd;
  }
  return { previous: current, next };
}
