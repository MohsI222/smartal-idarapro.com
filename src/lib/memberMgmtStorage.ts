import type { MemberMgmtState } from "@/lib/memberMgmtTypes";

const PREFIX = "idara_member_mgmt_v1";

export function storageKey(userId: string): string {
  return `${PREFIX}_${userId}`;
}

export function loadMemberMgmt(userId: string): MemberMgmtState {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { setup: null, members: [] };
    const p = JSON.parse(raw) as MemberMgmtState;
    if (!p || typeof p !== "object") return { setup: null, members: [] };
    return {
      setup: p.setup ?? null,
      members: Array.isArray(p.members) ? p.members : [],
    };
  } catch {
    return { setup: null, members: [] };
  }
}

export function saveMemberMgmt(userId: string, state: MemberMgmtState): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
}
