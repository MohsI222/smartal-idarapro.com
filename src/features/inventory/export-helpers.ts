import type { Invoice, Product } from "./types";

type TranslateFn = (key: string) => string;

export function buildStockHeaders(t: TranslateFn): string[] {
  return [
    t("inv.col.name"),
    t("inv.col.sku"),
    t("inv.col.sector"),
    t("inv.col.ppc"),
    t("inv.col.price"),
    t("inv.col.stockP"),
    t("inv.col.stockC"),
  ];
}

export function buildStockRows(products: Product[], t: TranslateFn): string[][] {
  return products.map((product) => [
    product.name,
    product.sku,
    t(`inv.retail.${product.retail_type}`),
    String(product.pieces_per_carton),
    String(product.unit_price),
    String(product.stock_pieces),
    String(Math.floor(product.stock_pieces / Math.max(1, product.pieces_per_carton))),
  ]);
}

export function buildInvoiceHeaders(t: TranslateFn): string[] {
  return [
    t("inv.customer"),
    t("inv.total"),
    t("inv.paid"),
    t("inv.credit"),
    t("inv.dueDate"),
    t("inv.col.date"),
  ];
}

export function buildInvoiceRows(invoices: Invoice[]): string[][] {
  return invoices.map((invoice) => [
    invoice.customer_name || "—",
    String(invoice.total),
    String(invoice.paid),
    String(invoice.credit),
    invoice.due_at ?? "—",
    invoice.created_at,
  ]);
}

export function buildStockExcelAoA(products: Product[], t: TranslateFn): (string | number)[][] {
  return [
    [
      t("inv.col.name"),
      t("inv.col.sku"),
      t("inv.col.sector"),
      t("inv.col.unitKind"),
      "ppc",
      t("inv.col.price"),
      t("inv.costPrice"),
      t("inv.col.stockP"),
    ],
    ...products.map((product) => [
      product.name,
      product.sku,
      product.retail_type,
      product.unit_kind || "piece",
      product.pieces_per_carton,
      product.unit_price,
      product.cost_price ?? 0,
      product.stock_pieces,
    ]),
  ];
}

export function buildInvoiceExcelAoA(invoices: Invoice[]): (string | number)[][] {
  return [
    ["id", "customer", "total", "paid", "credit", "due", "created"],
    ...invoices.map((invoice) => [
      invoice.id,
      invoice.customer_name,
      invoice.total,
      invoice.paid,
      invoice.credit,
      invoice.due_at ?? "",
      invoice.created_at,
    ]),
  ];
}
