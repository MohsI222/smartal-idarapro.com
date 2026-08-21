/**
 * طبقة موحّدة لمعالجة Excel / Word في المتصفح — أخطاء مع toast، واستيراد ديناميكي عند الحاجة.
 * يستخدم API لحفظ المستندات بدلاً من LocalStorage لعزل البيانات.
 */
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { APP_BRANDING, hexToExcelArgb } from "@/config/branding";
import { applyBordersToRange, styleDataRow, styleHeaderRow } from "@/lib/excelStyles";
import { ensureExportLibrariesReady } from "@/lib/exportLibraries";
import { api } from "@/lib/api";

export function sanitizeSheetName(name: string): string {
  const s = name.replace(/[:\\/?*\[\]]/g, "_").trim() || "Sheet1";
  return s.length > 31 ? s.slice(0, 31) : s;
}

export function sheetToAoa(ws: XLSX.WorkSheet): (string | number | null)[][] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: (string | number | null)[][] = [];
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const row: (string | number | null)[] = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) {
        row.push("");
        continue;
      }
      if (cell.t === "n") row.push(cell.v as number);
      else if (cell.t === "b") row.push(cell.v ? 1 : 0);
      else if (cell.t === "d")
        row.push(cell.v instanceof Date ? cell.v.toISOString().slice(0, 10) : String(cell.v));
      else row.push(cell.w ?? String(cell.v ?? ""));
    }
    rows.push(row);
  }
  return rows;
}

export async function readXlsxWorkbookFromFile(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array" });
}

export async function readXlsxWorkbookFromArrayBuffer(buf: ArrayBuffer): Promise<XLSX.WorkBook> {
  return XLSX.read(buf, { type: "array" });
}

/** معاينة HTML لـ .docx (مكتبة ثقيلة — لا تستورد إلا عند الطلب) */
export async function previewDocxAsHtml(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const res = await mammoth.convertToHtml({ arrayBuffer: buf });
  return res.value || "";
}

export type StashedOfficeFile = {
  id: string;
  name: string;
  kind: "xlsx" | "docx";
  base64: string;
  savedAt: string;
};

const MAX_STASH = 8;
const MAX_BYTES = 1_200_000;

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    if (document.body.contains(a)) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// API-based functions for office documents
export async function listOfficeStash(token?: string): Promise<StashedOfficeFile[]> {
  try {
    if (!token) return [];
    const response = await api<{ documents: any[] }>('/exported-documents', { token });
    const documents = response.documents || [];
    
    // Filter for office documents only and transform to StashedOfficeFile format
    return documents
      .filter((doc: any) => ['xlsx', 'xls', 'docx'].includes(doc.document_kind))
      .map((doc: any) => ({
        id: doc.id,
        name: doc.filename || doc.title,
        kind: doc.document_kind === 'xls' ? 'xlsx' : doc.document_kind as "xlsx" | "docx",
        base64: '', // Base64 not stored in DB, loaded on demand
        savedAt: doc.export_timestamp,
      }));
  } catch (error) {
    console.error('Failed to list office stash from API:', error);
    return [];
  }
}

export async function saveOfficeFileToStash(file: File, token?: string): Promise<StashedOfficeFile | null> {
  if (!token) {
    toast.error("Authentication required");
    return null;
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const kind: "xlsx" | "docx" | null = ext === "xlsx" || ext === "xls" ? "xlsx" : ext === "docx" ? "docx" : null;
  if (!kind) {
    toast.error("Only .xlsx or .docx");
    return null;
  }

  return new Promise<StashedOfficeFile | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const b64 = dataUrl.split(",")[1] ?? "";
        const approx = Math.floor((b64.length * 3) / 4);
        if (approx > MAX_BYTES) {
          toast.error("File too large");
          resolve(null);
          return;
        }

        // Save to API
        const response = await api<{ id: string }>('/exported-documents', {
          method: 'POST',
          token,
          body: JSON.stringify({
            document_kind: kind,
            title: file.name,
            filename: file.name,
            file_size: file.size,
            export_timestamp: new Date().toISOString(),
            metadata: { base64: b64 },
          }),
        });

        const entry: StashedOfficeFile = {
          id: response.id || uid(),
          name: file.name,
          kind,
          base64: b64,
          savedAt: new Date().toISOString(),
        };

        toast.success("Saved to server");
        resolve(entry);
      } catch (error) {
        console.error('Failed to save office file to API:', error);
        toast.error("Could not save file");
        resolve(null);
      }
    };
    reader.onerror = () => {
      toast.error("Read failed");
      resolve(null);
    };
    reader.readAsDataURL(file);
  });
}

