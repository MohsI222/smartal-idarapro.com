import type { InventoryImportKey, QuickUnit } from "./types";

export const RETAIL_TYPES = [
  "grocery",
  "lawyer_office",
  "pharmacy",
  "wedding_hall",
  "supermarket",
  "bookstore",
  "cafe",
  "hardware",
  "company",
  "laboratory",
  "retail",
] as const;

export const UNIT_KINDS = ["piece", "box", "bag", "kg"] as const;

export const INV_TABS = ["dash", "pos", "barcode", "credit", "workers", "logs"] as const;

export const QUICK_UNITS = ["piece", "box", "bag"] as const satisfies readonly QuickUnit[];

export const IMPORT_FALLBACK_INDEX: Record<InventoryImportKey, number> = {
  name: 0,
  sku: 1,
  retail_type: 2,
  unit_kind: 3,
  pieces_per_carton: 4,
  unit_price: 5,
  cost_price: 6,
  stock_pieces: 7,
  expiry_date: 8,
  low_stock_alert: 9,
};

export const IMPORT_HEADER_ALIASES: Record<InventoryImportKey, string[]> = {
  name: ["name", "product", "item", "designation", "produit", "الصنف", "المنتج", "الاسم"],
  sku: ["sku", "barcode", "bar code", "code", "reference", "référence", "كود", "باركود", "المرجع"],
  retail_type: ["sector", "retail_type", "retail type", "activity", "activité", "قطاع", "النشاط"],
  unit_kind: ["unit_kind", "unit kind", "unit", "kind", "unité", "وحدة", "نوع الوحدة"],
  pieces_per_carton: [
    "ppc",
    "pieces_per_carton",
    "pieces per carton",
    "per carton",
    "carton",
    "colis",
    "كرتون",
    "علبة",
  ],
  unit_price: ["unit_price", "unit price", "price", "prix", "ثمن", "السعر"],
  cost_price: ["cost_price", "cost price", "cost", "coût", "تكلفة", "ثمن الشراء"],
  stock_pieces: ["stock_pieces", "stock pieces", "stock", "quantity", "qty", "quantité", "مخزون", "الكمية"],
  expiry_date: ["expiry_date", "expiry", "expiration", "date expiration", "صلاحية", "انتهاء"],
  low_stock_alert: ["low_stock_alert", "low stock", "alert", "seuil", "تنبيه", "حد أدنى"],
};
