import { buildAdministrativeEditorPdfHtml } from "@/lib/legalApplicationPrint";
import { stripLegalBoilerplateForSimpleExport } from "@/lib/legalAdministrativePdfContent";
import { createKingdomHeaderImageDataUrl } from "@/lib/legalAdministrativePdfHeaderCanvas";
import { downloadPdfFromFullHtmlDocument } from "@/lib/pdfCanvasExport";

export type AdministrativeEditorPdfPayload = {
  formalRecipientLine: string;
  requestBody: string;
  officialLegal: boolean;
  /** إخفاء شعار/علم المملكة في PDF عند إلغاء التفعيل في الواجهة */
  includeKingdomSeal: boolean;
  layoutSpacing: "default" | "address_change";
  documentDateLine: string;
};

/**
 * تصدير طلب إداري — **نفس محرك Expert PDF** (مستند HTML UTF-8 كامل → iframe → html2canvas → jsPDF A4).
 * الوضع المبسّط يزيل المقاطع القانونية فقط؛ الترويسة تبقى ما لم يُلغَ المستخدم خيارها. صفحة واحدة عبر fitSinglePage.
 */
export async function downloadLegalAdministrativeSheetPdf(
  payload: AdministrativeEditorPdfPayload,
  direction: "rtl" | "ltr",
  lang: string,
  fileName: string
): Promise<void> {
  const safeName = (fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`).replace(
    /[^a-zA-Z0-9._\u0600-\u06FF-]+/g,
    "_"
  );

  const kingdomHeaderImageDataUrl = payload.includeKingdomSeal
    ? await createKingdomHeaderImageDataUrl()
    : null;
  const bodyForPdf = payload.officialLegal
    ? payload.requestBody
    : stripLegalBoilerplateForSimpleExport(payload.requestBody, lang);

  const fullHtml = buildAdministrativeEditorPdfHtml({
    formalRecipientLine: payload.formalRecipientLine,
    requestBody: bodyForPdf,
    direction,
    lang,
    kingdomHeaderImageDataUrl,
    officialLegal: payload.officialLegal,
    layoutSpacing: payload.layoutSpacing,
    documentDateLine: payload.documentDateLine,
  });

  await downloadPdfFromFullHtmlDocument(fullHtml, {
    fileName: safeName,
    scale: 2,
    fitSinglePage: true,
    iframeFontWaitMs: 200,
    preCaptureDelayMs: 15,
  });
}
