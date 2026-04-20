/**
 * تحميل مسبق لحزم التصدير (jspdf، html2canvas، exceljs، docx)
 * لتقليل أخطاء التوقيت / Dictionary عند أول استدعاء.
 */

type PdfCanvasLibs = {
  jsPDF: typeof import("jspdf").default;
  html2canvas: typeof import("html2canvas").default;
};

let pdfCanvasPromise: Promise<PdfCanvasLibs> | null = null;

export function preloadPdfCanvasLibraries(): Promise<PdfCanvasLibs> {
  if (!pdfCanvasPromise) {
    pdfCanvasPromise = Promise.all([import("jspdf"), import("html2canvas")]).then(
      ([jspdfMod, h2cMod]) => ({
        jsPDF: jspdfMod.default,
        html2canvas: h2cMod.default,
      })
    );
  }
  return pdfCanvasPromise;
}

export function preloadOfficeLibraries(): Promise<void> {
  return Promise.all([import("exceljs"), import("docx")]).then(() => undefined);
}

/** مسح الباركود + FFmpeg — تحميل مسبق لتقليل أخطاء التوقيت عند أول استخدام */
export function preloadScannerAndMediaLibraries(): Promise<unknown> {
  return Promise.all([
    import("@zxing/browser").catch(() => undefined),
    import("@ffmpeg/ffmpeg").catch(() => undefined),
    import("@ffmpeg/util").catch(() => undefined),
  ]);
}

/**
 * انتظار تحميل جميع وحدات التصدير (Excel / Word / PDF)
 * قبل أي عملية كتابة ملف لتفادي أخطاء التوقيت أو القاموس الداخلي.
 */
/** PDF فقط (محرر قانوني / تقارير) — بدون FFmpeg أو مسح باركود لتسريع التحميل */
export async function ensurePdfCanvasOnlyReady(): Promise<void> {
  await preloadPdfCanvasLibraries().catch(() => undefined);
}

export async function ensureExportLibrariesReady(): Promise<void> {
  await Promise.all([
    preloadPdfCanvasLibraries().catch(() => undefined),
    preloadOfficeLibraries(),
  ]);
}

/** استدعاء خامل بعد التفاعل الأول لتسخين الكاش */
export function scheduleExportLibrariesWarmup(): void {
  if (typeof window === "undefined") return;
  const run = () => {
    void preloadPdfCanvasLibraries().catch(() => undefined);
    void preloadOfficeLibraries().catch(() => undefined);
    window.setTimeout(() => {
      void preloadScannerAndMediaLibraries().catch(() => undefined);
    }, 1200);
  };
  if (document.readyState === "complete") {
    window.requestIdleCallback?.(run) ?? window.setTimeout(run, 800);
  } else {
    window.addEventListener("load", () => window.setTimeout(run, 400), { once: true });
  }
}
