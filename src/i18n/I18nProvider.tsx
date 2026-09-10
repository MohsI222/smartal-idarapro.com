/**
 * Digits: `t()` and `latinize()` run `toWesternDigits`; formatNumber / formatDateTime use `en-US` + `numberingSystem: "latn"`.
 * `data-numerals` + `index.css` pair with that.
 */
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppLocale } from "./strings";
import { LOCALES, translate } from "./strings";
export { I18N_INTL_DEFAULTS, I18N_NUMBERING_SYSTEM } from "./localeConfig";
import {
  formatLatinDateDMYFromIsoDate,
  formatLatinDateTime,
  formatLatinNumber,
  INTL_EN_US_WITH_LATN_NUMERALS,
} from "@/lib/latinNumeralFormat";
import { toWesternDigits } from "@/lib/unicodeDigits";

const STORAGE_KEY = "idara_locale";

/** BCP-47 `lang`: include `-u-nu-latn` so user agents prefer Latin digit glyphs with Arabic script. */
function documentHtmlLangAndNumeralSystem(locale: AppLocale): string {
  switch (locale) {
    case "ar-MA":
      return "ar-MA-u-nu-latn";
    case "ar-SA":
      return "ar-SA-u-nu-latn";
    case "fr":
      return "fr-FR-u-nu-latn";
    case "en":
      return "en-US-u-nu-latn";
    case "es":
      return "es-u-nu-latn";
    default:
      return "en-US-u-nu-latn";
  }
}

type Ctx = {
  locale: AppLocale;
  setLocale: (l: AppLocale) => void;
  /** Replace `{name}`-style placeholders when `params` is passed; output is always passed through `latinize` */
  t: (key: string, params?: Record<string, string>) => string;
  isRtl: boolean;
  /** Map any Indic / Eastern-Arabic digit code points in a string to 0–9 (use on raw API text before display). */
  latinize: (s: string) => string;
  /** `YYYY-MM-DD` from date inputs → `dd/MM/yyyy` with Latin digits (e.g. 25/04/2026) */
  formatIsoDateAsDMY: (iso: string) => string;
  /** أرقام لاتينية (0–9) دائماً — متسقة في الواجهة والتقارير */
  formatNumber: (n: number, options?: Intl.NumberFormatOptions) => string;
  /** Dates/times with Latin digits (0–9) — en-US Intl + latn */
  formatDateTime: (input: Date | number | string) => string;
};

const I18nContext = createContext<Ctx | null>(null);

function normalizeLocaleTag(raw: string | null): AppLocale | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (LOCALES.includes(raw as AppLocale)) return raw as AppLocale;
  if (lower.startsWith("ar")) {
    if (lower === "ar-sa" || lower.startsWith("ar-sa")) return "ar-SA";
    return "ar-MA";
  }
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("en")) return "en";
  return null;
}

function detectInitial(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY);
  const fromSaved = normalizeLocaleTag(saved);
  if (fromSaved) {
    if (saved && fromSaved !== saved) {
      try {
        localStorage.setItem(STORAGE_KEY, fromSaved);
      } catch {
        /* ignore */
      }
    }
    return fromSaved;
  }
  const nav = (navigator.language?.toLowerCase() ?? "en").split(",")[0]?.trim() ?? "en";
  if (nav.startsWith("ar")) {
    return nav.startsWith("ar-sa") ? "ar-SA" : "ar-MA";
  }
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("es")) return "es";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(detectInitial);

  const setLocale = useCallback((l: AppLocale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const isRtl = locale === "ar-MA" || locale === "ar-SA";

  useLayoutEffect(() => {
    document.documentElement.lang = documentHtmlLangAndNumeralSystem(locale);
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.dataset.numerals = "latin";

    // On every locale change, immediately sweep the full DOM to replace any
    // Arabic-Indic digits that were produced under the previous locale settings.
    if (typeof document !== "undefined" && document.body) {
      const sweep = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const raw = node.nodeValue;
          if (raw && /[\u0660-\u0669\u06F0-\u06F9]/.test(raw)) {
            node.nodeValue = toWesternDigits(raw);
          }
          return;
        }
        const tag = node.nodeType === Node.ELEMENT_NODE ? (node as Element).tagName : "";
        if (["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "CODE", "PRE"].includes(tag)) return;
        for (const c of node.childNodes) sweep(c);
      };
      sweep(document.body);
    }
  }, [locale, isRtl]);

  const latinize = useCallback((s: string) => toWesternDigits(s), []);

  const t = useCallback(
    (key: string, params?: Record<string, string>) => {
      let s = translate(locale, key);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          s = s.split(`{${k}}`).join(v);
        }
      }
      return latinize(s);
    },
    [locale, latinize]
  );

  const formatIsoDateAsDMY = useCallback(
    (iso: string) => formatLatinDateDMYFromIsoDate(iso),
    []
  );

  const formatNumber = useCallback(
    (n: number, options?: Intl.NumberFormatOptions) => formatLatinNumber(n, options, INTL_EN_US_WITH_LATN_NUMERALS),
    []
  );

  const formatDateTime = useCallback(
    (input: Date | number | string) => formatLatinDateTime(input, INTL_EN_US_WITH_LATN_NUMERALS),
    []
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      isRtl,
      latinize,
      formatIsoDateAsDMY,
      formatNumber,
      formatDateTime,
    }),
    [locale, setLocale, t, isRtl, latinize, formatIsoDateAsDMY, formatNumber, formatDateTime]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}
