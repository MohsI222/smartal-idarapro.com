import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Camera,
  Download,
  FileSpreadsheet,
  FileUp,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  UserPlus,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OcrScanner } from "@/components/OcrScanner";
import { parseMoroccanIdHints } from "@/lib/moroccanIdOcrParse";
import { parseMemberExcelFileSync, writeMemberExcelFile } from "@/lib/memberMgmtExcel";
import { loadMemberMgmt, saveMemberMgmt } from "@/lib/memberMgmtStorage";
import { exportMemberMgmtPdfPreferBackend } from "@/lib/memberMgmtPdf";
import {
  ORG_LABELS,
  addYearsFromDate,
  emptyMember,
  isMemberPaid,
  memberStatusLabel,
  parseYmd,
  startOfToday,
  type MemberMgmtSetup,
  type MemberRow,
  type OrgKind,
} from "@/lib/memberMgmtTypes";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const GLASS =
  "rounded-3xl border border-white/15 bg-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-xl";
const GRAD_PAGE =
  "min-h-[calc(100vh-6rem)] rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-600/25 via-fuchsia-500/15 to-cyan-400/20 p-4 md:p-8";

async function fileToLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const maxW = 420;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxW) {
          h = (h * maxW) / w;
          w = maxW;
        }
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const cx = c.getContext("2d");
        if (!cx) {
          const r = new FileReader();
          r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
          r.onerror = () => reject(new Error("read"));
          r.readAsDataURL(file);
          return;
        }
        cx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.85));
      } finally {
        URL.revokeObjectURL(u);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(u);
      reject(new Error("image"));
    };
    img.src = u;
  });
}

