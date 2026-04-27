import { v4 as uuidv4 } from "uuid";
import { todayIsoLocal } from "@/lib/todayIso";

export type OrgKind = "organization" | "institute" | "center";

export type MemberRow = {
  id: string;
  fullName: string;
  nationalId: string;
  membershipNo: string;
  regDate: string;
  endDate: string;
  amountDh: number;
};

export type MemberMgmtSetup = {
  orgKind: OrgKind;
  name: string;
  logoDataUrl: string | null;
  savedAt: string;
};

export type MemberMgmtState = {
  setup: MemberMgmtSetup | null;
  members: MemberRow[];
};

export const ORG_LABELS: Record<OrgKind, string> = {
  organization: "مؤسسة",
  institute: "معهد",
  center: "مركز",
};

export function emptyMember(): MemberRow {
  const today = todayIsoLocal();
  return {
    id: uuidv4(),
    fullName: "",
    nationalId: "",
    membershipNo: "",
    regDate: today,
    endDate: today,
    amountDh: 0,
  };
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/** Paid = لم يحن انتهاء الانخراط بعد (تاريخ الانتهاء ≥ اليوم) */
export function isMemberPaid(m: MemberRow): boolean {
  const end = parseYmd(m.endDate);
  const today = startOfToday();
  return end >= today;
}

export function memberStatusLabel(m: MemberRow): "Paid" | "Unpaid" {
  return isMemberPaid(m) ? "Paid" : "Unpaid";
}

export function addYearsFromDate(base: Date, years: number): string {
  const d = new Date(base);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}
