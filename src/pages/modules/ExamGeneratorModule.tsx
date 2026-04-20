import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileSpreadsheet, Lock, Save, ScrollText } from "lucide-react";
import { AiGenerateButton } from "@/components/AiGenerateButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { downloadXlsxWorkbook } from "@/lib/excelDownload";
import { buildPdfTableHtml, exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import * as XLSX from "xlsx";
import { useI18n } from "@/i18n/I18nProvider";

const STORAGE = "idara_exam_grid";

type ExamRow = { section: string; question: string; marks: string };

type ExamGenProps = { embedded?: boolean };

export function ExamGeneratorModule({ embedded = false }: ExamGenProps) {
  const { t, locale, isRtl } = useI18n();
  const { isApproved, approvedModules, user } = useAuth();
  const allowed = isApproved && approvedModules.includes("edu");
  const uid = user?.id ?? "guest";

  const defaultRows = useMemo<ExamRow[]>(
    () => [
      { section: "A", question: "", marks: "5" },
      { section: "A", question: "", marks: "5" },
      { section: "B", question: "", marks: "10" },
    ],
    []
  );

  const [rows, setRows] = useState<ExamRow[]>(defaultRows);

  const load = useCallback(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE}_${uid}`);
      if (raw) {
        const p = JSON.parse(raw) as ExamRow[];
        if (Array.isArray(p) && p.length) {
          setRows(p);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setRows(defaultRows);
  }, [uid, defaultRows]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = () => {
    localStorage.setItem(`${STORAGE}_${uid}`, JSON.stringify(rows));
  };

  const update = (i: number, patch: Partial<ExamRow>) => {
    setRows((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], ...patch };
      return n;
    });
  };

  const addRow = () => setRows((prev) => [...prev, { section: "", question: "", marks: "" }]);

  const exportPdf = async () => {
    const dir = isRtl ? "rtl" : "ltr";
    const headers = [t("exam.colSection"), t("exam.colQuestion"), t("exam.colMarks")];
    const dataRows = rows.map((r) => [r.section, r.question, r.marks]);
    const tableBlock = `${buildPdfTableHtml(headers, dataRows, dir)}
      <p style="margin-top:14px;color:#94a3b8;font-size:12px;">${t("brand")}</p>`;
    const innerHtml = `
      <h2 style="color:#f97316;font-size:17px;margin-bottom:12px;">${t("exam.title")}</h2>
      ${tableBlock}
    `;
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: tableBlock,
      sectionTitle: t("exam.title"),
      fileName: `exam-paper-${Date.now()}`,
      direction: dir,
      lang: locale,
      mainTitle: t("brand"),
      dateLocale: locale,
    });
  };

  const exportExcel = () => {
    const sheetRows = rows.map((r) => ({
      [t("exam.colSection")]: r.section,
      [t("exam.colQuestion")]: r.question,
      [t("exam.colMarks")]: r.marks,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    ws["!cols"] = [{ wch: 12 }, { wch: 48 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exam");
    downloadXlsxWorkbook(wb, `exam-paper-${Date.now()}.xlsx`);
  };

  if (!allowed) {
    if (embedded) return null;
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

  const headerBlock =
    !embedded ? (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-violet-500/15 border border-violet-500/30 shadow-lg shadow-violet-500/10">
            <ScrollText className="size-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text">
              {t("exam.title")}
            </h1>
            <p className="text-slate-400 text-sm">{t("exam.subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" onClick={persist}>
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
      </div>
    ) : (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">{t("exam.subtitle")}</p>
        <div className="flex flex-wrap gap-2">
          <AiGenerateButton
            module="exam"
            context={{ name: rows[0]?.question || t("exam.colQuestion"), subject: rows[0]?.section || "" }}
            onGenerated={(text) => {
              if (rows.length) update(0, { question: text.slice(0, 2000) });
            }}
          />
          <Button variant="default" size="sm" onClick={persist}>
            <Save className="size-4" />
            {t("common.save")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportExcel()}>
            <FileSpreadsheet className="size-4" />
            {t("pdf.exportCsv")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void exportPdf()}>
            <Download className="size-4" />
            {t("pdf.export")}
          </Button>
        </div>
      </div>
    );

  return (
    <div className={embedded ? "space-y-4" : "space-y-8"}>
      {headerBlock}

      <Card className="border-slate-800 border-orange-500/10 bg-[#0c1929]/80">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="size-4 text-violet-400" />
            {t("exam.tableTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="p-2 text-right w-24">{t("exam.colSection")}</th>
                  <th className="p-2 text-right">{t("exam.colQuestion")}</th>
                  <th className="p-2 text-right w-28">{t("exam.colMarks")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="p-2">
                      <Input
                        className="h-9 bg-slate-900/50 border-slate-700"
                        value={r.section}
                        onChange={(e) => update(i, { section: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-9 bg-slate-900/50 border-slate-700"
                        value={r.question}
                        onChange={(e) => update(i, { question: e.target.value })}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        className="h-9 bg-slate-900/50 border-slate-700"
                        value={r.marks}
                        onChange={(e) => update(i, { marks: e.target.value })}
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
    </div>
  );
}
