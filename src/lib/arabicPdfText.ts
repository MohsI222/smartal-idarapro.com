
/**
 * Arabic text shaping and normalization utility for PDF and web display.
 * - Converts Arabic-Indic/Eastern digits to Western digits.
 * - Shapes Arabic text for correct letter connections.
 * Optimized with memoization cache for performance.
 */

import { toWesternDigits } from "@/lib/unicodeDigits";
import { reshape } from "arabic-persian-reshaper";

// Cache for fixArabicText to avoid redundant processing
const fixArabicCache = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;

/**
 * Convert Arabic-Indic and Eastern Arabic-Indic digits to Western digits (0-9).
 */
export function normalizeArabicText(text: string): string {
  if (!text) return "";
  return toWesternDigits(String(text));
}

/**
 * Check if text contains Arabic script characters.
 */
export function hasArabicScript(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Processes Arabic text for display in environments that don't
 * fully support native Arabic shaping, like some PDF generators.
 * - Normalizes digits to Western format.
 * - Shapes Arabic letters for correct contextual forms.
 * It does NOT handle bidi/RTL ordering, as the HTML `dir=rtl` should suffice.
 */
export function fixArabicText(text: any): string {
  if (!text) return "";
  try {
    const str = String(text);
    if (!hasArabicScript(str)) return str;

    if (fixArabicCache.has(str)) {
      return fixArabicCache.get(str)!;
    }

    // 1. Normalize digits (e.g., ١٢٣ -> 123)
    const normalizedDigits = toWesternDigits(str);

    // 2. Reshape Arabic letters for correct contextual forms
    const reshaped = reshape(normalizedDigits);

    // Bidi handling is removed. The HTML dir=rtl attribute should handle text direction.

    // Manage cache size
    if (fixArabicCache.size >= MAX_CACHE_SIZE) {
      const firstKey = fixArabicCache.keys().next().value;
      if (firstKey !== undefined) {
        fixArabicCache.delete(firstKey);
      }
    }
    fixArabicCache.set(str, reshaped);

    return reshaped;
  } catch (error) {
    console.error("Arabic text processing failed:", error);
    return String(text);
  }
}

/**
 * Alias for fixArabicText for backward compatibility.
 */
export function shapeIfArabic(text: any): string {
  return fixArabicText(text);
}

