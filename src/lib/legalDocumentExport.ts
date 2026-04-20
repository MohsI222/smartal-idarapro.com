import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import * as XLSX from "xlsx";
import { downloadXlsxWorkbook } from "@/lib/excelDownload";
import { escapeHtmlPdf } from "@/lib/htmlEscape";
import { buildOfficialDocumentFullHtml } from "@/lib/legalApplicationPrint";
import {
  moroccanDocumentClassLabel,
  moroccanInstitutionLabel,
  MOROCCAN_DOCUMENT_CLASS_LABELS_AR,
  MOROCCAN_INSTITUTION_LABELS_AR,
  type MoroccanDocumentClass,
  type MoroccanInstitutionType,
} from "@/lib/moroccanLegalVariables";
import { fetchBackendPrintHtml, postBackendLegalDocx } from "@/lib/backendExportClient";
import { downloadPdfFromFullHtmlDocument } from "@/lib/pdfCanvasExport";

export type LegalExportPayload = {
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

function kingdomHeaderParagraphs(): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: "المملكة المغربية",
          bold: true,
          size: 32,
        }),
      ],
      alignment: AlignmentType.RIGHT,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "────────────────────────────────────────",
          color: "003876",
        }),
      ],
      alignment: AlignmentType.RIGHT,
    }),
  ];
}

/** تصدير Word (.docx) — ترويسة المملكة والخط الأزرق كنص */
export async function downloadLegalDocumentDocx(
  fileName: string,
  payload: LegalExportPayload
): Promise<void> {
  if (await postBackendLegalDocx(payload, fileName)) return;

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
                children: [
                  new TextRun({ text: `${k}: `, bold: true }),
                  new TextRun({ text: v || "—" }),
                ],
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

  const blob = await Packer.toBlob(doc);
  const out = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = out;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** تصدير Excel (.xlsx) — عمود الحقول والقيم */
export function downloadLegalDocumentXlsx(fileName: string, payload: LegalExportPayload): void {
  const data = [
    { الحقل: "نوع المؤسسة", القيمة: MOROCCAN_INSTITUTION_LABELS_AR[payload.institutionTypeId] },
    { الحقل: "نوع الوثيقة", القيمة: MOROCCAN_DOCUMENT_CLASS_LABELS_AR[payload.documentClassId] },
    { الحقل: "الاسم الكامل", القيمة: payload.fullName },
    { الحقل: "رقم البطاقة الوطنية", القيمة: payload.nationalId },
    { الحقل: "العنوان", القيمة: payload.address },
    { الحقل: "الهاتف", القيمة: payload.phone },
    { الحقل: "البريد", القيمة: payload.email },
    { الحقل: "التوجيه الرسمي", القيمة: payload.formalRecipientLine },
    { الحقل: "الجهة", القيمة: payload.recipientEntity },
    { الحقل: "التوجيه والاختصاص", القيمة: payload.serviceCenterLabel },
    { الحقل: "نوع الطلب", القيمة: payload.requestTypeLabel },
    { الحقل: "التاريخ", القيمة: payload.documentDateDisplay },
    { الحقل: "نص الطلب", القيمة: payload.requestDetails },
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "طلب");
  const out = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  downloadXlsxWorkbook(wb, out);
}

function legalOfficialKingdomLine(lang: string): string {
  if (lang.startsWith("ar")) return "المملكة المغربية";
  if (lang === "fr") return "Royaume du Maroc";
  if (lang === "es") return "Reino de Marruecos";
  return "Kingdom of Morocco";
}

function legalOfficialMetaHeaders(lang: string): {
  institution: string;
  documentClass: string;
  fullName: string;
  nationalId: string;
  address: string;
  phone: string;
  email: string;
  date: string;
  requestBody: string;
} {
  if (lang.startsWith("ar")) {
    return {
      institution: "نوع المؤسسة",
      documentClass: "نوع الوثيقة",
      fullName: "الاسم الكامل",
      nationalId: "رقم البطاقة الوطنية",
      address: "العنوان",
      phone: "الهاتف",
      email: "البريد الإلكتروني",
      date: "التاريخ",
      requestBody: "نص الطلب:",
    };
  }
  if (lang === "fr") {
    return {
      institution: "Type d'institution",
      documentClass: "Type de document",
      fullName: "Nom complet",
      nationalId: "Numéro de la CIN",
      address: "Adresse",
      phone: "Téléphone",
      email: "E-mail",
      date: "Date",
      requestBody: "Texte de la demande :",
    };
  }
  if (lang === "es") {
    return {
      institution: "Tipo de institución",
      documentClass: "Tipo de documento",
      fullName: "Nombre completo",
      nationalId: "DNI / identificación",
      address: "Dirección",
      phone: "Teléfono",
      email: "Correo electrónico",
      date: "Fecha",
      requestBody: "Texto de la solicitud:",
    };
  }
  return {
    institution: "Institution type",
    documentClass: "Document class",
    fullName: "Full name",
    nationalId: "National ID",
    address: "Address",
    phone: "Phone",
    email: "Email",
    date: "Date",
    requestBody: "Request text:",
  };
}

/** تصدير PDF رسمي (المملكة المغربية + محتوى) عبر Canvas + jsPDF — عناوين وجداول حسب لغة الواجهة (UTF-8) */
export async function openLegalDocumentOfficialPdf(
  payload: LegalExportPayload,
  direction: "rtl" | "ltr",
  lang: string,
  fileName = `legal-request-${Date.now()}.pdf`
): Promise<void> {
  const H = legalOfficialMetaHeaders(lang);
  const instLabel = moroccanInstitutionLabel(lang, payload.institutionTypeId);
  const docLabel = moroccanDocumentClassLabel(lang, payload.documentClassId);
  const metaRows = [
    [H.institution, instLabel],
    [H.documentClass, docLabel],
    [H.fullName, payload.fullName],
    [H.nationalId, payload.nationalId],
    [H.address, payload.address],
    [H.phone, payload.phone],
    [H.email, payload.email],
    [H.date, payload.documentDateDisplay],
  ];
  const tableHtml = `
    <table style="width:100%;border-collapse:collapse;font-size:11pt;margin-bottom:16px;">
      <tbody>
        ${metaRows
          .map(
            ([k, v]) =>
              `<tr><td style="border:1px solid #000;padding:6px;font-weight:700;width:28%;">${escapeHtmlPdf(k)}</td><td style="border:1px solid #000;padding:6px;">${escapeHtmlPdf(v || "—")}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>
    <div style="font-weight:700;margin-bottom:8px;">${escapeHtmlPdf(H.requestBody)}</div>
    <div style="white-space:pre-wrap;font-size:12pt;line-height:1.65;">${escapeHtmlPdf(payload.requestDetails.trim() || "—")}</div>
  `;
  const kingdom = legalOfficialKingdomLine(lang);
  const sectionTitle = `${docLabel} — ${instLabel}`;
  const backendHtml = await fetchBackendPrintHtml({
    direction,
    lang,
    kingdomLine: kingdom,
    sectionTitle,
    innerHtml: tableHtml,
    mode: "official",
  });
  if (backendHtml) {
    await downloadPdfFromFullHtmlDocument(backendHtml, { fileName });
    return;
  }
  const full = buildOfficialDocumentFullHtml({
    innerHtml: tableHtml,
    sectionTitle,
    direction,
    lang,
    officialKingdomLine: kingdom,
  });
  await downloadPdfFromFullHtmlDocument(full, { fileName });
}
