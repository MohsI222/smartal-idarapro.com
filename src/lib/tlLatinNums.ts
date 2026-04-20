/**
 * أرقام لاتينية (0123…) لسجل النقل واللوجستيك — ثابتة بغض النظر عن لغة الواجهة.
 */
export function formatTlLatinInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-US", { numberingSystem: "latn", maximumFractionDigits: 0 }).format(
    Number(n)
  );
}

export function formatTlLatinNum(n: number | null | undefined, maxFrac = 2): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-US", { numberingSystem: "latn", maximumFractionDigits: maxFrac }).format(
    Number(n)
  );
}

/** Dates/times for PDF and print views — always Western digits (0–9). */
export function formatLatinDateTime(locale: string, date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      numberingSystem: "latn",
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString("en-US", { numberingSystem: "latn" });
  }
}

/** عرض أرقام داخل سلسلة (مثل طوابع زمنية) بأرقام لاتينية */
export function ensureLatinDigitsInString(s: string): string {
  const east = "٠١٢٣٤٥٦٧٨٩";
  const west = "0123456789";
  let out = "";
  for (const ch of s) {
    const i = east.indexOf(ch);
    out += i >= 0 ? west[i]! : ch;
  }
  return out;
}
