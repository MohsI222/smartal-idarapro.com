/**
 * Latin digits (1, 2, 3 …): production uses `numberingSystem: "latn"` for formatNumber/formatDateTime,
 * `import.meta.env.PROD` forces numeral mode + `document.documentElement.dataset.numerals`, and
 * `src/index.css` sets lining/tabular numeric features on `html` (pairs with the production build).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppLocale } from "./strings";
import { LOCALES, translate } from "./strings";

const STORAGE_KEY = "idara_locale";
const NUMERAL_KEY = "idara_numeral";

export type NumeralStyle = "latin" | "arabic";

type Ctx = {
  locale: AppLocale;
  setLocale: (l: AppLocale) => void;
  /** Replace `{name}`-style placeholders when `params` is passed */
  t: (key: string, params?: Record<string, string>) => string;
  isRtl: boolean;
  numeralStyle: NumeralStyle;
  setNumeralStyle: (s: NumeralStyle) => void;
  /** أرقام لاتينية (0–9) دائماً — متسقة في الواجهة والتقارير */
  formatNumber: (n: number, options?: Intl.NumberFormatOptions) => string;
  /** Dates/times with Latin digits (0–9), localized calendar */
  formatDateTime: (input: Date | number | string) => string;
};

const I18nContext = createContext<Ctx | null>(null);

function detectInitial(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY) as AppLocale | null;
  if (saved && LOCALES.includes(saved)) return saved;
  const nav = navigator.language?.toLowerCase() ?? "en";
  if (nav.startsWith("ar")) {
    return nav.includes("sa") ? "ar-SA" : "ar-MA";
  }
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("es")) return "es";
  return "en";
}

function detectNumeral(): NumeralStyle {
  if (import.meta.env.PROD) return "latin";
  const s = localStorage.getItem(NUMERAL_KEY) as NumeralStyle | null;
  if (s === "latin" || s === "arabic") return s;
  const loc = detectInitial();
  return loc.startsWith("ar") ? "arabic" : "latin";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(detectInitial);
  const [numeralStyle, setNumeralStyleState] = useState<NumeralStyle>(detectNumeral);

  const setLocale = useCallback((l: AppLocale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const setNumeralStyle = useCallback((s: NumeralStyle) => {
    setNumeralStyleState(s);
    localStorage.setItem(NUMERAL_KEY, s);
  }, []);

  const isRtl = locale === "ar-MA" || locale === "ar-SA";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    if (import.meta.env.PROD) {
      document.documentElement.dataset.numerals = "latin";
    }
  }, [locale, isRtl]);

  const t = useCallback((key: string, params?: Record<string, string>) => {
    let s = translate(locale, key);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.split(`{${k}}`).join(v);
      }
    }
    return s;
  }, [locale]);

  const formatNumber = useCallback(
    (n: number, options?: Intl.NumberFormatOptions) => {
      try {
        return new Intl.NumberFormat(locale, { ...options, numberingSystem: "latn" }).format(n);
      } catch {
        return String(n);
      }
    },
    [locale]
  );

  const formatDateTime = useCallback(
    (input: Date | number | string) => {
      const ms =
        typeof input === "string"
          ? new Date(input).getTime()
          : input instanceof Date
            ? input.getTime()
            : input;
      if (!Number.isFinite(ms)) return "";
      try {
        return new Intl.DateTimeFormat(locale, {
          numberingSystem: "latn",
          dateStyle: "short",
          timeStyle: "short",
        }).format(ms);
      } catch {
        return new Date(ms).toISOString();
      }
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      isRtl,
      numeralStyle,
      setNumeralStyle,
      formatNumber,
      formatDateTime,
    }),
    [locale, setLocale, t, isRtl, numeralStyle, setNumeralStyle, formatNumber, formatDateTime]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}
