import type { Express, Request, Response } from "express";
import ExcelJS from "exceljs";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MOROCCAN_DOCUMENT_CLASS_LABELS_AR,
  MOROCCAN_INSTITUTION_LABELS_AR,
  type MoroccanDocumentClass,
  type MoroccanInstitutionType,
} from "../src/lib/moroccanLegalVariables.ts";
import type { StatutsParams } from "../src/lib/companyStatuts.ts";
import { buildStatutsDocxParagraphs } from "../src/lib/companyStatutsDocx.ts";
import type { AppLocale } from "../src/i18n/strings.ts";

type LegalExportPayload = {
  fullName: string;
  nationalId: string;
  address: string;
  phone: string;
  email: string;
  formalRecipientLine: string;
  recipientEntity: string;
  serviceCenterLabel: string;
  requestTypeLabel: string;
  documentDateDisplay: string;
  requestDetails: string;
  institutionTypeId: MoroccanInstitutionType;
  documentClassId: MoroccanDocumentClass;
};

const NOTO_TTF_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoNaskhArabic/NotoNaskhArabic-Regular.ttf";

let notoBase64Cache: string | null = null;

async function getNotoFontBase64(): Promise<string> {
  if (notoBase64Cache) return notoBase64Cache;
  const r = await fetch(NOTO_TTF_URL);
  if (!r.ok) throw new Error("font fetch");
  const buf = Buffer.from(await r.arrayBuffer());
  notoBase64Cache = buf.toString("base64");
  return notoBase64Cache;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "data", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
/** صور + موسيقى اختيارية للفيديو الترويجي */
const uploadPromoFields = multer({ dest: uploadDir, limits: { fileSize: 32 * 1024 * 1024 } }).fields([
  { name: "images", maxCount: 12 },
  { name: "music", maxCount: 1 },
]);

function kingdomHeaderParagraphs(): Paragraph[] {
  return [
    new Paragraph({
      children: [new TextRun({ text: "المملكة المغربية", bold: true, size: 32 })],
      alignment: AlignmentType.RIGHT,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [new TextRun({ text: "────────────────────────────────────────", color: "003876" })],
      alignment: AlignmentType.RIGHT,
    }),
  ];
}

async function buildLegalDocBuffer(payload: LegalExportPayload): Promise<Buffer> {
  const rows: [string, string][] = [
    ["نوع المؤسسة", MOROCCAN_INSTITUTION_LABELS_AR[payload.institutionTypeId]],
    ["نوع الوثيقة", MOROCCAN_DOCUMENT_CLASS_LABELS_AR[payload.documentClassId]],
    ["الاسم الكامل", payload.fullName],
    ["رقم البطاقة الوطنية", payload.nationalId],
    ["العنوان", payload.address],
    ["الهاتف", payload.phone],
    ["البريد", payload.email],
    ["التوجيه الرسمي", payload.formalRecipientLine],
    ["الجهة", payload.recipientEntity],
    ["التوجيه / الاختصاص", payload.serviceCenterLabel],
    ["نوع الطلب", payload.requestTypeLabel],
    ["التاريخ", payload.documentDateDisplay],
  ];

  const bodyParas = payload.requestDetails
    .split(/\n+/)
    .filter((l) => l.trim().length > 0)
    .map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line.trim(), font: "Arial" })],
          alignment: AlignmentType.RIGHT,
        })
    );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          ...kingdomHeaderParagraphs(),
          ...rows.map(
            ([k, v]) =>
              new Paragraph({
                children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun({ text: v || "—" })],
                alignment: AlignmentType.RIGHT,
              })
          ),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          new Paragraph({
            children: [new TextRun({ text: "نص الطلب:", bold: true, size: 24 })],
            alignment: AlignmentType.RIGHT,
          }),
          ...bodyParas,
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

