/**
 * Global barcode lookup: Open Food Facts (primary, no API key, CORS-friendly).
 * Barcode Lookup and similar APIs typically require keys; we surface OFF data for inventory pre-fill.
 */

export type GlobalBarcodeProduct = {
  barcode: string;
  name: string;
  categoryLabel: string;
  imageUrl: string | null;
  /** Maps to inventory `retail_type` options */
  suggestedRetailType:
    | "grocery"
    | "supermarket"
    | "pharmacy"
    | "bookstore"
    | "cafe"
    | "hardware"
    | "retail";
};

const FOOD_USER_AGENT = "SmartAlIdaraPro/1.0 (https://github.com/openfoodfacts)";

function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "").trim();
}

function inferRetailType(categories: string, tags: string[] | undefined): GlobalBarcodeProduct["suggestedRetailType"] {
  const hay = `${categories} ${(tags ?? []).join(" ")}`.toLowerCase();
  if (/(pharmac|drug|medication|health)/i.test(hay)) return "pharmacy";
  if (/(book|library|stationery)/i.test(hay)) return "bookstore";
  if (/(coffee|tea|cafe|café)/i.test(hay)) return "cafe";
  if (/(diy|hardware|tool|paint)/i.test(hay)) return "hardware";
  if (/(supermarket|hypermarket|grocery|food|beverage|snack|dairy|frozen)/i.test(hay)) {
    return /supermarket|hypermarket/i.test(hay) ? "supermarket" : "grocery";
  }
  return "retail";
}

/**
 * Fetches product metadata from Open Food Facts (world database).
 */
export async function lookupBarcodeOpenFoodFacts(rawBarcode: string): Promise<GlobalBarcodeProduct | null> {
  const barcode = normalizeBarcode(rawBarcode);
  if (barcode.length < 8 || barcode.length > 14) return null;

  const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
  const ac = new AbortController();
  const to = window.setTimeout(() => ac.abort(), 18_000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": FOOD_USER_AGENT },
      signal: ac.signal,
    });
  } catch {
    return null;
  } finally {
    window.clearTimeout(to);
  }
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status?: number;
    product?: {
      product_name?: string;
      product_name_en?: string;
      product_name_fr?: string;
      generic_name?: string;
      brands?: string;
      categories?: string;
      categories_tags?: string[];
      image_front_url?: string;
      image_url?: string;
    };
  };

  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const name = (
    p.product_name ||
    p.product_name_en ||
    p.product_name_fr ||
    p.generic_name ||
    ""
  ).trim();
  if (!name) return null;

  const categoryLabel = (p.categories || "").split(",").map((s) => s.trim()).filter(Boolean)[0] || "—";
  const imageUrl = p.image_front_url || p.image_url || null;

  return {
    barcode,
    name,
    categoryLabel,
    imageUrl,
    suggestedRetailType: inferRetailType(p.categories || "", p.categories_tags),
  };
}
