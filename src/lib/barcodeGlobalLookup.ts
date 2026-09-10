/**
 * Global barcode lookup: Open Food Facts (primary, no API key, CORS-friendly).
 * UPC Database (secondary, free, CORS-friendly) for additional price data.
 * Barcode Lookup and similar APIs typically require keys; we surface OFF data for inventory pre-fill.
 */

export type GlobalBarcodeProduct = {
  barcode: string;
  name: string;
  categoryLabel: string;
  imageUrl: string | null;
  /** السعر المحتمل من قاعدة البيانات العالمية */
  price?: number;
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
      /** السعر من Open Food Facts */
      price?: string;
      /** السعر في الدولار الأمريكي */
      price_usd?: string;
      /** السعر بالعملة المحلية */
      price_local?: string;
      /** كود العملة المحلية */
      code_currency?: string;
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

  // محاولة جلب السعر من Open Food Facts
  let price: number | undefined;
  const rawPrice = p.price || p.price_usd || p.price_local;
  if (rawPrice) {
    const parsedPrice = parseFloat(rawPrice);
    if (!isNaN(parsedPrice) && parsedPrice > 0) {
      price = parsedPrice;
    }
  }

  return {
    barcode,
    name,
    categoryLabel,
    imageUrl,
    price,
    suggestedRetailType: inferRetailType(p.categories || "", p.categories_tags),
  };
}

/**
 * دمج البيانات من مصادر متعددة للحصول على أفضل سعر متاح
 */
export async function lookupBarcodeWithPrice(rawBarcode: string): Promise<GlobalBarcodeProduct | null> {
  // محاولة جلب البيانات من Open Food Facts أولاً
  const offData = await lookupBarcodeOpenFoodFacts(rawBarcode);
  if (offData && offData.price) {
    return offData;
  }
  
  // إذا لم يوجد سعر في Open Food Facts، نرجع البيانات بدون سعر
  return offData;
}
