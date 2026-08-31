import {
  Barcode,
  Building2,
  Calculator,
  Car,
  FileText,
  Gavel,
  GraduationCap,
  LayoutGrid,
  MessageCircle,
  HousePlus,
  Shield,
  Radar,
  Scale,
  Sparkles,
  Train,
  Users,
  Video,
  LifeBuoy,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  /** يبرز الرابط في الشريط الجانبي (حدود/خلفية) */
  emphasize?: boolean;
  /** الصلاحية المطلوبة للوصول لهذا القسم */
  permission?: keyof import('@/context/PermissionsContext').UserPermissions;
};

/** منصة SaaS — الوحدات الجديدة */
export const PLATFORM_NAV: AppNavItem[] = [
  {
    to: "/app/inventory?tab=dash",
    icon: Barcode,
    labelKey: "nav.inventory",
    emphasize: true,
    permission: "can_access_inventory",
  },
  { to: "/app/company", icon: Building2, labelKey: "nav.company" },
  { to: "/app/tl", icon: Train, labelKey: "nav.transportLogistics", permission: "can_access_transport_logistics" },
  { to: "/app/delivery-hub", icon: Truck, labelKey: "nav.deliveryHub", emphasize: true, permission: "can_access_delivery" },
  { to: "/app/auto-real-estate", icon: HousePlus, labelKey: "nav.autoRealEstate", emphasize: true, permission: "can_access_auto_real_estate" },
  { to: "/app/company?sector=commercial-industrial", icon: Building2, labelKey: "nav.commercialCompany" },
  { to: "/app/academy", icon: Video, labelKey: "nav.corporateAcademy" },
  { to: "/app/members", icon: Users, labelKey: "nav.memberMgmt" },
  { to: "/app/lawyer", icon: Gavel, labelKey: "nav.lawyerPortal", emphasize: true, permission: "can_access_legal" },
  { to: "/app/law", icon: Scale, labelKey: "nav.caseTracking", permission: "can_access_legal" },
  { to: "/app/legal-ai", icon: Sparkles, labelKey: "nav.legalAi", permission: "can_access_ai" },
  { to: "/app/acc", icon: Calculator, labelKey: "nav.financeMgmt" },
  { to: "/app/edu", icon: GraduationCap, labelKey: "nav.smartEducation" },
  { to: "/app/edu-print", icon: FileText, labelKey: "nav.eduPrint" },
  { to: "/app/techauto", icon: Car, labelKey: "nav.techAuto" },
  { to: "/app/tools", icon: LayoutGrid, labelKey: "nav.businessTools" },
  { to: "/app/visa", icon: Radar, labelKey: "nav.visaRadar" },
  { to: "/app/chat", icon: MessageCircle, labelKey: "nav.internalChat" },
];

/** الوحدات الاحترافية الحالية */
export const PRIMARY_NAV: AppNavItem[] = [
  // AI Design Studio is restricted to super admin only - removed from navigation
];

export const SECONDARY_NAV: AppNavItem[] = [
  { to: "/app/hr", icon: Building2, labelKey: "section.hr.short", permission: "can_access_hr" },
  { to: "/app/support", icon: LifeBuoy, labelKey: "nav.support" },
  { to: "/app/legal", icon: Shield, labelKey: "nav.legalTerms", permission: "can_access_settings" },
];
