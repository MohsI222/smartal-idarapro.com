import { Globe } from "lucide-react";
import { LOCALES, LOCALE_LABELS, type AppLocale } from "@/i18n/strings";
import { useI18n } from "@/i18n/I18nProvider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Globe className="size-4 text-orange-400 shrink-0" aria-hidden />
      <label className="sr-only">{t("common.language")}</label>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as AppLocale)}
        className="h-9 rounded-lg border border-slate-600 bg-slate-900/80 px-2 text-sm text-slate-200 max-w-[200px]"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
