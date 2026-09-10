import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatLatinNumber } from "@/lib/latinNumeralFormat";

export { toWesternDigits } from "@/lib/unicodeDigits";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Western digits (0–9) via `en-US` + `numberingSystem: "latn"` — same policy as `useI18n().formatNumber`. */
export function formatWesternNumber(
  n: number,
  options?: Intl.NumberFormatOptions
): string {
  return formatLatinNumber(n, options);
}
