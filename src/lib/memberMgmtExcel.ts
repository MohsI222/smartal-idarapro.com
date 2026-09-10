import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { downloadXlsxWorkbook } from "@/lib/excelDownload";
import type { MemberRow } from "@/lib/memberMgmtTypes";
import { memberStatusLabel } from "@/lib/memberMgmtTypes";

const HEADERS_AR = [
  "الاسم الكامل",
  "رقم البطاقة الوطنية",
  "رقم الانخراط",
  "تاريخ التسجيل",
  "تاريخ الانتهاء",
  "مبلغ الدفع (درهم)",
  "الحالة",
];

function normalizeHeader(h: string): string {
  return h.replace(/\s+/g, " ").trim().toLowerCase();
}

/** بناء مصنف Excel للمنخرطين */
export function buildMemberWorkbook(members: MemberRow[]): XLSX.WorkBook {
  const data: (string | number)[][] = [
    HEADERS_AR,
    ...members.map((m) => [
      m.fullName,
      m.nationalId,
      m.membershipNo,
      m.regDate,
      m.endDate,
      m.amountDh,
      memberStatusLabel(m) === "Paid" ? "مدفوع" : "غير مدفوع",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المنخرطون");
  return wb;
}

/** تنزيل فوري — متوافق مع macOS/Windows/Safari */
export function writeMemberExcelFile(members: MemberRow[], fileName: string): void {
  const wb = buildMemberWorkbook(members);
  downloadXlsxWorkbook(wb, fileName);
}

/** استيراد من أول ورقة — يدعم صف عناوين عربي/إنجليزي */
export function parseMemberExcelFileSync(buf: ArrayBuffer): MemberRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!rows.length) return [];

  const first = rows[0] as Record<string, string>;
  const keys = Object.keys(first);
  const norm = keys.map((k) => ({ raw: k, n: normalizeHeader(k) }));

  const mapKey = (hints: string[]) => {
    for (const h of hints) {
      const f = norm.find((x) => x.n.includes(h) || h.includes(x.n));
      if (f) return f.raw;
    }
    return "";
  };

  const alias = {
    fullName: mapKey(["الاسم", "full", "nom", "name"]),
    nationalId: mapKey(["بطاقة", "cin", "national", "هوية"]),
    membershipNo: mapKey(["انخراط", "member", "عضوية", "subscription"]),
    regDate: mapKey(["تسجيل", "reg", "inscription"]),
    endDate: mapKey(["انتهاء", "end", "expir", "fin"]),
    amountDh: mapKey(["مبلغ", "amount", "montant", "درهم"]),
  };

  const out: MemberRow[] = [];

  for (const raw of rows) {
    const r = { ...raw } as Record<string, unknown>;
    const get = (aliasKey: keyof typeof alias, fallbacks: string[]) => {
      const k = alias[aliasKey];
      if (k && r[k] !== undefined && String(r[k]).trim() !== "") return String(r[k]).trim();
      for (const fb of fallbacks) {
        if (r[fb] !== undefined && String(r[fb]).trim() !== "") return String(r[fb]).trim();
      }
      return "";
    };

    const fullName = get("fullName", ["الاسم الكامل"]);
    const nationalId = get("nationalId", ["رقم البطاقة الوطنية"]);
    const membershipNo = get("membershipNo", ["رقم الانخراط"]);
    let regDate = get("regDate", ["تاريخ التسجيل"]);
    let endDate = get("endDate", ["تاريخ الانتهاء"]);
    const amountStr = get("amountDh", ["مبلغ الدفع (درهم)"]);

    if (!fullName && !nationalId && !membershipNo) continue;

    const num = (s: string) => {
      const n = parseFloat(String(s).replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
    const fixDate = (s: string) => {
      if (!s) return new Date().toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
        const [a, b, y] = s.split("/").map(Number);
        const d = new Date(y, b - 1, a);
        return d.toISOString().slice(0, 10);
      }
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return new Date().toISOString().slice(0, 10);
    };
    regDate = fixDate(regDate);
    endDate = fixDate(endDate);

    out.push({
      id: uuidv4(),
      fullName: fullName || "—",
      nationalId: nationalId || "—",
      membershipNo: membershipNo || "—",
      regDate,
      endDate,
      amountDh: num(amountStr),
    });
  }

  return out;
}
