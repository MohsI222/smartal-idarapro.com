export type Product = {
  id: string;
  name: string;
  sku: string;
  retail_type: string;
  pieces_per_carton: number;
  unit_price: number;
  stock_pieces: number;
  unit_kind?: string;
  cost_price?: number;
  expiry_date?: string | null;
  low_stock_alert?: number;
  video_url?: string | null;
  video_file_path?: string | null;
  video_file_name?: string | null;
  video_mime?: string | null;
};

export type Invoice = {
  id: string;
  customer_name: string;
  lines_json: string;
  total: number;
  paid: number;
  credit: number;
  due_at: string | null;
  created_at: string;
};

export type QuickUnit = "piece" | "box" | "bag";

export type DraftLine = {
  id: string;
  product_id: string;
  product_name: string;
  qty_pieces: number;
  sale_unit: QuickUnit;
  line_total: number;
};

export type ProductsResponse = { products: Product[] };
export type InvoicesResponse = { invoices: Invoice[] };
export type ProductCreateResponse = { id: string };

export type ProductWritePayload = {
  name: string;
  sku: string;
  retail_type: string;
  pieces_per_carton: number;
  unit_price: number;
  stock_pieces: number;
  unit_kind: string;
  cost_price: number;
  expiry_date?: string | null;
  low_stock_alert: number;
  video_url?: string | null;
  video_file_path?: string | null;
  video_file_name?: string | null;
  video_mime?: string | null;
};

export type ProductionBomItem = {
  material_id: string;
  name: string;
  quantity: number;
  available: number;
  reference?: string;
  source: "supabase" | "inventory_products";
};

export type InventorySourceRow = {
  id: string;
  name: string;
  qty: number;
  sku: string;
  barcode: string;
  reference: string;
  source: "supabase" | "inventory_products";
};

export type SheetCell = string | number | boolean | Date | null | undefined;

export type InventoryImportKey =
  | "name"
  | "sku"
  | "retail_type"
  | "unit_kind"
  | "pieces_per_carton"
  | "unit_price"
  | "cost_price"
  | "stock_pieces"
  | "expiry_date"
  | "low_stock_alert";

export type BrandingPrefs = {
  activityType: string;
  companyName: string;
  logoDataUrl: string;
};

export type NewProductFormState = {
  name: string;
  sku: string;
  retail_type: string;
  pieces_per_carton: string;
  unit_price: string;
  stock_pieces: string;
  unit_kind: string;
  cost_price: string;
  expiry_date: string;
  low_stock_alert: string;
  video_url?: string;
  video_file_path?: string;
  video_file_name?: string;
  video_mime?: string;
};

export type SaleFormState = {
  customer: string;
  paid: string;
  due_at: string;
};

export type StockAddFormState = {
  product_id: string;
  add: string;
};

export type MessageRecipient = {
  id: string;
  full_name: string;
  hierarchy_role?: string;
  department?: string;
};

export type ExportProcessingState = {
  active: boolean;
  label: string;
  progress?: number;
};

export type WorkerShift = {
  id: string;
  worker_id: string;
  worker_name: string;
  phone: string;
  center: string;
  entry_time: string;
  exit_time: string;
  hours_worked: number;
  products_sold: number;
  money_earned: number;
  created_at: string;
  updated_at: string;
};

export type WorkerShiftFormState = {
  worker_id: string;
  worker_name: string;
  phone: string;
  center: string;
  entry_time: string;
  exit_time: string;
  products_sold: string;
  money_earned: string;
};
