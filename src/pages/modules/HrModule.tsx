import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Download, FileSpreadsheet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OcrScanner, parseMoroccanIdHints } from "@/components/OcrScanner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { downloadXlsxWorkbook } from "@/lib/excelDownload";
import { buildPdfTableHtml, exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import * as XLSX from "xlsx";
import { useI18n } from "@/i18n/I18nProvider";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { HrEnterpriseSuite } from "@/components/hr/HrEnterpriseSuite";

type Employee = {
  id: string;
  name: string;
  employee_id: string;
  role: string;
  salary: number;
  contract_type: string;
  contract_end: string | null;
};

type MetricRow = {
  id: string;
  week_label: string;
  production: number;
  logistics: number;
  quality: number;
};

export function HrModule() {
  const { t, locale, isRtl } = useI18n();
  const { token, isApproved, approvedModules } = useAuth();
  const allowed = isApproved && approvedModules.includes("hr");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empDrafts, setEmpDrafts] = useState<Record<string, Employee>>({});
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [metricDrafts, setMetricDrafts] = useState<Record<string, MetricRow>>({});
  const [form, setForm] = useState({
    name: "",
    employee_id: "",
    role: "",
    salary: "",
    contract_type: "CDI",
    contract_end: "",
  });
  const load = useCallback(async () => {
    if (!token || !allowed) return;
    const [e, m] = await Promise.all([
      api<{ employees: Employee[] }>("/hr/employees", { token }),
      api<{ metrics: typeof metrics }>("/hr/metrics", { token }),
    ]);
    setEmployees(e.employees);
    setMetrics(m.metrics as MetricRow[]);
  }, [token, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const d: Record<string, Employee> = {};
    for (const e of employees) d[e.id] = { ...e };
    setEmpDrafts(d);
  }, [employees]);

  useEffect(() => {
    const d: Record<string, MetricRow> = {};
    for (const m of metrics) d[m.id] = { ...m };
    setMetricDrafts(d);
  }, [metrics]);

  const saveEmployeeRow = async (id: string) => {
    if (!token) return;
    const row = empDrafts[id];
    if (!row) return;
    await api(`/hr/employees/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        name: row.name,
        employee_id: row.employee_id,
        role: row.role,
        salary: row.salary,
        contract_type: row.contract_type,
        contract_end: row.contract_end,
      }),
    });
    await load();
  };

  const saveMetricRow = async (id: string) => {
    if (!token) return;
    const row = metricDrafts[id];
    if (!row) return;
    await api(`/hr/metrics/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        week_label: row.week_label,
        production: row.production,
        logistics: row.logistics,
        quality: row.quality,
      }),
    });
    await load();
  };

  const expiring = useMemo(() => {
    const now = Date.now();
    const in30 = 30 * 864e5;
    return employees.filter((emp) => {
      if (!emp.contract_end) return false;
      const t = new Date(emp.contract_end).getTime();
      return t - now < in30 && t > now;
    });
  }, [employees]);

  const addEmployee = async () => {
    if (!token) return;
    await api("/hr/employees", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: form.name,
        employee_id: form.employee_id,
        role: form.role,
        salary: Number(form.salary),
        contract_type: form.contract_type,
        contract_end: form.contract_end || undefined,
      }),
    });
    setForm({
      name: "",
      employee_id: "",
      role: "",
      salary: "",
      contract_type: "CDI",
      contract_end: "",
    });
    await load();
  };

  const exportPdf = async () => {
    const dir = isRtl ? "rtl" : "ltr";
    const empHeaders = [
      t("tbl.name"),
      t("tbl.empId"),
      t("tbl.role"),
      t("tbl.salary"),
      t("tbl.contract"),
      t("tbl.contractEnd"),
    ];
    const empRows = employees.map((e) => [
      e.name,
      e.employee_id,
      e.role,
      String(e.salary),
      e.contract_type,
      e.contract_end ?? "—",
    ]);
    const empTable = buildPdfTableHtml(empHeaders, empRows, dir);
    const metricHeaders = [
      t("tbl.week"),
      t("tbl.production"),
      t("tbl.logistics"),
      t("tbl.quality"),
    ];
    const metricRows = metrics.map((m) => [
      m.week_label,
      String(Math.round(m.production * 10) / 10),
      String(Math.round(m.logistics * 10) / 10),
      String(Math.round(m.quality * 10) / 10),
    ]);
    const metricTable = buildPdfTableHtml(metricHeaders, metricRows, dir);
    const innerHtml = `
      <h2 style="color:#f97316;font-size:17px;margin-bottom:10px;">${t("pdf.hrReport")}</h2>
      <p style="color:#94a3b8;font-size:13px;margin-bottom:14px;">${t("hr.title")}</p>
      ${empTable}
      <h3 style="color:#f97316;font-size:15px;margin:18px 0 10px;">${t("tbl.production")} · ${t("tbl.logistics")} · ${t("tbl.quality")}</h3>
      ${metricTable}
    `;
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: innerHtml,
      sectionTitle: t("pdf.hrReport"),
      fileName: `HR-report-${Date.now()}`,
      direction: dir,
      lang: locale,
      mainTitle: t("brand"),
      dateLocale: locale,
    });
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsEmp = XLSX.utils.json_to_sheet(
      employees.map((e) => ({
        [t("tbl.name")]: e.name,
        [t("tbl.empId")]: e.employee_id,
        [t("tbl.role")]: e.role,
        [t("tbl.salary")]: e.salary,
        [t("tbl.contract")]: e.contract_type,
        [t("tbl.contractEnd")]: e.contract_end ?? "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsEmp, "Employees");
    const wsMet = XLSX.utils.json_to_sheet(
      metrics.map((m) => ({
        [t("tbl.week")]: m.week_label,
        [t("tbl.production")]: m.production,
        [t("tbl.logistics")]: m.logistics,
        [t("tbl.quality")]: m.quality,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsMet, "Metrics");
    downloadXlsxWorkbook(wb, `hr-export-${Date.now()}.xlsx`);
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("hr.lockedTitle")}</h2>
        <p className="text-slate-400">{t("hr.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("hr.payCta")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-500/15 border border-blue-500/30">
            <Users className="size-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("hr.title")}</h1>
            <p className="text-slate-400 text-sm">{t("hr.moduleSubtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <FileSpreadsheet className="size-4" />
            {t("pdf.exportCsv")}
          </Button>
          <Button variant="secondary" onClick={() => void exportPdf()}>
            <Download className="size-4" />
            {t("pdf.export")}
          </Button>
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="size-6 text-amber-400 shrink-0" />
          <div>
            <p className="font-bold text-amber-200">{t("hr.contractRenewalAlertsTitle")}</p>
            <ul className="text-sm text-slate-300 mt-2 list-disc list-inside">
              {expiring.map((e) => (
                <li key={e.id}>
                  {t("hr.contractEndsLine")
                    .replace("{name}", e.name)
                    .replace("{date}", e.contract_end ?? "—")}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Tabs defaultValue="team">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="team">{t("hr.tabTeam")}</TabsTrigger>
          <TabsTrigger value="ops">{t("hr.tabOps")}</TabsTrigger>
          <TabsTrigger value="enterprise">{t("hr.tabEnterprise")}</TabsTrigger>
          <TabsTrigger value="ocr">{t("hr.tabOcr")}</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-6">
          <Card className="border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">{t("hr.addEmployeeTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field
                label={t("auth.fullName")}
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              />
              <Field
                label={t("tbl.empId")}
                value={form.employee_id}
                onChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
              />
              <Field
                label={t("tbl.role")}
                value={form.role}
                onChange={(v) => setForm((f) => ({ ...f, role: v }))}
              />
              <Field
                label={t("hr.labelSalaryMad")}
                value={form.salary}
                onChange={(v) => setForm((f) => ({ ...f, salary: v }))}
                type="number"
              />
              <div>
                <Label>{t("hr.labelContractType")}</Label>
                <select
                  className="mt-1 flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 text-sm"
                  value={form.contract_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contract_type: e.target.value }))
                  }
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                </select>
              </div>
              <Field
                label={t("hr.labelContractEndOptional")}
                value={form.contract_end}
                onChange={(v) => setForm((f) => ({ ...f, contract_end: v }))}
                type="date"
              />
              <div className="sm:col-span-2 lg:col-span-3">
                <Button onClick={() => void addEmployee()}>{t("hr.saveEmployee")}</Button>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="p-2 text-right min-w-[100px]">{t("tbl.name")}</th>
                  <th className="p-2 text-right min-w-[90px]">{t("tbl.empId")}</th>
                  <th className="p-2 text-right min-w-[90px]">{t("tbl.role")}</th>
                  <th className="p-2 text-right w-24">{t("tbl.salary")}</th>
                  <th className="p-2 text-right w-28">{t("tbl.contract")}</th>
                  <th className="p-2 text-right w-32">{t("tbl.contractEnd")}</th>
                  <th className="p-2 w-24">{t("common.saveRow")}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const d = empDrafts[e.id] ?? e;
                  return (
                    <tr key={e.id} className="border-t border-slate-800">
                      <td className="p-2">
                        <Input
                          className="h-9 bg-slate-900/50 border-slate-700"
                          value={d.name}
                          onChange={(ev) =>
                            setEmpDrafts((prev) => ({
                              ...prev,
                              [e.id]: { ...d, name: ev.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-9 bg-slate-900/50 border-slate-700"
                          value={d.employee_id}
                          onChange={(ev) =>
                            setEmpDrafts((prev) => ({
                              ...prev,
                              [e.id]: { ...d, employee_id: ev.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          className="h-9 bg-slate-900/50 border-slate-700"
                          value={d.role}
                          onChange={(ev) =>
                            setEmpDrafts((prev) => ({
                              ...prev,
                              [e.id]: { ...d, role: ev.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          className="h-9 bg-slate-900/50 border-slate-700"
                          value={d.salary}
                          onChange={(ev) =>
                            setEmpDrafts((prev) => ({
                              ...prev,
                              [e.id]: { ...d, salary: Number(ev.target.value) },
                            }))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <select
                          className="h-9 w-full rounded-md border border-slate-700 bg-slate-900/50 px-2 text-sm"
                          value={d.contract_type}
                          onChange={(ev) =>
                            setEmpDrafts((prev) => ({
                              ...prev,
                              [e.id]: { ...d, contract_type: ev.target.value },
                            }))
                          }
                        >
                          <option value="CDI">CDI</option>
                          <option value="CDD">CDD</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="date"
                          lang="en"
                          dir="ltr"
                          className="h-9 bg-slate-900/50 border-slate-700"
                          value={d.contract_end ?? ""}
                          onChange={(ev) =>
                            setEmpDrafts((prev) => ({
                              ...prev,
                              [e.id]: { ...d, contract_end: ev.target.value || null },
                            }))
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          onClick={() => void saveEmployeeRow(e.id)}
                        >
                          {t("common.saveRow")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="ops">
          <div className="space-y-6 p-2 rounded-xl bg-[#0c1929]">
            <h3 className="text-lg font-bold text-center text-orange-400">
              {t("hr.opsChartTitle")}
            </h3>
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="week_label" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ background: "#121214", border: "1px solid #334155" }}
                  />
                  <Legend />
                  <Bar dataKey="production" name={t("tbl.production")} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="logistics" name={t("tbl.logistics")} fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="quality" name={t("tbl.quality")} fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800 mt-4">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80">
                  <tr>
                    <th className="p-2 text-right">{t("tbl.week")}</th>
                    <th className="p-2 text-right">{t("tbl.production")}</th>
                    <th className="p-2 text-right">{t("tbl.logistics")}</th>
                    <th className="p-2 text-right">{t("tbl.quality")}</th>
                    <th className="p-2 w-24">{t("common.saveRow")}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => {
                    const d = metricDrafts[m.id] ?? m;
                    return (
                      <tr key={m.id} className="border-t border-slate-800">
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.week_label}
                            onChange={(ev) =>
                              setMetricDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...d, week_label: ev.target.value },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.production}
                            onChange={(ev) =>
                              setMetricDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...d, production: Number(ev.target.value) },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.logistics}
                            onChange={(ev) =>
                              setMetricDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...d, logistics: Number(ev.target.value) },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={d.quality}
                            onChange={(ev) =>
                              setMetricDrafts((prev) => ({
                                ...prev,
                                [m.id]: { ...d, quality: Number(ev.target.value) },
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={() => void saveMetricRow(m.id)}
                          >
                            {t("common.saveRow")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="enterprise">
          <HrEnterpriseSuite employees={employees} />
        </TabsContent>

        <TabsContent value="ocr">
          <OcrScanner
            onExtracted={(text) => {
              const hints = parseMoroccanIdHints(text);
              if (hints.fullName) setForm((f) => ({ ...f, name: hints.fullName ?? f.name }));
              window.alert(
                hints.raw.slice(0, 400) + (hints.raw.length > 400 ? "…" : "")
              );
            }}
          />
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...(type === "date" || type === "time" || type === "datetime-local"
          ? { lang: "en", dir: "ltr" }
          : {})}
      />
    </div>
  );
}
