import test from "node:test";
import assert from "node:assert/strict";
import {
  filterInventoryRows,
  filterQuickProducts,
  getCurrentLinePreview,
  getEffectiveSaleTotal,
  getOverdueCredits,
  toProductsLite,
} from "./selectors";
import type { Invoice, InventorySourceRow, Product } from "./types";

const products: Product[] = [
  {
    id: "p1",
    name: "Milk Box",
    sku: "MLK-01",
    retail_type: "grocery",
    pieces_per_carton: 6,
    unit_price: 12,
    stock_pieces: 18,
    unit_kind: "box",
    cost_price: 8,
    expiry_date: null,
    low_stock_alert: 3,
  },
  {
    id: "p2",
    name: "Sugar",
    sku: "SUG-02",
    retail_type: "retail",
    pieces_per_carton: 1,
    unit_price: 5,
    stock_pieces: 40,
    unit_kind: "piece",
    cost_price: 3,
    expiry_date: null,
    low_stock_alert: 5,
  },
];

test("filterQuickProducts matches by lowercase name and sku", () => {
  assert.deepEqual(filterQuickProducts(products, "milk").map((product) => product.id), ["p1"]);
  assert.deepEqual(filterQuickProducts(products, "sug-02").map((product) => product.id), ["p2"]);
  assert.equal(filterQuickProducts(products, "").length, 2);
});

test("getCurrentLinePreview computes unit pieces, line total and profit", () => {
  assert.deepEqual(getCurrentLinePreview(products, 0, "box"), {
    line: 72,
    profit: 24,
    pp: 6,
  });

  assert.deepEqual(getCurrentLinePreview([], 0, "piece"), {
    line: 0,
    profit: 0,
    pp: 1,
  });
});

test("getEffectiveSaleTotal keeps draft total on blank or invalid override", () => {
  assert.equal(getEffectiveSaleTotal("", 42), 42);
  assert.equal(getEffectiveSaleTotal("abc", 42), 42);
  assert.equal(getEffectiveSaleTotal("51,5", 42), 51.5);
});

test("getOverdueCredits only returns unpaid invoices older than now", () => {
  const invoices: Invoice[] = [
    {
      id: "i1",
      customer_name: "Late",
      lines_json: "[]",
      total: 100,
      paid: 0,
      credit: 100,
      due_at: "2026-06-01",
      created_at: "2026-06-01T10:00:00.000Z",
    },
    {
      id: "i2",
      customer_name: "Paid",
      lines_json: "[]",
      total: 100,
      paid: 100,
      credit: 0,
      due_at: "2026-06-01",
      created_at: "2026-06-01T10:00:00.000Z",
    },
    {
      id: "i3",
      customer_name: "Future",
      lines_json: "[]",
      total: 100,
      paid: 0,
      credit: 100,
      due_at: "2026-07-20",
      created_at: "2026-06-01T10:00:00.000Z",
    },
  ];

  assert.deepEqual(
    getOverdueCredits(invoices, new Date("2026-06-15T00:00:00.000Z")).map((invoice) => invoice.id),
    ["i1"]
  );
});

test("toProductsLite keeps matching fields required by receipt parsing", () => {
  assert.deepEqual(toProductsLite(products), [
    {
      id: "p1",
      name: "Milk Box",
      sku: "MLK-01",
      unit_price: 12,
      stock_pieces: 18,
      pieces_per_carton: 6,
    },
    {
      id: "p2",
      name: "Sugar",
      sku: "SUG-02",
      unit_price: 5,
      stock_pieces: 40,
      pieces_per_carton: 1,
    },
  ]);
});

test("filterInventoryRows normalizes lookup across source fields", () => {
  const rows: InventorySourceRow[] = [
    {
      id: "r1",
      name: "حليب 12",
      qty: 10,
      sku: "MLK-12",
      barcode: "12345",
      reference: "grocery",
      source: "inventory_products",
    },
    {
      id: "r2",
      name: "Rice",
      qty: 4,
      sku: "RCE-01",
      barcode: "888",
      reference: "retail",
      source: "supabase",
    },
  ];

  assert.deepEqual(filterInventoryRows(rows, "١٢").map((row) => row.id), ["r1"]);
  assert.deepEqual(filterInventoryRows(rows, "retail").map((row) => row.id), ["r2"]);
  assert.equal(filterInventoryRows(rows, "").length, 2);
});
