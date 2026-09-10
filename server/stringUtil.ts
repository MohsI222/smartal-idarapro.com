/** إزالة وسوم HTML وتقليل طول النصوص الواردة من العميل (حد أدنى من حماية XSS في واجهات المصادقة) */
export function sanitizeUserDisplayName(raw: string, maxLen = 120): string {
  const s = String(raw ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  return s.slice(0, maxLen);
}

export function sanitizeEmail(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
}
