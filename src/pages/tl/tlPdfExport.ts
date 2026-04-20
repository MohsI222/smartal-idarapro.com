import { exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import { buildPdfTableHtml } from "@/lib/pdfExport";
import { ensureLatinDigitsInString } from "@/lib/tlLatinNums";
import type { TlIncident, TlOpsLog, TlVehicleLog } from "@/lib/tlApi";

/** PDF/table cells: always Western digits */
function L(v: unknown): string {
  if (v == null || v === "") return "—";
  return ensureLatinDigitsInString(String(v));
}

const DEPT_PDF_STYLES = [
  { bg: "#ecfdf5", border: "#10b981", h: "#047857" },
  { bg: "#eff6ff", border: "#3b82f6", h: "#1d4ed8" },
  { bg: "#faf5ff", border: "#a855f7", h: "#7e22ce" },
  { bg: "#fff7ed", border: "#f97316", h: "#c2410c" },
  { bg: "#ecfeff", border: "#06b6d4", h: "#0e7490" },
  { bg: "#fefce8", border: "#eab308", h: "#a16207" },
] as const;

export async function exportTlErpPdf(opts: {
  direction: "rtl" | "ltr";
  lang: string;
  title: string;
  vehicles: TlVehicleLog[];
  ops: TlOpsLog[];
  incidents: TlIncident[];
  t: (k: string, params?: Record<string, string>) => string;
  fileName: string;
}) {
  const { direction, lang, title, vehicles, ops, incidents, t, fileName } = opts;
  const vHtml = buildPdfTableHtml(
    [
      t("tl.pdf.colVehicle"),
      t("tl.pdf.colDriver"),
      t("tl.pdf.colPhone"),
      t("tl.pdf.colExpected"),
      t("tl.pdf.colEntry"),
      t("tl.pdf.colStatus"),
      t("tl.pdf.colDelay"),
    ],
    vehicles.map((r) => [
      L(r.vehicle_id),
      L(r.driver_name),
      L(r.driver_phone),
      L(r.expected_entry_at),
      L(r.entry_at ?? "—"),
      L(r.alert_level),
      L(r.delay_minutes),
    ]),
    direction
  );
  const oHtml = buildPdfTableHtml(
    [
      t("tl.pdf.colEmployee"),
      t("tl.pdf.colTime"),
      t("tl.pdf.colQty"),
      t("tl.pdf.colTarget"),
      t("tl.pdf.colDelayReason"),
    ],
    ops.map((r) => [
      L(r.worker_full_name ?? r.worker_id),
      L(r.log_time),
      L(r.quantity),
      L(`${r.target_pct}%`),
      L(r.delay_reason || "—"),
    ]),
    direction
  );
  const incHtml = buildPdfTableHtml(
    [t("tl.pdf.colSeverity"), t("tl.pdf.colSummary"), t("tl.pdf.colDetail"), t("tl.pdf.colWhen")],
    incidents.map((i) => [L(i.severity), L(i.summary), L(i.detail ?? "—"), L(i.created_at)]),
    direction
  );
  const innerHtml = `
    <div style="font-family:system-ui,sans-serif;padding:16px;font-variant-numeric:lining-nums;">
      <h1 style="font-size:20px;color:#0052CC;">${title}</h1>
      <div style="margin:16px 0;padding:12px;background:#ecfdf5;border:2px solid #10b981;border-radius:8px;">
        <h2 style="color:#047857;margin:0 0 8px;">${t("tl.pdf.sectionVehicles")}</h2>
        ${vHtml}
      </div>
      <div style="margin:16px 0;padding:12px;background:#eff6ff;border:2px solid #3b82f6;border-radius:8px;">
        <h2 style="color:#1d4ed8;margin:0 0 8px;">${t("tl.pdf.sectionOps")}</h2>
        ${oHtml}
      </div>
      <div style="margin:16px 0;padding:12px;background:#fff7ed;border:2px solid #f97316;border-radius:8px;">
        <h2 style="color:#c2410c;margin:0 0 8px;">${t("tl.pdf.sectionIncidents")}</h2>
        ${incHtml}
      </div>
    </div>
  `;
  await exportSmartAlIdaraPdfPreferBackend({
    innerHtml,
    innerHtmlForBackend: innerHtml,
    sectionTitle: title,
    fileName,
    direction,
    lang,
    documentMode: "creative",
    mainTitle: "Smart Transport & Logistics Pro",
  });
}

/** One isolated block per department (vehicles and/or ops never mixed across departments). */
export async function exportTlErpPdfByDepartment(opts: {
  direction: "rtl" | "ltr";
  lang: string;
  title: string;
  byDept: { slug: string; vehicles: TlVehicleLog[]; ops: TlOpsLog[] }[];
  incidents: TlIncident[];
  t: (k: string, params?: Record<string, string>) => string;
  fileName: string;
}) {
  const { direction, lang, title, byDept, incidents, t, fileName } = opts;

  const deptBlocks = byDept
    .map(({ slug, vehicles, ops }, i) => {
      const st = DEPT_PDF_STYLES[i % DEPT_PDF_STYLES.length]!;
      const deptTitle = t(`tl.dept.${slug}`);
      const chunks: string[] = [];

      if (vehicles.length > 0) {
        const vHtml = buildPdfTableHtml(
          [
            t("tl.pdf.colVehicle"),
            t("tl.pdf.colDriver"),
            t("tl.pdf.colPhone"),
            t("tl.pdf.colExpected"),
            t("tl.pdf.colEntry"),
            t("tl.pdf.colStatus"),
            t("tl.pdf.colDelay"),
          ],
          vehicles.map((r) => [
            L(r.vehicle_id),
            L(r.driver_name),
            L(r.driver_phone),
            L(r.expected_entry_at),
            L(r.entry_at ?? "—"),
            L(r.alert_level),
            L(r.delay_minutes),
          ]),
          direction
        );
        chunks.push(
          `<h3 style="color:${st.h};margin:12px 0 6px;font-size:15px;">${deptTitle} — ${t("tl.pdf.sectionVehicles")}</h3>${vHtml}`
        );
      }

      if (ops.length > 0) {
        const oHtml = buildPdfTableHtml(
          [
            t("tl.pdf.colEmployee"),
            t("tl.pdf.colTime"),
            t("tl.pdf.colQty"),
            t("tl.pdf.colTarget"),
            t("tl.pdf.colDelayReason"),
          ],
          ops.map((r) => [
            L(r.worker_full_name ?? r.worker_id),
            L(r.log_time),
            L(r.quantity),
            L(`${r.target_pct}%`),
            L(r.delay_reason || "—"),
          ]),
          direction
        );
        chunks.push(
          `<h3 style="color:${st.h};margin:12px 0 6px;font-size:15px;">${deptTitle} — ${t("tl.pdf.sectionOps")}</h3>${oHtml}`
        );
      }

      if (chunks.length === 0) {
        chunks.push(
          `<p style="color:#64748b;font-size:13px;margin:8px 0;">${deptTitle}: ${t("tl.reportNoRows")}</p>`
        );
      }

      return `<div style="margin:16px 0;padding:12px;background:${st.bg};border:2px solid ${st.border};border-radius:8px;">${chunks.join("")}</div>`;
    })
    .join("");

  const incHtml = buildPdfTableHtml(
    [t("tl.pdf.colSeverity"), t("tl.pdf.colSummary"), t("tl.pdf.colDetail"), t("tl.pdf.colWhen")],
    incidents.map((i) => [L(i.severity), L(i.summary), L(i.detail ?? "—"), L(i.created_at)]),
    direction
  );

  const innerHtml = `
    <div style="font-family:system-ui,sans-serif;padding:16px;font-variant-numeric:lining-nums;">
      <h1 style="font-size:20px;color:#0052CC;">${title}</h1>
      ${deptBlocks}
      <div style="margin:16px 0;padding:12px;background:#f8fafc;border:2px solid #64748b;border-radius:8px;">
        <h2 style="color:#334155;margin:0 0 8px;">${t("tl.pdf.sectionIncidents")}</h2>
        ${incHtml}
      </div>
    </div>
  `;

  await exportSmartAlIdaraPdfPreferBackend({
    innerHtml,
    innerHtmlForBackend: innerHtml,
    sectionTitle: title,
    fileName,
    direction,
    lang,
    documentMode: "creative",
    mainTitle: "Smart Transport & Logistics Pro",
  });
}
