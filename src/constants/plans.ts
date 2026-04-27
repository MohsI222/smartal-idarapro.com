import type { SectionId } from "./sections";

/** كل معرفات الوحدات المتاحة في اشتراك SaaS */
export const ALL_SAAS_MODULE_IDS: SectionId[] = [
  "hr",
  "law",
  "lawyer",
  "acc",
  "edu",
  "public",
  "visa",
  "inventory",
  "members",
  "company",
  "academy",
  "gov",
  "legal_ai",
  "media_lab",
  "transport_logistics",
  "chat",
  "edu_print",
  "tools",
  "reminders",
];

/** تجربة 5 أيام — كل الأقسام عدا التأشيرة (موافقة منفصلة) */
export const TRIAL_MODULE_IDS: SectionId[] = ALL_SAAS_MODULE_IDS.filter((m) => m !== "visa");

export type BillingPeriod = "monthly" | "yearly";

export type PlanAccent =
  | "emerald"
  | "sky"
  | "violet"
  | "amber"
  | "rose"
  | "cyan"
  | "fuchsia";

export type PlanOption = {
  id: string;
  labelKey: string;
  blurbKey: string;
  /** سعر الشهر بالدرهم */
  priceMonthlyDh: number;
  /** سعر السنة بالدرهم */
  priceYearlyDh: number;
  modules: SectionId[];
  accent: PlanAccent;
  /** يُعرض في الصفحة الرئيسية كخطة مميزة */
  spotlight?: boolean;
};

/**
 * خطط المنصة — كل مشترك يستفيد من المراسلات الداخلية + واتساب الإدارة (يُدمج في approvedModules)
 * رادار التأشيرة: خطة المكتبات المتقدمة أو موافقة منفصلة
 */
export const PLAN_OPTIONS: PlanOption[] = [
  {
    id: "enterprises_schools",
    labelKey: "plan.enterprisesSchools",
    blurbKey: "plan.enterprisesSchools.blurb",
    priceMonthlyDh: 999,
    priceYearlyDh: 8000,
    accent: "amber",
    spotlight: true,
    modules: [
      "edu",
      "academy",
      "chat",
      "members",
      "acc",
      "legal_ai",
      "edu_print",
      "transport_logistics",
      "inventory",
      "gov",
      "public",
      "hr",
      "tools",
      "reminders",
    ],
  },
  {
    id: "lawyers",
    labelKey: "plan.lawyers",
    blurbKey: "plan.lawyers.blurb",
    priceMonthlyDh: 599,
    priceYearlyDh: 5000,
    accent: "rose",
    modules: ["lawyer", "legal_ai", "law", "members", "acc", "hr", "inventory", "reminders", "public", "chat"],
  },
  {
    id: "libraries_base",
    labelKey: "plan.librariesBase",
    blurbKey: "plan.librariesBase.blurb",
    priceMonthlyDh: 399,
    priceYearlyDh: 3830,
    accent: "cyan",
    modules: ["legal_ai", "gov", "chat"],
  },
  {
    id: "libraries_plus",
    labelKey: "plan.librariesPlus",
    blurbKey: "plan.librariesPlus.blurb",
    priceMonthlyDh: 599,
    priceYearlyDh: 5000,
    accent: "fuchsia",
    modules: ["visa", "legal_ai", "inventory", "acc", "public", "gov", "chat"],
  },
  {
    id: "retail",
    labelKey: "plan.retail",
    blurbKey: "plan.retail.blurb",
    priceMonthlyDh: 200,
    priceYearlyDh: 1920,
    accent: "emerald",
    modules: ["inventory", "acc", "members", "chat"],
  },
  {
    id: "institutes",
    labelKey: "plan.institutes",
    blurbKey: "plan.institutes.blurb",
    priceMonthlyDh: 299,
    priceYearlyDh: 2870,
    accent: "violet",
    modules: [
      "members",
      "academy",
      "chat",
      "acc",
      "edu_print",
      "gov",
      "edu",
      "reminders",
      "inventory",
      "public",
    ],
  },
  {
    id: "accountants",
    labelKey: "plan.accountants",
    blurbKey: "plan.accountants.blurb",
    priceMonthlyDh: 599,
    priceYearlyDh: 5000,
    accent: "sky",
    modules: [
      "company",
      "public",
      "members",
      "chat",
      "legal_ai",
      "law",
      "academy",
      "hr",
      "acc",
      "inventory",
      "tools",
      "reminders",
    ],
  },
];

/** إضافة رادار التأشيرة (Premium) — موافقة الأدمن */
export const VISA_PREMIUM_ADDON_DH = 100;
export const VISA_PREMIUM_PLAN_ID = "visa_premium";

/** خطط قديمة — للعرض في لوحة الإدارة فقط */
export const LEGACY_PLAN_IDS = new Set([
  "simple_commerce",
  "inventory_pro",
  "members_org",
  "full_management",
]);

export function planPriceDh(plan: PlanOption, period: BillingPeriod): number {
  return period === "yearly" ? plan.priceYearlyDh : plan.priceMonthlyDh;
}

/** نسبة التوفير السنوي مقابل 12× شهري */
export function yearlySavingsPercent(plan: PlanOption): number {
  const monthly12 = plan.priceMonthlyDh * 12;
  if (monthly12 <= 0) return 0;
  return Math.round((1 - plan.priceYearlyDh / monthly12) * 100);
}

/** فرق السعر: كم توفر بالدرهم سنوياً مقابل الشهري */
export function yearlySavingsDh(plan: PlanOption): number {
  return plan.priceMonthlyDh * 12 - plan.priceYearlyDh;
}
