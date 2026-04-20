import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  BookMarked,
  ClipboardList,
  Download,
  FileText,
  Loader2,
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
  buildReturnToWorkHtml,
  buildSalarySocialHtml,
  buildWorkCertificateHtml,
  type HrBranding,
} from "@/lib/hrEnterpriseHtml";
import { exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import { downloadHtmlAsWord } from "@/lib/wordExport";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

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

  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [absForm, setAbsForm] = useState({
    employeeName: "",
    employeeId: "",
    from: "",
    to: "",
    reason: "",
  });
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [dismissForm, setDismissForm] = useState({
    employeeName: "",
    employeeId: "",
    dateNotice: new Date().toISOString().slice(0, 10),
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
    date: new Date().toISOString().slice(0, 10),
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
    hireDate: "",
    endDate: "",
  });

  const [certSalary, setCertSalary] = useState({
    employeeName: "",
    employeeId: "",
    period: "",
    gross: "",
    cnss: "",
    amo: "",
    mutual: "",
    mutualId: "",
  });

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
    setAbsForm({ employeeName: "", employeeId: "", from: "", to: "", reason: "" });
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
                    className="mt-1"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      type="button"
                      size="sm"
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
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="bg-red-900/80"
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
              <div className="grid sm:grid-cols-2 gap-3">
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
                  label="CNSS"
                  value={certSalary.cnss}
                  onChange={(v) => setCertSalary((f) => ({ ...f, cnss: v }))}
                />
                <Field
                  label="AMO"
                  value={certSalary.amo}
                  onChange={(v) => setCertSalary((f) => ({ ...f, amo: v }))}
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
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    void exportPdf(
                      buildSalarySocialHtml({
                        branding,
                        employeeName: certSalary.employeeName || "—",
                        employeeId: certSalary.employeeId || "—",
                        period: certSalary.period || "—",
                        grossSalary: certSalary.gross || "—",
                        cnssNumber: certSalary.cnss || "—",
                        amoNumber: certSalary.amo || "—",
                        mutualName: certSalary.mutual || "—",
                        mutualId: certSalary.mutualId || "—",
                        dir,
                        locale: appLocale,
                      }),
                      "salary-social-slip"
                    )
                  }
                >
                  <Download className="size-4" />
                  {t("hr.enterprise.pdfSalary")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void exportWord(
                      buildSalarySocialHtml({
                        branding,
                        employeeName: certSalary.employeeName || "—",
                        employeeId: certSalary.employeeId || "—",
                        period: certSalary.period || "—",
                        grossSalary: certSalary.gross || "—",
                        cnssNumber: certSalary.cnss || "—",
                        amoNumber: certSalary.amo || "—",
                        mutualName: certSalary.mutual || "—",
                        mutualId: certSalary.mutualId || "—",
                        dir,
                        locale: appLocale,
                      }),
                      "salary-social"
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
      />
    </div>
  );
}
