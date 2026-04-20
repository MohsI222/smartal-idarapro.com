import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Calendar, Download, FileSpreadsheet, GraduationCap, Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { downloadXlsxWorkbook } from "@/lib/excelDownload";
import { buildPdfTableHtml, exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import * as XLSX from "xlsx";
import { useI18n } from "@/i18n/I18nProvider";
import { ExamGeneratorModule } from "@/pages/modules/ExamGeneratorModule";

const STORAGE_KEY = "idara_edu_schedule_rows";

type ScheduleRow = {
  day: string;
  time: string;
  subject: string;
  level: string;
};

export function EduModule() {
  const { t, locale, isRtl } = useI18n();
  const { isApproved, approvedModules, user } = useAuth();
  const allowed = isApproved && approvedModules.includes("edu");
  const uid = user?.id ?? "guest";
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "substitute";

  const setTab = (v: string) => {
    if (v === "substitute") setSearchParams({});
    else setSearchParams({ tab: v });
  };

  const defaultRows = useMemo(
    () => [
      {
        day: t("edu.demo.r1.day"),
        time: t("edu.demo.r1.time"),
        subject: t("edu.demo.r1.subject"),
        level: t("edu.demo.r1.level"),
      },
      {
        day: t("edu.demo.r2.day"),
        time: t("edu.demo.r2.time"),
        subject: t("edu.demo.r2.subject"),
        level: t("edu.demo.r2.level"),
      },
    ],
    [t]
  );

  const [rows, setRows] = useState<ScheduleRow[]>(defaultRows);

  const loadFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_${uid}`);
      if (raw) {
        const parsed = JSON.parse(raw) as ScheduleRow[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRows(parsed);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setRows(defaultRows);
  }, [uid, defaultRows]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const saveToStorage = () => {
    localStorage.setItem(`${STORAGE_KEY}_${uid}`, JSON.stringify(rows));
  };

  const updateRow = (i: number, patch: Partial<ScheduleRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => [...prev, { day: "", time: "", subject: "", level: "" }]);
  };

  const exportPdf = async () => {
    const dir = isRtl ? "rtl" : "ltr";
    const headers = [t("tbl.day"), t("tbl.time"), t("tbl.subject"), t("tbl.level")];
    const dataRows = rows.map((r) => [r.day, r.time, r.subject, r.level]);
    const tableBlock = `${buildPdfTableHtml(headers, dataRows, dir)}
      <p style="margin-top:14px;color:#94a3b8;font-size:12px;">${t("edu.smartHeadline")} — ${t("brand")}</p>`;
    const innerHtml = `
      <h2 style="color:#f97316;font-size:17px;margin-bottom:12px;">${t("pdf.eduSchedule")}</h2>
      ${tableBlock}
    `;
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: tableBlock,
      sectionTitle: t("edu.tabSchedule"),
      fileName: `edu-schedule-${Date.now()}`,
      direction: dir,
      lang: locale,
      mainTitle: t("brand"),
      dateLocale: locale,
    });
  };

  const exportExcel = () => {
    const sheetRows = rows.map((r) => ({
      [t("tbl.day")]: r.day,
      [t("tbl.time")]: r.time,
      [t("tbl.subject")]: r.subject,
      [t("tbl.level")]: r.level,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    ws["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 32 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Schedule");
    downloadXlsxWorkbook(wb, `edu-schedule-${Date.now()}.xlsx`);
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("edu.lockedTitle")}</h2>
        <p className="text-slate-400">{t("edu.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 rounded-3xl border border-purple-500/20 bg-gradient-to-b from-purple-950/25 via-transparent to-transparent p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-500/15 border border-purple-500/30 shadow-lg shadow-purple-500/10">
            <GraduationCap className="size-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text">
              {t("edu.smartHeadline")}
            </h1>
            <p className="text-slate-400 text-sm">{t("edu.smartSubtitle")}</p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-slate-900/80 border border-slate-800 p-1">
          <TabsTrigger value="substitute" className="data-[state=active]:bg-orange-600">
            {t("edu.tabSubstitute")}
          </TabsTrigger>
          <TabsTrigger value="exams" className="data-[state=active]:bg-orange-600">
            {t("edu.tabExams")}
          </TabsTrigger>
          <TabsTrigger value="schedule" className="data-[state=active]:bg-orange-600">
            {t("edu.tabSchedule")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="substitute" className="space-y-6">
          <Card className="border-slate-800 border-orange-500/10 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base">{t("edu.title")}</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-400 text-sm space-y-4">
              <p>{t("edu.notesBody")}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="size-4 text-orange-400" /> {t("edu.upcomingClasses")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-400 text-sm space-y-2">
              {rows.slice(0, 3).map((r, i) => (
                <p key={i}>
                  • {r.day} {r.time} — {r.level} — {r.subject}
                </p>
              ))}
              <p className="text-xs text-slate-600 pt-2">{t("edu.notes")}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exams" className="space-y-4">
          <ExamGeneratorModule embedded />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="default" onClick={saveToStorage}>
              <Save className="size-4" />
              {t("common.save")}
            </Button>
            <Button variant="outline" onClick={() => exportExcel()}>
              <FileSpreadsheet className="size-4" />
              {t("pdf.exportCsv")}
            </Button>
            <Button variant="secondary" onClick={() => void exportPdf()}>
              <Download className="size-4" />
              {t("pdf.export")}
            </Button>
          </div>

          <Card className="border-slate-800 border-orange-500/10 bg-[#0c1929]/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="size-4 text-orange-400" /> {t("edu.tabSchedule")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-slate-900/80">
                    <tr>
                      <th className="p-2 text-right">{t("tbl.day")}</th>
                      <th className="p-2 text-right">{t("tbl.time")}</th>
                      <th className="p-2 text-right">{t("tbl.subject")}</th>
                      <th className="p-2 text-right">{t("tbl.level")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-800">
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={r.day}
                            onChange={(e) => updateRow(i, { day: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={r.time}
                            onChange={(e) => updateRow(i, { time: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={r.subject}
                            onChange={(e) => updateRow(i, { subject: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-9 bg-slate-900/50 border-slate-700"
                            value={r.level}
                            onChange={(e) => updateRow(i, { level: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={addRow}>
                {t("common.add")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
