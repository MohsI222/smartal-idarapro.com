import {
  Barcode,
  Building2,
  Calculator,
  Car,
  FileText,
  GraduationCap,
  Landmark,
  LayoutGrid,
  MessageCircle,
  Shield,
  Radar,
  Scale,
  Sparkles,
  Train,
  Users,
  Video,
  Palette,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  /** يبرز الرابط في الشريط الجانبي (حدود/خلفية) */
  emphasize?: boolean;
};

/** منصة SaaS — الوحدات الجديدة */
export const PLATFORM_NAV: AppNavItem[] = [
  {
    to: "/app/inventory?tab=dash",
    icon: Barcode,
    labelKey: "nav.inventory",
    emphasize: true,
  },
  { to: "/app/visa", icon: Radar, labelKey: "nav.visaRadar" },
  { to: "/app/company", icon: Building2, labelKey: "nav.company" },
  { to: "/app/gov", icon: Landmark, labelKey: "nav.govHub" },
  { to: "/app/edu-print", icon: FileText, labelKey: "nav.eduPrint" },
  { to: "/app/techauto", icon: Car, labelKey: "nav.techAuto" },
  { to: "/app/chat", icon: MessageCircle, labelKey: "nav.internalChat" },
  { to: "/app/academy", icon: Video, labelKey: "nav.corporateAcademy" },
  { to: "/app/tools", icon: LayoutGrid, labelKey: "nav.businessTools" },
  { to: "/app/members", icon: Users, labelKey: "nav.memberMgmt" },
  { to: "/app/media-lab", icon: Palette, labelKey: "nav.mediaLab" },
  { to: "/app/tl", icon: Train, labelKey: "nav.transportLogistics" },
];

/** الوحدات الاحترافية الحالية */
export const PRIMARY_NAV: AppNavItem[] = [
  { to: "/app/edu", icon: GraduationCap, labelKey: "nav.smartEducation" },
  { to: "/app/public", icon: FileText, labelKey: "nav.legalLibrary" },
  { to: "/app/acc", icon: Calculator, labelKey: "nav.financeMgmt" },
  { to: "/app/law", icon: Scale, labelKey: "nav.caseTracking" },
  { to: "/app/legal-ai", icon: Sparkles, labelKey: "nav.legalAi" },
];

export const SECONDARY_NAV: AppNavItem[] = [
  { to: "/app/hr", icon: Building2, labelKey: "section.hr.short" },
  { to: "/app/support", icon: LifeBuoy, labelKey: "nav.support" },
  { to: "/app/legal", icon: Shield, labelKey: "nav.legalTerms" },
];
