import {
  LEGAL_CHAPTER_HINTS,
  LEGAL_REF_MOROCCO,
  type MoroccanDocumentClass,
  type MoroccanInstitutionType,
} from "@/lib/moroccanLegalVariables";

const L = LEGAL_REF_MOROCCO;
const H = LEGAL_CHAPTER_HINTS;

type InstBlock = { chapter: string; lawLabel: string; lawDahir: string };

const INSTITUTION_BLOCK: Record<MoroccanInstitutionType, InstBlock> = {
  court_first_instance: {
    chapter: H.civilProcedureOpening,
    lawLabel: "قانون المسطرة المدنية للمحاكم العادية",
    lawDahir: L.CIVIL_PROCEDURE_DAHIR,
  },
  court_commercial: {
    chapter: H.civilProcedureCommercial,
    lawLabel: "المسطرة المدنية في المنازعات التجارية ومدونة التجارة",
    lawDahir: L.CIVIL_PROCEDURE_DAHIR,
  },
  court_appeal: {
    chapter: H.civilProcedureAppeal,
    lawLabel: "المسطرة المدنية في درجة الاستئناف",
    lawDahir: L.CIVIL_PROCEDURE_DAHIR,
  },
  court_family: {
    chapter: H.familyCode,
    lawLabel: "مدونة الأسرة",
    lawDahir: L.FAMILY_CODE_DAHIR,
  },
  court_military: {
    chapter: H.criminalProcedureMilitary,
    lawLabel: "المسطرة أمام المحاكم العسكرية والتشريع ذي الصلة",
    lawDahir: L.MILITARY_LAW_REF,
  },
};

function lineBaina(inst: MoroccanInstitutionType, doc: MoroccanDocumentClass): string {
  const b = INSTITUTION_BLOCK[inst];
  let chapter = b.chapter;
  if (doc === "minutes") chapter = `${H.minutesRecords} و${b.chapter}`;
  if (doc === "opening_petition") chapter = `${b.chapter}، بما في ذلك ما يتعلق بصيغة المقال الافتتاحي`;
  if (doc === "complaint") chapter = `${H.criminalProcedure}، و${b.chapter}`;
  if (doc === "admin_request") chapter = `${H.adminProcedure}، و${b.chapter}`;
  return `بناءً على ${chapter}، الواردة في ${b.lawLabel} (الظهير الشريف رقم ${b.lawDahir} وتعديلاته)،`;
}

function lineTabaqan(inst: MoroccanInstitutionType, doc: MoroccanDocumentClass): string {
  if (doc === "admin_request") {
    return `وطبقاً لمقتضيات القانون رقم ${L.ADMIN_GENERAL_LAW} بمثابة النظام العام للإدارة، والقانون رقم ${L.ADMIN_JUSTICE_LAW} المتعلق بالمسطرة أمام المحاكم الإدارية حيث ينطبق الأمر، والنصوص التنظيمية الجاري بها العمل؛`;
  }
  const b = INSTITUTION_BLOCK[inst];
  if (doc === "complaint") {
    if (inst === "court_military") {
      return `وطبقاً لمقتضيات التشريع الجنائي العسكري المعمول به، وللمقتضيات الجنائية العامة حيث تنسجم مع طبيعة النازلة؛`;
    }
    return `وطبقاً لمقتضيات قانون المسطرة الجنائية الجاري بها العمل، وللمقتضيات المدنية في ${b.lawLabel} المشار إليها أعلاه حيث ينطبق؛`;
  }
  if (inst === "court_commercial") {
    return `وطبقاً لمقتضيات القانون رقم ${L.COMMERCE_CODE} المتعلق بمدونة التجارة وللمقتضيات المسطرية في المادة التجارية؛`;
  }
  if (inst === "court_family") {
    return `وطبقاً لمقتضيات مدونة الأسرة (الظهير الشريف رقم ${L.FAMILY_CODE_DAHIR} وتعديلاته) وللمسطرة المدنية في النزاعات الأسرية؛`;
  }
  return `وطبقاً لمقتضيات قانون المسطرة المدنية (الظهير الشريف رقم ${L.CIVIL_PROCEDURE_DAHIR} بتاريخ ${L.CIVIL_PROCEDURE_DATE_AR} وتعديلاته)؛`;
}

/**
 * فقرة مرجعية كاملة: «بناءً على…» + «طبقاً لمقتضيات القانون…»
 */
export function buildMoroccanLegalCitationAr(
  institution: MoroccanInstitutionType,
  docClass: MoroccanDocumentClass
): string {
  return [lineBaina(institution, docClass), lineTabaqan(institution, docClass)].join("\n");
}
