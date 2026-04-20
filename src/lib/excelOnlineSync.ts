import ExcelJS from "exceljs";
import { ensureExportLibrariesReady } from "@/lib/exportLibraries";
import { applyBordersToRange, styleDataRow, styleHeaderRow, styleTitleRow } from "@/lib/excelStyles";
import type { DashboardExportPayload } from "@/lib/dashboardExport";

export const EXCEL_SYNC_STORAGE_KEY = "idara_excel_online_sync_v1";

export function getExcelOnlineSyncEnabled(): boolean {
  try {
    return localStorage.getItem(EXCEL_SYNC_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setExcelOnlineSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(EXCEL_SYNC_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const SYNC_SCHEMA = 1;

export type BrandingSyncPayload = {
  companyName: string;
  activityType: string;
};

/**
 * مصنف متعدد الأوراق يتوافق مع رفع Excel / Excel Online:
 * - Idara_Sync_Meta: إصدار المخطط والتعليمات
 * - Branding_Edit: حقول قابلة للتعديل ثم الاستيراد للمنصة
 * - Financial_View: نفس بيانات لوحة التحكم مع تنسيق احترافي (قراءة من الخادم)
 */
export async function exportDashboardExcelOnlineSync(
  payload: DashboardExportPayload,
  branding: BrandingSyncPayload,
  fileName: string
): Promise<void> {
  await ensureExportLibrariesReady();
  const { labels, values, chart, companyName } = payload;
  const name = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Smart Al-Idara Pro";
  wb.created = new Date();
  wb.modified = new Date();

  const meta = wb.addWorksheet("Idara_Sync_Meta", { views: [{ rightToLeft: true }] });
  meta.addRow(["schema_version", SYNC_SCHEMA]);
  meta.addRow(["exported_at_utc", new Date().toISOString()]);
  meta.addRow([
    "how_to",
    "Edit Branding_Edit then Save. In Al-Idara: Dashboard → Import sync file. KPIs are server-side read-only.",
  ]);
  meta.getColumn(1).width = 22;
  meta.getColumn(2).width = 72;
  styleHeaderRow(meta.getRow(1));
  styleDataRow(meta.getRow(2), false);
  styleDataRow(meta.getRow(3), true);
  applyBordersToRange(meta, 1, 3, 1, 2);

  const edit = wb.addWorksheet("Branding_Edit", { views: [{ rightToLeft: true }] });
  edit.addRow(["field_key", "value_to_sync"]);
  edit.addRow(["companyName", branding.companyName]);
  edit.addRow(["activityType", branding.activityType]);
  edit.getColumn(1).width = 22;
  edit.getColumn(2).width = 48;
  styleHeaderRow(edit.getRow(1));
  styleDataRow(edit.getRow(2), false);
  styleDataRow(edit.getRow(3), true);
  applyBordersToRange(edit, 1, 3, 1, 2);

  const fin = wb.addWorksheet("Financial_View", { views: [{ rightToLeft: true }] });
  fin.addRow([companyName || "Smart Al-Idara Pro", ""]);
  styleTitleRow(fin.getRow(1));

  fin.addRow(["Metric", "Value"]);
  styleHeaderRow(fin.getRow(2));
  const kpiRows: (string | number)[][] = [
    [labels.docCount, values.docCount],
    [labels.revenueToday, values.todayRevenue],
    [labels.revenueHour, values.hourRevenue],
    [labels.profitToday, values.todayNetProfit],
    [labels.profitHour, values.hourNetProfit],
  ];
  let r = 3;
  for (const row of kpiRows) {
    fin.addRow(row);
    styleDataRow(fin.getRow(r), r % 2 === 1);
    r++;
  }
  fin.addRow([`${labels.title} — Series`, ""]);
  styleTitleRow(fin.getRow(r));
  r++;
  fin.addRow(["day", "revenue"]);
  styleHeaderRow(fin.getRow(r));
  r++;
  for (const c of chart) {
    fin.addRow([c.day, c.revenue]);
    styleDataRow(fin.getRow(r), r % 2 === 0);
    r++;
  }
  fin.getColumn(1).width = 36;
  fin.getColumn(2).width = 22;
  const lastRow = r - 1;
  applyBordersToRange(fin, 1, lastRow, 1, 2);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
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

export async function parseBrandingFromSyncExcel(file: File): Promise<BrandingSyncPayload | null> {
  await ensureExportLibrariesReady();
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const meta = wb.getWorksheet("Idara_Sync_Meta");
  if (meta) {
    const raw = meta.getRow(1).getCell(2).value;
    const schema = typeof raw === "number" ? raw : Number(String(raw ?? ""));
    if (Number.isFinite(schema) && schema > SYNC_SCHEMA + 1) return null;
  }
  const ws = wb.getWorksheet("Branding_Edit");
  if (!ws) return null;
  let companyName = "";
  let activityType = "general";
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const key = String(row.getCell(1).value ?? "").trim();
    const val = String(row.getCell(2).value ?? "").trim();
    if (key === "companyName") companyName = val;
    if (key === "activityType") activityType = val || "general";
  });
  return { companyName, activityType };
}
