import type { Cell, Row, Worksheet } from "exceljs";

/** ألوان هوية المنصة — متوافقة مع Excel و Excel Online */
export const HEADER_FILL_ARGB = "FF003876";
export const HEADER_FONT_ARGB = "FFFFFFFF";
export const TITLE_FILL_ARGB = "FFE0E7EF";
export const ACCENT_BORDER_ARGB = "FF94A3B8";
export const ZEBRA_FILL_ARGB = "FFF8FAFC";

const edge = { style: "thin" as const, color: { argb: ACCENT_BORDER_ARGB } };

export function styleHeaderRow(row: Row): void {
  row.font = { bold: true, color: { argb: HEADER_FONT_ARGB }, name: "Calibri", size: 11 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL_ARGB },
  };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.eachCell((cell: Cell) => {
    cell.border = { top: edge, left: edge, bottom: edge, right: edge };
  });
}

export function styleTitleRow(row: Row): void {
  row.font = { bold: true, color: { argb: "FF0F172A" }, name: "Calibri", size: 14 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: TITLE_FILL_ARGB },
  };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.eachCell((cell: Cell) => {
    cell.border = { top: edge, left: edge, bottom: edge, right: edge };
  });
}

export function styleDataRow(row: Row, zebra: boolean): void {
  row.font = { name: "Calibri", size: 11, color: { argb: "FF0F172A" } };
  if (zebra) {
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ZEBRA_FILL_ARGB },
    };
  }
  row.alignment = { vertical: "middle", wrapText: true };
  row.eachCell((cell: Cell) => {
    cell.border = { top: edge, left: edge, bottom: edge, right: edge };
  });
}

export function applyBordersToRange(worksheet: Worksheet, startRow: number, endRow: number, startCol: number, endCol: number): void {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = worksheet.getCell(r, c);
      const v = cell.value;
      if (v !== null && v !== undefined && v !== "") {
        cell.border = { top: edge, left: edge, bottom: edge, right: edge };
      }
    }
  }
}
