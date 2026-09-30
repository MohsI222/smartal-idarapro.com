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
