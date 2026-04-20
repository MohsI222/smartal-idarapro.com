import type { VisionReceiptItem } from "@/lib/inventoryVisionTypes";

/** أشكال خفيفة لمطابقة المخزون — بدون استيراد من الصفحات */
export type ProductLite = {
  id: string;
  name: string;
  sku: string;
  unit_price: number;
  stock_pieces: number;
  pieces_per_carton: number;
};

export type QuickUnit = "piece" | "box" | "bag";

export type DraftLineLike = {
  id: string;
  product_id: string;
  product_name: string;
  qty_pieces: number;
  sale_unit: QuickUnit;
  line_total: number;
};

export function normalizeArabicDigits(s: string): string {
  const ar = "٠١٢٣٤٥٦٧٨٩";
  let out = "";
  for (const ch of s) {
    const i = ar.indexOf(ch);
    out += i >= 0 ? String(i) : ch;
  }
  return out.replace(/،/g, ",").replace(/\u066B/g, ".");
}

function normalizeNameKey(s: string): string {
  return normalizeArabicDigits(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** مطابقة تقريبية بين اسم مستخرج وأسماء المخزون */
export function bestCatalogMatch(name: string, products: ProductLite[]): ProductLite | null {
  const n = normalizeNameKey(name);
  if (n.length < 2) return null;
  let best: ProductLite | null = null;
  let bestScore = 0;
  for (const p of products) {
    const pn = normalizeNameKey(p.name);
    if (!pn) continue;
    if (pn === n) return p;
    let score = 0;
    if (pn.includes(n) || n.includes(pn)) {
      score = Math.min(pn.length, n.length) / Math.max(pn.length, n.length);
    } else {
      const wa = n.split(/\s+/).filter((w) => w.length > 1);
      const wb = pn.split(/\s+/).filter((w) => w.length > 1);
      if (wa.length && wb.length) {
        const hit = wa.filter((w) => wb.some((x) => x.includes(w) || w.includes(x))).length;
        score = hit / Math.max(wa.length, wb.length);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore >= 0.38 ? best : null;
}

/**
 * عند فشل المطابقة بالأسماء: استخراج أرقام من كل سطر (كمية، سعر) لبناء أصناف تقريبية.
 */
export function heuristicReceiptItemsFromPlainText(raw: string): VisionReceiptItem[] {
  const text = normalizeArabicDigits(raw);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
  const out: VisionReceiptItem[] = [];
  for (const line of lines) {
    if (/total|المجموع|tva|ضريبة|sub/i.test(line)) continue;
    const nums = line.match(/\d+(?:[.,]\d+)?/g);
    if (!nums || nums.length < 2) continue;
    const vals = nums.map((x) => parseFloat(x.replace(",", "."))).filter((x) => Number.isFinite(x));
    if (vals.length < 2) continue;
    let qty = Math.max(1, Math.floor(vals[0]));
    let unitPrice = vals[vals.length - 1];
    if (unitPrice > 10000 && vals.length >= 3) {
      unitPrice = vals[vals.length - 1];
      qty = Math.max(1, Math.floor(vals[vals.length - 2]));
    }
    const namePart = line
      .replace(/\d+(?:[.,]\d+)?/g, " ")
      .replace(/[^\p{L}\s-]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (namePart.length < 2) continue;
    if (unitPrice < 0 || unitPrice > 1e7) continue;
    out.push({
      product_name: namePart.slice(0, 200),
      quantity: qty,
      unit_price: Math.round(unitPrice * 10000) / 10000,
    });
  }
  return out;
}

function piecesPerQuickUnit(p: ProductLite, u: QuickUnit): number {
  const ppc = Math.max(1, Math.floor(Number(p.pieces_per_carton) || 1));
  if (u === "piece") return 1;
  return ppc;
}

/**
 * يستخرج أسطراً شبيهة بفاتورة من نص خام (OCR / PDF / Excel كنص).
 */
export function parseDraftLinesFromPlainText(
  raw: string,
  products: ProductLite[],
  quickUnit: QuickUnit
): DraftLineLike[] {
  const text = normalizeArabicDigits(raw);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
  const sorted = [...products].sort((a, b) => b.name.length - a.name.length);
  const out: DraftLineLike[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const p of sorted) {
      const pn = p.name.trim().toLowerCase();
      if (pn.length < 2) continue;
      if (!lower.includes(pn) && !pn.split(/\s+/).every((w) => w.length < 2 || lower.includes(w))) continue;

      const nums = line.match(/\d+(?:[.,]\d+)?/g);
      if (!nums?.length) continue;
      const vals = nums.map((n) => parseFloat(n.replace(",", ".")));
      let qty = 1;
      let unitPrice = p.unit_price;
      if (vals.length >= 2) {
        qty = Math.max(1, Math.floor(vals[0]));
        unitPrice = vals[vals.length - 1];
      } else if (vals.length === 1) {
        qty = Math.max(1, Math.floor(vals[0]));
      }
      const pp = piecesPerQuickUnit(p, quickUnit);
      const qtyPieces = qty * pp;
      const lineTotal = qtyPieces * unitPrice;
      const key = `${p.id}-${qtyPieces}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: crypto.randomUUID(),
        product_id: p.id,
        product_name: p.name,
        qty_pieces: qtyPieces,
        sale_unit: quickUnit,
        line_total: Math.round(lineTotal * 100) / 100,
      });
      break;
    }
  }
  return out;
}

export type StockExtractRow = {
  product_id: string;
  product_name: string;
  /** كمية لإضافتها للمخزون */
  add_pieces: number;
  /** سعر الوحدة إن وُجد */
  unit_price?: number;
};

/**
 * لقسم المخزون: استخراج كميات/أسعار من إيصال يدوي لمطابقة المنتجات وتحديث المخزون.
 */
export function parseStockRowsFromPlainText(raw: string, products: ProductLite[]): StockExtractRow[] {
  const text = normalizeArabicDigits(raw);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
  const sorted = [...products].sort((a, b) => b.name.length - a.name.length);
  const out: StockExtractRow[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const p of sorted) {
      const pn = p.name.trim().toLowerCase();
      if (pn.length < 2) continue;
      if (!lower.includes(pn)) continue;
      const nums = line.match(/\d+(?:[.,]\d+)?/g);
      if (!nums?.length) continue;
      const vals = nums.map((n) => parseFloat(n.replace(",", ".")));
      let add = Math.max(0, Math.floor(vals[0]));
      let unitPrice: number | undefined;
      if (vals.length >= 2) {
        add = Math.max(0, Math.floor(vals[0]));
        unitPrice = vals[vals.length - 1];
      } else if (vals.length === 1) {
        add = Math.max(0, Math.floor(vals[0]));
      }
      if (add <= 0) continue;
      const key = p.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        product_id: p.id,
        product_name: p.name,
        add_pieces: add,
        unit_price: unitPrice,
      });
      break;
    }
  }
  return out;
}