export function MemberManagementModule() {
  const { user, isApproved, approvedModules } = useAuth();
  const { t } = useI18n();
  const uid = user?.id ?? "guest";
  const [setup, setSetup] = useState<MemberMgmtSetup | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [setupDraft, setSetupDraft] = useState<{
    orgKind: OrgKind;
    name: string;
    logoDataUrl: string | null;
  }>({ orgKind: "institute", name: "", logoDataUrl: null });

  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [exportPreparing, setExportPreparing] = useState(false);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = loadMemberMgmt(uid);
    setSetup(s.setup);
    setMembers(s.members);
    if (s.setup) {
      setSetupDraft({
        orgKind: s.setup.orgKind,
        name: s.setup.name,
        logoDataUrl: s.setup.logoDataUrl,
      });
    }
    setHydrated(true);
  }, [uid]);

  useEffect(() => {
    if (!hydrated) return;
    saveMemberMgmt(uid, { setup, members });
  }, [uid, setup, members, hydrated]);

  const overdue = useMemo(
    () => members.filter((m) => !isMemberPaid(m)),
    [members]
  );

  const saveSetup = useCallback(() => {
    const name = setupDraft.name.trim();
    if (!name) return;
    const next: MemberMgmtSetup = {
      orgKind: setupDraft.orgKind,
      name,
      logoDataUrl: setupDraft.logoDataUrl,
      savedAt: new Date().toISOString(),
    };
    setSetup(next);
    setSetupDialogOpen(false);
  }, [setupDraft]);

  const markPaid = useCallback((id: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const today = startOfToday();
        return { ...m, endDate: addYearsFromDate(today, 1) };
      })
    );
  }, []);

  const removeMember = useCallback((id: string) => {
    if (!confirm("حذف هذا المنخرط نهائياً؟")) return;
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const openNewMember = () => {
    setEditingMember(emptyMember());
    setMemberDialogOpen(true);
  };

  const openEditMember = (m: MemberRow) => {
    setEditingMember({ ...m });
    setMemberDialogOpen(true);
  };

  const saveMember = () => {
    if (!editingMember) return;
    const fullName = editingMember.fullName.trim();
    if (!fullName) return;
    setMembers((prev) => {
      const exists = prev.some((x) => x.id === editingMember.id);
      if (exists) return prev.map((x) => (x.id === editingMember.id ? editingMember : x));
      return [...prev, editingMember];
    });
    setMemberDialogOpen(false);
    setEditingMember(null);
  };

  const onOcrText = (text: string) => {
    const hints = parseMoroccanIdHints(text);
    setEditingMember((prev) => {
      const base = prev ?? emptyMember();
      return {
        ...base,
        fullName: hints.fullName ?? base.fullName,
        nationalId: hints.cin ?? base.nationalId,
      };
    });
    setOcrOpen(false);
    setMemberDialogOpen(true);
  };

  const importExcel = async (file: File) => {
    const buf = await file.arrayBuffer();
    const rows = parseMemberExcelFileSync(buf);
    if (!rows.length) {
      alert("لم يُعثر على صفوف صالحة في الملف.");
      return;
    }
    setMembers((prev) => [...prev, ...rows]);
    alert(`تم استيراد ${rows.length} سجلًا.`);
  };

  const handleExportExcel = useCallback(() => {
    setExportPreparing(true);
    window.setTimeout(() => {
      try {
        const safe = (setup?.name ?? "members").replace(/[^\w\u0600-\u06FF-]+/g, "_");
        writeMemberExcelFile(members, `${safe}_المنخرطون.xlsx`);
      } finally {
        setExportPreparing(false);
      }
    }, 80);
  }, [members, setup?.name]);

  const handleExportPDF = useCallback(async () => {
    if (!setup) return;
    setExportPreparing(true);
    try {
      const safe = (setup.name ?? "members").replace(/[^\w\u0600-\u06FF-]+/g, "_");
      await exportMemberMgmtPdfPreferBackend({
        setup,
        members,
        fileNameBase: safe,
      });
    } catch (e) {
      console.error(e);
      alert("تعذر إنشاء ملف PDF. تحقق من وجود الخط تحت /fonts/ أو حاول مجدداً.");
    } finally {
      setExportPreparing(false);
    }
  }, [setup, members]);

  const openSetupEdit = () => {
    if (setup) {
      setSetupDraft({
        orgKind: setup.orgKind,
        name: setup.name,
        logoDataUrl: setup.logoDataUrl,
      });
    }
    setSetupDialogOpen(true);
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        جاري التحميل…
      </div>
    );
  }

  const membersAllowed = isApproved && approvedModules.includes("members");
  if (!membersAllowed) {
    return (
      <div className="rounded-2xl border border-violet-500/30 p-8 text-center space-y-4 max-w-lg mx-auto">
        <Lock className="size-12 mx-auto text-violet-400" />
        <h2 className="text-xl font-bold text-white">{t("members.lockedTitle")}</h2>
        <p className="text-slate-400">{t("members.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  /** وضع الإعداد الأولي — ملء الاسم والنوع */
  if (!setup) {
    return (
      <div className={GRAD_PAGE} dir="rtl">
        <div
          className={cn(
            "mx-auto max-w-lg p-8 md:p-10",
            GLASS,
            "border-cyan-400/30 bg-gradient-to-br from-white/10 to-violet-500/10"
          )}
        >
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg">
              <Building2 className="size-6 text-white" />
            </span>
            <div>
              <h1 className="text-xl font-black text-white">إعداد المؤسسة</h1>
              <p className="text-sm text-slate-300">اختر النوع والاسم ثم احفظ للبدء</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-slate-200">النوع</Label>
              <select
                value={setupDraft.orgKind}
                onChange={(e) =>
                  setSetupDraft((d) => ({ ...d, orgKind: e.target.value as OrgKind }))
                }
                className="mt-1.5 w-full rounded-xl border border-white/20 bg-black/30 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50"
              >
                {(Object.keys(ORG_LABELS) as OrgKind[]).map((k) => (
                  <option key={k} value={k}>
                    {ORG_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-200">الاسم</Label>
              <Input
                value={setupDraft.name}
                onChange={(e) => setSetupDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="مثال: معهد النجاح للتكوين"
                className="mt-1.5 border-white/20 bg-black/30"
              />
            </div>
            <div>
              <Label className="text-slate-200">شعار المؤسسة (اختياري)</Label>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const data = await fileToLogoDataUrl(f);
                      setSetupDraft((d) => ({ ...d, logoDataUrl: data }));
                    } catch {
                      alert("تعذر قراءة الصورة.");
                    }
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => logoInputRef.current?.click()}
                  className="bg-white/10 text-white hover:bg-white/20"
                >
                  <Camera className="size-4" />
                  رفع الشعار
                </Button>
                {setupDraft.logoDataUrl && (
                  <img
                    src={setupDraft.logoDataUrl}
                    alt=""
                    className="h-14 w-auto max-w-[120px] rounded-lg border border-white/20 object-contain"
                  />
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">يُخزَّن محلياً مع حسابك فقط.</p>
            </div>
            <Button
              type="button"
              onClick={saveSetup}
              disabled={!setupDraft.name.trim()}
              className="w-full bg-gradient-to-l from-emerald-500 to-cyan-500 py-6 text-lg font-bold text-[#042f2e] shadow-lg hover:opacity-95"
            >
              حفظ والمتابعة
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={GRAD_PAGE} dir="rtl">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* رأس زجاجي */}
        <div
          className={cn(
            "flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between",
            GLASS,
            "bg-gradient-to-r from-indigo-500/20 via-purple-500/15 to-pink-500/20"
          )}
        >
          <div className="flex items-center gap-4">
            {setup.logoDataUrl ? (
              <img
                src={setup.logoDataUrl}
                alt=""
                className="h-16 w-auto max-w-[140px] rounded-xl border border-white/20 object-contain shadow-lg"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg">
                <Sparkles className="size-8 text-white" />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-200/80">
                {ORG_LABELS[setup.orgKind]}
              </p>
              <h1 className="text-2xl font-black text-white md:text-3xl">{setup.name}</h1>
              <p className="text-sm text-slate-300">تسيير المعاهد والمراكز — المنخرطون</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={openSetupEdit}
            className="border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <Settings2 className="size-4" />
            إعدادات المؤسسة
          </Button>
        </div>

        {/* تنبيهات المتأخرين */}
        <Card
          className={cn(
            "overflow-hidden border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.35)]",
            "bg-gradient-to-br from-red-600 via-red-700 to-rose-900 text-white"
          )}
        >
          <CardContent className="p-4 md:p-6">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="size-6 shrink-0 text-amber-200" />
              <h2 className="text-lg font-black md:text-xl">تنبيهات المتأخرين</h2>
              <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs font-bold">
                {overdue.length}
              </span>
            </div>
            {overdue.length === 0 ? (
              <p className="text-sm text-red-100/90">لا يوجد منخرطون متأخرون حالياً — بارك الله فيكم.</p>
            ) : (
              <ul className="space-y-3">
                {overdue.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/20 bg-black/20 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-bold">{m.fullName}</p>
                      <p className="text-sm text-red-100/90">
                        رقم الانخراط: <strong className="tabular-nums">{m.membershipNo}</strong> — المستحق:{" "}
                        <strong className="tabular-nums">{m.amountDh}</strong> درهم
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => markPaid(m.id)}
                        className="bg-emerald-500 font-bold text-emerald-950 hover:bg-emerald-400"
                      >
                        تم الدفع
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => removeMember(m.id)}
                        className="border-red-300/40 bg-red-950/40 text-red-100 hover:bg-red-950/60"
                      >
                        <Trash2 className="size-4" />
                        حذف
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* شريط أدوات */}
        <div className={cn("flex flex-col gap-3 p-4 md:flex-row md:flex-wrap md:items-center", GLASS)}>
          <Button
            type="button"
            onClick={openNewMember}
            className="bg-gradient-to-l from-violet-600 to-fuchsia-600 font-semibold shadow-lg"
          >
            <UserPlus className="size-4" />
            إدخال يدوي
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditingMember(emptyMember());
              setOcrOpen(true);
            }}
            className="border-cyan-400/30 bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30"
          >
            <Camera className="size-4" />
            مسح البطاقة الوطنية
          </Button>
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importExcel(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => excelInputRef.current?.click()}
            className="border-emerald-400/30 bg-emerald-500/15 text-emerald-50"
          >
            <FileUp className="size-4" />
            استيراد Excel
          </Button>
          <div className="ms-auto flex flex-col items-stretch gap-2 sm:items-end">
            {exportPreparing && (
              <p className="text-center text-sm font-semibold text-amber-200 sm:text-right animate-pulse">
                جاري التحضير…
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={exportPreparing}
                onClick={handleExportExcel}
                className="border-amber-400/40 bg-amber-500/15 text-amber-100 disabled:opacity-50"
              >
                <FileSpreadsheet className="size-4" />
                تحميل Excel
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={exportPreparing}
                onClick={() => void handleExportPDF()}
                className="border-rose-400/40 bg-rose-500/20 text-rose-50 disabled:opacity-50"
              >
                <Download className="size-4" />
                تحميل PDF
              </Button>
            </div>
          </div>
        </div>

        {/* الجدول الذكي */}
        <div className={cn("overflow-x-auto p-2 md:p-4", GLASS)}>
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="bg-gradient-to-l from-indigo-600/80 to-purple-600/80 text-right text-white">
                <th className="rounded-s-xl p-3 font-bold">الاسم الكامل</th>
                <th className="p-3 font-bold">رقم البطاقة الوطنية</th>
                <th className="p-3 font-bold">رقم الانخراط</th>
                <th className="p-3 font-bold">تاريخ التسجيل</th>
                <th className="p-3 font-bold">تاريخ الانتهاء</th>
                <th className="p-3 font-bold">مبلغ الدفع</th>
                <th className="p-3 font-bold">الحالة</th>
                <th className="rounded-e-xl p-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400">
                    لا توجد بيانات بعد — أضف منخرطاً أو استورد ملف Excel.
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const paid = isMemberPaid(m);
                  const overdueRow =
                    parseYmd(m.endDate) < startOfToday() ? "bg-red-500/10" : "bg-emerald-500/5";
                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        "border-b border-white/10 text-slate-100 transition-colors hover:bg-white/5",
                        overdueRow
                      )}
                    >
                      <td className="p-3 font-medium">{m.fullName}</td>
                      <td className="p-3 tabular-nums text-slate-300">{m.nationalId}</td>
                      <td className="p-3 tabular-nums">{m.membershipNo}</td>
                      <td className="p-3 tabular-nums text-slate-300">{m.regDate}</td>
                      <td className="p-3 tabular-nums">{m.endDate}</td>
                      <td className="p-3 tabular-nums">{m.amountDh} DH</td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                            paid
                              ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40"
                              : "bg-red-500/30 text-red-100 ring-1 ring-red-400/50"
                          )}
                        >
                          {memberStatusLabel(m) === "Paid" ? "Paid" : "Unpaid"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {!paid && (
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 bg-emerald-600/90 px-2 text-[11px] font-bold text-white hover:bg-emerald-500"
                              onClick={() => markPaid(m.id)}
                            >
                              تم الدفع
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-slate-200 hover:bg-white/10"
                            onClick={() => openEditMember(m)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-red-300 hover:bg-red-500/20"
                            onClick={() => removeMember(m.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <p className="mt-3 text-center text-[11px] text-slate-500">
            تُحدَّث الحالة تلقائياً عند تجاوز تاريخ الانتهاء — اليوم:{" "}
            {startOfToday().toISOString().slice(0, 10)}
          </p>
        </div>
      </div>

      {/* حوار إعدادات المؤسسة */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="max-w-md border-white/20 bg-[#0f172a]/95 text-white" dir="rtl">
          <DialogHeader>
            <DialogTitle>إعدادات المؤسسة</DialogTitle>
            <DialogDescription className="text-slate-400">
              تعديل النوع والاسم والشعار (محلي لحسابك).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>النوع</Label>
              <select
                value={setupDraft.orgKind}
                onChange={(e) =>
                  setSetupDraft((d) => ({ ...d, orgKind: e.target.value as OrgKind }))
                }
                className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2.5 text-sm"
              >
                {(Object.keys(ORG_LABELS) as OrgKind[]).map((k) => (
                  <option key={k} value={k}>
                    {ORG_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>الاسم</Label>
              <Input
                value={setupDraft.name}
                onChange={(e) => setSetupDraft((d) => ({ ...d, name: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>الشعار</Label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="mm-logo-edit"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const data = await fileToLogoDataUrl(f);
                      setSetupDraft((d) => ({ ...d, logoDataUrl: data }));
                    } catch {
                      alert("تعذر قراءة الصورة.");
                    }
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="secondary" asChild>
                  <label htmlFor="mm-logo-edit" className="cursor-pointer">
                    <Plus className="size-4" />
                    تغيير الشعار
                  </label>
                </Button>
                {setupDraft.logoDataUrl && (
                  <img
                    src={setupDraft.logoDataUrl}
                    alt=""
                    className="h-12 rounded-lg border border-slate-600"
                  />
                )}
              </div>
            </div>
            <Button
              type="button"
              className="w-full bg-gradient-to-l from-violet-600 to-fuchsia-600"
              onClick={saveSetup}
              disabled={!setupDraft.name.trim()}
            >
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* حوار عضو */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-lg border-white/20 bg-[#0f172a]/95 text-white" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingMember && members.some((x) => x.id === editingMember.id)
                ? "تعديل منخرط"
                : "منخرط جديد"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              أدخل البيانات أو استخدم مسح البطاقة من الشريط العلوي.
            </DialogDescription>
          </DialogHeader>
          {editingMember && (
            <div className="grid gap-3 pt-2">
              <div>
                <Label>الاسم الكامل</Label>
                <Input
                  value={editingMember.fullName}
                  onChange={(e) => setEditingMember({ ...editingMember, fullName: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>رقم البطاقة الوطنية</Label>
                <Input
                  value={editingMember.nationalId}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, nationalId: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>رقم الانخراط</Label>
                <Input
                  value={editingMember.membershipNo}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, membershipNo: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>تاريخ التسجيل</Label>
                  <Input
                    type="date"
                    value={editingMember.regDate}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, regDate: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>تاريخ الانتهاء</Label>
                  <Input
                    type="date"
                    value={editingMember.endDate}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, endDate: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>مبلغ الدفع (درهم)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={editingMember.amountDh || ""}
                  onChange={(e) =>
                    setEditingMember({
                      ...editingMember,
                      amountDh: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1"
                />
              </div>
              <Button
                type="button"
                className="w-full bg-gradient-to-l from-emerald-600 to-teal-600"
                onClick={saveMember}
              >
                حفظ
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* مسح OCR */}
      <Dialog open={ocrOpen} onOpenChange={setOcrOpen}>
        <DialogContent className="max-w-lg border-white/20 bg-[#0f172a]/95" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-white">مسح البطاقة الوطنية</DialogTitle>
            <DialogDescription>
              صورة واضحة للبطاقة — يُستخرج الاسم والرقم محلياً في متصفحك.
            </DialogDescription>
          </DialogHeader>
          <OcrScanner
            title="رفع صورة البطاقة"
            description="بعد الاستخراج يمكنك مراجعة الحقول في النموذج."
            onExtracted={(text) => onOcrText(text)}
            variant="royal"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
