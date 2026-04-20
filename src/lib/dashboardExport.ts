import ExcelJS from "exceljs";
import { escapeHtmlPdf } from "@/lib/htmlEscape";
import { applyBordersToRange, styleDataRow, styleHeaderRow, styleTitleRow } from "@/lib/excelStyles";
import { ensureExportLibrariesReady } from "@/lib/exportLibraries";
import { exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";

export type DashboardExportPayload = {
  companyName: string;
  logoDataUrl: string;
  labels: {
    docCount: string;
    revenueToday: string;
    revenueHour: string;
    profitToday: string;
    profitHour: string;
    title: string;
  };
  values: {
    docCount: number;
    todayRevenue: number;
    hourRevenue: number;
    todayNetProfit: number;
    hourNetProfit: number;
  };
  chart: { day: string; revenue: number }[];
};

function logoBlock(logoDataUrl: string, companyName: string, isRtl: boolean): string {
  if (!logoDataUrl.startsWith("data:image")) return "";
  const align = isRtl ? "right" : "left";
  return `
    <div style="margin-bottom:16px;text-align:${align};">
      <img class="print-keep" src="${logoDataUrl}" alt="" style="max-height:64px;max-width:200px;object-fit:contain;" />
      ${companyName ? `<p style="margin:8px 0 0;font-weight:800;font-size:14px;">${escapeHtmlPdf(companyName)}</p>` : ""}
    </div>
  `;
}

export async function exportDashboardPdf(
  payload: DashboardExportPayload,
  opts: { isRtl: boolean; lang: string; dateLocale: string; fileName: string }
): Promise<void> {
  const { companyName, logoDataUrl, labels, values, chart } = payload;
  const rows: (string | number)[][] = [
    [labels.docCount, values.docCount],
    [labels.revenueToday, values.todayRevenue],
    [labels.revenueHour, values.hourRevenue],
    [labels.profitToday, values.todayNetProfit],
    [labels.profitHour, values.hourNetProfit],
    ...chart.map((c) => [c.day, c.revenue]),
  ];
  const table = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tbody>
        ${rows
          .map(
            (r) =>
              `<tr><td style="border:1px solid #0f172a;padding:8px;font-weight:700;">${escapeHtmlPdf(String(r[0]))}</td>` +
              `<td style="border:1px solid #0f172a;padding:8px;">${escapeHtmlPdf(String(r[1]))}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
  const inner = `
    ${logoBlock(logoDataUrl, companyName, opts.isRtl)}
    <h2 style="color:#0f172a;font-size:16px;font-weight:800;margin-bottom:12px;">${escapeHtmlPdf(labels.title)}</h2>
    ${table}
  `;
  await exportSmartAlIdaraPdfPreferBackend({
    innerHtml: inner,
    innerHtmlForBackend: table,
    sectionTitle: labels.title,
    fileName: opts.fileName,
    direction: opts.isRtl ? "rtl" : "ltr",
    lang: opts.lang,
    dateLocale: opts.dateLocale,
    documentMode: "creative",
    mainTitle: companyName.trim() || "Smart Al-Idara Pro",
    logoDataUrl: logoDataUrl.startsWith("data:image") ? logoDataUrl : undefined,
  });
}

/** Excel حقيقي عبر ExcelJS مباشرة (OOXML ثنائي) — ترويسة وألوان وحدود */
export async function exportDashboardExcel(payload: DashboardExportPayload, fileName: string): Promise<void> {
  await ensureExportLibrariesReady();
  const { labels, values, chart, companyName } = payload;
  const name = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Smart Al-Idara Pro";
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet("Dashboard", {
    views: [{ rightToLeft: true }],
  });

  ws.addRow([companyName || "Smart Al-Idara Pro", ""]);
  styleTitleRow(ws.getRow(1));

  ws.addRow(["Metric", "Value"]);
  styleHeaderRow(ws.getRow(2));

  const kpis: (string | number)[][] = [
    [labels.docCount, values.docCount],
    [labels.revenueToday, values.todayRevenue],
    [labels.revenueHour, values.hourRevenue],
    [labels.profitToday, values.todayNetProfit],
    [labels.profitHour, values.hourNetProfit],
  ];
  let r = 3;
  for (const row of kpis) {
    ws.addRow(row);
    styleDataRow(ws.getRow(r), r % 2 === 1);
    r++;
  }

  ws.addRow([labels.title, ""]);
  styleTitleRow(ws.getRow(r));
  r++;

  ws.addRow(["day", "revenue"]);
  styleHeaderRow(ws.getRow(r));
  r++;

  for (const c of chart) {
    ws.addRow([c.day, c.revenue]);
    styleDataRow(ws.getRow(r), r % 2 === 0);
    r++;
  }

  ws.getColumn(1).width = 36;
  ws.getColumn(2).width = 22;
  applyBordersToRange(ws, 1, r - 1, 1, 2);

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
