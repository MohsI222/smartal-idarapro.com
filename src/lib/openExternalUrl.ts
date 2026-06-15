/** فتح رابط رسمي في نافذة/متصفح منفصل — أنسب لـ PWA standalone والـ WebView */
export function openExternalUrl(
  url: string,
  event?: { preventDefault(): void; stopPropagation(): void }
): void {
  event?.preventDefault();
  event?.stopPropagation();
  const u = url.trim();
  if (!u) return;
  try {
    const w = globalThis.open(u, "_blank", "noopener,noreferrer");
    if (w == null) globalThis.location.assign(u);
  } catch {
    globalThis.location.assign(u);
  }
}
