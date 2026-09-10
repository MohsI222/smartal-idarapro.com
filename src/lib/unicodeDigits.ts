/**
 * Map Unicode decimal digit code points to Western ASCII 0–9 (Eastern Arabic, Devanagari, etc.).
 * Used after Intl `numberingSystem: "latn"` and in `toWesternDigits` for UI / PDF.
 *
 * Common Indic digit blocks (U+0660–U+0669, U+06F0–U+06F9, etc.) are normalized first with regex, then
 * any other Unicode digit block is handled per code point.
 */
const RE_ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g; /* U+0660–U+0669 */
const RE_EXT_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g; /* U+06F0–U+06F9 */

function applyArabicIndicRegexPass(s: string): string {
  return s
    .replace(RE_ARABIC_INDIC_DIGITS, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(RE_EXT_ARABIC_INDIC_DIGITS, (ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return String(cp - 0x06f0);
    });
}

function unicodeDigitToWesternChar(ch: string): string {
  const cp = ch.codePointAt(0);
  if (cp == null) return ch;
  if (cp >= 0x30 && cp <= 0x39) return ch;
  if (cp >= 0x0660 && cp <= 0x0669) return String(cp - 0x0660);
  if (cp >= 0x06f0 && cp <= 0x06f9) return String(cp - 0x06f0);
  if (cp >= 0x0966 && cp <= 0x096f) return String(cp - 0x0966);
  if (cp >= 0x09e6 && cp <= 0x09ef) return String(cp - 0x09e6);
  if (cp >= 0xff10 && cp <= 0xff19) return String(cp - 0xff10);
  if (cp >= 0x17e0 && cp <= 0x17e9) return String(cp - 0x17e0);
  if (cp >= 0x1810 && cp <= 0x1819) return String(cp - 0x1810);
  if (cp >= 0x0a66 && cp <= 0x0a6f) return String(cp - 0x0a66);
  if (cp >= 0x0f20 && cp <= 0x0f29) return String(cp - 0x0f20);
  if (cp >= 0x1040 && cp <= 0x1049) return String(cp - 0x1040);
  return ch;
}

export function toWesternDigits(input: string | number): string {
  const afterRegex = applyArabicIndicRegexPass(String(input));
  let out = "";
  for (const ch of afterRegex) {
    out += unicodeDigitToWesternChar(ch);
  }
  return out;
}
