import { toWesternDigits } from "@/lib/unicodeDigits";

/** هروب HTML للطباعة ووثائق HTML المضمّنة — لا يعتمد على مسار PDF بالكانفاس */
export function escapeHtmlPdf(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `escapeHtmlPdf` + normalize any Unicode digit runs to U+0030–39. */
export function escapeHtmlPdfLatin(s: string) {
  return escapeHtmlPdf(toWesternDigits(s));
}
