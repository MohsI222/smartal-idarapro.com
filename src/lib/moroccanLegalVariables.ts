/**
 * ═══════════════════════════════════════════════════════════════════════════
 * مرجع قانوني مغربي — متغيرات مركزية للتحديث التلقائي عند تعديل الدستور أو القوانين
 * Moroccan legal reference hub — update these constants when legislation changes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** أنواع المؤسسات القضائية المدعومة في المحرر */
export type MoroccanInstitutionType =
  | "court_first_instance"
  | "court_commercial"
  | "court_appeal"
  | "court_family"
  | "court_military";

/** أنواع الوثائق الإجرائية المدعومة */
export type MoroccanDocumentClass =
  | "minutes"
  | "opening_petition"
  | "complaint"
  | "admin_request";

export const MOROCCAN_INSTITUTION_LABELS_AR: Record<MoroccanInstitutionType, string> = {
  court_first_instance: "محكمة ابتدائية",
  court_commercial: "محكمة تجارية",
  court_appeal: "محكمة استئناف",
  court_family: "محكمة للأسرة",
  court_military: "محكمة عسكرية",
};

export const MOROCCAN_DOCUMENT_CLASS_LABELS_AR: Record<MoroccanDocumentClass, string> = {
  minutes: "محضر",
  opening_petition: "مقال افتتاحي",
  complaint: "شكاية",
  admin_request: "طلب إداري",
};

export const MOROCCAN_INSTITUTION_LABELS_FR: Record<MoroccanInstitutionType, string> = {
  court_first_instance: "Tribunal de première instance",
  court_commercial: "Tribunal de commerce",
  court_appeal: "Cour d'appel",
  court_family: "Tribunal de la famille",
  court_military: "Justice militaire",
};

export const MOROCCAN_DOCUMENT_CLASS_LABELS_FR: Record<MoroccanDocumentClass, string> = {
  minutes: "Procès-verbal",
  opening_petition: "Conclusions introductives",
  complaint: "Plainte",
  admin_request: "Requête administrative",
};

export const MOROCCAN_INSTITUTION_LABELS_EN: Record<MoroccanInstitutionType, string> = {
  court_first_instance: "Court of first instance",
  court_commercial: "Commercial court",
  court_appeal: "Court of appeal",
  court_family: "Family court",
  court_military: "Military court",
};

export const MOROCCAN_DOCUMENT_CLASS_LABELS_EN: Record<MoroccanDocumentClass, string> = {
  minutes: "Minutes / official record",
  opening_petition: "Opening pleading",
  complaint: "Complaint",
  admin_request: "Administrative request",
};

export function moroccanInstitutionLabel(locale: string, id: MoroccanInstitutionType): string {
  if (locale === "fr") return MOROCCAN_INSTITUTION_LABELS_FR[id];
  if (locale.startsWith("ar")) return MOROCCAN_INSTITUTION_LABELS_AR[id];
  return MOROCCAN_INSTITUTION_LABELS_EN[id];
}

export function moroccanDocumentClassLabel(locale: string, id: MoroccanDocumentClass): string {
  if (locale === "fr") return MOROCCAN_DOCUMENT_CLASS_LABELS_FR[id];
  if (locale.startsWith("ar")) return MOROCCAN_DOCUMENT_CLASS_LABELS_AR[id];
  return MOROCCAN_DOCUMENT_CLASS_LABELS_EN[id];
}

/**
 * مراجع تشريعية (نصوص وظهائر) — يُحدَّث هنا فقط عند نشر قوانين جديدة أو تعديلات
 */
export const LEGAL_REF_MOROCCO = {
  /** قانون المسطرة المدنية — الظهير الشريف 1.58.250 */
  CIVIL_PROCEDURE_DAHIR: "1.58.250",
  CIVIL_PROCEDURE_DATE_AR: "12 فبراير 1974",
  /** مدونة التجارة — القانون 15.95 */
  COMMERCE_CODE: "15.95",
  /** مدونة الأسرة — ظهير شريف 1.04.22 (ساري المفعول مع التعديلات) */
  FAMILY_CODE_DAHIR: "1.04.22",
  /** القانون العام للإدارة — 03.01 */
  ADMIN_GENERAL_LAW: "03.01",
  /** قانون المسطرة أمام المحاكم الإدارية — 03.12 */
  ADMIN_JUSTICE_LAW: "03.12",
  /** القانون العسكري — مرجع إرشادي */
  MILITARY_LAW_REF: "1.77.13",
} as const;

/**
 * فصول إرشادية (وصفية) — تُستبدل بأرقام فصول دقيقة عند الحاجة بعد التحقق من النص الجاري
 * يُفضّل الإبقاء على صياغة وصفية لتجنب خطأ في رقم الفصل بعد التعديل التشريعي
 */
export const LEGAL_CHAPTER_HINTS = {
  civilProcedureOpening: "الفصول المتعلقة بافتتاح المسطرة المدنية والدعوى أمام المحاكم الابتدائية",
  civilProcedureAppeal: "الفصول المتعلقة بالاستئناف والمسطرة أمام محاكم الاستئناف",
  civilProcedureCommercial: "الفصول المتعلقة بالمنازعات التجارية والمسطرة المدنية في المادة التجارية",
  commercialCode: "الفصول المتعلقة بالأعمال التجارية والتجار والمسطرة المدنية في المادة التجارية",
  familyCode: "الفصول المتعلقة بالأحوال الشخصية والأسرة والنزاعات المدنية المرتبطة بها",
  criminalProcedure: "الفصول المتعلقة بالمسطرة الجنائية والشكايات والتتبع",
  criminalProcedureMilitary: "الفصول المتعلقة بالمسطرة الجنائية أمام القضاء العسكري",
  minutesRecords: "الفصول المتعلقة بالإثبات والمحاضر والإجراءات التحضيرية",
  adminProcedure: "الفصول المتعلقة بالمسطرة الإدارية والإجراءات أمام الإدارة أو المحاكم الإدارية",
} as const;
