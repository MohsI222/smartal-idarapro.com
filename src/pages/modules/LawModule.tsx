import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileSpreadsheet, Gavel, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { downloadCsv } from "@/lib/exportMoroccanPdf";
import { todayIsoLocal } from "@/lib/todayIso";
import { buildPdfTableHtml, exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import { useI18n } from "@/i18n/I18nProvider";

type CaseRow = {
  id: string;
  title: string;
  client_name: string;
  deadline: string | null;
  status: string;
};

export function LawModule() {
  const { t, locale, isRtl } = useI18n();
  const { token, isApproved, approvedModules } = useAuth();
  const allowed = isApproved && approvedModules.includes("law");
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CaseRow>>({});
  const [form, setForm] = useState({ title: "", client_name: "", deadline: todayIsoLocal() });

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    const r = await api<{ cases: CaseRow[] }>("/law/cases", { token });
    setCases(r.cases);
  }, [token, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const d: Record<string, CaseRow> = {};
    for (const c of cases) d[c.id] = { ...c };
    setDrafts(d);
  }, [cases]);

  const saveRow = async (id: string) => {
    if (!token) return;
    const row = drafts[id];
    if (!row) return;
    await api(`/law/cases/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        title: row.title,
        client_name: row.client_name,
        deadline: row.deadline || null,
        status: row.status,
      }),
    });
    await load();
  };

  const exportExcel = () => {
    downloadCsv(
      `cases-${Date.now()}.csv`,
      cases.map((c) => ({
        [t("tbl.caseTitle")]: c.title,
        [t("tbl.client")]: c.client_name,
        [t("tbl.deadline")]: c.deadline ?? "",
        [t("tbl.status")]: c.status,
      }))
    );
  };

  const add = async () => {
    if (!token) return;
    await api("/law/cases", {
      method: "POST",
      token,
      body: JSON.stringify({
        title: form.title,
        client_name: form.client_name,
        deadline: form.deadline || undefined,
      }),
    });
    setForm({ title: "", client_name: "", deadline: todayIsoLocal() });
    await load();
  };

  const exportPdf = async () => {
    const dir = isRtl ? "rtl" : "ltr";
    const headers = [
      t("tbl.caseTitle"),
      t("tbl.client"),
      t("tbl.deadline"),
      t("tbl.status"),
    ];
    const rows = cases.map((c) => [
      c.title,
      c.client_name,
      c.deadline ?? "—",
      c.status,
    ]);
    const tableOnly = buildPdfTableHtml(headers, rows, dir);
    const innerHtml = `
      <h2 style="color:#f97316;font-size:17px;margin-bottom:12px;">${t("pdf.casesReport")}</h2>
      ${tableOnly}
    `;
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: tableOnly,
      sectionTitle: t("law.title"),
      fileName: `cases-${Date.now()}`,
      direction: dir,
      lang: locale,
      mainTitle: t("brand"),
      dateLocale: locale,
    });
  };

  if (!allowed) {
    return <Locked titleKey="law.lockedTitle" descKey="law.lockedDesc" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-3 rounded-2xl bg-orange-500/15 border border-orange-500/30 shrink-0">
            <Gavel className="size-8 text-orange-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-200 to-amber-500 bg-clip-text text-transparent">
              {t("nav.caseTracking")}
            </h1>
            <p className="text-slate-400 text-sm">{t("law.subtitleSeguimiento")}</p>
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
            <Link to="/app/reminders">{t("nav.reminders")}</Link>
          </Button>
        </div>
      </div>

      <Card className="border-slate-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4" /> {t("law.newCase")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>{t("tbl.caseTitle")}</Label>
            <Input
              className="mt-1"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("tbl.client")}</Label>
            <Input
              className="mt-1"
              value={form.client_name}
              onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("tbl.deadline")}</Label>
            <Input
              className="mt-1"
              type="date"
              lang="en"
              dir="ltr"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
            />
          </div>
          <Button onClick={() => void add()}>{t("common.save")}</Button>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80">
            <tr>
              <th className="p-3 text-right min-w-[120px]">{t("tbl.caseTitle")}</th>
              <th className="p-3 text-right min-w-[120px]">{t("tbl.client")}</th>
              <th className="p-3 text-right min-w-[110px]">{t("tbl.deadline")}</th>
              <th className="p-3 text-right min-w-[100px]">{t("tbl.status")}</th>
              <th className="p-3 w-24">{t("common.saveRow")}</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const d = drafts[c.id] ?? c;
              return (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="p-2">
                    <Input
                      className="h-9 bg-slate-900/50 border-slate-700"
                      value={d.title}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [c.id]: { ...d, title: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      className="h-9 bg-slate-900/50 border-slate-700"
                      value={d.client_name}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [c.id]: { ...d, client_name: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="date"
                      lang="en"
                      dir="ltr"
                      className="h-9 bg-slate-900/50 border-slate-700"
                      value={d.deadline ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [c.id]: { ...d, deadline: e.target.value || null },
                        }))
                      }
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="h-9 w-full rounded-md border border-slate-700 bg-slate-900/50 px-2 text-sm"
                      value={d.status}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [c.id]: { ...d, status: e.target.value },
                        }))
                      }
                    >
                      <option value="open">{t("law.status.open")}</option>
                      <option value="pending">{t("law.status.pending")}</option>
                      <option value="closed">{t("law.status.closed")}</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => void saveRow(c.id)}
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

function Locked({ titleKey, descKey }: { titleKey: string; descKey: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4">
      <Lock className="size-12 mx-auto text-orange-400" />
      <h2 className="text-xl font-bold">{t(titleKey)}</h2>
      <p className="text-slate-400">{t(descKey)}</p>
      <Button asChild>
        <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
      </Button>
    </div>
  );
}
