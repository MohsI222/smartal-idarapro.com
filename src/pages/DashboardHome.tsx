import { lazy, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Barcode,
  Bell,
  Copy,
  Check,
  CreditCard,
  Download,
  FileSpreadsheet,
  Upload,
  FileText,
  Layers,
  Lock,
  Sparkles,
  TrendingUp,
  Settings,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SECTIONS } from "@/constants/sections";
import { SocialLinksGrid } from "@/components/SocialLinksGrid";
import { GlobalAiAssistant } from "@/components/ai/GlobalAiAssistant";
import { UserAiSettings } from "@/components/UserAiSettings";
import { PlatformGuideAssistant } from "@/components/PlatformGuideAssistant";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";
import { getPublicOrigin } from "@/lib/publicOrigin";
import { exportDashboardExcel, exportDashboardPdf } from "@/lib/dashboardExport";
import {
  exportDashboardExcelOnlineSync,
  getExcelOnlineSyncEnabled,
  parseBrandingFromSyncExcel,
} from "@/lib/excelOnlineSync";
import {
  clearDocumentActivity,
  readDocumentActivity,
  type DocumentActivityEntry,
} from "@/lib/documentActivityLog";
import {
  addSampleTransactions,
  calculateLocalFinancialStats,
  addLocalDownload,
  clearLocalTransactions,
  clearLocalDownloads,
} from "@/lib/localTransactions";
import { QuickOfficeBar } from "@/components/office/QuickOfficeBar";
import { exportBrandedTableDocx, withFileToast } from "@/services/fileService";

const OfficeDocumentsCard = lazy(() =>
  import("@/components/office/OfficeDocumentsCard").then((m) => ({ default: m.OfficeDocumentsCard }))
);

type FinancialSummary = {
  docCount: number;
  todayRevenue: number;
  hourRevenue: number;
  todayNetProfit: number;
  hourNetProfit: number;
  salesCount: number;
  chart: { day: string; revenue: number }[];
};

type Branding = {
  companyName: string;
  activityType: string;
  logoDataUrl: string;
  socialWebsite: string;
  socialFacebook: string;
  socialInstagram: string;
  socialLinkedin: string;
  socialTwitter: string;
};

function getDefaultSummary(): FinancialSummary {
  const now = new Date();
  const chart: { day: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    chart.push({
      day: d.toISOString().slice(0, 10),
      revenue: 0,
    });
  }
  return {
    docCount: 0,
    todayRevenue: 0,
    hourRevenue: 0,
    todayNetProfit: 0,
    hourNetProfit: 0,
    salesCount: 0,
    chart,
  };
}

