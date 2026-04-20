import {
  buildOfficialDocumentFullHtml,
  buildPlatformReportFullHtml,
} from "@/lib/legalApplicationPrint";
import { pushDocumentActivity } from "@/lib/documentActivityLog";
import { fetchBackendPrintHtml } from "@/lib/backendExportClient";
import { downloadPdfFromFullHtmlDocument } from "@/lib/pdfCanvasExport";
import { escapeHtmlPdf } from "@/lib/htmlEscape";
import { isTrialWatermarkExport } from "@/lib/exportPolicy";

export { escapeHtmlPdf };

/** Fallback إن لم يُمرَّر عنوان من الترجمة */
export const PDF_MAIN_TITLE = "Smart Al-Idara Pro";

/** جداول التقارير — أبيض وأسود في الطباعة */
export function buildPdfTableHtml(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  direction: "rtl" | "ltr"
): string {
  const th = headers
    .map(
      (h) =>
        `<th style="border:1px solid #000000;padding:8px;background:#ffffff;color:#000000;font-weight:700;">${escapeHtmlPdf(String(h))}</th>`
    )
    .join("");
  const trs = rows
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td style="border:1px solid #000000;padding:8px;background:#ffffff;color:#000000;">${escapeHtmlPdf(String(c ?? "—"))}</td>`).join("")}</tr>`
    )
    .join("");
  return `
    <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:${direction === "rtl" ? "right" : "left"};direction:${direction};">
      <thead><tr>${th}</tr></thead>
      <tbody>${trs}</tbody>
    </table>
  `;
}

export type ExportPdfOptions = {
  innerHtml: string;
  sectionTitle: string;
  fileName: string;
  direction: "rtl" | "ltr";
  lang?: string;
  mainTitle?: string;
  dateLocale?: string;
  /** official = Kingdom header for legal/government only; platform/creative = vibrant report, no platform watermark */
  documentMode?: "platform" | "official" | "creative";
  officialKingdomLine?: string;
  /** تجربة — علامة مائية على PDF */
  trialWatermark?: boolean;
};

/** خيارات VIP: طباعة HTML من الخادم (خط عربي + شعار Base64) ثم PDF عبر Canvas */
export type ExportPdfProOptions = ExportPdfOptions & {
  logoDataUrl?: string;
  /** محتوى أبسط للخادم (مثلاً جدول فقط) لتفادي تكرار العناوين مع قالب الطباعة */
  innerHtmlForBackend?: string;
};

/**
 * PDF احترافي: يحاول أولاً `/api/backend/print-html` ثم التحويل إلى PDF (jspdf + html2canvas)
 * ثم يرجع لبناء HTML محلي ونفس مسار Canvas عند الفشل.
 */
export async function exportSmartAlIdaraPdfPreferBackend(opts: ExportPdfProOptions): Promise<void> {
  const {
    innerHtml,
    innerHtmlForBackend,
    sectionTitle,
    direction,
    lang = typeof document !== "undefined" && document.documentElement.lang
      ? document.documentElement.lang
      : "en",
    mainTitle = PDF_MAIN_TITLE,
    documentMode = "platform",
    officialKingdomLine = "المملكة المغربية",
    logoDataUrl,
    fileName,
    trialWatermark: trialW,
  } = opts;
  const trialWatermark = trialW ?? isTrialWatermarkExport();

  const mode =
    documentMode === "official" ? "official" : documentMode === "creative" ? "creative" : "platform";
  const wmNote =
    trialWatermark && mode !== "official"
      ? `<p style="color:#7f1d1d;font-size:12px;font-weight:700;border:2px solid #fecaca;padding:10px;margin:0 0 12px;background:#fff7ed;">${escapeHtmlPdf(
          lang.startsWith("ar")
            ? "SMART AL IDARA PRO — نسخة تجريبية — غير صالحة قانونياً للإيداع أو الاستعمال الرسمي حتى ترقية الاشتراك"
            : "SMART AL IDARA PRO — TRIAL VERSION — Legally invalid for official filing or use until you upgrade to a paid plan"
        )}</p>`
      : "";
  const backendHtml = await fetchBackendPrintHtml({
    direction,
    lang: lang || "ar",
    kingdomLine: officialKingdomLine.trim() || "المملكة المغربية",
    sectionTitle,
    mainTitle: mode === "official" ? undefined : mainTitle,
    innerHtml: wmNote + (innerHtmlForBackend ?? innerHtml),
    mode,
    logoDataUrl: logoDataUrl?.startsWith("data:image") ? logoDataUrl : undefined,
  });
  if (backendHtml) {
    await downloadPdfFromFullHtmlDocument(backendHtml, { fileName });
    pushDocumentActivity("pdf", `${sectionTitle || fileName}`.replace(/\.pdf$/i, ""));
    return;
  }
  await exportSmartAlIdaraPdf(opts);
}

/**
 * تصدير PDF عبر html2canvas + jsPDF (صورة JPEG Base64 لكل صفحة A4) — دون window.print().
 */
