import { api } from "@/lib/api";
import type { LogisticsQueueItem, ProductionRequestRow } from "@/lib/supabaseClient";

export type ProductionBomItem = {
  material_id: string;
  quantity: number;
  name?: string;
  reference?: string;
  source?: string;
};

function mapRequest(row: Record<string, unknown>): ProductionRequestRow {
  let bom_items: ProductionRequestRow["bom_items"] = null;
  const raw = row.bom_items_json ?? row.bom_items;
  if (typeof raw === "string" && raw.trim()) {
    try {
      bom_items = JSON.parse(raw) as ProductionRequestRow["bom_items"];
    } catch {
      bom_items = null;
    }
  } else if (Array.isArray(raw)) {
    bom_items = raw as ProductionRequestRow["bom_items"];
  }
  return {
    id: String(row.id),
    title: (row.title as string | null | undefined) ?? null,
    product_id: (row.product_id as string | null | undefined) ?? null,
    target_quantity: Number(row.target_quantity ?? 0) || 0,
    quantity: Number(row.quantity ?? row.target_quantity ?? 0) || 0,
    status: (row.status as string | null | undefined) ?? "pending",
    requested_by: (row.requested_by as string | null | undefined) ?? null,
    assigned_to: (row.assigned_to as string | null | undefined) ?? null,
    bom_items,
    created_at: (row.created_at as string | null | undefined) ?? null,
  };
}

export async function fetchProductionRequestsBackend(token: string): Promise<ProductionRequestRow[]> {
  const res = await api<{ requests: Record<string, unknown>[] }>("/inventory/production-requests", { token });
  return (res.requests ?? []).map(mapRequest);
}

export async function createProductionRequestBackend(
  token: string,
  payload: {
    title: string;
    target_quantity: number;
    status?: string;
    requested_by?: string;
    bom_items: ProductionBomItem[];
  }
): Promise<ProductionRequestRow | null> {
  const res = await api<{ request: Record<string, unknown> }>("/inventory/production-requests", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  return res.request ? mapRequest(res.request) : null;
}

export async function fetchLogisticsQueueBackend(token: string): Promise<LogisticsQueueItem[]> {
  const res = await api<{ items: LogisticsQueueItem[] }>("/inventory/logistics-queue", { token });
  return res.items ?? [];
}

export async function assignLogisticsItemBackend(
  token: string,
  logisticsId: string,
  assignedTo: string
): Promise<void> {
  await api(`/inventory/logistics-queue/${encodeURIComponent(logisticsId)}/assign`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ assigned_to: assignedTo }),
  });
}

export async function reserveProductionMaterialBackend(
  token: string,
  payload: { product_id: string; quantity: number; source?: string }
): Promise<void> {
  await api("/inventory/production-reserve", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}
