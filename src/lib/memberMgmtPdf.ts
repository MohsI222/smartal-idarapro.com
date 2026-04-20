import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import arabicPersianReshaper from "arabic-persian-reshaper";
import { fetchBackendPrintHtml } from "@/lib/backendExportClient";
import { buildOfficialDocumentFullHtml } from "@/lib/legalApplicationPrint";
import { downloadPdfFromFullHtmlDocument } from "@/lib/pdfCanvasExport";
import { buildOfficialPdfTableHtml } from "@/lib/pdfExport";
import {
  ORG_LABELS,
  memberStatusLabel,
  type MemberMgmtSetup,
  type MemberRow,
} from "@/lib/memberMgmtTypes";

const FONT_VFS_NAME = "NotoNaskhArabic-Regular.ttf";
const FONT_FAMILY = "NotoNaskhArabic";

/** TTF عام من Noto (CORS مفتوح) — يتفادى مسار /fonts الفارغ وأخطاء zlib المرتبطة بضغط PDF */
const NOTO_NASKH_AR_TTF_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoNaskhArabic/NotoNaskhArabic-Regular.ttf";

/** تحضير نص عربي لعرضه في jsPDF (سياق LTR) مع خط يدعم الحروف */
function cellText(s: string): string {
  const t = String(s ?? "").trim();
  if (!/[\u0600-\u06FF]/.test(t)) return t;
  const shaped = arabicPersianReshaper.ArabicShaper.convertArabic(t);
  return shaped.split("").reverse().join("");
}

function arrayBufferToBinaryString(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let bin = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    bin += String.fromCharCode.apply(null, sub as unknown as number[]);
  }
  return bin;
}

let fontLoadPromise: Promise<void> | null = null;

function ensureArabicFontLoaded(doc: jsPDF): Promise<void> {
  if (fontLoadPromise) return fontLoadPromise;
  fontLoadPromise = (async () => {
    const res = await fetch(NOTO_NASKH_AR_TTF_URL);
    if (!res.ok) throw new Error(`font: ${res.status}`);
    const buf = await res.arrayBuffer();
    const bin = arrayBufferToBinaryString(buf);
    doc.addFileToVFS(FONT_VFS_NAME, bin);
    doc.addFont(FONT_VFS_NAME, FONT_FAMILY, "normal", undefined, "Identity-H");
    doc.setFont(FONT_FAMILY, "normal");
  })().catch((e) => {
    fontLoadPromise = null;
    throw e;
  });
  return fontLoadPromise;
}

/** يحاول أولاً HTML من الخادم ثم PDF عبر Canvas؛ ثم يرجع لـ jsPDF */
export async function exportMemberMgmtPdfPreferBackend(opts: {
  setup: MemberMgmtSetup;
  members: MemberRow[];
  fileNameBase: string;
}): Promise<void> {
  const { setup, members, fileNameBase } = opts;
  const safe = fileNameBase.replace(/[^\w\u0600-\u06FF-]+/g, "_") || "members";
  const pdfName = `${safe}_المنخرطون.pdf`;
  const headers = [
    "الاسم الكامل",
    "رقم البطاقة الوطنية",
    "رقم الانخراط",
    "تاريخ التسجيل",
    "تاريخ الانتهاء",
    "مبلغ الدفع",
    "الحالة",
  ];
  const rows = members.map((m) => {
    const st = memberStatusLabel(m);
    const statusAr = st === "Paid" ? "مدفوع" : "غير مدفوع";
    return [m.fullName, m.nationalId, m.membershipNo, m.regDate, m.endDate, String(m.amountDh), statusAr];
  });
  const tableHtml = buildOfficialPdfTableHtml(
    headers,
    rows.length ? rows : [["لا توجد بيانات", "—", "—", "—", "—", "—", "—"]],
    "rtl"
  );
  const innerHtml = `<h2 style="color:#0f172a;font-size:14px;font-weight:800;margin:0 0 12px;">كشف المنخرطين</h2>${tableHtml}`;
  const sectionTitle = `${ORG_LABELS[setup.orgKind]} — ${setup.name}`;
  const backendHtml = await fetchBackendPrintHtml({
    direction: "rtl",
    lang: "ar",
    kingdomLine: "المملكة المغربية",
    sectionTitle,
    innerHtml,
    mode: "official",
    logoDataUrl: setup.logoDataUrl?.startsWith("data:image") ? setup.logoDataUrl : undefined,
  });
  if (backendHtml) {
    await downloadPdfFromFullHtmlDocument(backendHtml, { fileName: pdfName });
    return;
  }
  try {
    const local = buildOfficialDocumentFullHtml({
      innerHtml,
      sectionTitle,
      direction: "rtl",
      lang: "ar",
      officialKingdomLine: "المملكة المغربية",
    });
    await downloadPdfFromFullHtmlDocument(local, { fileName: pdfName });
  } catch {
    await exportMemberMgmtJsPdf(opts);
  }
}

export async function exportMemberMgmtJsPdf(opts: {
  setup: MemberMgmtSetup;
  members: MemberRow[];
  fileNameBase: string;
}): Promise<void> {
  const { setup, members, fileNameBase } = opts;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: false,
  });

  await ensureArabicFontLoaded(doc);
  doc.setFont(FONT_FAMILY, "normal");

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  doc.setFontSize(12);
  doc.setTextColor(30, 27, 75);
  const title = `${ORG_LABELS[setup.orgKind]} — ${setup.name}`;
  doc.text(cellText(title), pageW - margin, 14, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const sub = cellText("كشف المنخرطين");
  doc.text(sub, pageW - margin, 20, { align: "right" });

  const head = [
    [
      cellText("الاسم الكامل"),
      cellText("رقم البطاقة الوطنية"),
      cellText("رقم الانخراط"),
      cellText("تاريخ التسجيل"),
      cellText("تاريخ الانتهاء"),
      cellText("مبلغ الدفع"),
      cellText("الحالة"),
    ],
  ];

  const body = members.map((m) => {
    const st = memberStatusLabel(m);
    const statusAr = st === "Paid" ? "مدفوع" : "غير مدفوع";
    return [
      cellText(m.fullName),
      m.nationalId,
      m.membershipNo,
      m.regDate,
      m.endDate,
      String(m.amountDh),
      cellText(statusAr),
    ];
  });

  const emptyRow: string[][] = [
    [cellText("لا توجد بيانات"), "", "", "", "", "", ""],
  ];

  autoTable(doc, {
    startY: 26,
    head,
    body: body.length ? body : emptyRow,
    styles: {
      font: FONT_FAMILY,
      fontSize: 8,
      halign: "right",
      valign: "middle",
      cellPadding: 1.5,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: "normal",
      halign: "right",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "grid",
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.2,
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      doc.setFont(FONT_FAMILY, "normal");
      const foot = cellText("Smart Al-Idara Pro — تصدير المنخرطين");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(foot, pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
    },
  });

  const safe = fileNameBase.replace(/[^\w\u0600-\u06FF-]+/g, "_") || "members";
  doc.save(`${safe}_المنخرطون.pdf`);
}