export async function exportSmartAlIdaraPdf(opts: ExportPdfOptions): Promise<void> {
  const {
    innerHtml,
    sectionTitle,
    fileName,
    direction,
    lang =
      typeof document !== "undefined" && document.documentElement.lang
        ? document.documentElement.lang
        : "en",
    mainTitle = PDF_MAIN_TITLE,
    dateLocale = lang,
    documentMode = "platform",
    officialKingdomLine = "المملكة المغربية",
    trialWatermark: trialW,
  } = opts;
  const trialWatermark =
    documentMode !== "official" && (trialW ?? isTrialWatermarkExport());

  const full =
    documentMode === "official"
      ? buildOfficialDocumentFullHtml({
          innerHtml,
          sectionTitle,
          direction,
          lang,
          officialKingdomLine: officialKingdomLine.trim() || "المملكة المغربية",
          dateLocale: dateLocale ?? lang,
        })
      : buildPlatformReportFullHtml({
          innerHtml,
          sectionTitle,
          mainTitle,
          direction,
          lang,
          dateLocale: dateLocale ?? lang,
          trialWatermark,
        });

  await downloadPdfFromFullHtmlDocument(full, { fileName });
  pushDocumentActivity("pdf", `${sectionTitle || fileName}`.replace(/\.pdf$/i, ""));
}

export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string,
  sectionTitle: string,
  lang?: string,
  mainTitle?: string,
  dateLocale?: string
): Promise<void> {
  const dir = (element.closest("[dir]") as HTMLElement | null)?.dir === "ltr" ? "ltr" : "rtl";
  await exportSmartAlIdaraPdfPreferBackend({
    innerHtml: element.innerHTML,
    sectionTitle,
    fileName,
    direction: dir,
    lang,
    mainTitle,
    dateLocale: dateLocale ?? lang,
  });
}

export type EduPrintFields = {
  logoUrl: string;
  institution: string;
  examTitle: string;
  subject: string;
  teacher: string;
  labels: {
    institution: string;
    examTitle: string;
    subject: string;
    teacher: string;
    footer: string;
  };
};

function buildEduPrintInnerHtml(fields: EduPrintFields, direction: "rtl" | "ltr"): string {
  const L = fields.labels;
  const ta = direction === "rtl" ? "right" : "left";
  return `
    <div style="direction:${direction};text-align:${ta};">
      ${
        fields.institution.trim()
          ? `<p style="margin:0 0 8px 0;"><strong>${escapeHtmlPdf(L.institution)}:</strong> ${escapeHtmlPdf(fields.institution)}</p>`
          : ""
      }
      ${
        fields.examTitle.trim()
          ? `<p style="margin:0 0 12px 0;font-size:13pt;font-weight:700;">${escapeHtmlPdf(fields.examTitle)}</p>`
          : ""
      }
      <table style="width:100%;border-collapse:collapse;font-size:11pt;">
        <tr>
          <td style="border:1px solid #000;padding:10px;font-weight:700;width:32%;">${escapeHtmlPdf(L.subject)}</td>
          <td style="border:1px solid #000;padding:10px;">${escapeHtmlPdf(fields.subject || "—")}</td>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:10px;font-weight:700;">${escapeHtmlPdf(L.teacher)}</td>
          <td style="border:1px solid #000;padding:10px;">${escapeHtmlPdf(fields.teacher || "—")}</td>
        </tr>
      </table>
      <p style="margin-top:18px;font-size:9pt;text-align:center;color:#000;">${escapeHtmlPdf(L.footer)}</p>
    </div>
  `;
}

/** وثيقة التعليم — PDF عبر الخادم ثم Canvas، أو قالب المنصة محلياً */
export async function exportEduPrintColorPdf(
  fields: EduPrintFields,
  fileName: string,
  direction: "rtl" | "ltr",
  lang: string,
  mainTitle: string,
  dateLocale: string
): Promise<void> {
  const innerHtml = buildEduPrintInnerHtml(fields, direction);
  const sectionTitle = fields.examTitle.trim() || fields.labels.examTitle;
  const logoDataUrl = fields.logoUrl.startsWith("data:image") ? fields.logoUrl : undefined;

  const tw = isTrialWatermarkExport();
  const wmNote =
    tw
      ? `<p style="color:#7f1d1d;font-size:12px;font-weight:700;border:2px solid #fecaca;padding:10px;margin:0 0 12px;background:#fff7ed;">${escapeHtmlPdf(
          lang.startsWith("ar")
            ? "SMART AL IDARA PRO — نسخة تجريبية — غير صالحة قانونياً"
            : "SMART AL IDARA PRO — TRIAL VERSION — Legally invalid until paid"
        )}</p>`
      : "";
  const backendHtml = await fetchBackendPrintHtml({
    direction,
    lang,
    kingdomLine: "المملكة المغربية",
    sectionTitle,
    mainTitle,
    innerHtml: wmNote + innerHtml,
    mode: "creative",
    logoDataUrl,
  });
  if (backendHtml) {
    await downloadPdfFromFullHtmlDocument(backendHtml, { fileName });
    return;
  }

  const full = buildPlatformReportFullHtml({
    innerHtml,
    sectionTitle,
    mainTitle,
    direction,
    lang,
    dateLocale,
    trialWatermark: tw,
  });
  await downloadPdfFromFullHtmlDocument(full, { fileName });
}

/** جداول الوثائق الرسمية — حدود سوداء */
export function buildOfficialPdfTableHtml(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  direction: "rtl" | "ltr"
): string {
  return buildPdfTableHtml(headers, rows, direction);
}
