import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { ensureExportLibrariesReady } from "@/lib/exportLibraries";
import type { AppLocale } from "@/i18n/strings";
import type { StatutsParams } from "@/lib/companyStatuts";
import { buildStatutsDocxParagraphs } from "@/lib/companyStatutsDocx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function asDocxDownloadBlob(blob: Blob): Blob {
  if (blob.type === DOCX_MIME) return blob;
  return new Blob([blob], { type: DOCX_MIME });
}

/** تصدير النظام الأساسي بصيغة .docx (OOXML، UTF-8) */
export async function downloadStatutsDocx(fileName: string, locale: AppLocale, params: StatutsParams): Promise<void> {
  await ensureExportLibrariesReady();
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: buildStatutsDocxParagraphs(locale, params),
      },
    ],
  });
  const blob = asDocxDownloadBlob(await Packer.toBlob(doc));
  const out = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = out;
  a.style.setProperty("display", "none");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/** يستخرج نصاً مقروءاً من HTML للفقرات */
function linesFromHtml(html: string): string[] {
  if (typeof document === "undefined") {
    return [html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "—"];
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  const text = (wrap.innerText || wrap.textContent || "").trim();
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.length ? lines : ["—"];
}

/**
 * تقارير مخزون/فواتير — ملف ‎.docx‎ حقيقي (Open XML) مع ‎Content-Type‎ الصحيح للويندوز/أندرويد.
 */
export async function downloadHtmlAsWord(html: string, fileName: string): Promise<void> {
  const lines = linesFromHtml(html);
  const doc = new Document({
    creator: "Smart Al-Idara Pro",
    sections: [
      {
        properties: {},
        children: lines.map(
          (line) =>
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  font: "Arial",
                }),
              ],
              alignment: AlignmentType.RIGHT,
            })
        ),
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const base = fileName.replace(/\.(doc|docx|html)$/i, "");
  const out = `${base}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = out;
  a.style.setProperty("display", "none");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** جدول بسيط إلى docx (بديل عند وجود HTML جدولي فقط) */
export async function downloadTableAsWordDocx(
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  fileName: string
): Promise<void> {
  await ensureExportLibrariesReady();
  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: String(h), bold: true, font: "Arial" })],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        })
    ),
  });
  const bodyRows = rows.map(
    (r) =>
      new TableRow({
        children: r.map(
          (c) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: String(c ?? "—"), font: "Arial" })],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            })
        ),
      })
  );
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
  const doc = new Document({
    creator: "Smart Al-Idara Pro",
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 28, font: "Arial" })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ children: [new TextRun({ text: "" })] }),
          table,
        ],
      },
    ],
  });
  const blob = asDocxDownloadBlob(await Packer.toBlob(doc));
  const out = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = out;
  a.style.setProperty("display", "none");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
