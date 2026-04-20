/**
 * استخراج حقول البطاقة الوطنية المغربية (CNIE) من نص OCR — إرشادي، مع تطبيع وتعدد أنماط.
 */

export type MoroccanIdHints = {
  raw: string;
  /** رقم البطاقة الوطنية */
  cin?: string;
  /** الاسم الكامل */
  fullName?: string;
  /** العنوان */
  address?: string;
  /** هاتف */
  phone?: string;
  /** بريد */
  email?: string;
};

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const LAT_DIGITS = "0123456789";

/** تحويل الأرقام العربية إلى لاتينية وتقليل الضوضاء */
export function normalizeOcrText(text: string): string {
  let s = text;
  for (let i = 0; i < AR_DIGITS.length; i++) {
    s = s.split(AR_DIGITS[i]).join(LAT_DIGITS[i]);
  }
  return s.replace(/\u200f|\u200e/g, "").replace(/[ \t]+/g, " ").replace(/\r/g, "");
}

function linesFromText(text: string): string[] {
  return normalizeOcrText(text)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** استخراج CIN: حرف لاتيني + 5–7 أرقام، مع تصحيح فراغات OCR */
export function extractMoroccanCin(text: string): string | undefined {
  const n = normalizeOcrText(text);
  const patterns: RegExp[] = [
    /\b([A-Z]{1,2})\s*(\d{5,7})\b/gi,
    /\b([A-Z]{1,2})[|\sIl\/\\]+(\d{5,7})\b/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(n)) !== null) {
      const letters = m[1].toUpperCase();
      const digits = m[2];
      if (/^\d+$/.test(digits) && /^[A-Z]+$/.test(letters)) {
        return `${letters}${digits}`;
      }
    }
  }
  const loose = n.match(/\b([A-Z])(\d{6})\b/i);
  if (loose) return `${loose[1].toUpperCase()}${loose[2]}`;
  return undefined;
}

function extractEmail(text: string): string | undefined {
  const m = normalizeOcrText(text).match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
  return m?.[0];
}

function extractPhoneMa(text: string): string | undefined {
  const n = normalizeOcrText(text);
  const spaced = n.match(/(?:\+212|00212)\s*[67]\d(?:\s*\d){7}/);
  if (spaced) return spaced[0].replace(/\s/g, "");
  const plus = n.match(/\+212[67]\d{8}/);
  if (plus) return plus[0];
  const z = n.match(/\b0[67]\d{8}\b/);
  if (z) return z[0];
  const nine = n.match(/\b[67]\d{8}\b/);
  if (nine) return `0${nine[0]}`;
  return undefined;
}

/** قيمة بعد تسمية في نفس السطر أو السطر التالي */
function valueAfterLabel(
  lines: string[],
  labelRe: RegExp,
  reject?: (s: string) => boolean
): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const same = line.match(labelRe);
    if (same) {
      const onLine = (same[1] ?? same[2] ?? "").trim();
      if (onLine && (!reject || !reject(onLine))) return onLine;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const cand = lines[j].replace(/^[:：\-–]\s*/, "").trim();
        if (!cand) continue;
        if (reject && reject(cand)) continue;
        if (/^[\d\s\-+()]+$/.test(cand) && cand.length < 10) continue;
        if (/^[A-Z]{1,2}\d{5,7}$/i.test(cand.replace(/\s/g, ""))) continue;
        return cand;
      }
    }
  }
  return undefined;
}

function buildFullName(lines: string[], _raw: string): string | undefined {
  const nom =
    valueAfterLabel(
      lines,
      /^(?:اللقب|Nom|NOM|nom|Noms?)\s*[:：]?\s*(.+)$/i,
      (s) => /^[\dA-Z]{1,3}$/i.test(s)
    ) ||
    valueAfterLabel(lines, /^(?:الاسم\s*العائلي)\s*[:：]?\s*(.+)$/i);

  const prenom =
    valueAfterLabel(lines, /^(?:الاسم\s*الشخصي|Prénom|PRENOM|prenom|Prenom)\s*[:：]?\s*(.+)$/i) ||
    valueAfterLabel(
      lines,
      /^(?:الاسم)\s*[:：]?\s*(.+)$/i,
      (s) => /اللقب|العنوان|Adresse|الهاتف|Date|N°|CIN/i.test(s)
    );

  if (prenom && nom) {
    const p = prenom.trim();
    const n = nom.trim();
    if (p !== n) return `${p} ${n}`.trim();
    return p || n;
  }
  if (prenom) return prenom.trim();
  if (nom) return nom.trim();

  const fullLine = valueAfterLabel(
    lines,
    /^(?:الاسم\s*الكامل|Nom\s+et\s+prénom|Nom\s+complet|Nom\s+prénom)\s*[:：]?\s*(.+)$/i
  );
  if (fullLine) return fullLine.trim();

  const nameAfterKeyword = valueAfterLabel(
    lines,
    /^(?:الاسم|Name|NAME)\s*[:：]?\s*(.+)$/i,
    (s) => /^(العنوان|Adresse|الهاتف|Date|N°|CIN|البطاقة)/i.test(s)
  );
  if (nameAfterKeyword && nameAfterKeyword.length >= 3) return nameAfterKeyword.trim();

  return undefined;
}

function extractAddress(lines: string[], _raw: string): string | undefined {
  const addr =
    valueAfterLabel(lines, /^(?:العنوان|Adresse|ADRESSE|Address)\s*[:：]?\s*(.+)$/i) ||
    valueAfterLabel(lines, /^(?:السكن|Domicile)\s*[:：]?\s*(.+)$/i);
  if (addr) return addr.replace(/\s+/g, " ").trim();

  const i = lines.findIndex((l) => /^(?:العنوان|Adresse|ADRESSE)\s*$/i.test(l) || /العنوان|Adresse|ADRESSE/i.test(l));
  if (i >= 0) {
    const parts: string[] = [];
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const l = lines[j];
      if (/الهاتف|Tel|Date|Tél|CIN|N°|البطاقة|Prénom|Nom|^[\d\s\-+]{6,}$/i.test(l) && !/شارع|حي|زنقة|جماعة|مدينة|avenue|rue/i.test(l)) {
        if (parts.length > 0) break;
        continue;
      }
      if (l.length > 4) parts.push(l);
      if (parts.length >= 3) break;
    }
    if (parts.length) return parts.join("، ").trim();
  }
  return undefined;
}

/**
 * استخراج إرشادي من نص OCR كامل (بطاقة تعريف مغربية أو وثيقة قريبة).
 */
export function parseMoroccanIdHints(text: string): MoroccanIdHints {
  const raw = text;
  try {
    const lines = linesFromText(text);
    const normalized = normalizeOcrText(text);

    const cin = extractMoroccanCin(normalized);
    const fullName = buildFullName(lines, normalized);
    const address = extractAddress(lines, normalized);
    const email = extractEmail(normalized);
    const phone = extractPhoneMa(normalized);

    return {
      raw,
      ...(cin ? { cin } : {}),
      ...(fullName ? { fullName } : {}),
      ...(address ? { address } : {}),
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
    };
  } catch {
    return { raw };
  }
}
