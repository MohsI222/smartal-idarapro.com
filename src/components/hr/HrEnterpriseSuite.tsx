import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  BookMarked,
  ClipboardList,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";
import { AiGenerateButton } from "@/components/AiGenerateButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/strings";
import { api } from "@/lib/api";
import {
  buildDismissalNoticeHtml,
  buildEmploymentContractHtml,
  buildInternalRulesAckHtml,
  buildPayrollSlipHtml,
  buildReturnToWorkHtml,
  buildWorkCertificateHtml,
  type HrBranding,
} from "@/lib/hrEnterpriseHtml";
import { exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import { downloadHtmlAsWord } from "@/lib/wordExport";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { todayIsoLocal } from "@/lib/todayIso";
import { tlSendMessage, tlWorkers, type TlWorker } from "@/lib/tlApi";

type Employee = {
  id: string;
  name: string;
  employee_id: string;
  role: string;
  salary: number;
};

type AbsenceRow = {
  id: string;
  employeeName: string;
  employeeId: string;
  from: string;
  to: string;
  reason: string;
};

type PayrollForm = {
  employeeName: string;
  employeeId: string;
  period: string;
  gross: string;
  cnss: string;
  amo: string;
  ipe: string;
  mutual: string;
  mutualId: string;
  paidLeave: string;
  overtime125: string;
  overtime150: string;
  overtime200: string;
  seniorityBonus: string;
  attendanceBonus: string;
  productivityBonus: string;
  advanceSalary: string;
};

function minutesFromTime(value: string): number | null {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function analyzeAttendance(scheduledStart: string, actualCheckIn: string) {
  const scheduled = minutesFromTime(scheduledStart);
  const actual = minutesFromTime(actualCheckIn);
  if (scheduled === null || actual === null) return { minutesLate: 0, absent: !actualCheckIn, late: false };
  const minutesLate = Math.max(0, actual - scheduled);
  return { minutesLate, absent: minutesLate >= 240, late: minutesLate >= 10 };
}

function numericAmount(value: string): number {
  return Math.max(0, Number(String(value || "").replace(",", ".")) || 0);
}

function payrollFromForm(form: PayrollForm) {
  const baseSalary = numericAmount(form.gross);
  const paidLeave = numericAmount(form.paidLeave);
  const overtime125 = numericAmount(form.overtime125);
  const overtime150 = numericAmount(form.overtime150);
  const overtime200 = numericAmount(form.overtime200);
  const seniorityBonus = numericAmount(form.seniorityBonus);
  const attendanceBonus = numericAmount(form.attendanceBonus);
  const productivityBonus = numericAmount(form.productivityBonus);
  const totalBrut =
    baseSalary +
    paidLeave +
    overtime125 +
    overtime150 +
    overtime200 +
    seniorityBonus +
    attendanceBonus +
    productivityBonus;
  const cnss = form.cnss.trim() ? numericAmount(form.cnss) : Math.min(totalBrut, 6000) * 0.0448;
  const amo = form.amo.trim() ? numericAmount(form.amo) : totalBrut * 0.0226;
  const ipe = form.ipe.trim() ? numericAmount(form.ipe) : totalBrut * 0.0019;
  const mutual = numericAmount(form.mutual);
  const advanceSalary = numericAmount(form.advanceSalary);
  const totalCotisations = cnss + amo + ipe + mutual;
  const netSalary = Math.max(0, totalBrut - totalCotisations - advanceSalary);
  return {
    baseSalary,
    paidLeave,
    overtime125,
    overtime150,
    overtime200,
    seniorityBonus,
    attendanceBonus,
    productivityBonus,
    cnss,
    amo,
    ipe,
    mutual,
    advanceSalary,
    totalBrut,
    totalCotisations,
    netSalary,
  };
}

function pdfLang(locale: AppLocale): string {
  if (locale.startsWith("ar")) return "ar";
  if (locale === "fr") return "fr";
  return "en";
}

export function HrEnterpriseSuite({ employees }: { employees: Employee[] }) {
  const { t, locale, isRtl } = useI18n();
  const { token } = useAuth();
  const appLocale = locale as AppLocale;
  const dir = isRtl ? "rtl" : "ltr";

  const [branding, setBranding] = useState<HrBranding>({ companyName: "" });
  const [loadingBrand, setLoadingBrand] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingStatus, setBrandingStatus] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [absForm, setAbsForm] = useState({
    employeeName: "",
    employeeId: "",
    from: todayIsoLocal(),
    to: todayIsoLocal(),
    reason: "",
  });
  const [returnDate, setReturnDate] = useState(() => todayIsoLocal());
  const [attendanceAi, setAttendanceAi] = useState({
    scheduledStart: "09:00",
    actualCheckIn: "09:00",
  });

  const [dismissForm, setDismissForm] = useState({
    employeeName: "",
    employeeId: "",
    dateNotice: todayIsoLocal(),
    grounds: "",
  });

  const [rulesText, setRulesText] = useState("");
  const rulesSeeded = useRef(false);
  useEffect(() => {
    if (rulesSeeded.current) return;
    rulesSeeded.current = true;
    setRulesText(t("hr.enterprise.rulesDefault"));
  }, [t]);
  const [rulesAck, setRulesAck] = useState({
    employeeName: "",
    employeeId: "",
    date: todayIsoLocal(),
  });

  const [contractCtx, setContractCtx] = useState({
    employerName: "",
    employeeName: "",
    nationalId: "",
    jobTitle: "",
    salaryGross: "",
    trialMonths: "3",
    contractType: "CDI",
    workPlace: "Maroc",
    hours: "44",
  });
  const [contractDraft, setContractDraft] = useState("");

  const [certWork, setCertWork] = useState({
    employeeName: "",
    employeeId: "",
    role: "",
    hireDate: todayIsoLocal(),
    endDate: "",
  });

  const [certSalary, setCertSalary] = useState<PayrollForm>({
    employeeName: "",
    employeeId: "",
    period: "",
    gross: "",
    cnss: "",
    amo: "",
    ipe: "",
    mutual: "",
    mutualId: "",
    paidLeave: "0",
    overtime125: "0",
    overtime150: "0",
    overtime200: "0",
    seniorityBonus: "0",
    attendanceBonus: "0",
    productivityBonus: "0",
    advanceSalary: "0",
  });
  const salaryCalc = useMemo(() => payrollFromForm(certSalary), [certSalary]);
  const [bridgeWorkers, setBridgeWorkers] = useState<TlWorker[]>([]);
  const [bridgeInventoryCount, setBridgeInventoryCount] = useState(0);
  const [bridgeSenderId, setBridgeSenderId] = useState("");
  const [bridgeRecipientId, setBridgeRecipientId] = useState("");
  const [bridgeBody, setBridgeBody] = useState("");
  const [bridgeStatus, setBridgeStatus] = useState("");
  const [isBridgeLoading, setIsBridgeLoading] = useState(false);
  const [isBridgeSending, setIsBridgeSending] = useState(false);
  const attendanceCalc = useMemo(
    () => analyzeAttendance(attendanceAi.scheduledStart, attendanceAi.actualCheckIn),
    [attendanceAi.actualCheckIn, attendanceAi.scheduledStart]
  );

  const loadBranding = useCallback(async () => {
    if (!token) return;
    setLoadingBrand(true);
    try {
      const r = await api<{ branding: { companyName?: string; logoDataUrl?: string } }>(
        "/user/branding",
        { token }
      );
      setBranding({
        companyName: r.branding?.companyName ?? "",
        logoDataUrl: r.branding?.logoDataUrl ?? undefined,
      });
    } catch {
      setBranding({ companyName: "" });
    } finally {
      setLoadingBrand(false);
    }
  }, [token]);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  const saveBranding = async () => {
    if (!token) return;
    setSavingBranding(true);
    setBrandingStatus("");
    try {
      await api("/user/branding", {
        method: "PUT",
        token,
        body: JSON.stringify({
          companyName: branding.companyName,
          logoDataUrl: branding.logoDataUrl ?? "",
        }),
      });
      setBrandingStatus(t("hr.enterprise.brandingSaved"));
    } catch (error) {
      setBrandingStatus(error instanceof Error ? error.message : t("auth.errGeneric"));
    } finally {
      setSavingBranding(false);
    }
  };

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const logoDataUrl = String(reader.result || "");
      if (logoDataUrl.startsWith("data:image")) {
        setBranding((current) => ({ ...current, logoDataUrl }));
        setBrandingStatus(t("hr.enterprise.logoReady"));
      }
    };
    reader.readAsDataURL(file);
  };

  const loadBridgeData = useCallback(async () => {
    if (!token) return;
    setIsBridgeLoading(true);
    try {
      const [workersResult, inventoryResult] = await Promise.allSettled([
        tlWorkers(token),
        api<{ products?: unknown[] }>("/inventory/products", { token }),
      ]);
      const workers = workersResult.status === "fulfilled" ? workersResult.value.workers : [];
      const products =
        inventoryResult.status === "fulfilled" && Array.isArray(inventoryResult.value.products)
          ? inventoryResult.value.products.length
          : 0;
      setBridgeWorkers(workers);
      setBridgeInventoryCount(products);
      setBridgeSenderId((prev) => prev || workers[0]?.id || "");
      setBridgeRecipientId((prev) => prev || workers.find((worker) => worker.id !== workers[0]?.id)?.id || workers[1]?.id || "");
    } finally {
      setIsBridgeLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadBridgeData();
  }, [loadBridgeData]);

  const payrollBridgeSummary = useMemo(
    () =>
      `${t("hr.enterprise.salarySlipTitle")} - ${certSalary.employeeName || "—"} / ${certSalary.period || "—"}\n` +
      `${t("hr.enterprise.totalBrut")}: ${salaryCalc.totalBrut.toFixed(2)} MAD\n` +
      `${t("hr.enterprise.totalCotisations")}: ${salaryCalc.totalCotisations.toFixed(2)} MAD\n` +
      `${t("hr.enterprise.netSalary")}: ${salaryCalc.netSalary.toFixed(2)} MAD`,
    [certSalary.employeeName, certSalary.period, salaryCalc.netSalary, salaryCalc.totalBrut, salaryCalc.totalCotisations, t]
  );

  const sendBridgeMessage = async () => {
    if (!token || !bridgeSenderId || !bridgeRecipientId) return;
    setIsBridgeSending(true);
    setBridgeStatus("");
    try {
      await tlSendMessage(token, {
        from_worker_id: bridgeSenderId,
        to_worker_id: bridgeRecipientId,
        body: bridgeBody.trim() || payrollBridgeSummary,
      });
      setBridgeBody("");
      setBridgeStatus(t("hr.enterprise.bridgeSent"));
    } catch (error) {
      setBridgeStatus(error instanceof Error ? error.message : t("auth.errGeneric"));
    } finally {
      setIsBridgeSending(false);
    }
  };

  const applyEmployeePick = (id: string) => {
    const e = employees.find((x) => x.id === id);
    if (!e) return;
    setAbsForm((f) => ({
      ...f,
      employeeName: e.name,
      employeeId: e.employee_id,
    }));
    setDismissForm((f) => ({ ...f, employeeName: e.name, employeeId: e.employee_id }));
    setRulesAck((f) => ({ ...f, employeeName: e.name, employeeId: e.employee_id }));
    setCertWork((f) => ({
      ...f,
      employeeName: e.name,
      employeeId: e.employee_id,
      role: e.role,
    }));
    setCertSalary((f) => ({ ...f, employeeName: e.name, employeeId: e.employee_id, gross: String(e.salary) }));
  };

  const exportPdf = async (innerHtml: string, fileBase: string) => {
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: innerHtml,
      sectionTitle: fileBase,
      fileName: `${fileBase}-${Date.now()}`,
      direction: dir,
      lang: pdfLang(appLocale),
      mainTitle: branding.companyName || t("brand"),
      dateLocale: locale,
      documentMode: "creative",
      logoDataUrl: branding.logoDataUrl?.startsWith("data:image") ? branding.logoDataUrl : undefined,
    });
  };

  const exportWord = async (html: string, name: string) => {
    await downloadHtmlAsWord(html, `${name}-${Date.now()}.docx`);
  };

  const addAbsence = () => {
    if (!absForm.employeeName.trim()) return;
    setAbsences((a) => [
      ...a,
      {
        id: crypto.randomUUID(),
        ...absForm,
      },
    ]);
    setAbsForm({ employeeName: "", employeeId: "", from: todayIsoLocal(), to: todayIsoLocal(), reason: "" });
  };

  const defaultEmployer = useMemo(
    () => branding.companyName || contractCtx.employerName || "—",
    [branding.companyName, contractCtx.employerName]
  );

  if (loadingBrand) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-8">
        <Loader2 className="size-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">{t("hr.enterprise.intro")}</p>

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="attendance" className="gap-1.5">
            <ClipboardList className="size-4" />
            {t("hr.enterprise.tabAttendance")}
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <BookMarked className="size-4" />
            {t("hr.enterprise.tabRules")}
          </TabsTrigger>
          <TabsTrigger value="contract" className="gap-1.5">
            <FileText className="size-4" />
            {t("hr.enterprise.tabContract")}
          </TabsTrigger>
          <TabsTrigger value="certs" className="gap-1.5">
            <Award className="size-4" />
            {t("hr.enterprise.tabCerts")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.enterprise.absenceTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {employees.length > 0 && (
                <div>
                  <Label>{t("hr.enterprise.pickEmployee")}</Label>
                  <select
                    className="mt-1 flex h-10 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900/50 px-3 text-sm"
                    defaultValue=""
                    onChange={(e) => applyEmployeePick(e.target.value)}
                  >
                    <option value="">{t("hr.enterprise.pickPlaceholder")}</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label={t("auth.fullName")}
                  value={absForm.employeeName}
                  onChange={(v) => setAbsForm((f) => ({ ...f, employeeName: v }))}
                />
                <Field
                  label={t("tbl.empId")}
                  value={absForm.employeeId}
                  onChange={(v) => setAbsForm((f) => ({ ...f, employeeId: v }))}
                />
                <Field
                  label={t("hr.enterprise.from")}
                  type="date"
                  value={absForm.from}
                  onChange={(v) => setAbsForm((f) => ({ ...f, from: v }))}
                />
                <Field
                  label={t("hr.enterprise.to")}
                  type="date"
                  value={absForm.to}
                  onChange={(v) => setAbsForm((f) => ({ ...f, to: v }))}
                />
              </div>
              <div>
                <Label>{t("hr.enterprise.reason")}</Label>
                <Input
                  className="mt-1"
                  value={absForm.reason}
                  onChange={(e) => setAbsForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <Button type="button" variant="secondary" onClick={addAbsence}>
                {t("hr.enterprise.addAbsence")}
              </Button>

              <div className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-4 shadow-[0_0_28px_rgba(217,70,239,0.18)]">
                <div className="flex items-center gap-2 text-sm font-bold text-fuchsia-100">
                  <ClipboardList className="size-4 text-fuchsia-300" />
                  {t("hr.enterprise.aiAttendanceTitle")}
                </div>
                <div className="mt-3 grid sm:grid-cols-3 gap-3">
                  <Field
                    label={t("hr.enterprise.scheduledStart")}
                    type="time"
                    value={attendanceAi.scheduledStart}
                    onChange={(v) => setAttendanceAi((f) => ({ ...f, scheduledStart: v }))}
                  />
                  <Field
                    label={t("hr.enterprise.actualCheckIn")}
                    type="time"
                    value={attendanceAi.actualCheckIn}
                    onChange={(v) => setAttendanceAi((f) => ({ ...f, actualCheckIn: v }))}
                  />
                  <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">
                    <div className="text-slate-400">{t("hr.enterprise.attendanceStatus")}</div>
                    <div className={cn("mt-1 font-bold", attendanceCalc.late ? "text-amber-300" : "text-emerald-300")}>
                      {attendanceCalc.absent
                        ? t("hr.enterprise.absenceWarning")
                        : attendanceCalc.late
                          ? t("hr.enterprise.lateWarning").replace("{minutes}", String(attendanceCalc.minutesLate))
                          : t("hr.enterprise.onTime")}
                    </div>
                  </div>
                </div>
              </div>

              {absences.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-800 text-sm">
                  <table className="w-full">
                    <thead className="bg-slate-900/80">
                      <tr>
                        <th className="p-2 text-right">{t("tbl.name")}</th>
                        <th className="p-2 text-right">{t("hr.enterprise.from")}</th>
                        <th className="p-2 text-right">{t("hr.enterprise.to")}</th>
                        <th className="p-2 text-right">{t("hr.enterprise.reason")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absences.map((a) => (
                        <tr key={a.id} className="border-t border-slate-800">
                          <td className="p-2">{a.employeeName}</td>
                          <td className="p-2">{a.from}</td>
                          <td className="p-2">{a.to}</td>
                          <td className="p-2">{a.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                <div>
                  <Label>{t("hr.enterprise.returnDate")}</Label>
                  <Input
                    type="date"
                    lang="en"
                    dir="ltr"
                    className="mt-1"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      type="button"
                      size="sm"
                      className="border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)] hover:bg-cyan-300/25"
                      onClick={() =>
                        void exportPdf(
                          buildReturnToWorkHtml({
                            branding,
                            employeeName: absForm.employeeName || "—",
                            employeeId: absForm.employeeId || "—",
                            absenceFrom: absForm.from || "—",
                            absenceTo: absForm.to || "—",
                            reason: absForm.reason || "—",
                            returnDate,
                            dir,
                            locale: appLocale,
                          }),
                          "return-to-work"
                        )
                      }
                    >
                      <Download className="size-4" />
                      {t("hr.enterprise.pdfReturn")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300/20"
                      onClick={() =>
                        void exportWord(
                          buildReturnToWorkHtml({
                            branding,
                            employeeName: absForm.employeeName || "—",
                            employeeId: absForm.employeeId || "—",
                            absenceFrom: absForm.from || "—",
                            absenceTo: absForm.to || "—",
                            reason: absForm.reason || "—",
                            returnDate,
                            dir,
                            locale: appLocale,
                          }),
                          "return-to-work"
                        )
                      }
                    >
                      {t("hr.enterprise.wordExport")}
                    </Button>
                  </div>
                </div>
                <div>
                  <Field
                    label={t("hr.enterprise.dismissDate")}
                    type="date"
                    value={dismissForm.dateNotice}
                    onChange={(v) => setDismissForm((f) => ({ ...f, dateNotice: v }))}
                  />
                  <Label className="mt-3 block">{t("hr.enterprise.dismissTitle")}</Label>
                  <textarea
                    className={cn(
                      "mt-1 min-h-[72px] w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                    )}
                    value={dismissForm.grounds}
                    onChange={(e) =>
                      setDismissForm((f) => ({ ...f, grounds: e.target.value }))
                    }
                    placeholder={t("hr.enterprise.dismissPlaceholder")}
                  />
                  <div className="mt-2 max-w-md">
                    <AiGenerateButton
                      module="hrContract"
                      variant="outline"
                      context={{
                        docKind: "dismissal_grounds",
                        employeeName: dismissForm.employeeName,
                        employeeId: dismissForm.employeeId,
                        dateNotice: dismissForm.dateNotice,
                        groundsHint: dismissForm.grounds,
                      }}
                      onGenerated={(text) =>
                        setDismissForm((f) => ({ ...f, grounds: text.slice(0, 8000) }))
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="bg-red-900/80 shadow-[0_0_18px_rgba(248,113,113,0.28)]"
                      onClick={() =>
                        void exportPdf(
                          buildDismissalNoticeHtml({
                            branding,
                            employeeName: dismissForm.employeeName || absForm.employeeName || "—",
                            employeeId: dismissForm.employeeId || absForm.employeeId || "—",
                            dateNotice: dismissForm.dateNotice,
                            grounds: dismissForm.grounds || "—",
                            dir,
                            locale: appLocale,
                          }),
                          "dismissal-notice"
                        )
                      }
                    >
                      <Download className="size-4" />
                      {t("hr.enterprise.pdfDismiss")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void exportWord(
                          buildDismissalNoticeHtml({
                            branding,
                            employeeName: dismissForm.employeeName || absForm.employeeName || "—",
                            employeeId: dismissForm.employeeId || absForm.employeeId || "—",
                            dateNotice: dismissForm.dateNotice,
                            grounds: dismissForm.grounds || "—",
                            dir,
                            locale: appLocale,
                          }),
                          "dismissal"
                        )
                      }
                    >
                      {t("hr.enterprise.wordExport")}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.enterprise.rulesTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className={cn(
                  "min-h-[160px] w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 font-mono text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                )}
                value={rulesText}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRulesText(e.target.value)}
              />
              <div className="max-w-md">
                <AiGenerateButton
                  module="hrContract"
                  variant="outline"
                  className="border-fuchsia-300/70 bg-fuchsia-400/10 text-fuchsia-100 shadow-[0_0_22px_rgba(217,70,239,0.35)] hover:bg-fuchsia-300/20"
                  context={{
                    docKind: "internal_rules_polish",
                    rulesExcerpt: rulesText.slice(0, 4000),
                  }}
                  onGenerated={(text) => setRulesText(text.slice(0, 12000))}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label={t("auth.fullName")}
                  value={rulesAck.employeeName}
                  onChange={(v) => setRulesAck((f) => ({ ...f, employeeName: v }))}
                />
                <Field
                  label={t("tbl.empId")}
                  value={rulesAck.employeeId}
                  onChange={(v) => setRulesAck((f) => ({ ...f, employeeId: v }))}
                />
                <Field
                  label={t("hr.enterprise.ackDate")}
                  type="date"
                  value={rulesAck.date}
                  onChange={(v) => setRulesAck((f) => ({ ...f, date: v }))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)] hover:bg-cyan-300/25"
                  onClick={() =>
                    void exportPdf(
                      buildInternalRulesAckHtml({
                        branding,
                        employeeName: rulesAck.employeeName || "—",
                        employeeId: rulesAck.employeeId || "—",
                        rulesExcerpt: rulesText,
                        ackDate: rulesAck.date,
                        dir,
                        locale: appLocale,
                      }),
                      "internal-rules-ack"
                    )
                  }
                >
                  <Download className="size-4" />
                  {t("hr.enterprise.pdfRules")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300/20"
                  onClick={() =>
                    void exportWord(
                      buildInternalRulesAckHtml({
                        branding,
                        employeeName: rulesAck.employeeName || "—",
                        employeeId: rulesAck.employeeId || "—",
                        rulesExcerpt: rulesText,
                        ackDate: rulesAck.date,
                        dir,
                        locale: appLocale,
                      }),
                      "internal-rules"
                    )
                  }
                >
                  {t("hr.enterprise.wordExport")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contract" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.enterprise.contractTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field
                  label={t("hr.enterprise.employer")}
                  value={contractCtx.employerName || defaultEmployer}
                  onChange={(v) => setContractCtx((f) => ({ ...f, employerName: v }))}
                />
                <Field
                  label={t("hr.enterprise.employee")}
                  value={contractCtx.employeeName}
                  onChange={(v) => setContractCtx((f) => ({ ...f, employeeName: v }))}
                />
                <Field
                  label={t("legalAi.field.nationalId")}
                  value={contractCtx.nationalId}
                  onChange={(v) => setContractCtx((f) => ({ ...f, nationalId: v }))}
                />
                <Field
                  label={t("hr.enterprise.jobTitle")}
                  value={contractCtx.jobTitle}
                  onChange={(v) => setContractCtx((f) => ({ ...f, jobTitle: v }))}
                />
                <Field
                  label={t("hr.labelSalaryMad")}
                  value={contractCtx.salaryGross}
                  onChange={(v) => setContractCtx((f) => ({ ...f, salaryGross: v }))}
                />
                <Field
                  label={t("hr.enterprise.trialMonths")}
                  value={contractCtx.trialMonths}
                  onChange={(v) => setContractCtx((f) => ({ ...f, trialMonths: v }))}
                />
                <div>
                  <Label>{t("hr.labelContractType")}</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 text-sm"
                    value={contractCtx.contractType}
                    onChange={(e) =>
                      setContractCtx((f) => ({ ...f, contractType: e.target.value }))
                    }
                  >
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                  </select>
                </div>
                <Field
                  label={t("hr.enterprise.workPlace")}
                  value={contractCtx.workPlace}
                  onChange={(v) => setContractCtx((f) => ({ ...f, workPlace: v }))}
                />
                <Field
                  label={t("hr.enterprise.hoursWeek")}
                  value={contractCtx.hours}
                  onChange={(v) => setContractCtx((f) => ({ ...f, hours: v }))}
                />
              </div>
              <AiGenerateButton
                module="hrContract"
                className="border-fuchsia-300/70 bg-fuchsia-400/10 text-fuchsia-100 shadow-[0_0_22px_rgba(217,70,239,0.35)] hover:bg-fuchsia-300/20"
                context={{
                  employer: contractCtx.employerName || defaultEmployer,
                  employee: contractCtx.employeeName,
                  nationalId: contractCtx.nationalId,
                  jobTitle: contractCtx.jobTitle,
                  salaryGross: contractCtx.salaryGross,
                  trialMonths: contractCtx.trialMonths,
                  contractType: contractCtx.contractType,
                  workPlace: contractCtx.workPlace,
                  hoursPerWeek: contractCtx.hours,
                }}
                onGenerated={(text) => setContractDraft(text)}
              />
              <textarea
                className={cn(
                  "min-h-[220px] w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm leading-relaxed text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
                )}
                value={contractDraft}
                onChange={(e) => setContractDraft(e.target.value)}
                placeholder={t("hr.enterprise.contractPlaceholder")}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)] hover:bg-cyan-300/25"
                  onClick={() =>
                    void exportPdf(
                      buildEmploymentContractHtml({
                        branding,
                        bodyText: contractDraft || t("hr.enterprise.contractEmpty"),
                        dir,
                        locale: appLocale,
                      }),
                      "employment-contract"
                    )
                  }
                >
                  <Download className="size-4" />
                  {t("hr.enterprise.pdfContract")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300/20"
                  onClick={() =>
                    void exportWord(
                      buildEmploymentContractHtml({
                        branding,
                        bodyText: contractDraft || t("hr.enterprise.contractEmpty"),
                        dir,
                        locale: appLocale,
                      }),
                      "employment-contract"
                    )
                  }
                >
                  {t("hr.enterprise.wordExport")}
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">{t("hr.enterprise.disclaimer")}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certs" className="space-y-4 mt-4">
          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.enterprise.certWorkTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field
                  label={t("auth.fullName")}
                  value={certWork.employeeName}
                  onChange={(v) => setCertWork((f) => ({ ...f, employeeName: v }))}
                />
                <Field
                  label={t("tbl.empId")}
                  value={certWork.employeeId}
                  onChange={(v) => setCertWork((f) => ({ ...f, employeeId: v }))}
                />
                <Field
                  label={t("tbl.role")}
                  value={certWork.role}
                  onChange={(v) => setCertWork((f) => ({ ...f, role: v }))}
                />
                <Field
                  label={t("hr.enterprise.hireDate")}
                  type="date"
                  value={certWork.hireDate}
                  onChange={(v) => setCertWork((f) => ({ ...f, hireDate: v }))}
                />
                <Field
                  label={t("hr.labelContractEndOptional")}
                  type="date"
                  value={certWork.endDate}
                  onChange={(v) => setCertWork((f) => ({ ...f, endDate: v }))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)] hover:bg-cyan-300/25"
                  onClick={() =>
                    void exportPdf(
                      buildWorkCertificateHtml({
                        branding,
                        employeeName: certWork.employeeName || "—",
                        employeeId: certWork.employeeId || "—",
                        role: certWork.role || "—",
                        hireDate: certWork.hireDate || "—",
                        endDate: certWork.endDate || undefined,
                        dir,
                        locale: appLocale,
                      }),
                      "work-certificate"
                    )
                  }
                >
                  <Download className="size-4" />
                  {t("hr.enterprise.pdfWorkCert")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300/20"
                  onClick={() =>
                    void exportWord(
                      buildWorkCertificateHtml({
                        branding,
                        employeeName: certWork.employeeName || "—",
                        employeeId: certWork.employeeId || "—",
                        role: certWork.role || "—",
                        hireDate: certWork.hireDate || "—",
                        endDate: certWork.endDate || undefined,
                        dir,
                        locale: appLocale,
                      }),
                      "work-certificate"
                    )
                  }
                >
                  {t("hr.enterprise.wordExport")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.enterprise.certSalaryTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <div className="rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-500/15 via-slate-950/80 to-emerald-500/10 p-4">
                <div className="grid gap-3 lg:grid-cols-[120px_1fr_auto] lg:items-end">
                  <div className="flex h-24 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/10 p-2">
                    {branding.logoDataUrl?.startsWith("data:image") ? (
                      <img src={branding.logoDataUrl} alt="" className="max-h-20 max-w-full object-contain" />
                    ) : (
                      <ImagePlus className="size-8 text-cyan-200" />
                    )}
                  </div>
                  <Field
                    label={t("hr.enterprise.companyName")}
                    value={branding.companyName}
                    onChange={(companyName) => setBranding((current) => ({ ...current, companyName }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="gap-2" onClick={() => logoInputRef.current?.click()}>
                      <ImagePlus className="size-4" />
                      {t("hr.enterprise.uploadLogo")}
                    </Button>
                    <Button type="button" className="gap-2 bg-emerald-400 text-emerald-950 hover:bg-emerald-300" disabled={savingBranding} onClick={() => void saveBranding()}>
                      {savingBranding ? t("common.processing") : t("common.save")}
                    </Button>
                  </div>
                </div>
                {brandingStatus && <p className="mt-3 text-xs text-emerald-100">{brandingStatus}</p>}
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Field
                  label={t("auth.fullName")}
                  value={certSalary.employeeName}
                  onChange={(v) => setCertSalary((f) => ({ ...f, employeeName: v }))}
                />
                <Field
                  label={t("tbl.empId")}
                  value={certSalary.employeeId}
                  onChange={(v) => setCertSalary((f) => ({ ...f, employeeId: v }))}
                />
                <Field
                  label={t("hr.enterprise.period")}
                  value={certSalary.period}
                  onChange={(v) => setCertSalary((f) => ({ ...f, period: v }))}
                  placeholder="2026-04"
                />
                <Field
                  label={t("hr.labelSalaryMad")}
                  value={certSalary.gross}
                  onChange={(v) => setCertSalary((f) => ({ ...f, gross: v }))}
                />
                <Field
                  label={t("hr.enterprise.paidLeave")}
                  value={certSalary.paidLeave}
                  onChange={(v) => setCertSalary((f) => ({ ...f, paidLeave: v }))}
                />
                <Field
                  label={t("hr.enterprise.overtime125")}
                  value={certSalary.overtime125}
                  onChange={(v) => setCertSalary((f) => ({ ...f, overtime125: v }))}
                />
                <Field
                  label={t("hr.enterprise.overtime150")}
                  value={certSalary.overtime150}
                  onChange={(v) => setCertSalary((f) => ({ ...f, overtime150: v }))}
                />
                <Field
                  label={t("hr.enterprise.overtime200")}
                  value={certSalary.overtime200}
                  onChange={(v) => setCertSalary((f) => ({ ...f, overtime200: v }))}
                />
                <Field
                  label={t("hr.enterprise.seniorityBonus")}
                  value={certSalary.seniorityBonus}
                  onChange={(v) => setCertSalary((f) => ({ ...f, seniorityBonus: v }))}
                />
                <Field
                  label={t("hr.enterprise.attendanceBonus")}
                  value={certSalary.attendanceBonus}
                  onChange={(v) => setCertSalary((f) => ({ ...f, attendanceBonus: v }))}
                />
                <Field
                  label={t("hr.enterprise.productivityBonus")}
                  value={certSalary.productivityBonus}
                  onChange={(v) => setCertSalary((f) => ({ ...f, productivityBonus: v }))}
                />
                <Field
                  label={t("hr.enterprise.cnss")}
                  value={certSalary.cnss}
                  onChange={(v) => setCertSalary((f) => ({ ...f, cnss: v }))}
                />
                <Field
                  label={t("hr.enterprise.amo")}
                  value={certSalary.amo}
                  onChange={(v) => setCertSalary((f) => ({ ...f, amo: v }))}
                />
                <Field
                  label={t("hr.enterprise.ipe")}
                  value={certSalary.ipe}
                  onChange={(v) => setCertSalary((f) => ({ ...f, ipe: v }))}
                />
                <Field
                  label={t("hr.enterprise.mutual")}
                  value={certSalary.mutual}
                  onChange={(v) => setCertSalary((f) => ({ ...f, mutual: v }))}
                />
                <Field
                  label={t("hr.enterprise.mutualId")}
                  value={certSalary.mutualId}
                  onChange={(v) => setCertSalary((f) => ({ ...f, mutualId: v }))}
                />
                <Field
                  label={t("hr.enterprise.advanceSalary")}
                  value={certSalary.advanceSalary}
                  onChange={(v) => setCertSalary((f) => ({ ...f, advanceSalary: v }))}
                />
              </div>
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm shadow-[0_0_28px_rgba(52,211,153,0.18)]">
                <div className="font-bold text-emerald-100">{t("hr.enterprise.autoDeductions")}</div>
                <div className="mt-2 grid sm:grid-cols-3 xl:grid-cols-6 gap-2 text-slate-200">
                  <span>{t("hr.enterprise.totalBrut")}: {salaryCalc.totalBrut.toFixed(2)} MAD</span>
                  <span>CNSS: {salaryCalc.cnss.toFixed(2)} MAD</span>
                  <span>AMO: {salaryCalc.amo.toFixed(2)} MAD</span>
                  <span>IPE: {salaryCalc.ipe.toFixed(2)} MAD</span>
                  <span>{t("hr.enterprise.totalCotisations")}: {salaryCalc.totalCotisations.toFixed(2)} MAD</span>
                  <span className="font-bold text-emerald-200">{t("hr.enterprise.netSalary")}: {salaryCalc.netSalary.toFixed(2)} MAD</span>
                </div>
              </div>
              <div className="rounded-2xl border border-sky-300/25 bg-sky-500/10 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 font-bold text-sky-100">
                      <MessageSquare className="size-4" />
                      {t("hr.enterprise.bridgeTitle")}
                    </p>
                    <p className="text-xs text-slate-400">{t("hr.enterprise.bridgeDesc")}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={isBridgeLoading} onClick={() => void loadBridgeData()}>
                    {isBridgeLoading ? t("common.processing") : t("barcode.refresh")}
                  </Button>
                </div>
                <div className="mb-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                  <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    {t("hr.enterprise.bridgeWorkers")}: {bridgeWorkers.length}
                  </span>
                  <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    {t("hr.enterprise.bridgeInventory")}: {bridgeInventoryCount}
                  </span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-300">{t("hr.enterprise.bridgeSender")}</span>
                    <select className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white" value={bridgeSenderId} onChange={(event) => setBridgeSenderId(event.target.value)}>
                      {bridgeWorkers.map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.full_name} · {worker.department}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-300">{t("hr.enterprise.bridgeRecipient")}</span>
                    <select className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white" value={bridgeRecipientId} onChange={(event) => setBridgeRecipientId(event.target.value)}>
                      {bridgeWorkers.filter((worker) => worker.id !== bridgeSenderId).map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.full_name} · {worker.department}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <textarea
                  className="mt-3 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  value={bridgeBody}
                  onChange={(event) => setBridgeBody(event.target.value)}
                  placeholder={payrollBridgeSummary}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" className="gap-2 bg-sky-400 text-sky-950 hover:bg-sky-300" disabled={isBridgeSending || !bridgeSenderId || !bridgeRecipientId} onClick={() => void sendBridgeMessage()}>
                    <Send className="size-4" />
                    {isBridgeSending ? t("common.processing") : t("hr.enterprise.bridgeSend")}
                  </Button>
                  {bridgeStatus && <span className="text-xs text-sky-100">{bridgeStatus}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.35)] hover:bg-cyan-300/25"
                  onClick={() =>
                    void exportPdf(
                      buildPayrollSlipHtml({
                        branding,
                        employeeName: certSalary.employeeName || "—",
                        employeeId: certSalary.employeeId || "—",
                        period: certSalary.period || "—",
                        ...salaryCalc,
                        dir,
                        locale: appLocale,
                      }),
                      "fiche-de-paie"
                    )
                  }
                >
                  <Download className="size-4" />
                  {t("hr.enterprise.salarySlipTitle")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-cyan-300/70 bg-cyan-400/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.28)] hover:bg-cyan-300/20"
                  onClick={() =>
                    void exportWord(
                      buildPayrollSlipHtml({
                        branding,
                        employeeName: certSalary.employeeName || "—",
                        employeeId: certSalary.employeeId || "—",
                        period: certSalary.period || "—",
                        ...salaryCalc,
                        dir,
                        locale: appLocale,
                      }),
                      "fiche-de-paie"
                    )
                  }
                >
                  {t("hr.enterprise.wordExport")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        {...(type === "date" || type === "time" || type === "datetime-local"
          ? { lang: "en", dir: "ltr" }
          : {})}
      />
    </div>
  );
}
