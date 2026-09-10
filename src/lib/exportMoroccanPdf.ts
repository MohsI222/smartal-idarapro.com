/** إعادة تصدير للتوافق — التنفيذ في pdfExport */
export {
  PDF_MAIN_TITLE,
  buildPdfTableHtml,
  escapeHtmlPdf,
  exportSmartAlIdaraPdf,
  exportSmartAlIdaraPdfPreferBackend,
  exportElementToPdf,
} from "./pdfExport";

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const bom = "\uFEFF";
  const header = keys.join(";") + "\n";
  const body = rows.map((r) => keys.map((k) => esc(r[k])).join(";")).join("\n");
  const blob = new Blob([bom + header + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
