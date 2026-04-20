import { ensurePdfCanvasOnlyReady, preloadPdfCanvasLibraries } from "@/lib/exportLibraries";

export type PdfFromHtmlOptions = {
  /** اسم الملف بدون مسار */
  fileName: string;
  /** دقة التقاط Canvas (1–3) — أعلى = ملف أكبر */
  scale?: number;
  /** انتظار تحميل خطوط الإطار قبل اللقطة (بعد write) */
  iframeFontWaitMs?: number;
  /** تأخير إضافي مباشرة قبل html2canvas (يساعد اكتمال الرسم العربي) */
  preCaptureDelayMs?: number;
  /** تقليص اللقطة لتناسب صفحة A4 واحدة (210×297 مم) — بدون صفحة ثانية */
  fitSinglePage?: boolean;
};

/**
 * يحوّل مستند HTML كامل (مع خطوط Google في <head>) إلى PDF عبر:
 * html2canvas → JPEG Base64 → jsPDF (صفحات متعددة A4).
 */
export async function downloadPdfFromFullHtmlDocument(
  fullHtmlDocument: string,
  opts: PdfFromHtmlOptions
): Promise<void> {
  const {
    fileName,
    scale: scaleOpt,
    iframeFontWaitMs = 260,
    preCaptureDelayMs = 0,
    fitSinglePage = false,
  } = opts;
  const safeName = (fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`).replace(
    /[^a-zA-Z0-9._\u0600-\u06FF-]+/g,
    "_"
  );

  await document.fonts.ready.catch(() => undefined);
  await ensurePdfCanvasOnlyReady();
  const { jsPDF, html2canvas } = await preloadPdfCanvasLibraries();

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "pdf-export-capture");
  iframe.setAttribute("aria-hidden", "true");
  const baseW = 794;
  iframe.style.cssText = `position:fixed;left:-14000px;top:0;width:${baseW}px;min-height:400px;border:0;opacity:0;pointer-events:none;visibility:hidden;`;
  document.body.appendChild(iframe);

  const idoc = iframe.contentDocument;
  if (!idoc) {
    document.body.removeChild(iframe);
    throw new Error("iframe document");
  }

  try {
    idoc.open();
    idoc.write(fullHtmlDocument);
    idoc.close();

    const win = iframe.contentWindow;
    if (win?.document?.fonts && typeof win.document.fonts.ready?.then === "function") {
      await win.document.fonts.ready.catch(() => undefined);
    }
    await new Promise<void>((r) => window.setTimeout(r, iframeFontWaitMs));
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    if (preCaptureDelayMs > 0) {
      await new Promise<void>((r) => window.setTimeout(r, preCaptureDelayMs));
    }

    const body = idoc.body;
    /** High-res capture: full canvas → PNG Base64 before jsPDF for layout fidelity (avoids blank/heavy compression loss). */
    const scale = Math.min(
      3,
      Math.max(2, scaleOpt ?? (fitSinglePage ? 2 : window.devicePixelRatio > 1 ? 2.5 : 2.25))
    );

    const canvas = await html2canvas(body, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      foreignObjectRendering: false,
      imageTimeout: 20_000,
      windowWidth: idoc.documentElement.scrollWidth,
      windowHeight: Math.max(idoc.documentElement.scrollHeight, body.scrollHeight),
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: canvas.width >= canvas.height ? "p" : "p",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);

    if (fitSinglePage) {
      let drawW = pageW;
      let drawH = (imgProps.height * drawW) / imgProps.width;
      if (drawH > pageH) {
        drawH = pageH;
        drawW = (imgProps.width * drawH) / imgProps.height;
      }
      const x = (pageW - drawW) / 2;
      const y = 0;
      pdf.addImage(imgData, "PNG", x, y, drawW, drawH, undefined, "SLOW");
    } else {
      const imgWmm = pageW;
      const imgHmm = (imgProps.height * imgWmm) / imgProps.width;

      let heightLeft = imgHmm;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWmm, imgHmm, undefined, "SLOW");
      heightLeft -= pageH;

      while (heightLeft > 0) {
        position = heightLeft - imgHmm;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWmm, imgHmm, undefined, "SLOW");
        heightLeft -= pageH;
      }
    }

    pdf.save(safeName);
  } finally {
    document.body.removeChild(iframe);
  }
}
