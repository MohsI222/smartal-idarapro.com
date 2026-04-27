import { escapeHtmlPdf, escapeHtmlPdfLatin } from "@/lib/htmlEscape";
import { formatLatinDateTime } from "@/lib/tlLatinNums";

/** خطوط عربية من Google قبل الطباعة — يقلّل الصفحات البيضاء بسبب عدم تحميل الخط. */
const FONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&display=swap" rel="stylesheet" />
`;

function schedulePrint(w: Window): void {
  const runPrint = () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
  };
  const afterFonts = () => {
    const d = w.document;
    if (d.fonts && typeof d.fonts.ready?.then === "function") {
      void d.fonts.ready.then(() => {
        requestAnimationFrame(() => requestAnimationFrame(runPrint));
      });
    } else {
      window.setTimeout(runPrint, 450);
    }
  };
  const schedule = () => queueMicrotask(() => requestAnimationFrame(() => requestAnimationFrame(afterFonts)));
  if (w.document.readyState === "complete") schedule();
  else w.addEventListener("load", () => schedule(), { once: true });
}

const SHARED_PRINT_EXTRAS = `
    .brand-foot {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px solid #cbd5e1;
      font-size: 8pt;
      color: #475569;
      text-align: center;
      font-family: "Noto Naskh Arabic", Arial, sans-serif;
    }
    @media print {
      img:not(.print-keep),
      svg:not(.print-keep) {
        display: none !important;
      }
    }
`;

/** مستند HTML كامل للتقاط PDF عبر Canvas (jspdf + html2canvas) — دون الاعتماد على الطباعة */
export function buildLegalApplicationFullHtml(
  requestDetails: string,
  direction: "rtl" | "ltr" = "rtl",
  lang: string = "ar"
): string {
  const kingdom = escapeHtmlPdf("المملكة المغربية");
  const bodyText = escapeHtmlPdfLatin(requestDetails.trim() || "—");
  const headerDir = direction;
  const headerAlign = direction === "rtl" ? "right" : "left";
  const bodyAlign = direction === "rtl" ? "right" : "left";

  return `<!DOCTYPE html>
<html lang="${escapeHtmlPdf(lang)}" dir="${direction}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${kingdom}</title>
  ${FONT_LINKS}
  <style>
    @page { size: A4; margin: 20mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff !important;
      color: #000 !important;
    }
    * {
      font-variant-numeric: tabular-nums !important;
      -webkit-font-feature-settings: "tnum" 1, "lnum" 1 !important;
      font-feature-settings: "tnum" 1, "lnum" 1 !important;
    }
    body {
      font-family: "Noto Naskh Arabic", Arial, "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.55;
      font-variant-numeric: lining-nums tabular-nums;
      -webkit-font-feature-settings: "tnum" 1, "lnum" 1 !important;
      font-feature-settings: "tnum" 1, "lnum" 1 !important;
    }
    .doc-wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 8px 0 32px;
      background: #fff;
      color: #000;
    }
    header.kingdom-header {
      direction: ${headerDir};
      text-align: ${headerAlign};
      padding-bottom: 10px;
      margin-bottom: 18px;
      border-bottom: 3px solid #003876;
      background: #fff;
    }
    header.kingdom-header .kingdom-line {
      font-family: "Noto Naskh Arabic", Arial, serif;
      font-size: 20pt;
      font-weight: 700;
      color: #000;
      letter-spacing: normal;
      line-height: 1.3;
      unicode-bidi: isolate;
    }
    .request-body {
      direction: ${direction};
      text-align: ${bodyAlign};
      font-family: "Noto Naskh Arabic", Arial, serif;
      font-size: 12pt;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
      unicode-bidi: plaintext;
      color: #000;
      background: #fff;
      min-height: 120px;
    }
    ${SHARED_PRINT_EXTRAS}
  </style>
</head>
<body>
  <div class="doc-wrap">
    <header class="kingdom-header">
      <div class="kingdom-line">${kingdom}</div>
    </header>
    <div class="request-body">${bodyText}</div>
  </div>
