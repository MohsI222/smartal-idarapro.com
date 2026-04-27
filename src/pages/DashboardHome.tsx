import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [docActivity, setDocActivity] = useState<DocumentActivityEntry[]>(() => readDocumentActivity());

  useEffect(() => {
    const sync = () => setExcelSyncOn(getExcelOnlineSyncEnabled());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  useEffect(() => {
    const onAct = () => setDocActivity(readDocumentActivity());
    window.addEventListener("idara-doc-activity", onAct);
    return () => window.removeEventListener("idara-doc-activity", onAct);
  }, []);

  const welcome = t("dashboard.welcome").replace(
    "{name}",
    user?.name ?? t("dashboard.guestName")
  );

  const referralUrl =
    typeof window !== "undefined"
      ? `${getPublicOrigin()}/register?ref=${encodeURIComponent(user?.referral_code ?? user?.id ?? "guest")}`
      : "";

  const copyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [fin, brand] = await Promise.all([
        api<FinancialSummary>("/dashboard/financial-summary", { token }),
        api<{ branding: Branding }>("/user/branding", { token }),
      ]);
      setSummary(fin);
      if (brand.branding) setBranding(brand.branding);
    } catch {
      setSummary(null);
    }
  }, [token]);

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

  const saveBranding = async () => {
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
  };

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result ?? "");
      if (data.startsWith("data:image") && data.length < 500_000) {
        setBranding((b) => ({ ...b, logoDataUrl: data }));
      }
    };
    reader.readAsDataURL(f);
  };

  const runExportPdf = async () => {
    if (!summary) return;
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
          docCount: summary.docCount,
          todayRevenue: summary.todayRevenue,
          hourRevenue: summary.hourRevenue,
          todayNetProfit: summary.todayNetProfit,
          hourNetProfit: summary.hourNetProfit,
        },
        chart: summary.chart,
      },
      {
        isRtl,
        lang: locale.startsWith("ar") ? "ar" : "en",
        dateLocale: locale,
        fileName: `dashboard-${Date.now()}.pdf`,
      }
    );
  };

  const runExportExcelSync = async () => {
    if (!summary) return;
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
          docCount: summary.docCount,
          todayRevenue: summary.todayRevenue,
          hourRevenue: summary.hourRevenue,
          todayNetProfit: summary.todayNetProfit,
          hourNetProfit: summary.hourNetProfit,
        },
        chart: summary.chart,
      },
      { companyName: branding.companyName, activityType: branding.activityType },
      `idara-excel-sync-${Date.now()}.xlsx`
    );
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

  const runExportExcel = () => {
    if (!summary) return;
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
          docCount: summary.docCount,
          todayRevenue: summary.todayRevenue,
          hourRevenue: summary.hourRevenue,
          todayNetProfit: summary.todayNetProfit,
          hourNetProfit: summary.hourNetProfit,
        },
        chart: summary.chart,
      },
      `dashboard-${Date.now()}.xlsx`
    ).catch(() => undefined);
  };

  const chartData =
    summary?.chart.map((c) => ({
      ...c,
      label: c.day.slice(5),
    })) ?? [];

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
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2 bg-white/10 border border-white/15"
                disabled={!summary}
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
                disabled={!summary}
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
                    disabled={!summary}
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
                    onChange={(ev) => void onImportSyncExcel(ev)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-2 bg-[#003876]/40 border border-[#0052CC]/40"
                    disabled={!token}
                    onClick={() => syncFileInputRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    {t("dashboard.importExcelSync")}
                  </Button>
                </>
              )}
            </div>
          </div>

          {summary ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                <StatCard
                  icon={FileText}
                  label={t("dashboard.docCount")}
                  value={formatNumber(summary.docCount, { maximumFractionDigits: 0 })}
                  accent="text-[#0052CC]"
                />
                <StatCard
                  icon={Layers}
                  label={t("dashboard.revenueToday")}
                  value={formatNumber(summary.todayRevenue, { maximumFractionDigits: 2 })}
                  accent="text-[#FF8C00]"
                />
                <StatCard
                  icon={Download}
                  label={t("dashboard.revenueHour")}
                  value={formatNumber(summary.hourRevenue, { maximumFractionDigits: 2 })}
                  accent="text-emerald-400"
                />
                <StatCard
                  icon={Sparkles}
                  label={t("dashboard.profitToday")}
                  value={formatNumber(summary.todayNetProfit, { maximumFractionDigits: 2 })}
                  accent="text-cyan-400"
                />
                <StatCard
                  icon={TrendingUp}
                  label={t("dashboard.profitHour")}
                  value={formatNumber(summary.hourNetProfit, { maximumFractionDigits: 2 })}
                  accent="text-fuchsia-400"
                />
                <StatCard
                  icon={Layers}
                  label={t("dashboard.statDownloadsCount")}
                  value={formatNumber(summary.salesCount, { maximumFractionDigits: 0 })}
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
          ) : (
            <p className="text-slate-500 text-sm">{t("common.loading")}</p>
          )}
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
                  clearDocumentActivity();
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
                onChange={(e) => setBranding((b) => ({ ...b, companyName: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-300">{t("dashboard.pickLogo")}</Label>
              <Input type="file" accept="image/*" className="mt-1 text-sm" onChange={onLogoFile} />
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
                onChange={(e) => setBranding((b) => ({ ...b, socialWebsite: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-300">{t("social.facebook")}</Label>
              <Input
                className="mt-1 bg-[#050a12]/60 border-slate-600"
                dir="ltr"
                value={branding.socialFacebook}
                onChange={(e) => setBranding((b) => ({ ...b, socialFacebook: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-300">{t("social.instagram")}</Label>
              <Input
                className="mt-1 bg-[#050a12]/60 border-slate-600"
                dir="ltr"
                value={branding.socialInstagram}
                onChange={(e) => setBranding((b) => ({ ...b, socialInstagram: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-300">{t("social.linkedin")}</Label>
              <Input
                className="mt-1 bg-[#050a12]/60 border-slate-600"
                dir="ltr"
                value={branding.socialLinkedin}
                onChange={(e) => setBranding((b) => ({ ...b, socialLinkedin: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-slate-300">{t("social.twitter")}</Label>
              <Input
                className="mt-1 bg-[#050a12]/60 border-slate-600"
                dir="ltr"
                value={branding.socialTwitter}
                onChange={(e) => setBranding((b) => ({ ...b, socialTwitter: e.target.value }))}
              />
            </div>
          </div>
          <Button type="button" onClick={() => void saveBranding()} disabled={savingBrand || !token}>
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
  const { isApproved, approvedModules } = useAuth();
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {SECTIONS.map((sec) => {
        const unlocked = isApproved && approvedModules.includes(sec.id);
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
