import type { InventoryItem } from "@/lib/supabaseClient";
import { IMPORT_FALLBACK_INDEX, IMPORT_HEADER_ALIASES, RETAIL_TYPES, UNIT_KINDS } from "./constants";
import type {
  InventoryImportKey,
  InventorySourceRow,
  Product,
  ProductWritePayload,
  QuickUnit,
  SheetCell,
} from "./types";

export function piecesPerQuickUnit(product: Product, unit: QuickUnit): number {
  const piecesPerCarton = Math.max(1, Math.floor(Number(product.pieces_per_carton) || 1));
  if (unit === "piece") return 1;
  return piecesPerCarton;
}

export function textCell(cell: SheetCell): string {
  if (cell == null) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
}

export function normalizeHeader(cell: SheetCell): string {
  return textCell(cell)
    .toLowerCase()
    .replace(/[()[\]{}:؛،,._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findHeaderIndex(header: SheetCell[], aliases: string[]): number {
  const normalizedAliases = aliases.map((alias) => normalizeHeader(alias));
  return header.findIndex((cell) => {
    const normalizedHeader = normalizeHeader(cell);
    if (!normalizedHeader) return false;
    return normalizedAliases.some(
      (alias) => normalizedHeader === alias || (alias.length > 3 && normalizedHeader.includes(alias))
    );
  });
}

export function parseNumberCell(cell: SheetCell, fallback: number): number {
  if (typeof cell === "number" && Number.isFinite(cell)) return cell;
  const text = textCell(cell).replace(/\s/g, "").replace(",", ".");
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseIntCell(cell: SheetCell, fallback: number, min: number): number {
  return Math.max(min, Math.floor(parseNumberCell(cell, fallback)));
}

export function parseDateCell(cell: SheetCell): string | null {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) return cell.toISOString().slice(0, 10);
  if (typeof cell === "number" && Number.isFinite(cell) && cell > 20000) {
    const excelEpochUtc = Date.UTC(1899, 11, 30);
    const parsedDate = new Date(excelEpochUtc + Math.round(cell * 86400000));
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString().slice(0, 10);
  }
  const raw = textCell(cell);
  if (!raw) return null;
  const iso = raw.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const local = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (!local) return null;
  const [, day, month, year] = local;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function normalizeRetailType(cell: SheetCell, fallback: string): string {
  const raw = textCell(cell);
  return (RETAIL_TYPES as readonly string[]).includes(raw) ? raw : fallback || "retail";
}

export function normalizeUnitKind(cell: SheetCell): string {
  const raw = textCell(cell);
  return (UNIT_KINDS as readonly string[]).includes(raw) ? raw : "piece";
}

export function normalizeLookupText(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.codePointAt(0)! - 0x06f0))
    .toLowerCase()
    .trim();
}

function isBarcodeLike(value: string): boolean {
  return /^[A-Z0-9][A-Z0-9\s._-]{2,119}$/i.test(value) && /\d/.test(value);
}

function productIdentityFromCells(nameCell: SheetCell, skuCell: SheetCell, fallbackIndex: number) {
  const rawName = textCell(nameCell).slice(0, 240);
  const rawSku = textCell(skuCell).slice(0, 120);
  const sku = rawSku || (isBarcodeLike(rawName) ? rawName.slice(0, 120) : "");
  const name =
    rawName ||
    (sku ? `Product ${sku}` : `Product ${fallbackIndex + 1}`);
  return { name, sku };
}

export function parseInventoryLooseTextRows(raw: string, defaultRetailType: string): ProductWritePayload[] {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(total|subtotal|tva|tax|المجموع|الإجمالي|ضريبة)\b/i.test(line));

  const parsed: ProductWritePayload[] = [];
  const seen = new Set<string>();

  for (const line of rows) {
    const cells = line
      .split(/\t|;|,/)
      .map((cell) => cell.trim())
      .filter(Boolean);
    const primary = cells[0] || line;
    const skuCandidate = cells.find(isBarcodeLike) || "";
    const nums = line.match(/\d+(?:[.,]\d+)?/g) || [];
    const nameCandidate = primary
      .replace(/\d+(?:[.,]\d+)?/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const identity = productIdentityFromCells(nameCandidate || primary, skuCandidate, parsed.length);
    const key = `${identity.name.toLowerCase()}|${identity.sku.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const quantity = nums.length === 1 && !skuCandidate ? parseIntCell(nums[0], 1, 0) : 1;
    const unitPrice = nums.length >= 2 ? Math.max(0, parseNumberCell(nums[nums.length - 1], 0)) : 0;

    parsed.push({
      name: identity.name,
      sku: identity.sku,
      retail_type: defaultRetailType || "retail",
      pieces_per_carton: 1,
      unit_price: unitPrice,
      stock_pieces: quantity,
      unit_kind: "piece",
      cost_price: 0,
      expiry_date: null,
      low_stock_alert: 10,
    });
  }

  return parsed;
}

export function inventoryRowFromSupabase(item: InventoryItem): InventorySourceRow {
  const name = String(item.name ?? item.sku ?? item.reference ?? item.id).trim() || item.id;
  return {
    id: item.id,
    name,
    qty: Math.max(0, Number(item.quantity ?? item.stock_pieces ?? 0) || 0),
    sku: String(item.sku ?? "").trim(),
    barcode: String(item.barcode ?? "").trim(),
    reference: String(item.reference ?? "").trim(),
    source: "supabase",
  };
}

export function inventoryRowFromProduct(product: Product): InventorySourceRow {
  return {
    id: product.id,
    name: product.name,
    qty: Math.max(0, Number(product.stock_pieces) || 0),
    sku: product.sku,
    barcode: product.sku,
    reference: product.retail_type,
    source: "inventory_products",
  };
}

export function parseInventoryImportRows(rows: SheetCell[][], defaultRetailType: string): ProductWritePayload[] {
  // Process ALL rows, not just visible ones, to ensure no data is skipped
  if (rows.length === 0) return [];

  const firstRow = rows[0] ?? [];
  const namedIndexes = Object.fromEntries(
    Object.entries(IMPORT_HEADER_ALIASES).map(([key, aliases]) => [
      key,
      findHeaderIndex(firstRow, aliases),
    ])
  ) as Record<InventoryImportKey, number>;
  const hasHeader = Object.values(namedIndexes).some((index) => index >= 0);
  const indexes: Record<InventoryImportKey, number> = { ...IMPORT_FALLBACK_INDEX };
  if (hasHeader) {
    for (const key of Object.keys(indexes) as InventoryImportKey[]) {
      if (namedIndexes[key] >= 0) indexes[key] = namedIndexes[key];
    }
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const parsed: ProductWritePayload[] = [];
  for (const [rowIndex, row] of dataRows.entries()) {
    // Skip completely empty rows (all cells are null/undefined/empty)
    if (row.every(cell => cell == null || textCell(cell) === "")) continue;

    const { name, sku } = productIdentityFromCells(row[indexes.name], row[indexes.sku], rowIndex);

    // Use default values for missing data instead of skipping
    parsed.push({
      name,
      sku,
      retail_type: normalizeRetailType(row[indexes.retail_type], defaultRetailType),
      pieces_per_carton: parseIntCell(row[indexes.pieces_per_carton], 1, 1),
      unit_price: Math.max(0, parseNumberCell(row[indexes.unit_price], 0)),
      stock_pieces: parseIntCell(row[indexes.stock_pieces], 0, 0),
      unit_kind: normalizeUnitKind(row[indexes.unit_kind]),
      cost_price: Math.max(0, parseNumberCell(row[indexes.cost_price], 0)),
      expiry_date: parseDateCell(row[indexes.expiry_date]),
      low_stock_alert: parseIntCell(row[indexes.low_stock_alert], 10, 0),
    });
  }
  console.log(`[parseInventoryImportRows] Processed ${rows.length} rows, parsed ${parsed.length} products`);
  return parsed;
}