export function DashboardHome() {
  const { isApproved, subscription, user, token } = useAuth();
  const { t, isRtl, locale, formatNumber, formatDateTime } = useI18n();
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [branding, setBranding] = useState<Branding>({
    companyName: "",
    activityType: "general",
    logoDataUrl: "",
    socialWebsite: "",
    socialFacebook: "",
    socialInstagram: "",
    socialLinkedin: "",
    socialTwitter: "",
  });
  const [savingBrand, setSavingBrand] = useState(false);
  const [excelSyncOn, setExcelSyncOn] = useState(getExcelOnlineSyncEnabled);
  const syncFileInputRef = useRef<HTMLInputElement>(null);
  const [docActivity, setDocActivity] = useState<DocumentActivityEntry[]>([]);

  useEffect(() => {
    const sync = () => setExcelSyncOn(getExcelOnlineSyncEnabled());
    window.addEventListener("excel-online-sync-toggle", sync);
    return () => window.removeEventListener("excel-online-sync-toggle", sync);
  }, []);

  useEffect(() => {
    const loadDocActivity = async () => {
      if (token) {
        const docs = await readDocumentActivity(token);
        setDocActivity(docs);
      }
    };
    
    loadDocActivity();
    
    const onAct = () => loadDocActivity();
    window.addEventListener("idara-doc-activity", onAct);
    return () => window.removeEventListener("idara-doc-activity", onAct);
  }, [token]);

  const welcome = useMemo(
    () =>
      t("dashboard.welcome").replace("{name}", user?.name ?? t("dashboard.guestName")),
    [t, user?.name]
  );

  const referralUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${getPublicOrigin()}/register?ref=${encodeURIComponent(user?.referral_code ?? user?.id ?? "guest")}`;
  }, [user?.referral_code, user?.id]);

  const copyReferral = useCallback(async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      startTransition(() => setCopied(true));
      window.setTimeout(() => startTransition(() => setCopied(false)), 2000);
    } catch {
      startTransition(() => setCopied(false));
    }
  }, [referralUrl]);

  const loadData = useCallback(async () => {
    // Always get local stats first with user isolation
    const localStats = calculateLocalFinancialStats(user?.id ?? null);
    
    if (!token) {
      // Load from localStorage fallback for guest/no token
      try {
        const localFin = localStorage.getItem("idara_financial_summary_fallback");
        const localBrand = localStorage.getItem("idara_branding_fallback");
        if (localFin) {
          const serverFin = JSON.parse(localFin) as FinancialSummary;
          // Combine server + local data
          setSummary({
            ...serverFin,
            docCount: serverFin.docCount + localStats.docCount,
            todayRevenue: serverFin.todayRevenue + localStats.todayRevenue,
            hourRevenue: serverFin.hourRevenue + localStats.hourRevenue,
            todayNetProfit: serverFin.todayNetProfit + localStats.todayNetProfit,
            hourNetProfit: serverFin.hourNetProfit + localStats.hourNetProfit,
            salesCount: serverFin.salesCount + localStats.salesCount,
            chart: combineChartData(serverFin.chart, localStats.chart),
          });
        } else {
          setSummary(localStats);
        }
        if (localBrand) setBranding(JSON.parse(localBrand) as Branding);
      } catch {
        setSummary(localStats);
      }
      return;
    }
    try {
      const [fin, brand] = await Promise.all([
        api<FinancialSummary>("/dashboard/financial-summary", { token }),
        api<{ branding: Branding }>("/user/branding", { token }),
      ]);
      // Combine server + local data
      setSummary({
        ...fin,
        docCount: fin.docCount + localStats.docCount,
        todayRevenue: fin.todayRevenue + localStats.todayRevenue,
        hourRevenue: fin.hourRevenue + localStats.hourRevenue,
        todayNetProfit: fin.todayNetProfit + localStats.todayNetProfit,
        hourNetProfit: fin.hourNetProfit + localStats.hourNetProfit,
        salesCount: fin.salesCount + localStats.salesCount,
        chart: combineChartData(fin.chart, localStats.chart),
      });
      if (brand.branding) {
        setBranding(brand.branding);
        localStorage.setItem("idara_branding_fallback", JSON.stringify(brand.branding));
      }
      localStorage.setItem("idara_financial_summary_fallback", JSON.stringify(fin));
    } catch {
      // Fallback to localStorage or local stats
      try {
        const localFin = localStorage.getItem("idara_financial_summary_fallback");
        if (localFin) {
          const serverFin = JSON.parse(localFin) as FinancialSummary;
          setSummary({
            ...serverFin,
            docCount: serverFin.docCount + localStats.docCount,
            todayRevenue: serverFin.todayRevenue + localStats.todayRevenue,
            hourRevenue: serverFin.hourRevenue + localStats.hourRevenue,
            todayNetProfit: serverFin.todayNetProfit + localStats.todayNetProfit,
            hourNetProfit: serverFin.hourNetProfit + localStats.hourNetProfit,
            salesCount: serverFin.salesCount + localStats.salesCount,
            chart: combineChartData(serverFin.chart, localStats.chart),
          });
        } else {
          setSummary(localStats);
        }
      } catch {
        setSummary(localStats);
      }
    }
  }, [token]);

  function combineChartData(
    serverChart: { day: string; revenue: number }[],
    localChart: { day: string; revenue: number }[]
  ): { day: string; revenue: number }[] {
    const combined = new Map<string, number>();
    serverChart.forEach((c) => combined.set(c.day, (combined.get(c.day) || 0) + c.revenue));
    localChart.forEach((c) => combined.set(c.day, (combined.get(c.day) || 0) + c.revenue));
    return Array.from(combined.entries())
      .map(([day, revenue]) => ({ day, revenue }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const socialHrefOverrides = useMemo(() => {
    const o: Record<string, string> = {};
    if (branding.socialWebsite?.trim()) o.social_website = branding.socialWebsite.trim();
    if (branding.socialFacebook?.trim()) o.social_facebook = branding.socialFacebook.trim();
    if (branding.socialInstagram?.trim()) o.social_instagram = branding.socialInstagram.trim();
    if (branding.socialLinkedin?.trim()) o.social_linkedin = branding.socialLinkedin.trim();
    if (branding.socialTwitter?.trim()) o.social_twitter = branding.socialTwitter.trim();
    return Object.keys(o).length ? o : undefined;
  }, [
    branding.socialWebsite,
    branding.socialFacebook,
    branding.socialInstagram,
    branding.socialLinkedin,
    branding.socialTwitter,
  ]);

  const saveBranding = useCallback(async () => {
    if (!token) return;
    setSavingBrand(true);
    try {
      await api("/user/branding", {
        method: "PUT",
        token,
        body: JSON.stringify({
          companyName: branding.companyName,
          activityType: branding.activityType,
          logoDataUrl: branding.logoDataUrl,
          socialWebsite: branding.socialWebsite,
          socialFacebook: branding.socialFacebook,
          socialInstagram: branding.socialInstagram,
          socialLinkedin: branding.socialLinkedin,
          socialTwitter: branding.socialTwitter,
        }),
      });
    } finally {
      setSavingBrand(false);
    }
  }, [token, branding]);

  const onLogoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result ?? "");
      if (data.startsWith("data:image") && data.length < 500_000) {
        startTransition(() => setBranding((b) => ({ ...b, logoDataUrl: data })));
      }
    };
    reader.readAsDataURL(f);
  }, []);

  const runExportPdf = useCallback(async () => {
    const data = summary ?? getDefaultSummary();
    addLocalDownload({ filename: `dashboard-${Date.now()}.pdf`, type: "pdf" }, user?.id ?? null);
    await exportDashboardPdf(
      {
        companyName: branding.companyName,
        logoDataUrl: branding.logoDataUrl,
        labels: {
          docCount: t("dashboard.docCount"),
          revenueToday: t("dashboard.revenueToday"),
          revenueHour: t("dashboard.revenueHour"),
          profitToday: t("dashboard.profitToday"),
          profitHour: t("dashboard.profitHour"),
          title: t("dashboard.financialTitle"),
        },
        values: {
          docCount: data.docCount,
          todayRevenue: data.todayRevenue,
          hourRevenue: data.hourRevenue,
          todayNetProfit: data.todayNetProfit,
          hourNetProfit: data.hourNetProfit,
        },
        chart: data.chart,
      },
      {
        isRtl,
        lang: locale.startsWith("ar") ? "ar" : "en",
        dateLocale: locale,
        fileName: `dashboard-${Date.now()}.pdf`,
      }
    );
    void loadData();
  }, [summary, branding, t, isRtl, locale, loadData]);

  const runExportExcelSync = async () => {
    const data = summary ?? getDefaultSummary();
    addLocalDownload({ filename: `idara-excel-sync-${Date.now()}.xlsx`, type: "excel" }, user?.id ?? null);
    await exportDashboardExcelOnlineSync(
      {
        companyName: branding.companyName,
        logoDataUrl: branding.logoDataUrl,
        labels: {
          docCount: t("dashboard.docCount"),
          revenueToday: t("dashboard.revenueToday"),
          revenueHour: t("dashboard.revenueHour"),
          profitToday: t("dashboard.profitToday"),
          profitHour: t("dashboard.profitHour"),
          title: t("dashboard.financialTitle"),
        },
        values: {
          docCount: data.docCount,
          todayRevenue: data.todayRevenue,
          hourRevenue: data.hourRevenue,
          todayNetProfit: data.todayNetProfit,
          hourNetProfit: data.hourNetProfit,
        },
        chart: data.chart,
      },
      { companyName: branding.companyName, activityType: branding.activityType },
      `idara-excel-sync-${Date.now()}.xlsx`
    );
    void loadData();
  };

  const onImportSyncExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !token) return;
    try {
      const parsed = await parseBrandingFromSyncExcel(f);
      if (!parsed) {
        window.alert("Invalid sync file — use Export sync workbook from the dashboard.");
        return;
      }
      await api("/user/branding", {
        method: "PUT",
        token,
        body: JSON.stringify({
          companyName: parsed.companyName,
          activityType: parsed.activityType,
          logoDataUrl: branding.logoDataUrl,
        }),
      });
      setBranding((b) => ({
        ...b,
        companyName: parsed.companyName,
        activityType: parsed.activityType,
      }));
      await loadData();
      window.alert(t("dashboard.syncImported"));
    } catch {
      window.alert(t("auth.errGeneric"));
    }
  };

  const runProfessionalWord = useCallback(async () => {
    const data = summary ?? getDefaultSummary();
    addLocalDownload({ filename: `dashboard-pro-${Date.now()}.docx`, type: "word" }, user?.id ?? null);
    await withFileToast(
      () =>
        exportBrandedTableDocx({
          title: t("dashboard.financialTitle"),
          rows: [
            [t("dashboard.docCount"), String(data.docCount)],
            [t("dashboard.revenueToday"), String(data.todayRevenue)],
            [t("dashboard.revenueHour"), String(data.hourRevenue)],
            [t("dashboard.profitToday"), String(data.todayNetProfit)],
            [t("dashboard.profitHour"), String(data.hourNetProfit)],
            [t("dashboard.statDownloadsCount"), String(data.salesCount)],
          ],
          fileName: `dashboard-pro-${Date.now()}.docx`,
        }),
      t("auth.errGeneric")
    );
    void loadData();
  }, [summary, t, loadData]);

  const runExportExcel = () => {
    const data = summary ?? getDefaultSummary();
    addLocalDownload({ filename: `dashboard-${Date.now()}.xlsx`, type: "excel" }, user?.id ?? null);
    void exportDashboardExcel(
      {
        companyName: branding.companyName,
        logoDataUrl: branding.logoDataUrl,
        labels: {
          docCount: t("dashboard.docCount"),
          revenueToday: t("dashboard.revenueToday"),
          revenueHour: t("dashboard.revenueHour"),
          profitToday: t("dashboard.profitToday"),
          profitHour: t("dashboard.profitHour"),
          title: t("dashboard.financialTitle"),
        },
        values: {
          docCount: data.docCount,
          todayRevenue: data.todayRevenue,
          hourRevenue: data.hourRevenue,
          todayNetProfit: data.todayNetProfit,
          hourNetProfit: data.hourNetProfit,
        },
        chart: data.chart,
      },
      `dashboard-${Date.now()}.xlsx`
    ).catch(() => undefined);
    void loadData();
  };

  const chartData = useMemo(
    () =>
      (summary ?? getDefaultSummary()).chart.map((c) => ({
        ...c,
        label: c.day.slice(5),
      })),
    [summary]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-l from-[#FF8C00] via-white to-[#0052CC] bg-clip-text text-transparent">
            {welcome}
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 px-3 py-2 text-[#FF8C00] text-sm shadow-lg">
            <Bell className="size-4" />
            {t("dashboard.alerts")}
          </span>
        </div>
      </div>

      <Card className="border-white/10 bg-gradient-to-br from-[#0052CC]/15 via-[#0a1628]/80 to-[#FF8C00]/10 backdrop-blur-xl shadow-2xl overflow-hidden">
        <CardContent className="p-4 md:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <TrendingUp className="size-6 text-[#FF8C00]" />
                {t("dashboard.financialTitle")}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t("dashboard.financialHint")}</p>
              <Link
                to="/app/inventory?tab=dash"
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-[#FF8C00] hover:text-[#ffa033] transition-colors"
              >
                <Barcode className="size-3.5 shrink-0" />
                {t("dashboard.inventoryRadarLink")}
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 text-xs text-slate-500 hover:text-slate-300"
                data-nav-index="0" data-nav-group="dashboard-actions"
                onClick={() => {
                  addSampleTransactions(user?.id ?? null);
                  void loadData();
                }}
              >
                تحميل بيانات تجريبية
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 text-xs text-red-500/70 hover:text-red-400"
                data-nav-index="1" data-nav-group="dashboard-actions"
                onClick={() => {
                  if (window.confirm("مسح جميع البيانات المحلية؟")) {
                    clearLocalTransactions(user?.id ?? null);
                    clearLocalDownloads(user?.id ?? null);
                    void loadData();
                  }
                }}
              >
                مسح البيانات المحلية
              </Button>
            </div>
            <div className="flex flex-col gap-3 w-full sm:w-auto">
              <QuickOfficeBar
                onProfessionalExcel={runExportExcel}
                onProfessionalWord={runProfessionalWord}
                disabledExcel={false}
                disabledWord={false}
                labels={{
                  quickGrid: t("fileUi.quickGrid"),
                  exportExcel: t("fileUi.proExcel"),
                  exportWord: t("fileUi.proWord"),
                }}
              />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2 bg-white/10 border border-white/15"
                data-nav-index="2" data-nav-group="dashboard-export"
                onClick={() => void runExportPdf()}
              >
                <FileText className="size-4" />
                {t("dashboard.exportPdf")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2 bg-white/10 border border-white/15"
                data-nav-index="3" data-nav-group="dashboard-export"
                onClick={runExportExcel}
              >
                <FileSpreadsheet className="size-4" />
                {t("dashboard.exportExcel")}
              </Button>
              {excelSyncOn && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-2 bg-emerald-950/40 border border-emerald-500/30 text-emerald-100"
                    data-nav-index="4" data-nav-group="dashboard-export"
                    onClick={() => void runExportExcelSync()}
                  >
                    <FileSpreadsheet className="size-4" />
                    {t("dashboard.exportExcelSync")}
                  </Button>
                  <input
                    ref={syncFileInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(ev) => {
                      void onImportSyncExcel(ev);
                      ev.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-2 bg-[#003876]/40 border border-[#0052CC]/40"
                    disabled={!token}
                    data-nav-index="5" data-nav-group="dashboard-export"
                    onClick={() => syncFileInputRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    {t("dashboard.importExcelSync")}
                  </Button>
                </>
              )}
            </div>
            </div>
          </div>

          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              <StatCard
                icon={FileText}
                label={t("dashboard.docCount")}
                value={formatNumber((summary ?? getDefaultSummary()).docCount, { maximumFractionDigits: 0 })}
                accent="text-[#0052CC]"
              />
              <StatCard
                icon={Layers}
                label={t("dashboard.revenueToday")}
                value={formatNumber((summary ?? getDefaultSummary()).todayRevenue, { maximumFractionDigits: 2 })}
                accent="text-[#FF8C00]"
              />
              <StatCard
                icon={Download}
                label={t("dashboard.revenueHour")}
                value={formatNumber((summary ?? getDefaultSummary()).hourRevenue, { maximumFractionDigits: 2 })}
                accent="text-emerald-400"
              />
              <StatCard
                icon={Sparkles}
                label={t("dashboard.profitToday")}
                value={formatNumber((summary ?? getDefaultSummary()).todayNetProfit, { maximumFractionDigits: 2 })}
                accent="text-cyan-400"
              />
              <StatCard
                icon={TrendingUp}
                label={t("dashboard.profitHour")}
                value={formatNumber((summary ?? getDefaultSummary()).hourNetProfit, { maximumFractionDigits: 2 })}
                accent="text-fuchsia-400"
              />
              <StatCard
                icon={Layers}
                label={t("dashboard.statDownloadsCount")}
                value={formatNumber((summary ?? getDefaultSummary()).salesCount, { maximumFractionDigits: 0 })}
                accent="text-amber-300"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 h-[280px]">
              <p className="text-sm font-bold text-slate-300 mb-3">{t("dashboard.chart7d")}</p>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0052CC" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#FF8C00" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    tickFormatter={(v) => formatNumber(Number(v), { maximumFractionDigits: 0 })}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0a1628",
                      border: "1px solid rgba(255,140,0,0.4)",
                      borderRadius: 12,
                    }}
                    formatter={(value: number | string) => [
                      formatNumber(Number(value), { maximumFractionDigits: 2 }),
                      t("dashboard.revenueToday"),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#FF8C00"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        </CardContent>
      </Card>

      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-[#0a1628]/90 backdrop-blur-xl">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-black text-white flex items-center gap-2">
                <Layers className="size-5 text-emerald-400" />
                {t("dashboard.activityTitle")}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{t("dashboard.activityHint")}</p>
            </div>
            {docActivity.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 border-white/10"
                onClick={() => {
                  clearDocumentActivity(user?.id);
                  setDocActivity([]);
                }}
              >
                {t("dashboard.activityClear")}
              </Button>
            )}
          </div>
          {docActivity.length === 0 ? (
            <p className="text-sm text-slate-500">{t("dashboard.activityEmpty")}</p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto text-sm">
              {docActivity.slice(0, 25).map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border border-white/5 rounded-lg px-3 py-2 bg-black/20"
                >
                  <span className="text-slate-200 truncate min-w-0">{e.title}</span>
                  <span
                    dir="ltr"
                    className="text-[10px] text-slate-500 font-digits-latin shrink-0"
                  >
                    {formatDateTime(new Date(e.at))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Suspense
        fallback={
          <div className="rounded-xl border border-white/10 bg-[#0a1628]/60 p-6 text-sm text-slate-400">{t("common.loading")}</div>
        }
      >
        <OfficeDocumentsCard
          title={t("fileUi.officeHubTitle")}
          subtitle={t("fileUi.officeHubSubtitle")}
          uploadLabel={t("fileUi.upload")}
          previewLabel={t("fileUi.refreshPreview")}
          saveLabel={t("fileUi.saveLocal")}
          stashTitle={t("fileUi.savedList")}
        />
      </Suspense>

      <UserAiSettings />

      <PlatformGuideAssistant isPreSubscription={false} />

      <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
        <CardContent className="p-4 md:p-6 space-y-4">
          <h3 className="font-black text-white">{t("dashboard.brandingTitle")}</h3>
          <p className="text-xs text-slate-400">{t("dashboard.brandingHint")}</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">{t("dashboard.companyName")}</Label>
              <Input
                className="mt-1 bg-[#050a12]/60 border-slate-600"
                value={branding.companyName}
                data-nav-index="6" data-nav-group="dashboard-branding"
                onChange={(e) => setBranding((b) => ({ ...b, companyName: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-300">{t("dashboard.pickLogo")}</Label>
              <Input type="file" accept="image/*" className="mt-1 text-sm" data-nav-index="7" data-nav-group="dashboard-branding" onChange={(e) => {
                onLogoFile(e);
                e.target.value = "";
              }} />
            </div>
          </div>
          {branding.logoDataUrl && (
            <img
              src={branding.logoDataUrl}
              alt=""
              className="max-h-16 max-w-[200px] object-contain rounded-lg border border-white/10"
            />
          )}
          <p className="text-xs font-semibold text-slate-300 pt-2">{t("dashboard.brandSocialBlock")}</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">{t("social.website")}</Label>
              <Input
                className="mt-1 bg-[#050a12]/60 border-slate-600"
                dir="ltr"
                placeholder="https://"
                value={branding.socialWebsite}
                data-nav-index="8" data-nav-group="dashboard-branding"
                onChange={(e) => setBranding((b) => ({ ...b, socialWebsite: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-300">{t("social.facebook")}</Label>
              <Input
                className="mt-1 bg-[#050a12]/60 border-slate-600"
                dir="ltr"
                value={branding.socialFacebook}
                data-nav-index="9" data-nav-group="dashboard-branding"
                onChange={(e) => setBranding((b) => ({ ...b, socialFacebook: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-300">{t("social.instagram")}</Label>
              <Input
                className="mt-1 bg-[#050a12]/60 border-slate-600"
                dir="ltr"
                value={branding.socialInstagram}
                data-nav-index="10" data-nav-group="dashboard-branding"
                onChange={(e) => setBranding((b) => ({ ...b, socialInstagram: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-300">{t("social.linkedin")}</Label>
              <Input
                className="mt-1 bg-[#050a12]/60 border-slate-600"
                dir="ltr"
                value={branding.socialLinkedin}
                data-nav-index="11" data-nav-group="dashboard-branding"
                onChange={(e) => setBranding((b) => ({ ...b, socialLinkedin: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-slate-300">{t("social.twitter")}</Label>
              <Input
                className="mt-1 bg-[#050a12]/60 border-slate-600"
                dir="ltr"
                value={branding.socialTwitter}
                data-nav-index="12" data-nav-group="dashboard-branding"
                onChange={(e) => setBranding((b) => ({ ...b, socialTwitter: e.target.value }))}
              />
            </div>
          </div>
          <Button type="button" onClick={() => void saveBranding()} disabled={savingBrand || !token} data-nav-index="13" data-nav-group="dashboard-branding">
            {t("dashboard.saveBranding")}
          </Button>
        </CardContent>
      </Card>

      <SocialLinksGrid hrefOverrides={socialHrefOverrides} />

      <Card className="border-[#0052CC]/30 bg-gradient-to-br from-[#0052CC]/10 via-[#0a1628] to-[#FF8C00]/5 overflow-hidden backdrop-blur-sm">
        <CardContent className="p-4 md:p-6 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div>
            <p className="text-sm font-semibold text-[#FF8C00]">{t("dashboard.referralTitle")}</p>
            <p className="text-xs text-slate-500 mt-1">{t("dashboard.referralHint")}</p>
            <code className="mt-3 block text-xs md:text-sm text-white/90 break-all rounded-lg bg-black/30 px-3 py-2 border border-slate-700/80">
              {referralUrl || "—"}
            </code>
          </div>
          <Button
            type="button"
            onClick={() => void copyReferral()}
            data-nav-index="14" data-nav-group="dashboard-referral"
            className="shrink-0 bg-[#FF8C00] text-[#050a12] hover:bg-[#e67e00] gap-2"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t("dashboard.referralCopied") : t("dashboard.referralCopy")}
          </Button>
        </CardContent>
      </Card>

      {!isApproved && (
        <div className="rounded-2xl border border-orange-500/40 bg-gradient-to-l from-orange-500/10 to-blue-500/10 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex gap-3">
            <Lock className="size-10 text-orange-400 shrink-0" />
            <div>
              <h2 className="font-bold text-lg">{t("dashboard.lockTitle")}</h2>
              <p className="text-slate-400 text-sm mt-1 max-w-xl">{t("dashboard.lockDesc")}</p>
              {subscription?.status === "pending" && (
                <Badge className="mt-2">{t("dashboard.pending")}</Badge>
              )}
              {subscription?.status === "rejected" && (
                <Badge variant="destructive" className="mt-2">
                  {t("dashboard.rejected")}
                </Badge>
              )}
            </div>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link to="/app/pay">
              <CreditCard className="size-4" />
              {t("dashboard.subscribePay")}
            </Link>
          </Button>
        </div>
      )}

      <SectionGrid />

      <GlobalAiAssistant
        section="dashboard"
        context="Executive Dashboard - Financial Reports, Business Analytics, and Management"
        availableFields={["company_name", "revenue", "profit", "expenses"]}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-md hover:border-[#0052CC]/40 transition-colors idara-animate-in shadow-lg">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Icon className={`size-6 shrink-0 ${accent}`} strokeWidth={1.75} />
          <span
            dir="ltr"
            className="text-2xl font-black text-white tabular-nums font-digits-latin min-w-0 text-end"
          >
            {value}
          </span>
        </div>
        <p className="text-xs text-slate-500 leading-tight text-start">{label}</p>
      </CardContent>
    </Card>
  );
}

function SectionGrid() {
  const { isApproved, approvedModules, isAdmin } = useAuth();
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {SECTIONS.map((sec) => {
        const unlocked = isAdmin || (isApproved && approvedModules.includes(sec.id));
        const Icon = sec.icon;
        return (
          <Card
            key={sec.id}
            className="overflow-hidden border-white/10 bg-white/5 backdrop-blur-md hover:border-orange-500/40 transition-colors"
          >
            <CardContent className="p-0">
              <div className="p-6">
                <Icon className={`size-10 ${sec.color} mb-3`} />
                <h3 className="text-lg font-bold">{t(sec.titleKey)}</h3>
                <p className="text-slate-500 text-sm mt-2">{t("dashboard.cardDesc")}</p>
                <div className="flex justify-between items-center mt-4 font-bold">
                  <span className="text-orange-400">{sec.price}</span>
                  <span className="text-xs text-slate-600">{t("common.perMonth")}</span>
                </div>
              </div>
              <div className="bg-black/40 px-6 py-3 flex items-center justify-between border-t border-white/10">
                {unlocked ? (
                  <Badge variant="success">{t("dashboard.active")}</Badge>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Lock className="size-3" /> {t("dashboard.locked")}
                  </span>
                )}
                <Button size="sm" variant={unlocked ? "secondary" : "default"} asChild>
                  <Link to={unlocked ? sec.path : "/app/pay"}>
                    {unlocked ? (
                      <>
                        <Sparkles className="size-3" /> {t("dashboard.enter")}
                      </>
                    ) : (
                      t("dashboard.subscribe")
                    )}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
