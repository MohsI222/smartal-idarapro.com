import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert Eastern-Arabic / Persian / Hindi digits (٠١٢٣…) to Western digits (0123…) */
export function toWesternDigits(input: string | number): string {
  return String(input).replace(/[٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹]/g, (d) => {
    const code = d.charCodeAt(0);
    // Eastern-Arabic: U+0660–U+0669
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    // Extended Arabic-Indic (Persian/Urdu): U+06F0–U+06F9
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    return d;
  });
}

/** Format a number always with Western digits, no locale-specific grouping surprises */
export function formatWesternNumber(
  n: number,
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat("en-US", {
      ...options,
      numberingSystem: "latn",
    }).format(n);
  } catch {
    return String(n);
  }
}
