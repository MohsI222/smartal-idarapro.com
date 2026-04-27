/**
 * All UI locales (ar-MA, ar-SA, fr, en, es) use Latin digits in formatting only (numberingSystem latn / u-nu-latn).
 * Use with `Intl` / `toWesternDigits` / `u-nu-latn` BCP-47 extension as implemented in `latinNumeralFormat`.
 */
export const I18N_NUMBERING_SYSTEM = "latn" as const;

export const I18N_INTL_DEFAULTS = { numberingSystem: I18N_NUMBERING_SYSTEM } as const;
