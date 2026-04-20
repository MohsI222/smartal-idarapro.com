/** هروب HTML للطباعة ووثائق HTML المضمّنة — لا يعتمد على مسار PDF بالكانفاس */
export function escapeHtmlPdf(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
