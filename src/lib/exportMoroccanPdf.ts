/** إعادة تصدير للتوافق — التنفيذ في pdfExport */
export {
  PDF_MAIN_TITLE,
  buildPdfTableHtml,
  escapeHtmlPdf,
  exportSmartAlIdaraPdf,
  exportSmartAlIdaraPdfPreferBackend,
  exportElementToPdf,
} from "./pdfExport";

import * as XLSX from "xlsx";

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  console.log("downloadCsv called with:", { filename, rowsCount: rows.length });
  if (rows.length === 0) {
    console.log("No rows to export");
    return;
  }

  try {
    // Create worksheet from data
    const worksheet = XLSX.utils.json_to_sheet(rows);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    
    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    
    // Create blob
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    console.log("Excel blob created, size:", blob.size);
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.replace(".csv", ".xlsx");
    link.style.display = "none";
    document.body.appendChild(link);
    
    console.log("Link appended to DOM, clicking...");
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log("Link removed and URL revoked");
    }, 100);
  } catch (error) {
    console.error("Error downloading Excel:", error);
  }
}