</body>
</html>`;
}

/**
 * طباعة الطلب: نافذة جديدة تحتوي على ترويسة «المملكة المغربية» ونص الطلب فقط، ثم window.print().
 */
export function openLegalApplicationPrintWindow(
  requestDetails: string,
  direction: "rtl" | "ltr" = "rtl",
  lang: string = "ar"
): void {
  const html = buildLegalApplicationFullHtml(requestDetails, direction, lang);

  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  schedulePrint(win);
}

export type PlatformPrintWindowOpts = {
  innerHtml: string;
  sectionTitle: string;
  mainTitle: string;
  direction: "rtl" | "ltr";
  lang: string;
  dateLocale?: string;
  /** علامة مائية — تجربة مجانية */
  trialWatermark?: boolean;
};

/** HTML كامل لتقرير المنصة — للتصدير PDF عبر Canvas */
export function buildPlatformReportFullHtml(opts: PlatformPrintWindowOpts): string {
  const { innerHtml, sectionTitle, mainTitle, direction, lang, dateLocale = lang, trialWatermark } = opts;
  const mt = escapeHtmlPdfLatin(mainTitle.trim());
  const st = escapeHtmlPdfLatin(sectionTitle.trim());
  const dateStr = escapeHtmlPdfLatin(formatLatinDateTime(dateLocale || lang));
  const headerDir = direction;
  const headerAlign = direction === "rtl" ? "right" : "left";
  const bodyAlign = direction === "rtl" ? "right" : "left";

  return `<!DOCTYPE html>
