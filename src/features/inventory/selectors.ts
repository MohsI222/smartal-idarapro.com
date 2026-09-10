import type { ProductLite } from "@/lib/inventoryReceiptParse";
import { normalizeLookupText, piecesPerQuickUnit } from "./import-helpers";
import type { Invoice, InventorySourceRow, Product, QuickUnit } from "./types";

export function filterInventoryRows(rows: InventorySourceRow[], inventorySearch: string): InventorySourceRow[] {
  const q = normalizeLookupText(inventorySearch);
  if (!q) return rows;
  return rows.filter((row) => {
    const haystack = [row.name, row.sku, row.barcode, row.reference, row.id]
      .map(normalizeLookupText)
      .join(" ");
    return haystack.includes(q);
  });
}

export function filterQuickProducts(products: Product[], quickSearch: string): Product[] {
  const q = quickSearch.trim().toLowerCase();
  if (!q) return products;

  // Check if search is numeric (for SKU ending match)
  const isNumeric = /^\d+$/.test(q);

  return products.filter((product) => {
    const nameLower = product.name.toLowerCase();
    const skuLower = product.sku.toLowerCase();

    // If search starts with a letter, match products starting with that letter
    if (/^[a-z\u0600-\u06ff]/.test(q)) {
      return nameLower.startsWith(q) || skuLower.startsWith(q);
    }

    // If search is numeric, match products ending with that number in SKU
    if (isNumeric) {
      return skuLower.endsWith(q);
    }

    // Default: includes match for backward compatibility
    return nameLower.includes(q) || skuLower.includes(q);
  });
}

export function getOverdueCredits(invoices: Invoice[], now = new Date()): Invoice[] {
  return invoices.filter((invoice) => (invoice.credit ?? 0) > 0 && invoice.due_at && new Date(invoice.due_at) < now);
}

export function getCurrentLinePreview(
  products: Product[],
  quickListIndex: number,
  quickUnit: QuickUnit
): { line: number; profit: number; pp: number } {
  const product = products[quickListIndex];
  if (!product) return { line: 0, profit: 0, pp: 1 };

  const pp = piecesPerQuickUnit(product, quickUnit);
  const line = pp * product.unit_price;
  const cost = Math.max(0, Number(product.cost_price) || 0);
  const profit = pp * (product.unit_price - cost);
  return { line, profit, pp };
}

export function getEffectiveSaleTotal(manualTotalOverride: string, draftGrandTotal: number): number {
  const raw = manualTotalOverride.trim().replace(",", ".");
  if (raw === "") return draftGrandTotal;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : draftGrandTotal;
}

export function toProductsLite(products: Product[]): ProductLite[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    unit_price: product.unit_price,
    stock_pieces: product.stock_pieces,
    pieces_per_carton: product.pieces_per_carton,
  }));
}
