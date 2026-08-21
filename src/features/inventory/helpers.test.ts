import test from "node:test";
import assert from "node:assert/strict";
import {
  inventoryRowFromProduct,
  inventoryRowFromSupabase,
  parseDateCell,
  parseInventoryImportRows,
  piecesPerQuickUnit,
} from "./import-helpers";
import {
  buildInvoiceExcelAoA,
  buildInvoiceHeaders,
  buildInvoiceRows,
  buildStockExcelAoA,
  buildStockHeaders,
  buildStockRows,
} from "./export-helpers";
import type { Invoice, Product } from "./types";

const t = (key: string) => `tx:${key}`;

const product: Product = {
  id: "p1",
  name: "Milk",
  sku: "MLK-1",
  retail_type: "grocery",
  pieces_per_carton: 12,
  unit_price: 8.5,
  stock_pieces: 36,
  unit_kind: "box",
  cost_price: 5,
  expiry_date: null,
  low_stock_alert: 6,
};

const invoice: Invoice = {
  id: "i1",
  customer_name: "Client A",
  lines_json: "[]",
  total: 120,
  paid: 90,
  credit: 30,
  due_at: "2026-07-01",
  created_at: "2026-06-28T10:00:00.000Z",
};

test("piecesPerQuickUnit returns carton size for box and bag, 1 for piece", () => {
  assert.equal(piecesPerQuickUnit(product, "piece"), 1);
  assert.equal(piecesPerQuickUnit(product, "box"), 12);
  assert.equal(piecesPerQuickUnit(product, "bag"), 12);
});

test("parseDateCell normalizes ISO, local and excel serial dates", () => {
  assert.equal(parseDateCell("2026/7/5"), "2026-07-05");
  assert.equal(parseDateCell("5/7/2026"), "2026-07-05");
  assert.equal(parseDateCell(new Date("2026-07-05T12:00:00.000Z")), "2026-07-05");
  assert.match(parseDateCell(46208) ?? "", /^\d{4}-\d{2}-\d{2}$/);
});

test("parseInventoryImportRows reads named headers and applies sane defaults", () => {
  const rows = [
    ["الاسم", "barcode", "activity", "unit", "ppc", "price", "cost", "qty", "expiry", "alert"],
    ["Milk", "12345", "grocery", "box", "12", "8,5", "5", "24", "2026-07-05", "4"],
    ["Sugar", "", "unknown", "", "", "", "", "", "", ""],
  ];

  assert.deepEqual(parseInventoryImportRows(rows, "retail"), [
    {
      name: "Milk",
      sku: "12345",
      retail_type: "grocery",
      pieces_per_carton: 12,
      unit_price: 8.5,
      stock_pieces: 24,
      unit_kind: "box",
      cost_price: 5,
      expiry_date: "2026-07-05",
      low_stock_alert: 4,
    },
    {
      name: "Sugar",
      sku: "",
      retail_type: "retail",
      pieces_per_carton: 1,
      unit_price: 0,
      stock_pieces: 0,
      unit_kind: "piece",
      cost_price: 0,
      expiry_date: null,
      low_stock_alert: 10,
    },
  ]);
});

test("parseInventoryImportRows falls back to positional columns when header is absent", () => {
  const rows = [["Rice", "RC-1", "retail", "piece", 6, 3.2, 2.1, 18, "05/07/2026", 2]];
  assert.deepEqual(parseInventoryImportRows(rows, "grocery"), [
    {
      name: "Rice",
      sku: "RC-1",
      retail_type: "retail",
      pieces_per_carton: 6,
      unit_price: 3.2,
      stock_pieces: 18,
      unit_kind: "piece",
      cost_price: 2.1,
      expiry_date: "2026-07-05",
      low_stock_alert: 2,
    },
  ]);
});

test("inventoryRow mappers keep stable source-specific fields", () => {
  assert.deepEqual(inventoryRowFromProduct(product), {
    id: "p1",
    name: "Milk",
    qty: 36,
    sku: "MLK-1",
    barcode: "MLK-1",
    reference: "grocery",
    source: "inventory_products",
  });

  assert.deepEqual(
    inventoryRowFromSupabase({
      id: "s1",
      name: "Flour",
      sku: "FLR-9",
      barcode: "9988",
      reference: "raw",
      quantity: 11,
    } as never),
    {
      id: "s1",
      name: "Flour",
      qty: 11,
      sku: "FLR-9",
      barcode: "9988",
      reference: "raw",
      source: "supabase",
    }
  );
});

test("export helpers keep headers, rows and excel shapes stable", () => {
  assert.deepEqual(buildStockHeaders(t), [
    "tx:inv.col.name",
    "tx:inv.col.sku",
    "tx:inv.col.sector",
    "tx:inv.col.ppc",
    "tx:inv.col.price",
    "tx:inv.col.stockP",
    "tx:inv.col.stockC",
  ]);

  assert.deepEqual(buildStockRows([product], t), [["Milk", "MLK-1", "tx:inv.retail.grocery", "12", "8.5", "36", "3"]]);
  assert.deepEqual(buildInvoiceHeaders(t), [
    "tx:inv.customer",
    "tx:inv.total",
    "tx:inv.paid",
    "tx:inv.credit",
    "tx:inv.dueDate",
    "tx:inv.col.date",
  ]);
  assert.deepEqual(buildInvoiceRows([invoice]), [["Client A", "120", "90", "30", "2026-07-01", "2026-06-28T10:00:00.000Z"]]);

  assert.deepEqual(buildStockExcelAoA([product], t), [
    ["tx:inv.col.name", "tx:inv.col.sku", "tx:inv.col.sector", "tx:inv.col.unitKind", "ppc", "tx:inv.col.price", "tx:inv.costPrice", "tx:inv.col.stockP"],
    ["Milk", "MLK-1", "grocery", "box", 12, 8.5, 5, 36],
  ]);

  assert.deepEqual(buildInvoiceExcelAoA([invoice]), [
    ["id", "customer", "total", "paid", "credit", "due", "created"],
    ["i1", "Client A", 120, 90, 30, "2026-07-01", "2026-06-28T10:00:00.000Z"],
  ]);
});