async function buildStatutsDocxServerBuffer(locale: string, payload: StatutsParams): Promise<Buffer> {
  const paragraphs = buildStatutsDocxParagraphs(locale as AppLocale, payload);
  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

async function buildReportTableDocxBuffer(opts: {
  kingdomLine: string;
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  rtl: boolean;
}): Promise<Buffer> {
  const align = opts.rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const cellText = (t: string, bold: boolean, color?: string) =>
    new TextRun({
      text: String(t ?? "—"),
      bold,
      font: "Arial",
      rightToLeft: opts.rtl,
      size: 21,
      ...(color ? { color } : {}),
    });

  const headerCells = opts.headers.map(
    (h) =>
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: "003876", color: "003876" },
        children: [
          new Paragraph({
            alignment: align,
            children: [cellText(String(h), true, "FFFFFF")],
          }),
        ],
      })
  );

  const bodyRows = opts.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (c) =>
            new TableCell({
              children: [new Paragraph({ alignment: align, children: [cellText(String(c ?? "—"), false)] })],
            })
        ),
      })
  );

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells }), ...bodyRows],
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: opts.kingdomLine, bold: true, size: 32 })],
          }),
          new Paragraph({
            alignment: align,
            children: [new TextRun({ text: opts.title, bold: true, size: 28 })],
          }),
          ...(opts.subtitle
            ? [
                new Paragraph({
                  alignment: align,
                  children: [cellText(opts.subtitle, false)],
                }),
              ]
            : []),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          table,
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Smart Al-Idara Pro — تصدير إداري احترافي",
                italics: true,
                size: 18,
                color: "64748B",
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

async function buildEmbeddedPrintHtml(opts: {
  direction: "rtl" | "ltr";
  lang: string;
  kingdomLine: string;
  sectionTitle: string;
  mainTitle?: string;
  innerHtml: string;
  mode?: "official" | "platform" | "creative";
  logoDataUrl?: string;
}): Promise<string> {
  const fontB64 = await getNotoFontBase64();
  const dir = opts.direction;
  const align = dir === "rtl" ? "right" : "left";
  const mt = escapeHtml(opts.mainTitle?.trim() || "Smart Al-Idara Pro");
  const st = escapeHtml(opts.sectionTitle.trim());
  const kl = escapeHtml(opts.kingdomLine.trim());
  const logo =
    opts.logoDataUrl?.startsWith("data:image")
      ? `<div style="margin-bottom:16px;text-align:${align};"><img class="print-keep" src="${opts.logoDataUrl}" alt="" style="max-height:72px;max-width:220px;object-fit:contain;"/></div>`
      : "";

  if (opts.mode === "platform" || opts.mode === "creative") {
    return `<!DOCTYPE html>
<html lang="${escapeHtml(opts.lang)}" dir="${dir}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${mt}</title>
<style>
@font-face{font-family:'NotoNaskh';src:url(data:font/ttf;base64,${fontB64}) format('truetype');font-weight:400;font-display:block;}
@page{size:A4;margin:20mm}
html,body{margin:0;padding:0;background:#fff!important;color:#000!important}
body{font-family:'NotoNaskh',Arial,sans-serif;font-size:12pt;line-height:1.55}
.doc-wrap{max-width:720px;margin:0 auto;padding:8px 0 32px}
header.report-header{direction:${dir};text-align:${align};padding:14px 16px 16px;margin-bottom:18px;border-bottom:3px solid #003876;background:linear-gradient(135deg,#f0f9ff 0%,#ecfdf5 45%,#fff7ed 100%);border-radius:0 0 8px 8px}
.main-line{font-size:18pt;font-weight:800;color:#0c4a6e}
.section-line{font-size:12pt;font-weight:700;margin-top:8px;color:#0369a1}
.date-line{font-size:9pt;margin-top:6px;color:#64748b}
.print-body{direction:${dir};text-align:${align}}
.print-body img.print-keep{display:block;max-height:72px}
@media print{
  img:not(.print-keep),svg:not(.print-keep){display:none!important}
}
</style></head>
<body><div class="doc-wrap">
<header class="report-header">
<div class="main-line">${mt}</div>
${st ? `<div class="section-line">${st}</div>` : ""}
<div class="date-line">${escapeHtml(new Date().toLocaleString(opts.lang))}</div>
</header>
${logo}
<div class="print-body">${opts.innerHtml}</div>
</div></body></html>`;
  }

  return `<!DOCTYPE html>
<html lang="${escapeHtml(opts.lang)}" dir="${dir}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${kl}</title>
<style>
@font-face{font-family:'NotoNaskh';src:url(data:font/ttf;base64,${fontB64}) format('truetype');font-weight:400;font-display:block;}
@page{size:A4;margin:20mm}
html,body{margin:0;padding:0;background:#fff!important;color:#000!important}
body{font-family:'NotoNaskh',Arial,serif;font-size:12pt}
.doc-wrap{max-width:720px;margin:0 auto;padding:8px 0 32px}
header.kingdom-header{direction:${dir};text-align:${align};padding-bottom:10px;margin-bottom:14px;border-bottom:3px solid #003876}
.kingdom-line{font-size:18pt;font-weight:900;color:#003876}
.section-line{font-size:12pt;font-weight:700;margin-top:8px;color:#000}
.date-line{font-size:9pt;margin-top:6px}
.print-body{direction:${dir};text-align:${align};font-family:'NotoNaskh',Arial,sans-serif}
.print-body table{width:100%;border-collapse:collapse;font-size:11pt}
@media print{
  table,th,td{border-color:#000!important}
  img:not(.print-keep),svg:not(.print-keep){display:none!important}
}
</style></head>
<body><div class="doc-wrap">
<header class="kingdom-header">
<div class="kingdom-line">${kl}</div>
<div class="section-line">${st}</div>
<div class="date-line">${escapeHtml(new Date().toLocaleString(opts.lang))}</div>
</header>
${logo}
<div class="print-body">${opts.innerHtml}</div>
</div></body></html>`;
}