<html lang="${escapeHtmlPdf(lang)}" dir="${direction}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${mt}</title>
  ${FONT_LINKS}
  <style>
    @page { size: A4; margin: 20mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff !important;
      color: #000 !important;
    }
    * {
      font-variant-numeric: tabular-nums !important;
      -webkit-font-feature-settings: "tnum" 1, "lnum" 1 !important;
      font-feature-settings: "tnum" 1, "lnum" 1 !important;
    }
    body {
      font-family: "Noto Naskh Arabic", Arial, "Segoe UI", sans-serif;
      font-size: 12pt;
      line-height: 1.55;
      font-variant-numeric: lining-nums tabular-nums;
      -webkit-font-feature-settings: "tnum" 1, "lnum" 1 !important;
      font-feature-settings: "tnum" 1, "lnum" 1 !important;
    }
    .doc-wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 8px 0 32px;
      background: #fff;
      color: #000;
    }
    header.report-header {
      direction: ${headerDir};
      text-align: ${headerAlign};
      padding-bottom: 10px;
      margin-bottom: 14px;
      border-bottom: 2px solid #000;
      background: #fff;
    }
    header.report-header .main-line {
      font-size: 17pt;
      font-weight: 700;
      color: #000;
      unicode-bidi: isolate;
    }
    header.report-header .section-line {
      font-size: 12pt;
      font-weight: 600;
      margin-top: 8px;
      color: #000;
    }
    header.report-header .date-line {
      font-size: 9pt;
      margin-top: 6px;
      color: #000;
    }
    .print-body {
      direction: ${direction};
      text-align: ${bodyAlign};
      color: #000;
      background: #fff;
      font-family: "Noto Naskh Arabic", Arial, sans-serif;
    }
    .print-body table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11pt;
    }
    .print-body img.print-keep {
      max-height: 72px;
      max-width: 220px;
      object-fit: contain;
    }
    @media print {
      @page { size: A4; margin: 20mm; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      * {
        color: #000 !important;
        background: #fff !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
      .doc-wrap { padding: 0 !important; max-width: none !important; }
      table, th, td { border-color: #000 !important; }
      .print-body img.print-keep {
        display: block !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
    ${SHARED_PRINT_EXTRAS}
  </style>
</head>
<body>
  <div class="doc-wrap">
    <header class="report-header">
      <div class="main-line">${mt}</div>
      ${st ? `<div class="section-line">${st}</div>` : ""}
      <div class="date-line">${dateStr}</div>
    </header>
    <div class="print-body">${innerHtml}</div>
    ${
      trialWatermark
        ? `<div class="idara-trial-wm" aria-hidden="true" style="position:fixed;left:0;right:0;top:0;bottom:0;pointer-events:none;z-index:9999;display:flex;align-items:center;justify-content:center;">
  <span style="display:block;max-width:92%;text-align:center;font-size:38px;font-weight:900;line-height:1.15;color:rgba(180,30,30,0.16);transform:rotate(-28deg);font-family:Arial,'Noto Naskh Arabic',sans-serif;">
    ${escapeHtmlPdf(
      lang.startsWith("ar")
        ? "SMART AL IDARA PRO — نسخة تجريبية — غير صالحة قانونياً"
        : "SMART AL IDARA PRO — TRIAL VERSION — LEGALLY INVALID"
    )}
  </span>
</div>`
        : ""
    }
  </div>
</body>
</html>`;
}

/** تقارير المنصة — نافذة + طباعة (اختياري؛ التصدير الافتراضي عبر Canvas في pdfExport) */
export function openPlatformReportPrintWindow(opts: PlatformPrintWindowOpts): void {
  const html = buildPlatformReportFullHtml(opts);
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  schedulePrint(win);
}

export type OfficialPrintWindowOpts = {
  innerHtml: string;
  sectionTitle: string;
  direction: "rtl" | "ltr";
  lang: string;
  officialKingdomLine: string;
  dateLocale?: string;
};

/** HTML كامل للوثيقة الرسمية — للتصدير PDF عبر Canvas */
export function buildOfficialDocumentFullHtml(opts: OfficialPrintWindowOpts): string {
  const {
    innerHtml,
    sectionTitle,
    direction,
    lang,
    officialKingdomLine,
    dateLocale = lang,
  } = opts;
  const kingdom = escapeHtmlPdfLatin(officialKingdomLine.trim() || "المملكة المغربية");
  const titleSec = escapeHtmlPdfLatin(sectionTitle.trim());
  const dateStr = escapeHtmlPdfLatin(formatLatinDateTime(dateLocale || lang));
  const headerDir = direction;
  const headerAlign = direction === "rtl" ? "right" : "left";
  const bodyAlign = direction === "rtl" ? "right" : "left";

  return `<!DOCTYPE html>
<html lang="${escapeHtmlPdf(lang)}" dir="${direction}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${kingdom}</title>
  ${FONT_LINKS}
  <style>
    @page { size: A4; margin: 20mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff !important;
      color: #000 !important;
    }
    * {
      font-variant-numeric: tabular-nums !important;
      -webkit-font-feature-settings: "tnum" 1, "lnum" 1 !important;
      font-feature-settings: "tnum" 1, "lnum" 1 !important;
    }
    body {
      font-family: "Noto Naskh Arabic", Arial, "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.5;
      font-variant-numeric: lining-nums tabular-nums;
      -webkit-font-feature-settings: "tnum" 1, "lnum" 1 !important;
      font-feature-settings: "tnum" 1, "lnum" 1 !important;
    }
    .doc-wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 8px 0 32px;
      background: #fff;
      color: #000;
    }
    header.kingdom-header {
      direction: ${headerDir};
      text-align: ${headerAlign};
      padding-bottom: 10px;
      margin-bottom: 14px;
      border-bottom: 3px solid #003876;
      background: #fff;
    }
    header.kingdom-header .kingdom-line {
      font-size: 18pt;
      font-weight: 900;
      color: #003876;
      letter-spacing: 0.02em;
      line-height: 1.3;
      unicode-bidi: isolate;
    }
    header.kingdom-header .section-line {
      font-size: 12pt;
      font-weight: 700;
      margin-top: 8px;
      color: #000;
    }
    header.kingdom-header .date-line {
      font-size: 9pt;
      margin-top: 6px;
      color: #000;
    }
    .print-body {
      direction: ${direction};
      text-align: ${bodyAlign};
      color: #000;
      background: #fff;
      font-family: "Noto Naskh Arabic", Arial, sans-serif;
    }
    .print-body table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11pt;
    }
    @media print {
      @page { size: A4; margin: 20mm; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      * {
        color: #000 !important;
        background: #fff !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
      .doc-wrap { padding: 0 !important; max-width: none !important; }
      table, th, td { border-color: #000 !important; }
      header.kingdom-header .kingdom-line { color: #003876 !important; }
      header.kingdom-header { border-bottom-color: #003876 !important; }
    }
    ${SHARED_PRINT_EXTRAS}
  </style>
</head>
<body>
  <div class="doc-wrap">
    <header class="kingdom-header">
      <div class="kingdom-line">${kingdom}</div>
      <div class="section-line">${titleSec}</div>
      <div class="date-line">${dateStr}</div>
    </header>
    <div class="print-body">${innerHtml}</div>
  </div>
</body>
</html>`;
}

/** خطوط التصدير الإداري: Amiri/Cairo (display=block) + احتياط Noto */
const ADMIN_EDITOR_PDF_FONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@600;700&family=Noto+Naskh+Arabic:wght@400;600;700&display=block" rel="stylesheet" />
`;

export type AdministrativeEditorPdfLayoutSpacing = "default" | "address_change";

export type AdministrativeEditorPdfInput = {
  formalRecipientLine: string;
  requestBody: string;
  direction: "rtl" | "ltr";
  lang: string;
  /** PNG — علم + شعار + المملكة (يجوز أن يُزال عند طلب المستخدم) */
  kingdomHeaderImageDataUrl: string | null;
  /** رسمي (ترويسة كاملة + نص قانوني) مقابل طلب مبسّط */
  officialLegal: boolean;
  /** توزيع مسافات أوحى لطلب تبديل عنوان السكن */
  layoutSpacing: AdministrativeEditorPdfLayoutSpacing;
  /** تاريخ يظهر في ذيل التوقيع */
  documentDateLine: string;
};

/** فقرات منفصلة في الوضع المبسّط — هامش سفلي 20px + line-height 2.5 */
function bodyChunksToSimpleParagraphsHtml(raw: string): string {
  const t = raw.trim() || "—";
  let chunks = t.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length <= 1 && /\n/.test(t)) {
    chunks = t.split("\n").map((s) => s.trim()).filter(Boolean);
  }
  const parts = chunks.length > 0 ? chunks : [t];
  return parts.map((p) => `<p class="simple-para">${escapeHtmlPdfLatin(p)}</p>`).join("");
}

/** فصل المقدمة عن فقرة «أنا الممضي أسفله» (أو ما يقابلها) لزيادة المسافة البصرية الاحترافية */
function splitAdministrativeBodyForUndersigned(raw: string): { head: string; tail: string | null } {
  const t = raw.trim();
  if (!t) return { head: "—", tail: null };
  const needles = [
    "\nأنا الممضي أسفله",
    "أنا الممضي أسفله",
    "\nJe soussigné",
    "Je soussigné",
    "\nYo,",
    "\nI, the undersigned",
    "I, the undersigned",
  ];
  for (const needle of needles) {
    const i = t.indexOf(needle);
    if (i > 0) {
      return { head: t.slice(0, i).trimEnd(), tail: t.slice(i).trimStart() };
    }
  }
  return { head: t, tail: null };
}

function administrativePdfSignatureLabels(lang: string): { heading: string; hint: string } {
  const l = lang.toLowerCase();
  if (l.startsWith("ar")) return { heading: "خاتمة", hint: "الاسم الكامل والتوقيع" };
  if (l.startsWith("fr")) return { heading: "Clôture", hint: "Nom complet et signature" };
  if (l.startsWith("es")) return { heading: "Cierre", hint: "Nombre completo y firma" };
  return { heading: "Closing", hint: "Full name and signature" };
}

function administrativePdfDateCaption(lang: string): string {
  const l = lang.toLowerCase();
  if (l.startsWith("ar")) return "التاريخ";
  if (l.startsWith("fr")) return "Date";
  if (l.startsWith("es")) return "Fecha";
  return "Date";
}

function administrativePdfHtmlTitle(lang: string, officialLegal: boolean): string {
  if (officialLegal) return escapeHtmlPdf("المملكة المغربية");
  const l = lang.toLowerCase();
  if (l.startsWith("ar")) return escapeHtmlPdf("طلب إداري");
  if (l.startsWith("fr")) return escapeHtmlPdf("Demande administrative");
  if (l.startsWith("es")) return escapeHtmlPdf("Solicitud administrativa");
  return escapeHtmlPdf("Administrative request");
}

/**
 * HTML كامل لمحرر الطلب الإداري — نفس مسار Expert PDF (iframe + html2canvas + jsPDF).
 * A4: هوامش جانبية 25 مم، هامش علوي 10 مم، ترويسة بصورة Base64، خاتمة ومنطقة توقيع أسفل الصفحة المنطقية.
 */
export function buildAdministrativeEditorPdfHtml(input: AdministrativeEditorPdfInput): string {
  const {
    formalRecipientLine,
    requestBody,
    direction,
    lang,
    kingdomHeaderImageDataUrl,
    officialLegal,
    layoutSpacing,
    documentDateLine,
  } = input;
  const htmlTitle =
    kingdomHeaderImageDataUrl != null
      ? escapeHtmlPdf("المملكة المغربية")
      : administrativePdfHtmlTitle(lang, officialLegal);
  const formal = escapeHtmlPdfLatin(formalRecipientLine.trim() || "—");
  const rawBody = requestBody.trim() || "—";
  const { head: headRaw, tail: tailRaw } = splitAdministrativeBodyForUndersigned(rawBody);
  const headSafe = headRaw.trim().length ? headRaw.trim() : "—";
  const headBlock = officialLegal
    ? `<div class="request-main">${escapeHtmlPdfLatin(headSafe)}</div>`
    : `<div class="request-main request-main--simple">${bodyChunksToSimpleParagraphsHtml(headSafe)}</div>`;
  const tailBlock =
    tailRaw != null && tailRaw.length > 0
      ? officialLegal
        ? `<div class="request-main request-main-undersigned">${escapeHtmlPdfLatin(tailRaw)}</div>`
        : `<div class="request-main request-main--simple request-main-undersigned">${bodyChunksToSimpleParagraphsHtml(tailRaw)}</div>`
      : "";
  const bodyAlign = direction === "rtl" ? "right" : "left";
  const headerSrc = kingdomHeaderImageDataUrl?.replace(/"/g, "&quot;") ?? "";
  const headerImgHtml = kingdomHeaderImageDataUrl
    ? `<div class="official-identity"><img class="kingdom-header-img print-keep" src="${headerSrc}" width="300" height="56" alt="" /></div>`
    : "";
  const sig = administrativePdfSignatureLabels(lang);
  const sigHeading = escapeHtmlPdf(sig.heading);
  const sigHint = escapeHtmlPdf(sig.hint);
  const dateCap = escapeHtmlPdf(administrativePdfDateCaption(lang));
  const dateEsc = escapeHtmlPdfLatin(documentDateLine.trim() || "—");
  const shellClass = [
    "doc-shell",
    layoutSpacing === "address_change" ? "doc-shell--addr" : "doc-shell--std",
    officialLegal ? "" : "doc-shell--simple",
  ]
    .filter(Boolean)
    .join(" ");

  return `<!DOCTYPE html>
<html lang="${escapeHtmlPdf(lang)}" dir="${direction}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${htmlTitle}</title>
  ${ADMIN_EDITOR_PDF_FONT_LINKS}
  <style>
    @page { size: A4 portrait; margin: 0; }
    * {
      box-sizing: border-box;
      font-variant-numeric: tabular-nums !important;
      -webkit-font-feature-settings: "tnum" 1, "lnum" 1 !important;
      font-feature-settings: "tnum" 1, "lnum" 1 !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff !important;
      color: #000 !important;
    }
    body {
      font-family: Amiri, Cairo, "Noto Naskh Arabic", Arial, "Times New Roman", serif;
      font-weight: 400;
      /* Western digits 0–9; Arabic script unchanged */
      font-variant-numeric: lining-nums tabular-nums;
      -webkit-font-feature-settings: "liga" 1, "calt" 1, "tnum" 1, "lnum" 1;
      font-feature-settings: "liga" 1, "calt" 1, "tnum" 1, "lnum" 1;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc-shell {
      width: 210mm;
      max-width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 10mm 25mm 14mm;
      background: #fff;
      color: #000;
      display: flex;
      flex-direction: column;
    }
    .doc-shell--std .pdf-header-block { margin-bottom: 2mm; }
    .doc-shell--std .blue-rule { margin-bottom: 12px; }
    .doc-shell--std .formal-salutation { margin-bottom: 14px; }
    .doc-shell--addr .pdf-header-block { margin-bottom: 5mm; }
    .doc-shell--addr .blue-rule {
      margin-top: 3mm;
      margin-bottom: 11mm;
    }
    .doc-shell--addr .formal-salutation {
      margin-top: 4mm;
      margin-bottom: 22px;
    }
    .doc-shell--addr .doc-body-column { margin-top: 3mm; }
    .doc-shell--addr .request-main-undersigned { margin-top: 3.5rem; }
    /* وضع مبسّط: تباعد أوضح + انتشار عمودي بين الترويسة/الموضوع والنص */
    .doc-shell--simple .blue-rule { margin-bottom: 20px !important; }
    .doc-shell--simple .formal-salutation {
      margin-bottom: 36px !important;
      padding-bottom: 6px;
    }
    .doc-shell--simple .doc-body-column {
      margin-top: 8mm;
      padding-top: 4mm;
    }
    .doc-shell--simple .request-main--simple {
      direction: ${direction};
      text-align: ${bodyAlign};
      font-family: Amiri, Cairo, "Noto Naskh Arabic", serif;
      font-size: 11.5pt;
      font-weight: 400;
      unicode-bidi: plaintext;
      color: #0f172a;
      white-space: normal;
      margin: 0;
      line-height: 2.5;
    }
    .doc-shell--simple .simple-para {
      margin: 0 0 20px;
      line-height: 2.5;
      padding: 0;
      word-wrap: break-word;
    }
    .doc-shell--simple .simple-para:last-child {
      margin-bottom: 0;
    }
    .doc-shell--simple .request-main-undersigned {
      margin-top: 2.75rem !important;
    }
    .pdf-header-block {
      flex-shrink: 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .official-identity {
      text-align: center;
      direction: rtl;
      margin: 0;
    }
    .kingdom-header-img {
      display: block;
      margin: 0 auto;
      max-width: 300px;
      width: 100%;
      height: auto;
    }
    .blue-rule {
      display: block;
      height: 3px;
      margin: 8px 0 14px;
      padding: 0;
      border: 0;
      border-radius: 1px;
      background: #003876 !important;
      width: 100%;
      flex-shrink: 0;
      break-inside: avoid;
      page-break-inside: avoid;
      page-break-after: avoid;
    }
    .formal-salutation {
      flex-shrink: 0;
      direction: ${direction};
      text-align: center;
      font-family: Amiri, Cairo, "Noto Naskh Arabic", serif;
      font-size: 12pt;
      font-weight: 600;
      line-height: 1.5;
      margin: 0 0 14px;
      unicode-bidi: plaintext;
      color: #111;
    }
    .doc-body-column {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .request-main {
      direction: ${direction};
      text-align: ${bodyAlign};
      font-family: Amiri, Cairo, "Noto Naskh Arabic", serif;
      font-size: 11.5pt;
      font-weight: 400;
      line-height: 2;
      white-space: pre-wrap;
      word-wrap: break-word;
      unicode-bidi: plaintext;
      color: #0f172a;
      margin: 0;
    }
    .request-main-undersigned {
      margin-top: 2.5rem;
    }
    .signature-area {
      flex-shrink: 0;
      margin-top: auto;
      min-height: 29.7mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding-top: 5mm;
      padding-bottom: 1mm;
      direction: ${direction};
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .signature-heading {
      font-size: 11pt;
      font-weight: 600;
      color: #003876;
      margin: 0 0 3mm;
      letter-spacing: 0.03em;
    }
    .signature-rule {
      height: 0;
      border: 0;
      border-bottom: 1px solid #000;
      margin: 6mm auto 2mm;
      width: 72%;
      max-width: 160mm;
    }
    .signature-hint {
      font-size: 9.5pt;
      color: #1e293b;
      margin: 0 0 2mm;
      font-weight: 500;
    }
    .signature-date {
      font-size: 10pt;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }
    .signature-date-lbl {
      color: #003876;
      font-weight: 600;
      margin-inline-end: 0.35em;
    }
    @media print {
      @page { size: A4 portrait; margin: 0; }
      html, body { background: #fff !important; }
      .doc-shell {
        padding: 10mm 25mm 14mm !important;
        min-height: 297mm !important;
      }
      .blue-rule {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="${shellClass}">
    <div class="pdf-header-block">
      ${headerImgHtml}
      <div class="blue-rule" aria-hidden="true"></div>
    </div>
    <div class="formal-salutation">${formal}</div>
    <div class="doc-body-column">
      ${headBlock}
      ${tailBlock}
    </div>
    <div class="signature-area">
      <p class="signature-heading">${sigHeading}</p>
      <div class="signature-rule" aria-hidden="true"></div>
      <p class="signature-hint">${sigHint}</p>
      <p class="signature-date"><span class="signature-date-lbl">${dateCap}:</span> ${dateEsc}</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * وثيقة رسمية (جدول/نص) — نافذة جديدة ثم window.print().
 */
export function openOfficialDocumentPrintWindow(opts: OfficialPrintWindowOpts): void {
  const html = buildOfficialDocumentFullHtml(opts);
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  schedulePrint(win);
}
