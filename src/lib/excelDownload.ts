import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { postBackendXlsxStream } from "@/lib/backendExportClient";
import { applyBordersToRange, styleDataRow, styleHeaderRow, styleTitleRow } from "@/lib/excelStyles";
import { ensureExportLibrariesReady } from "@/lib/exportLibraries";

/**
 * تنزيل ‎.xlsx‎ عبر ExcelJS (Office Open XML متوافق مع Excel و Google Sheets).
 * يُحوَّل من مصنف SheetJS عند التصدير؛ الاستيراد يبقى بـ xlsx كما هو.
 */
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

function firstRowLooksLikeHeader(firstRow: (string | number | null)[], hasSecondRow: boolean): boolean {
  if (!hasSecondRow || firstRow.length === 0) return false;
  const strs = firstRow.filter((v) => typeof v === "string" && String(v).trim().length > 0).length;
  const nums = firstRow.filter((v) => typeof v === "number").length;
  if (strs === firstRow.length) return true;
  if (strs >= firstRow.length - 1 && nums === 0) return true;
  return false;
}

async function workbookToExcelJsBuffer(wb: XLSX.WorkBook): Promise<Uint8Array> {
  await ensureExportLibrariesReady();
  const xbook = new ExcelJS.Workbook();
  xbook.creator = "Smart Al-Idara Pro";
  xbook.lastModifiedBy = "Smart Al-Idara Pro";
  xbook.created = new Date();
  xbook.modified = new Date();
  xbook.company = "Smart Al-Idara Pro";

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const aoa = sheetToAoa(ws);
    const sn = sanitizeSheetName(sheetName);
    const rtl = /[\u0600-\u06FF\u0750-\u077F]/.test(sheetName);
    const xws = xbook.addWorksheet(sn, {
      views: [{ rightToLeft: rtl }],
    });

    const cols = ws["!cols"] as { wch?: number }[] | undefined;
    if (cols?.length) {
      xws.columns = cols.map((c) => ({
        width: Math.min(55, Math.max(9, (c.wch ?? 10) + 1.2)),
      }));
    }

    aoa.forEach((row, r) => {
      row.forEach((cell, c) => {
        const cl = xws.getCell(r + 1, c + 1);
        if (typeof cell === "number") cl.value = cell;
        else cl.value = cell ?? "";
      });
    });

    if (aoa.length === 0) continue;

    const maxCol = Math.max(1, ...aoa.map((row) => row.length));
    const headerLike = firstRowLooksLikeHeader(aoa[0] ?? [], aoa.length >= 2);
    if (aoa.length === 1) {
      styleTitleRow(xws.getRow(1));
    } else if (headerLike) {
      styleHeaderRow(xws.getRow(1));
      for (let ri = 2; ri <= aoa.length; ri++) {
        styleDataRow(xws.getRow(ri), ri % 2 === 0);
      }
    } else {
      for (let ri = 1; ri <= aoa.length; ri++) {
        styleDataRow(xws.getRow(ri), ri % 2 === 1);
      }
    }
    applyBordersToRange(xws, 1, aoa.length, 1, maxCol);

    if (headerLike && aoa.length >= 2) {
      xws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: aoa.length, column: maxCol },
      };
    }
  }

  const buf = await xbook.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

function fallbackSheetJsWrite(wb: XLSX.WorkBook): Uint8Array {
  const wbout = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
    bookSST: false,
    compression: true,
  });
  return new Uint8Array(wbout);
}

export function workbookToBackendSheets(wb: XLSX.WorkBook): {
  name: string;
  rows: (string | number | null | undefined)[][];
  rtl: boolean;
  /** عرض الأعمدة للخادم (ExcelJS) — قوالب احترافية */
  columnWidths?: number[];
  /** الصف الأول ترويسة زرقاء (افتراضي: true) */
  headerRow?: boolean;
}[] {
  return wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      return { name: sanitizeSheetName(sheetName), rows: [], rtl: /[\u0600-\u06FF]/.test(sheetName) };
    }
    const aoa = sheetToAoa(ws);
    const cols = ws["!cols"] as { wch?: number }[] | undefined;
    const columnWidths = cols
      ?.map((c) => (typeof c?.wch === "number" ? Math.min(55, Math.max(6, c.wch + 1.2)) : undefined))
      .filter((x): x is number => x != null);
    return {
      name: sanitizeSheetName(sheetName),
      rows: aoa,
      rtl: /[\u0600-\u06FF\u0750-\u077F]/.test(sheetName),
      ...(columnWidths?.length ? { columnWidths } : {}),
      headerRow: true,
    };
  });
}

export async function downloadXlsxWorkbook(wb: XLSX.WorkBook, fileName: string): Promise<void> {
  const name = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  await ensureExportLibrariesReady().catch(() => undefined);
  const serverOk = await postBackendXlsxStream({ fileName: name, sheets: workbookToBackendSheets(wb) });
  if (serverOk) return;

  let bytes: Uint8Array;
  try {
    bytes = await workbookToExcelJsBuffer(wb);
  } catch (e) {
    console.warn("[excel] ExcelJS export failed, falling back to SheetJS", e);
    bytes = fallbackSheetJsWrite(wb);
  }
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.setProperty("display", "none");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