export async function removeOfficeStashEntry(id: string, token?: string): Promise<void> {
  if (!token) {
    toast.error("Authentication required");
    return;
  }

  try {
    await api(`/exported-documents/${id}`, {
      method: 'DELETE',
      token,
    });
    toast.success("Deleted successfully");
  } catch (error) {
    console.error('Failed to remove office stash entry:', error);
    toast.error("Could not delete file");
  }
}

export async function clearOfficeStash(token?: string): Promise<void> {
  if (!token) {
    toast.error("Authentication required");
    return;
  }

  try {
    const documents = await listOfficeStash(token);
    for (const doc of documents) {
      await removeOfficeStashEntry(doc.id, token);
    }
    toast.success("All files deleted");
  } catch (error) {
    console.error('Failed to clear office stash:', error);
    toast.error("Could not clear files");
  }
}

/** تنزيل مصفوفة كجدول Excel مع ألوان الهوية */
export async function exportBrandedTableXlsx(opts: {
  sheetName: string;
  rows: (string | number | null | undefined)[][];
  fileName: string;
  titleRow?: string;
}): Promise<void> {
  await ensureExportLibrariesReady().catch(() => undefined);
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_BRANDING.businessName;
  wb.company = APP_BRANDING.businessName;
  const primary = hexToExcelArgb(APP_BRANDING.primaryHex);
  const secondary = hexToExcelArgb(APP_BRANDING.secondaryHex);
  const sn = sanitizeSheetName(opts.sheetName);
  const maxCols = Math.max(1, ...opts.rows.map((r) => r.length));
  const ws = wb.addWorksheet(sn, {
    views: [{ rightToLeft: /[\u0600-\u06FF]/.test(sn) }],
  });

  let rowIdx = 1;
  if (opts.titleRow) {
    const tr = ws.getRow(rowIdx);
    tr.getCell(1).value = opts.titleRow;
    tr.getCell(1).font = { bold: true, size: 14, color: { argb: primary } };
    tr.getCell(1).alignment = { horizontal: "center" };
    ws.mergeCells(rowIdx, 1, rowIdx, maxCols);
    rowIdx += 1;
  }

  const meta = ws.getRow(rowIdx);
  meta.getCell(1).value = APP_BRANDING.businessName;
  meta.getCell(1).font = { italic: true, color: { argb: secondary } };
  rowIdx += 1;

  const dataStart = rowIdx;
  opts.rows.forEach((dataRow, i) => {
    const r = ws.getRow(rowIdx + i);
    dataRow.forEach((cell, c) => {
      r.getCell(c + 1).value = cell ?? "";
    });
    if (opts.rows.length >= 2 && i === 0) styleHeaderRow(r);
    else styleDataRow(r, i % 2 === 1);
  });

  const endR = rowIdx + opts.rows.length - 1;
  applyBordersToRange(ws, dataStart, Math.max(dataStart, endR), 1, maxCols);

  const buf = await wb.xlsx.writeBuffer();
  const name = opts.fileName.endsWith(".xlsx") ? opts.fileName : `${opts.fileName}.xlsx`;
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, name);
}

/** مستند Word بسيط — عنوان + جدول */
export async function exportBrandedTableDocx(opts: {
  title: string;
  rows: (string | number | null | undefined)[][];
  fileName: string;
}): Promise<void> {
  await ensureExportLibrariesReady().catch(() => undefined);
  const docx = await import("docx");
  const {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TextRun,
    WidthType,
    AlignmentType,
    HeadingLevel,
  } = docx;

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({
      text: APP_BRANDING.businessName,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: opts.title, bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  ];

  if (opts.rows.length) {
    const tableRows = opts.rows.map(
      (cells) =>
        new TableRow({
          children: cells.map(
            (c) =>
              new TableCell({
                children: [new Paragraph(String(c ?? ""))],
                width: { size: Math.max(10, 100 / Math.max(1, cells.length)), type: WidthType.PERCENTAGE },
              })
          ),
        })
    );
    children.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const name = opts.fileName.endsWith(".docx") ? opts.fileName : `${opts.fileName}.docx`;
  triggerDownload(blob, name);
}

export async function withFileToast<T>(fn: () => Promise<T>, errLabel = "File operation failed"): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    toast.error(`${errLabel}: ${msg}`);
    return undefined;
  }
}
