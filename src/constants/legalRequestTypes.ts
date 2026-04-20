/** مجموعات وأنواع طلبات إدارية/قانونية شائعة — قابلة للتوسعة */
export type RequestGroupId =
  | "morocco_admin"
  | "justice"
  | "business"
  | "education"
  | "housing"
  | "intl"
  | "other";

export const LEGAL_REQUEST_GROUPS: {
  id: RequestGroupId;
  typeIds: string[];
}[] = [
  {
    id: "morocco_admin",
    typeIds: [
      "id_card_renewal",
      "residence_certificate",
      "address_change",
      "birth_certificate",
      "marriage_certificate",
      "family_record",
      "nationality_cert",
      "passport_request",
      "passeport_lost",
      "driver_license_exchange",
      "vehicle_registration",
      "tax_clearance",
      "cnss_affiliation",
      "health_insurance_card",
    ],
  },
  {
    id: "justice",
    typeIds: [
      "casier_judiciaire",
      "legal_aid",
      "court_hearing",
      "notarized_power",
      "inheritance_file",
      "complaint_draft",
    ],
  },
  {
    id: "business",
    typeIds: [
      "company_registration",
      "trade_register_extract",
      "auto_entrepreneur",
      "vat_registration",
      "commercial_lease",
      "employment_contract",
    ],
  },
  {
    id: "education",
    typeIds: [
      "school_transfer",
      "diploma_equivalence",
      "exam_authorization",
      "scholarship_request",
    ],
  },
  {
    id: "housing",
    typeIds: ["rent_subsidy", "social_housing", "utility_subscription"],
  },
  {
    id: "intl",
    typeIds: [
      "visa_application",
      "embassy_letter",
      "consular_registration",
      "translation_legalization",
    ],
  },
  {
    id: "other",
    typeIds: ["custom_freeform"],
  },
];

/** تحديد المجموعة (إداري / قضائي / …) من معرف نوع الطلب */
export function getRequestGroupIdForType(requestTypeId: string): RequestGroupId {
  for (const g of LEGAL_REQUEST_GROUPS) {
    if (g.typeIds.includes(requestTypeId)) return g.id;
  }
  return "other";
}
