import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileSpreadsheet, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OcrScanner, parseMoroccanIdHints } from "@/components/OcrScanner";
import { useAuth } from "@/context/AuthContext";
import {
  buildPdfTableHtml,
  escapeHtmlPdf,
  exportElementToPdf,
  exportSmartAlIdaraPdfPreferBackend,
} from "@/lib/pdfExport";
import { downloadCsv } from "@/lib/exportMoroccanPdf";
import { useI18n } from "@/i18n/I18nProvider";
import { AiGenerateButton } from "@/components/AiGenerateButton";

export function PublicWriterModule() {
  const { t, locale, isRtl } = useI18n();
  const { isApproved, approvedModules } = useAuth();
  const allowed = isApproved && approvedModules.includes("public");
  const templates = useMemo(
    () =>
      [
        {
          id: "sale" as const,
          title: t("public.tpl.sale.title"),
          body: t("public.tpl.sale.body"),
        },
        {
          id: "rent" as const,
          title: t("public.tpl.rent.title"),
          body: t("public.tpl.rent.body"),
        },
        {
          id: "commit" as const,
          title: t("public.tpl.commit.title"),
          body: t("public.tpl.commit.body"),
        },
        {
          id: "application" as const,
          title: t("public.tpl.application.title"),
          body: t("public.tpl.application.body"),
        },
      ] as const,
    [t]
  );
  const [active, setActive] = useState<(typeof templates)[number]["id"]>("sale");
  const [vars, setVars] = useState({
    party1: "",
    party2: "",
    amount: "",
    city: "",
  });
  const [extraBody, setExtraBody] = useState("");
  const [filled, setFilled] = useState("");
  const refPdf = useRef<HTMLDivElement>(null);

  const tpl = templates.find((x) => x.id === active)!;
  const cityForExport = vars.city.trim() || t("public.defaultCity");

  const applyOcr = (text: string) => {
    const h = parseMoroccanIdHints(text);
    setVars((v) => ({
      ...v,
      party1: h.fullName || h.cin || v.party1,
    }));
    setFilled(h.raw);
  };

  const renderBody = () => {
    const base = tpl.body.replace(/\.\.\./g, vars.party1 || "______");
    return extraBody ? `${extraBody}\n\n${base}` : base;
  };

  const exportPdfFull = async () => {
    const dir = isRtl ? "rtl" : "ltr";
    const dataHeaders = [t("field.partyName"), t("tbl.city"), t("tbl.amount")];
    const dataRows = [[vars.party1 || "—", cityForExport, vars.amount || "—"]];
    const dataTable = buildPdfTableHtml(dataHeaders, dataRows, dir);
    const footerLine = escapeHtmlPdf(
      t("public.footerDraft").replace("{city}", cityForExport)
    );
    const docBlock = `
      <div style="margin-top:16px;padding:14px;border:1px solid #334155;border-radius:8px;background:#111827;">
        <p style="color:#f97316;font-weight:700;margin-bottom:10px;">${escapeHtmlPdf(tpl.title)}</p>
        <p style="white-space:pre-wrap;line-height:1.7;color:#e2e8f0;">${escapeHtmlPdf(renderBody())}</p>
        <p style="margin-top:14px;color:#64748b;font-size:12px;">${footerLine}</p>
      </div>
    `;
    const innerHtml = `
      <h2 style="color:#f97316;font-size:17px;">${t("pdf.contract")}</h2>
      ${dataTable}
      ${docBlock}
    `;
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml,
      innerHtmlForBackend: innerHtml,
      sectionTitle: t("public.libraryTitle"),
      fileName: `acte-${active}-${Date.now()}`,
      direction: dir,
      lang: locale,
      mainTitle: t("brand"),
      dateLocale: locale,
    });
  };

  const exportExcel = () => {
    downloadCsv(`contract-data-${Date.now()}.csv`, [
      {
        [t("field.partyName")]: vars.party1,
        [t("field.city")]: cityForExport,
        [t("field.amountOptional")]: vars.amount,
      },
    ]);
  };

  const exportPdfVisual = async () => {
    if (!refPdf.current) return;
    await exportElementToPdf(
      refPdf.current,
      `acte-visual-${Date.now()}`,
      tpl.title,
      locale,
      t("brand"),
      locale
    );
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("public.lockTitle")}</h2>
        <p className="text-slate-400">{t("public.lockDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30">
          <FileText className="size-8 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-orange-400 bg-clip-text text-transparent">
            {t("public.libraryTitle")}
          </h1>
          <p className="text-slate-400 text-sm">{t("public.librarySubtitle")}</p>
        </div>
      </div>

      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor">{t("public.tabEditor")}</TabsTrigger>
          <TabsTrigger value="ocr">{t("public.tabOcr")}</TabsTrigger>
        </TabsList>
        <TabsContent value="editor" className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {templates.map((x) => (
              <Button
                key={x.id}
                variant={active === x.id ? "default" : "outline"}
                className="h-auto min-h-[3rem] py-3 text-center leading-snug"
                onClick={() => setActive(x.id)}
              >
                {x.title}
              </Button>
            ))}
          </div>
          <Card className="border-slate-800 border-amber-500/10">
            <CardHeader>
              <CardTitle className="text-base">{t("public.quickData")}</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>{t("field.partyName")}</Label>
                <Input
                  className="mt-1"
                  value={vars.party1}
                  onChange={(e) => setVars((v) => ({ ...v, party1: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("field.city")}</Label>
                <Input
                  className="mt-1"
                  value={vars.city}
                  onChange={(e) => setVars((v) => ({ ...v, city: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("field.amountOptional")}</Label>
                <Input
                  className="mt-1"
                  value={vars.amount}
                  onChange={(e) => setVars((v) => ({ ...v, amount: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <AiGenerateButton
              module="public"
              context={{
                name: vars.party1,
                city: vars.city,
                amount: vars.amount,
              }}
              onGenerated={(text) => setExtraBody(text)}
            />
          </div>

          <div
            ref={refPdf}
            className="rounded-2xl border border-slate-700 bg-[#0c1929] p-8 min-h-[200px] leading-relaxed"
            dir={isRtl ? "rtl" : "ltr"}
            style={{ textAlign: isRtl ? "right" : "left" }}
          >
            <p className="text-orange-400 font-bold mb-4">{tpl.title}</p>
            <p className="text-slate-200 whitespace-pre-wrap">{renderBody()}</p>
            <p className="mt-8 text-slate-500 text-sm">
              {t("public.footerDraft").replace("{city}", cityForExport)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportExcel()}>
              <FileSpreadsheet className="size-4" />
              {t("pdf.exportCsv")}
            </Button>
            <Button variant="default" onClick={() => void exportPdfFull()}>
              <Download className="size-4" />
              {t("pdf.export")} — {t("pdf.tableAndText")}
            </Button>
            <Button variant="secondary" onClick={() => void exportPdfVisual()}>
              <Download className="size-4" />
              {t("pdf.export")} — {t("pdf.visualTemplate")}
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="ocr">
          <OcrScanner title={t("ocr.scanId")} onExtracted={applyOcr} />
          {filled && (
            <Card className="mt-4 border-slate-800">
              <CardHeader>
                <CardTitle className="text-sm">{t("public.extracted")}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 max-h-40 overflow-auto whitespace-pre-wrap">
                {filled.slice(0, 2000)}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
