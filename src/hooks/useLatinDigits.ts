import { useI18n } from "@/i18n/I18nProvider";

/** Global: normalize any displayed string to Western digits (0–9) before render. */
export function useLatinDigits(): (s: string) => string {
  return useI18n().latinize;
}
