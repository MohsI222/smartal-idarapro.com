import {
  Bell,
  Building2,
  Calculator,
  Gavel,
  GraduationCap,
  LayoutGrid,
  MessageCircle,
  Palette,
  Radar,
  Scale,
  Train,
  Users,
  FileText,
  type LucideIcon,
} from "lucide-react";

export type SectionId =
  | "hr"
  | "law"
  | "lawyer"
  | "acc"
  | "edu"
  | "public"
  | "visa"
  | "inventory"
  | "members"
  | "company"
  | "academy"
  | "gov"
  | "legal_ai"
  | "media_lab"
  | "transport_logistics"
  | "chat"
  | "edu_print"
  | "tools"
  | "reminders";

export type SectionDef = {
  id: SectionId;
  titleKey: string;
  shortTitleKey: string;
  icon: LucideIcon;
  color: string;
  price: string;
  path: string;
};

export const SECTIONS: SectionDef[] = [
  {
    id: "hr",
    titleKey: "section.hr.title",
    shortTitleKey: "section.hr.short",
    icon: Building2,
    color: "text-blue-400",
    price: "—",
    path: "/app/hr",
  },
  {
    id: "law",
    titleKey: "section.law.title",
    shortTitleKey: "section.law.short",
    icon: Scale,
    color: "text-orange-400",
    price: "—",
    path: "/app/law",
  },
  {
    id: "lawyer",
    titleKey: "section.lawyer.title",
    shortTitleKey: "section.lawyer.short",
    icon: Gavel,
    color: "text-amber-400",
    price: "—",
    path: "/app/lawyer",
  },
  {
    id: "acc",
    titleKey: "section.acc.title",
    shortTitleKey: "section.acc.short",
    icon: Calculator,
    color: "text-emerald-400",
    price: "—",
    path: "/app/acc",
  },
  {
    id: "edu",
    titleKey: "section.edu.title",
    shortTitleKey: "section.edu.short",
    icon: GraduationCap,
    color: "text-purple-400",
    price: "—",
    path: "/app/edu",
  },
  {
    id: "public",
    titleKey: "section.public.title",
    shortTitleKey: "section.public.short",
    icon: Users,
    color: "text-amber-400",
    price: "—",
    path: "/app/public",
  },
  {
    id: "visa",
    titleKey: "section.visa.title",
    shortTitleKey: "section.visa.short",
    icon: Radar,
    color: "text-cyan-400",
    price: "—",
    path: "/app/visa",
  },
  {
    id: "inventory",
    titleKey: "section.inventory.title",
    shortTitleKey: "section.inventory.short",
    icon: Building2,
    color: "text-teal-400",
    price: "—",
    path: "/app/inventory",
  },
  {
    id: "members",
    titleKey: "section.members.title",
    shortTitleKey: "section.members.short",
    icon: Users,
    color: "text-violet-400",
    price: "—",
    path: "/app/members",
  },
  {
    id: "company",
    titleKey: "section.company.title",
    shortTitleKey: "section.company.short",
    icon: Building2,
    color: "text-sky-400",
    price: "—",
    path: "/app/company",
  },
  {
    id: "academy",
    titleKey: "section.academy.title",
    shortTitleKey: "section.academy.short",
    icon: GraduationCap,
    color: "text-pink-400",
    price: "—",
    path: "/app/academy",
  },
  {
    id: "gov",
    titleKey: "section.gov.title",
    shortTitleKey: "section.gov.short",
    icon: Building2,
    color: "text-sky-400",
    price: "—",
    path: "/app/gov",
  },
  {
    id: "legal_ai",
    titleKey: "section.legal_ai.title",
    shortTitleKey: "section.legal_ai.short",
    icon: Scale,
    color: "text-rose-400",
    price: "—",
    path: "/app/legal-ai",
  },
  {
    id: "media_lab",
    titleKey: "section.media_lab.title",
    shortTitleKey: "section.media_lab.short",
    icon: Palette,
    color: "text-fuchsia-400",
    price: "—",
    path: "/app/media-lab",
  },
  {
    id: "transport_logistics",
    titleKey: "section.transport_logistics.title",
    shortTitleKey: "section.transport_logistics.short",
    icon: Train,
    color: "text-teal-400",
    price: "—",
    path: "/app/tl",
  },
  {
    id: "chat",
    titleKey: "section.chat.title",
    shortTitleKey: "section.chat.short",
    icon: MessageCircle,
    color: "text-green-400",
    price: "—",
    path: "/app/chat",
  },
  {
    id: "edu_print",
    titleKey: "section.edu_print.title",
    shortTitleKey: "section.edu_print.short",
    icon: FileText,
    color: "text-indigo-400",
    price: "—",
    path: "/app/edu-print",
  },
  {
    id: "tools",
    titleKey: "section.tools.title",
    shortTitleKey: "section.tools.short",
    icon: LayoutGrid,
    color: "text-orange-300",
    price: "—",
    path: "/app/tools",
  },
  {
    id: "reminders",
    titleKey: "section.reminders.title",
    shortTitleKey: "section.reminders.short",
    icon: Bell,
    color: "text-yellow-400",
    price: "—",
    path: "/app/reminders",
  },
];
