import { toWesternDigits } from "@/lib/unicodeDigits";

/**
 * BCP-47 `u-nu-latn` forces the Unicode Latin numbering system; adds `numberingSystem: "latn"` in options.
 * Prevents Eastern Arabic–Indic digit shaping from macOS even if a property is ignored in some runtimes.
 */
export const INTL_EN_US_WITH_LATN_NUMERALS = "en-US-u-nu-latn" as const;
/** All Arabic `Intl` long dates use ar-MA + Latin numerals (per product: no Eastern-Arabic digit run). */
export const INTL_AR_MA_WITH_LATN_NUMERALS = "ar-MA-u-nu-latn" as const;

export type AppNumericFormatLocale = typeof INTL_EN_US_WITH_LATN_NUMERALS;

/** @deprecated use {@link INTL_EN_US_WITH_LATN_NUMERALS} */
export const NUMERIC_FORMAT_LOCALE_EN = INTL_EN_US_WITH_LATN_NUMERALS;

export function resolveNumericFormatLocale(_appLocale?: string): AppNumericFormatLocale {
  return INTL_EN_US_WITH_LATN_NUMERALS;
}

function intlTagForLongDateNonArabic(uiLocale: string): string {
  const u = (uiLocale || "en").trim();
  if (u === "fr" || u.toLowerCase().startsWith("fr-")) return "fr-FR-u-nu-latn";
  if (u === "en" || u.toLowerCase().startsWith("en-")) return "en-US-u-nu-latn";
  if (u === "es" || u.toLowerCase().startsWith("es-")) return "es-u-nu-latn";
  return "en-US-u-nu-latn";
}

function sanitizeNumString(s: string): string {
  return toWesternDigits(s);
}

export function formatLatinNumber(
  n: number,
  options?: Intl.NumberFormatOptions,
  intlLocale: AppNumericFormatLocale = INTL_EN_US_WITH_LATN_NUMERALS
): string {
  try {
    return sanitizeNumString(
      new Intl.NumberFormat(intlLocale, {
        ...options,
        numberingSystem: "latn",
      }).format(n)
    );
  } catch {
    return sanitizeNumString(String(n));
  }
}

/**
 * Short date+time; digits always 0–9. Locale is `en-US` only.
 */
export function formatLatinDateTime(
  input: Date | number | string,
  intlLocale: AppNumericFormatLocale = INTL_EN_US_WITH_LATN_NUMERALS
): string {
  const ms =
    typeof input === "string"
      ? new Date(input).getTime()
      : input instanceof Date
        ? input.getTime()
        : input;
  if (!Number.isFinite(ms)) return "";
  try {
    return sanitizeNumString(
      new Intl.DateTimeFormat(intlLocale, {
        numberingSystem: "latn",
        dateStyle: "short",
        timeStyle: "short",
      }).format(ms)
    );
  } catch {
    return sanitizeNumString(new Date(ms).toISOString());
  }
}

/**
 * Time of day (24h) with Latin digits — for chat, logs, etc.
 */
export function formatLatinTime(
  input: Date | number = new Date(),
  intlLocale: AppNumericFormatLocale = INTL_EN_US_WITH_LATN_NUMERALS
): string {
  const ms = typeof input === "number" ? input : input.getTime();
  if (!Number.isFinite(ms)) return "";
  try {
    return sanitizeNumString(
      new Intl.DateTimeFormat(intlLocale, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        numberingSystem: "latn",
      }).format(ms)
    );
  } catch {
    return sanitizeNumString(
      new Date(ms).toLocaleTimeString(INTL_EN_US_WITH_LATN_NUMERALS, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        numberingSystem: "latn",
      })
    );
  }
}

/**
 * Long date: Arabic always uses `ar-MA` + `u-nu-latn`; other languages use that locale + `u-nu-latn`.
 */
export function formatLocalLongDateLatinDigits(
  d: Date,
  uiLocale: string
): string {
  const ar = /^ar/i.test((uiLocale || "").trim());
  const tag = ar ? INTL_AR_MA_WITH_LATN_NUMERALS : intlTagForLongDateNonArabic(uiLocale);
  try {
    return sanitizeNumString(
      new Intl.DateTimeFormat(tag, {
        year: "numeric",
        month: "long",
        day: "numeric",
        numberingSystem: "latn",
      }).format(d)
    );
  } catch {
    return sanitizeNumString(
      d.toLocaleDateString(INTL_EN_US_WITH_LATN_NUMERALS, {
        year: "numeric",
        month: "long",
        day: "numeric",
        numberingSystem: "latn",
      })
    );
  }
}

/**
 * Fixed `dd/MM/yyyy` with ASCII digits (e.g. 25/04/2026) — forms & Smart Editor label,
 * independent of system locale. Does not use OS/Browser `Intl` resolution for the pattern.
 */
export function formatLatinDateDMY(d: Date): string {
  if (!Number.isFinite(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** Parse an ISO `YYYY-MM-DD` (from `<input type="date">`) to `dd/MM/yyyy` in Latin digits. */
export function formatLatinDateDMYFromIsoDate(iso: string): string {
  if (!iso?.trim()) return "";
  const d = new Date(`${iso.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return sanitizeNumString(String(iso));
  return formatLatinDateDMY(d);
}

/**
 * en-GB short date with Latin numerals — equivalent in intent to
 * Same intent as `toLocaleDateString("en-GB", { numberingSystem: "latn" })`.
 */
export function formatEnGbShortDateLatin(d: Date): string {
  if (!Number.isFinite(d.getTime())) return "";
  return sanitizeNumString(
    new Intl.DateTimeFormat("en-GB", {
      numberingSystem: "latn",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d)
  );
}
