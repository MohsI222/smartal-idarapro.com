import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Download, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postBackendStatutsDocx } from "@/lib/backendExportClient";
import { buildSarlStatutsHtml } from "@/lib/companyStatuts";
import { exportSmartAlIdaraPdfPreferBackend } from "@/lib/pdfExport";
import { downloadStatutsDocx } from "@/lib/wordExport";
import { officialKingdomHeader } from "@/lib/legalRequestDraft";
import type { AppLocale } from "@/i18n/strings";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

function pdfLangFromLocale(locale: AppLocale): string {
  if (locale.startsWith("ar")) return "ar";
  if (locale === "fr") return "fr";
  if (locale === "es") return "es";
  return "en";
}

export function CompanySetupModule() {
  const { t, isRtl, locale } = useI18n();
  const { isApproved, approvedModules } = useAuth();
  const allowed = isApproved && approvedModules.includes("company");
  const appLocale = locale as AppLocale;
  const [denomination, setDenomination] = useState("");
  const [capital, setCapital] = useState("100000");
  const [siege, setSiege] = useState("Casablanca");
  const [objet, setObjet] = useState("");
  const [associes, setAssocies] = useState("");
  const [busyDocx, setBusyDocx] = useState(false);

  const dateIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const statutsParams = useMemo(
    () => ({
      denomination: denomination || "—",
      capital,
      siege,
      objet: objet || t("company.defaultObjet"),
      associes: associes || "—",
      dateIso,
    }),
    [denomination, capital, siege, objet, associes, dateIso, t]
  );

  const html = useMemo(
    () => buildSarlStatutsHtml(appLocale, statutsParams),
    [appLocale, statutsParams]
  );

  const bodyInner = useMemo(() => {
    if (typeof document === "undefined") return "";
    return new DOMParser().parseFromString(html, "text/html").body.innerHTML;
  }, [html]);

  const exportPdf = async () => {
    const kingdom = officialKingdomHeader(appLocale);
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml: bodyInner,
      sectionTitle: t("company.statutsTitle"),
      fileName: `statuts-${Date.now()}.pdf`,
      direction: isRtl ? "rtl" : "ltr",
      lang: pdfLangFromLocale(appLocale),
      dateLocale: locale,
      documentMode: "official",
      officialKingdomLine: kingdom,
    });
  };

  const exportWord = async () => {
    setBusyDocx(true);
    try {
      const fn = `statuts-${Date.now()}.docx`;
      if (
        await postBackendStatutsDocx(fn, appLocale, statutsParams as unknown as Record<string, string>)
      ) {
        return;
      }
      await downloadStatutsDocx(fn, appLocale, statutsParams);
    } finally {
      setBusyDocx(false);
    }
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4 max-w-lg mx-auto">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("company.lockedTitle")}</h2>
        <p className="text-slate-400 text-sm">{t("company.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl pb-16">
      <header>
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          <Building2 className="size-8 text-[#0052CC]" />
          {t("company.title")}
        </h1>
        <p className="text-slate-400 mt-2 text-sm">{t("company.subtitle")}</p>
      </header>

      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader className="border-b border-slate-800">
          <p className="font-black text-white">{t("company.formTitle")}</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label className="text-slate-300">{t("company.field.name")}</Label>
            <Input
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={denomination}
              onChange={(e) => setDenomination(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-slate-300">{t("company.field.capital")}</Label>
            <Input
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-slate-300">{t("company.field.siege")}</Label>
            <Input
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={siege}
              onChange={(e) => setSiege(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-slate-300">{t("company.field.objet")}</Label>
            <Input
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-slate-300">{t("company.field.associes")}</Label>
            <textarea
              className="mt-1 w-full min-h-[100px] rounded-md border border-slate-700 bg-[#0c1222] px-3 py-2 text-sm text-white"
              value={associes}
              onChange={(e) => setAssocies(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" className="gap-2 bg-[#0052CC]" onClick={() => void exportPdf()}>
              <Download className="size-4" />
              {t("company.downloadPdf")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={busyDocx}
              onClick={() => void exportWord()}
            >
              <FileText className="size-4" />
              {busyDocx ? t("legalAi.exporting") : t("company.downloadWord")}
            </Button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{t("company.disclaimer")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
