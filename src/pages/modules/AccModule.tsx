import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Calculator, Download, FileSpreadsheet, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { downloadCsv } from "@/lib/exportMoroccanPdf";
import { buildPdfTableHtml, exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import { useI18n } from "@/i18n/I18nProvider";

type Report = {
  id: string;
  title: string;
  period: string;
  amount: number | null;
  notes: string | null;
  entry_type?: string;
};

export function AccModule() {
  const { t, locale, isRtl } = useI18n();
  const { token, isApproved, approvedModules } = useAuth();
  const allowed = isApproved && approvedModules.includes("acc");
  const [reports, setReports] = useState<Report[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Report>>({});
  const [form, setForm] = useState({
    title: "",
    period: "",
    amount: "",
    notes: "",
    entry_type: "expense" as "expense" | "income",
  });

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    const r = await api<{ reports: Report[] }>("/acc/reports", { token });
    setReports(r.reports);
  }, [token, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const d: Record<string, Report> = {};
    for (const r of reports) d[r.id] = { ...r };
    setDrafts(d);
  }, [reports]);

  const saveRow = async (id: string) => {
    if (!token) return;
    const row = drafts[id];
    if (!row) return;
    await api(`/acc/reports/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        title: row.title,
        period: row.period,
        amount: row.amount ?? null,
        notes: row.notes ?? null,
        entry_type: row.entry_type === "income" ? "income" : "expense",
      }),
    });
    await load();
  };

  const exportExcel = () => {
    downloadCsv(
      `accounting-${Date.now()}.csv`,
      reports.map((r) => ({
        [t("tbl.caseTitle")]: r.title,
        [t("tbl.period")]: r.period,
        [t("tbl.amount")]: r.amount ?? "",
        [t("tbl.notes")]: r.notes ?? "",
        [t("acc.entryType")]: r.entry_type === "income" ? t("acc.flowIncome") : t("acc.flowExpense"),
      }))
    );
  };

  const add = async () => {
    if (!token) return;
    await api("/acc/reports", {
      method: "POST",
      token,
      body: JSON.stringify({
        title: form.title,
        period: form.period,
        amount: form.amount ? Number(form.amount) : undefined,
        notes: form.notes || undefined,
        entry_type: form.entry_type,
      }),
    });
    setForm({ title: "", period: "", amount: "", notes: "", entry_type: "expense" });
    await load();
  };

  const exportPdf = async () => {
    const dir = isRtl ? "rtl" : "ltr";
    const headers = [
      t("tbl.caseTitle"),
      t("tbl.period"),
      t("acc.entryType"),
      t("tbl.amount"),
      t("tbl.notes"),
    ];
    const rows = reports.map((r) => [
      r.title,
      r.period,
      r.entry_type === "income" ? t("acc.flowIncome") : t("acc.flowExpense"),
      r.amount != null ? String(r.amount) : "—",
      r.notes ?? "—",
    ]);
    const tableOnly = buildPdfTableHtml(headers, rows, dir);
    const innerHtml = `
      <h2 style="color:#f97316;font-size:17px;margin-bottom:12px;">${t("pdf.accReport")}</h2>
      ${tableOnly}
    `;
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: tableOnly,
      sectionTitle: t("acc.title"),
      fileName: `accounting-${Date.now()}`,
      direction: dir,
      lang: locale,
      mainTitle: t("brand"),
      dateLocale: locale,
    });
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("acc.lockedTitle")}</h2>
        <p className="text-slate-400">{t("acc.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 shrink-0">
            <Calculator className="size-8 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-200 to-teal-400 bg-clip-text text-transparent">
              {t("nav.financeMgmt")}
            </h1>
            <p className="text-slate-400 text-sm">{t("acc.financeSubtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => exportExcel()}>
            <FileSpreadsheet className="size-4" />
            {t("pdf.exportCsv")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void exportPdf()}>
            <Download className="size-4" />
            {t("pdf.export")}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/reminders" className="inline-flex items-center gap-2">
              <Bell className="size-4" />
              {t("nav.reminders")}
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">{t("acc.newReport")}</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>{t("tbl.caseTitle")}</Label>
            <Input
              className="mt-1"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("tbl.period")}</Label>
            <Input
              className="mt-1"
              placeholder={t("acc.periodExample")}
              value={form.period}
              onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("field.amountOptional")}</Label>
            <Input
              className="mt-1"
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("tbl.notes")}</Label>
            <Input
              className="mt-1"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("acc.entryType")}</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 text-sm"
              value={form.entry_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  entry_type: e.target.value === "income" ? "income" : "expense",
                }))
              }
            >
              <option value="expense">{t("acc.flowExpense")}</option>
              <option value="income">{t("acc.flowIncome")}</option>
            </select>
          </div>
          <Button onClick={() => void add()}>{t("common.add")}</Button>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80">
            <tr>
              <th className="p-3 text-right min-w-[120px]">{t("tbl.caseTitle")}</th>
              <th className="p-3 text-right min-w-[100px]">{t("tbl.period")}</th>
              <th className="p-3 text-right min-w-[100px]">{t("acc.entryType")}</th>
              <th className="p-3 text-right min-w-[90px]">{t("tbl.amount")}</th>
              <th className="p-3 text-right min-w-[120px]">{t("tbl.notes")}</th>
              <th className="p-3 w-24">{t("common.saveRow")}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const d = drafts[r.id] ?? r;
              return (
                <tr key={r.id} className="border-t border-slate-800">
                  <td className="p-2">
                    <Input
                      className="h-9 bg-slate-900/50 border-slate-700"
                      value={d.title}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: { ...d, title: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      className="h-9 bg-slate-900/50 border-slate-700"
                      value={d.period}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: { ...d, period: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="h-9 w-full rounded-md border border-slate-700 bg-slate-900/50 px-2 text-sm"
                      value={d.entry_type === "income" ? "income" : "expense"}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: {
                            ...d,
                            entry_type: e.target.value === "income" ? "income" : "expense",
                          },
                        }))
                      }
                    >
                      <option value="expense">{t("acc.flowExpense")}</option>
                      <option value="income">{t("acc.flowIncome")}</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      className="h-9 bg-slate-900/50 border-slate-700"
                      value={d.amount ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: {
                            ...d,
                            amount: e.target.value ? Number(e.target.value) : null,
                          },
                        }))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      className="h-9 bg-slate-900/50 border-slate-700"
                      value={d.notes ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [r.id]: { ...d, notes: e.target.value || null },
                        }))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => void saveRow(r.id)}
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
  );
}
