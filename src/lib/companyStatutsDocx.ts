import { Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import type { AppLocale } from "@/i18n/strings";
import type { StatutsParams } from "@/lib/companyStatuts";

function pLtr(text: string, bold = false) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 160 },
    children: [
      new TextRun({
        text,
        bold,
        font: "Calibri",
        size: bold ? 28 : 22,
      }),
    ],
  });
}

function pRtl(text: string, bold = false) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 160 },
    children: [
      new TextRun({
        text,
        bold,
        font: "Arial",
        rightToLeft: true,
        size: bold ? 28 : 22,
      }),
    ],
  });
}

function buildArDocx(p: StatutsParams): Paragraph[] {
  return [
    pRtl("المملكة المغربية", true),
    pRtl("النظام الأساسي — شركة ذات مسؤولية محدودة ذات شريك واحد (SARLAU)", true),
    pRtl(
      "المرجع القانوني: القانون 5.15 (مدونة الشركات) والظهير 1.15.16 وتعديلاته.",
      false
    ),
    pRtl(`المادة 1 — التسمية: «${p.denomination}».`, false),
    pRtl(`المادة 2 — المركز الاجتماعي: ${p.siege}.`, false),
    pRtl(`المادة 3 — الغرض: ${p.objet}.`, false),
    pRtl(`المادة 4 — رأس المال: ${p.capital} درهم.`, false),
    pRtl(`المادة 5 — الشريك الوحيد: ${p.associes}.`, false),
    pRtl(
      "المادة 6 إلى 15 — التسيير، المحاسبة، التعديل، الانحلال، النزاعات: وفق مدونة الشركات والمحاكم المختصة بالمملكة المغربية.",
      false
    ),
    pRtl(`تاريخ المسودة: ${p.dateIso}`, false),
    pRtl("التوقيعات: الشريك الوحيد ______________  المدير ______________", false),
    pRtl("ملحق إرشادي: إيداع لدى المحكمة التجارية والسجل التجاري وDGI قبل المصادقة النهائية.", false),
  ];
}

function buildFrDocx(p: StatutsParams): Paragraph[] {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
      children: [new TextRun({ text: "Royaume du Maroc", bold: true, font: "Calibri", size: 32 })],
    }),
    pLtr("Statuts — SARLAU", true),
    pLtr(
      "Référence : Code des sociétés (loi 5.15), Dahir 1-15-16 du 20 août 2015. Projet indicatif — validation professionnelle requise.",
      false
    ),
    pLtr(`Article 1 — Dénomination : « ${p.denomination} ».`, true),
    pLtr(`Article 2 — Siège : ${p.siege}.`, false),
    pLtr(`Article 3 — Objet : ${p.objet}.`, false),
    pLtr(`Article 4 — Capital : ${p.capital} dirhams.`, false),
    pLtr(`Article 5 — Associé unique : ${p.associes}.`, false),
    pLtr(
      "Articles 6 à 15 — Gestion, comptabilité, modifications, dissolution, tribunaux marocains compétents.",
      false
    ),
    pLtr(`Projet établi le : ${p.dateIso}`, false),
    pLtr("Signatures : associé unique ______________  gérant ______________", false),
    pLtr("Annexe : dépôt tribunal de commerce, RC, DGI.", false),
  ];
}

function buildEsDocx(p: StatutsParams): Paragraph[] {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
      children: [new TextRun({ text: "Reino de Marruecos", bold: true, font: "Calibri", size: 32 })],
    }),
    pLtr("Estatutos — SARLAU", true),
    pLtr(
      "Marco legal: Código de Sociedades (ley 5.15), Dahir 1-15-16. Borrador orientativo — revisión profesional.",
      false
    ),
    pLtr(`Artículo 1 — Denominación: « ${p.denomination} ».`, true),
    pLtr(`Artículo 2 — Domicilio: ${p.siege}.`, false),
    pLtr(`Artículo 3 — Objeto: ${p.objet}.`, false),
    pLtr(`Artículo 4 — Capital: ${p.capital} dirhams.`, false),
    pLtr(`Artículo 5 — Socio único: ${p.associes}.`, false),
    pLtr("Artículos 6 a 15 — Administración, contabilidad, modificación, disolución, tribunales marroquíes.", false),
    pLtr(`Borrador fechado: ${p.dateIso}`, false),
    pLtr("Firmas: socio único ______________  gerente ______________", false),
    pLtr("Anexo: registro mercantil, DGI.", false),
  ];
}

function buildEnDocx(p: StatutsParams): Paragraph[] {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
      children: [new TextRun({ text: "Kingdom of Morocco", bold: true, font: "Calibri", size: 32 })],
    }),
    pLtr("Articles of association — SARLAU", true),
    pLtr(
      "Legal basis: Companies Code (Act 5.15), Dahir 1-15-16 of 20 August 2015. Indicative draft — professional review required.",
      false
    ),
    pLtr(`Article 1 — Name: « ${p.denomination} ».`, true),
    pLtr(`Article 2 — Registered office: ${p.siege}.`, false),
    pLtr(`Article 3 — Purpose: ${p.objet}.`, false),
    pLtr(`Article 4 — Capital: ${p.capital} MAD.`, false),
    pLtr(`Article 5 — Sole member: ${p.associes}.`, false),
    pLtr("Articles 6–15 — Management, accounting, amendment, dissolution, competent Moroccan courts.", false),
    pLtr(`Draft dated: ${p.dateIso}`, false),
    pLtr("Signatures: sole member ______________  manager ______________", false),
    pLtr("Annex: commercial court, trade register, DGI.", false),
  ];
}

export function buildStatutsDocxParagraphs(locale: AppLocale, p: StatutsParams): Paragraph[] {
  if (locale.startsWith("ar")) return buildArDocx(p);
  if (locale === "fr") return buildFrDocx(p);
  if (locale === "es") return buildEsDocx(p);
  return buildEnDocx(p);
}
