import type { RequestGroupId } from "@/constants/legalRequestTypes";
import type { AppLocale } from "@/i18n/strings";
import { buildMoroccanLegalCitationAr } from "@/lib/moroccanLegalCitations";
import type { MoroccanDocumentClass, MoroccanInstitutionType } from "@/lib/moroccanLegalVariables";
import { getSmartLegalParagraphAr } from "@/lib/legalSmartParagraph";

export function formatDocumentDate(isoDate: string, locale: AppLocale): string {
  if (!isoDate?.trim()) return "";
  const d = new Date(`${isoDate.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

/** ترويسة رسمية للمملكة — الوثائق الإدارية */
export function officialKingdomHeader(locale: AppLocale): string {
  if (locale.startsWith("ar")) return "المملكة المغربية";
  if (locale === "fr") return "Royaume du Maroc";
  if (locale === "es") return "Reino de Marruecos";
  return "Kingdom of Morocco";
}

/** إطار قانوني مغربي عام للمسودة (إرشادي) */
function moroccanLegalBasis(locale: AppLocale): string {
  if (locale.startsWith("ar")) {
    return [
      "الإطار القانوني: يستند هذا الطلب إلى التشريعات والمساطر المغربية الجاري بها العمل، بما يشمل المسطرة المدنية والجنائية والإدارية بحسب موضوع الطلب، مع مراعاة الشروط الشكلية والموضوعية للقبول.",
    ].join("\n");
  }
  if (locale === "fr") {
    return [
      "Cadre juridique (indicatif) : la présente demande s'appuie sur la Constitution et les procédures marocaines en vigueur, notamment :",
      "— le code de procédure civile (Dahir 1-58-250 du 12 février 1974) tel que modifié, pour les matières civiles ;",
      "— la procédure pénale / code de procédure pénale applicable pour les affaires pénales ou plaintes ;",
      "— la loi n° 03-12 relative au recours devant les juridictions administratives ;",
      "— les textes sectoriels applicables, sous réserve des formalités de forme et de fond pour recevabilité.",
    ].join("\n");
  }
  if (locale === "es") {
    return [
      "Marco jurídico (orientativo): esta solicitud se basa en la Constitución y en las normas procesales marroquíes vigentes, entre otras:",
      "— el Dahir n.º 1-58-250 de 12 de febrero de 1974 (procedimiento civil), con modificaciones;",
      "— el procedimiento penal / normativa procesal penal aplicable en asuntos penales o denuncias;",
      "— la ley n.º 03-12 sobre recursos ante la jurisdicción administrativa;",
      "— los textos sectoriales aplicables, con los requisitos formales y materiales de admisibilidad.",
    ].join("\n");
  }
  return [
    "Legal framework (indicative): this application relies on the Constitution and Moroccan law in force, including for example:",
    "— Code of Civil Procedure (Dahir 1-58-250 of 12 February 1974) as amended, for civil matters;",
    "— criminal procedure / applicable penal procedural rules for criminal matters or complaints;",
    "— Law 03-12 on administrative justice;",
    "— applicable sectoral texts, subject to formal and substantive requirements for official admissibility.",
  ].join("\n");
}

/**
 * للوثائق العربية الرسمية: أخذ الجزء العربي فقط عندما تكون تسميات الواجهة ثنائية اللغة (عربي / إنجليزي).
 */
export function arabicOfficialLine(s: string): string {
  const t = s.trim();
  if (!t) return t;
  const sep = " / ";
  const i = t.indexOf(sep);
  if (i >= 0) return t.slice(0, i).trim();
  const dash = " — ";
  const j = t.indexOf(dash);
  if (j >= 0) {
    const after = t.slice(j + dash.length).trim();
    if (/^[A-Za-zÀ-ÿ]/.test(after)) return t.slice(0, j).trim();
  }
  return t;
}

type DraftParams = {
  /** صيغة التوجيه الرسمية، مثلاً: إلى السيد وكيل الملك */
  formalRecipientLine: string;
  requestGroupId: RequestGroupId;
  recipientEntity: string;
  serviceCenterLabel: string;
  requestTypeLabel: string;
  fullName: string;
  nationalId: string;
  address: string;
  phone: string;
  email: string;
  documentDateIso: string;
  dateFormatted: string;
  /** نوع المؤسسة القضائية — يحدد قاعدة الاقتباس القانوني (متغيرات في moroccanLegalVariables) */
  institutionTypeId?: MoroccanInstitutionType;
  /** نوع الوثيقة — يحدد صياغة «بناءً على الفصل…» و«طبقاً لمقتضيات القانون…» */
  documentClassId?: MoroccanDocumentClass;
};

/**
 * مسودة طلب إداري/قانوني بلهجة رسمية — مع ترويسة المملكة وأساس قانوني مغربي.
 */
export function buildLegalRequestDraft(locale: AppLocale, p: DraftParams): string {
  const rec = p.recipientEntity.trim() || "—";
  const center = p.serviceCenterLabel.trim();
  const centerDisplay = locale.startsWith("ar") ? arabicOfficialLine(center) : center;
  const requestTypeDisplay = locale.startsWith("ar") ? arabicOfficialLine(p.requestTypeLabel.trim()) : p.requestTypeLabel.trim();
  const name = p.fullName.trim() || "…";
  const cin = p.nationalId.trim() || "…";
  const addr = p.address.trim() || "…";
  const phone = p.phone.trim();
  const email = p.email.trim();
  const dateLine = p.dateFormatted || formatDocumentDate(p.documentDateIso, locale);
  const kingdom = officialKingdomHeader(locale);
  const legalBlock = moroccanLegalBasis(locale);
  const saluteAr = p.formalRecipientLine.trim() || "إلى السيد المدير الموقف،";
  const legalSmartAr = getSmartLegalParagraphAr(p.requestGroupId);
  const inst = p.institutionTypeId ?? "court_first_instance";
  const docCls = p.documentClassId ?? "admin_request";
  const citationAr = buildMoroccanLegalCitationAr(inst, docCls);

  const contactAr =
    phone || email
      ? [phone ? `الهاتف: ${phone}` : "", email ? `البريد: ${email}` : ""].filter(Boolean).join(" — ")
      : "";

  if (locale.startsWith("ar")) {
    return [
      saluteAr,
      "",
      rec,
      "",
      centerDisplay ? `جهة التوجيه والاختصاص: ${centerDisplay}` : "",
      "",
      `الموضوع: طلب يتعلق بـ ${requestTypeDisplay}، وفق المساطر القانونية المعمول بها.`,
      "",
      legalSmartAr,
      "",
      citationAr,
      "",
      "تحية طيبة وبعد،",
      "",
      `أنا الممضي أسفله ${name}، الحامل للبطاقة الوطنية للتعريف رقم ${cin}، الساكن بـ ${addr}.`,
      contactAr,
      "",
      `أطلب منكم المقتضى بدراسة طلبي المتعلق بـ ${requestTypeDisplay}، وإيداعه في الآجال مع الوثائق المطلوبة.`,
      "",
      `تاريخ إعداد الطلب: ${dateLine}.`,
      "",
      "وتفضلوا بقبول فائق الاحترام،",
      "",
      "التوقيع: ____________________",
    ]
      .filter((line) => line !== "")
      .join("\n");
  }

  if (locale === "fr") {
    const formalFr = p.formalRecipientLine.trim() || "À l’attention de l’autorité compétente,";
    return [
      kingdom,
      "",
      formalFr,
      `Autorité destinataire : ${rec}`,
      center ? `Orientation / compétence : ${center}` : "",
      "",
      `Objet : demande relative à « ${p.requestTypeLabel} », dans le respect des procédures marocaines en vigueur (forme et fond).`,
      "",
      legalBlock,
      "",
      `Je soussigné(e) ${name}, titulaire de la CIN n° ${cin}, demeurant à : ${addr}.`,
      phone ? `Tél. : ${phone}` : "",
      email ? `E-mail : ${email}` : "",
      "",
      `Je vous prie de bien vouloir instruire ma demande concernant « ${p.requestTypeLabel} », avec les pièces et délais requis.`,
      "",
      `Fait le ${dateLine}.`,
      "",
      "Signature : ____________________",
    ]
      .filter((line) => line !== "")
      .join("\n");
  }

  if (locale === "es") {
    const formalEs = p.formalRecipientLine.trim() || "A la atención de la autoridad competente,";
    return [
      kingdom,
      "",
      formalEs,
      `Destinatario: ${rec}`,
      center ? `Orientación / competencia: ${center}` : "",
      "",
      `Asunto: solicitud relativa a « ${p.requestTypeLabel} », conforme a los procedimientos marroquíes vigentes (forma y fondo).`,
      "",
      legalBlock,
      "",
      `Yo, ${name}, titular del documento de identidad n.º ${cin}, con domicilio en: ${addr}.`,
      phone ? `Tel.: ${phone}` : "",
      email ? `Correo: ${email}` : "",
      "",
      `Solicito el estudio de mi petición mencionada, con la documentación y plazos exigidos por su administración.`,
      "",
      `Fecha del escrito: ${dateLine}.`,
      "",
      "Firma: ____________________",
    ]
      .filter((line) => line !== "")
      .join("\n");
  }

  const formalEn = p.formalRecipientLine.trim() || "To the competent authority,";
  return [
    kingdom,
    "",
    formalEn,
    `Recipient authority: ${rec}`,
    center ? `Routing / competence: ${center}` : "",
    "",
    `Subject: application regarding « ${p.requestTypeLabel} », in compliance with applicable Moroccan procedures (form and substance).`,
    "",
    legalBlock,
    "",
    `I, the undersigned ${name}, national ID no. ${cin}, residing at: ${addr}.`,
    phone ? `Phone: ${phone}` : "",
    email ? `Email: ${email}` : "",
    "",
    `I respectfully request that you process the above application with the required documents and time limits.`,
    "",
    `Date of this request: ${dateLine}.`,
    "",
    "Signature: ____________________",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