function configureCloudinary(): boolean {
  const n = process.env.CLOUDINARY_CLOUD_NAME;
  const k = process.env.CLOUDINARY_API_KEY;
  const s = process.env.CLOUDINARY_API_SECRET;
  if (!n || !k || !s) return false;
  cloudinary.config({ cloud_name: n, api_key: k, api_secret: s });
  return true;
}

export function registerBackendServices(
  app: Express,
  authMiddleware: (req: Request, res: Response, next: () => void) => void
): void {
  app.post(
    "/api/backend/xlsx-stream",
    authMiddleware,
    async (req: Request, res: Response) => {
      const body = req.body as {
        fileName?: string;
        sheets?: {
          name: string;
          rows: (string | number | null | undefined)[][];
          rtl?: boolean;
          columnWidths?: number[];
          headerRow?: boolean;
        }[];
      };
      if (!body?.sheets?.length) {
        res.status(400).json({ error: "sheets required" });
        return;
      }
      const rawName = body.fileName?.trim() || "export.xlsx";
      const fileName = rawName.endsWith(".xlsx") ? rawName : `${rawName}.xlsx`;
      try {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
          stream: res,
          useSharedStrings: true,
          useStyles: true,
        });

        for (const sh of body.sheets) {
          const safeName = (sh.name || "Sheet").replace(/[:\\/?*\[\]]/g, "_").slice(0, 31) || "Sheet";
          const worksheet = workbook.addWorksheet(safeName, {
            views: [{ rightToLeft: !!sh.rtl }],
          });
          if (sh.columnWidths?.length) {
            sh.columnWidths.forEach((w, i) => {
              worksheet.getColumn(i + 1).width = w;
            });
          }
          const useHeader = sh.headerRow !== false;
          const thin = {
            style: "thin" as const,
            color: { argb: "FF94A3B8" },
          };
          let rowIndex = 0;
          for (const row of sh.rows) {
            rowIndex++;
            const excelRow = worksheet.addRow(row ?? []);
            if (useHeader && rowIndex === 1) {
              excelRow.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
              excelRow.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF003876" },
              };
              excelRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            } else {
              excelRow.font = { name: "Calibri", size: 11, color: { argb: "FF0F172A" } };
              if (rowIndex > 1 && rowIndex % 2 === 0) {
                excelRow.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFF8FAFC" },
                };
              }
              excelRow.alignment = { vertical: "middle", wrapText: true };
            }
            excelRow.eachCell((cell) => {
              cell.border = {
                top: thin,
                left: thin,
                bottom: thin,
                right: thin,
              };
            });
            excelRow.commit();
          }
          await worksheet.commit();
        }
        await workbook.commit();
      } catch (e) {
        console.error("[backend/xlsx-stream]", e);
        if (!res.headersSent) res.status(500).json({ error: "فشل توليد Excel" });
      }
    }
  );

  app.post("/api/backend/docx-legal", authMiddleware, async (req: Request, res: Response) => {
    const body = req.body as { fileName?: string; payload?: LegalExportPayload };
    if (!body?.payload) {
      res.status(400).json({ error: "payload required" });
      return;
    }
    const rawName = body.fileName?.trim() || "document.docx";
    const fileName = rawName.endsWith(".docx") ? rawName : `${rawName}.docx`;
    try {
      const buf = await buildLegalDocBuffer(body.payload);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.send(buf);
    } catch (e) {
      console.error("[backend/docx-legal]", e);
      res.status(500).json({ error: "فشل توليد Word" });
    }
  });

  app.post("/api/backend/docx-statuts", authMiddleware, async (req: Request, res: Response) => {
    const body = req.body as { fileName?: string; locale?: string; payload?: StatutsParams };
    if (!body?.payload || !body.locale) {
      res.status(400).json({ error: "locale و payload مطلوبان" });
      return;
    }
    const rawName = body.fileName?.trim() || "statuts.docx";
    const fileName = rawName.endsWith(".docx") ? rawName : `${rawName}.docx`;
    try {
      const buf = await buildStatutsDocxServerBuffer(body.locale, body.payload);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.send(buf);
    } catch (e) {
      console.error("[backend/docx-statuts]", e);
      res.status(500).json({ error: "فشل توليد النظام الأساسي" });
    }
  });

  app.post("/api/backend/docx-report", authMiddleware, async (req: Request, res: Response) => {
    const body = req.body as {
      fileName?: string;
      kingdomLine?: string;
      title?: string;
      subtitle?: string;
      headers?: string[];
      rows?: (string | number | null | undefined)[][];
      rtl?: boolean;
    };
    if (!body?.title || !body?.headers?.length) {
      res.status(400).json({ error: "title و headers مطلوبان" });
      return;
    }
    const rawName = body.fileName?.trim() || "report.docx";
    const fileName = rawName.endsWith(".docx") ? rawName : `${rawName}.docx`;
    try {
      const buf = await buildReportTableDocxBuffer({
        kingdomLine: body.kingdomLine ?? "المملكة المغربية",
        title: body.title,
        subtitle: body.subtitle,
        headers: body.headers,
        rows: body.rows ?? [],
        rtl: body.rtl !== false,
      });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.send(buf);
    } catch (e) {
      console.error("[backend/docx-report]", e);
      res.status(500).json({ error: "فشل توليد تقرير Word" });
    }
  });

  app.post("/api/backend/print-html", authMiddleware, async (req: Request, res: Response) => {
    const body = req.body as {
      direction?: "rtl" | "ltr";
      lang?: string;
      kingdomLine?: string;
      sectionTitle?: string;
      mainTitle?: string;
      innerHtml?: string;
      mode?: "official" | "platform" | "creative";
      logoDataUrl?: string;
    };
    if (!body?.innerHtml) {
      res.status(400).json({ error: "innerHtml required" });
      return;
    }
    try {
      const html = await buildEmbeddedPrintHtml({
        direction: body.direction ?? "rtl",
        lang: body.lang ?? "ar",
        kingdomLine: body.kingdomLine ?? "المملكة المغربية",
        sectionTitle: body.sectionTitle ?? "",
        mainTitle: body.mainTitle,
        innerHtml: body.innerHtml,
        mode: body.mode ?? "official",
        logoDataUrl: body.logoDataUrl,
      });
      res.json({ html });
    } catch (e) {
      console.error("[backend/print-html]", e);
      res.status(500).json({ error: "فشل توليد وثيقة الطباعة" });
    }
  });

  app.post(
    "/api/backend/promo-video",
    authMiddleware,
    uploadPromoFields,
    async (req: Request, res: Response) => {
      const filesMap = req.files as Record<string, Express.Multer.File[]> | undefined;
      const imageFiles = filesMap?.images ?? [];
      const musicFiles = filesMap?.music ?? [];
      if (!imageFiles.length) {
        res.status(400).json({ error: "صور ناقصة", fallback: true });
        return;
      }
      const headline = String((req.body as { headline?: string }).headline ?? "").slice(0, 200);
      const tagline = String((req.body as { tagline?: string }).tagline ?? "").slice(0, 280);
      const captions = String((req.body as { captions?: string }).captions ?? "").slice(0, 1200);
      const shotKey = process.env.SHOTSTACK_API_KEY?.trim();
      const shotBase = (process.env.SHOTSTACK_BASE_URL ?? "https://api.shotstack.io/v1").replace(/\/$/, "");
      const defaultMusic =
        process.env.PROMO_MUSIC_URL?.trim() ||
        "https://cdn.pixabay.com/download/audio/2022/03/15/audio_115b9b31b2.mp3";

      const cloudOk = configureCloudinary();
      const allTemp = [...imageFiles, ...musicFiles];
      if (!cloudOk) {
        for (const f of allTemp) {
          try {
            fs.unlinkSync(f.path);
          } catch {
            /* ignore */
          }
        }
        res.status(503).json({
          fallback: true,
          message: "اضبط CLOUDINARY_CLOUD_NAME و CLOUDINARY_API_KEY و CLOUDINARY_API_SECRET",
        });
        return;
      }

      const urls: string[] = [];
      let musicUrl: string | undefined;
      try {
        for (const f of imageFiles) {
          const up = await cloudinary.uploader.upload(f.path, {
            folder: "idara/promo",
            resource_type: "image",
            overwrite: false,
          });
          urls.push(up.secure_url);
        }
        if (musicFiles[0]) {
          const mu = await cloudinary.uploader.upload(musicFiles[0].path, {
            folder: "idara/promo-audio",
            resource_type: "auto",
            overwrite: false,
          });
          musicUrl = mu.secure_url;
        }
      } catch (e) {
        console.error("[promo-video] cloudinary upload", e);
        for (const f of allTemp) {
          try {
            fs.unlinkSync(f.path);
          } catch {
            /* ignore */
          }
        }
        res.status(500).json({ fallback: true, message: "فشل رفع الوسائط" });
        return;
      } finally {
        for (const f of allTemp) {
          try {
            fs.unlinkSync(f.path);
          } catch {
            /* ignore */
          }
        }
      }

      if (!shotKey) {
        res.status(503).json({
          fallback: true,
          message: "الصور جاهزة على السحابة — أضف SHOTSTACK_API_KEY لدمج فيديو",
          imageUrls: urls,
          headline,
        });
        return;
      }

      const clipLen = 4;
      const totalLen = urls.length * clipLen;
      const imageClips = urls.map((src, i) => ({
        asset: { type: "image", src },
        start: i * clipLen,
        length: clipLen,
        effect: "zoomIn",
      }));

      const captionBlock = [headline, tagline, captions].filter((s) => s.trim().length > 0).join("\n\n");
      const titleTrackClips: Record<string, unknown>[] = [];
      if (captionBlock.trim()) {
        titleTrackClips.push({
          asset: {
            type: "title",
            text: captionBlock.slice(0, 480),
            style: "minimal",
            color: "#ffffff",
            size: "small",
            background: "#003876",
          },
          start: 0,
          length: Math.min(totalLen, 90),
          position: "bottom",
        });
      }

      const soundtrackSrc = musicUrl || defaultMusic;
      const timeline = {
        timeline: {
          background: "#0a1628",
          soundtrack: soundtrackSrc
            ? {
                src: soundtrackSrc,
                effect: "fadeOut",
                volume: musicUrl ? 0.42 : 0.28,
              }
            : undefined,
          tracks: [
            { clips: imageClips },
            ...(titleTrackClips.length ? [{ clips: titleTrackClips }] : []),
          ],
        },
        output: { format: "mp4", resolution: "hd", fps: 25 },
      };

      try {
        const sr = await fetch(`${shotBase}/render`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": shotKey,
          },
          body: JSON.stringify(timeline),
        });
        const sj = (await sr.json().catch(() => ({}))) as {
          response?: { id?: string; url?: string; message?: string; status?: string };
          message?: string;
        };
        if (!sr.ok) {
          res.status(502).json({
            fallback: true,
            message: sj.message ?? sj.response?.message ?? "Shotstack error",
            imageUrls: urls,
          });
          return;
        }
        const id = sj.response?.id;
        if (!id) {
          res.status(502).json({
            fallback: true,
            message: "لم يُرجع Shotstack معرّف العرض",
            imageUrls: urls,
          });
          return;
        }

        let videoUrl: string | undefined;
        for (let attempt = 0; attempt < 90; attempt++) {
          await new Promise((r) => setTimeout(r, 2000));
          const stRes = await fetch(`${shotBase}/render/${id}`, {
            headers: { "x-api-key": shotKey },
          });
          const stData = (await stRes.json().catch(() => ({}))) as {
            response?: { status?: string; url?: string; error?: string };
          };
          const status = stData.response?.status;
          if (status === "done" && stData.response?.url) {
            videoUrl = stData.response.url;
            break;
          }
          if (status === "failed") {
            res.status(502).json({
              fallback: true,
              message: stData.response?.error ?? "فشل تجهيز الفيديو",
              imageUrls: urls,
            });
            return;
          }
        }

        if (videoUrl) {
          res.json({ provider: "shotstack", url: videoUrl });
          return;
        }
        res.status(504).json({
          fallback: true,
          message: "انتهت مهلة انتظار الفيديو من Shotstack",
          imageUrls: urls,
        });
      } catch (e) {
        console.error("[promo-video] shotstack", e);
        res.status(500).json({ fallback: true, message: "Shotstack فشل", imageUrls: urls });
      }
    }
  );
}
