/**
 * توجيه دقيق: محاكم وإدارات مغربية — التسميات عبر `legalAi.center.*`
 */
/** الأمن الوطني والدرك أولاً كما في التوجيه الإداري الشائع */
export const LEGAL_ADMIN_CENTER_IDS = [
  "admin_national_security",
  "admin_gendarmerie",
  "admin_prefecture",
  "admin_commune",
] as const;

export const LEGAL_COURT_CENTER_IDS = [
  "court_military",
  "court_first_instance",
  "court_appeal",
  "court_cassation",
] as const;

export const LEGAL_OTHER_CENTER_IDS = [
  "provincial_council",
  "ministry",
  "cnss",
  "tax_office",
  "embassy",
  "custom",
] as const;

export const LEGAL_SERVICE_CENTER_IDS = [
  ...LEGAL_ADMIN_CENTER_IDS,
  ...LEGAL_COURT_CENTER_IDS,
  ...LEGAL_OTHER_CENTER_IDS,
] as const;

export type LegalServiceCenterId = (typeof LEGAL_SERVICE_CENTER_IDS)[number];
