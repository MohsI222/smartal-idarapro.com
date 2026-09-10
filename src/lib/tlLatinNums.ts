/**
 * أرقام لاتينية (0123…) — `en-US` + `numberingSystem: "latn"` (مثل بقية المنصة).
 */
import {
  formatLatinDateTime as formatLatinDateTimeCore,
  formatLatinNumber,
  INTL_EN_US_WITH_LATN_NUMERALS,
} from "@/lib/latinNumeralFormat";
import { toWesternDigits } from "@/lib/unicodeDigits";

export function formatTlLatinInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return formatLatinNumber(Number(n), { maximumFractionDigits: 0 });
}

export function formatTlLatinNum(n: number | null | undefined, maxFrac = 2): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return formatLatinNumber(Number(n), { maximumFractionDigits: maxFrac });
}

/**
 * @param _appLocaleish Unused — all formatters use en-US + latn (kept for call-site compatibility).
 * @param date Date to format (default: now).
 */
export function formatLatinDateTime(
  _appLocaleish?: string,
  date: Date = new Date()
): string {
  void _appLocaleish;
  return formatLatinDateTimeCore(date, INTL_EN_US_WITH_LATN_NUMERALS);
}

/**
 * @deprecated use `import { toWesternDigits } from "@/lib/utils"`
 */
export function ensureLatinDigitsInString(s: string): string {
  return toWesternDigits(s);
}
