import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Bot,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Globe2,
  Lock as LockIcon,
  Plane,
  RefreshCw,
  Search,
  Smartphone,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VISA_CENTER_ENTRIES, type VisaCenterEntry } from "@/constants/visaCenters";
import { api } from "@/lib/api";
import { VISA_PREMIUM_ADDON_DH } from "@/constants/plans";
import { exportSmartAlIdaraPdfPreferBackend, buildOfficialPdfTableHtml } from "@/lib/pdfExport";
import { officialKingdomHeader } from "@/lib/legalRequestDraft";
import { playEmbassyOpenChime, startAlarm, stopAlarm } from "@/lib/visaAlarm";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import type { AppLocale } from "@/i18n/strings";
const USER_PROFILE_KEY = "user_profile";
const VISA_USER_DATA_KEY = "visaUserData";
const LEGACY_VISA_LS_KEY = "idara_visa_local_profile_v1";

/** اسم المشرف الافتراضي — يُحفظ تلقائياً في localStorage لضمان بقاء السجل */
const DEFAULT_VISA_FULL_NAME = "LAHCEN EL MOUTAOUAKIL";

type VisaLocalProfile = { full_name: string; passport_no: string; phone: string; email: string };

const EMPTY_VISA_PROFILE: VisaLocalProfile = {
  full_name: DEFAULT_VISA_FULL_NAME,
  passport_no: "",
  phone: "",
  email: "",
};

function normalizeVisaProfile(p: VisaLocalProfile): VisaLocalProfile {
  const full_name = String(p.full_name ?? "").trim() || DEFAULT_VISA_FULL_NAME;
  return {
    full_name,
    passport_no: String(p.passport_no ?? "").trim(),
    phone: String(p.phone ?? "").trim(),
    email: String(p.email ?? "").trim(),
  };
}

function readVisaProfileFromStorage(): VisaLocalProfile {
  try {
    let raw = localStorage.getItem(USER_PROFILE_KEY);
    if (raw) {
      try {
        const o = JSON.parse(raw) as Record<string, unknown>;
        return normalizeVisaProfile({
          full_name: String(o.full_name ?? o.fullName ?? ""),
          passport_no: String(o.passport_no ?? ""),
          phone: String(o.phone ?? ""),
          email: String(o.email ?? ""),
        });
      } catch {
        /* تالف — نكمل بالمفاتيح الأخرى */
      }
    }
    raw = localStorage.getItem(VISA_USER_DATA_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_VISA_LS_KEY);
    if (!raw) {
      const initial = normalizeVisaProfile({ ...EMPTY_VISA_PROFILE });
      try {
        const s = JSON.stringify(initial);
        localStorage.setItem(USER_PROFILE_KEY, s);
        localStorage.setItem(VISA_USER_DATA_KEY, s);
      } catch {
        /* ignore */
      }
      return initial;
    }
    const o = JSON.parse(raw) as Partial<VisaLocalProfile>;
    const merged = normalizeVisaProfile({
      full_name: String(o.full_name ?? ""),
      passport_no: String(o.passport_no ?? ""),
      phone: String(o.phone ?? ""),
      email: String(o.email ?? ""),
    });
    if (!String(o.full_name ?? "").trim()) {
      try {
        const s = JSON.stringify(merged);
        localStorage.setItem(VISA_USER_DATA_KEY, s);
        localStorage.setItem(USER_PROFILE_KEY, s);
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
    }
    return merged;
  } catch {
    return normalizeVisaProfile({ ...EMPTY_VISA_PROFILE });
  }
}

function nonEmptyApiField(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  return s.length ? s : undefined;
}

type CenterRow = { center_id: string; status: string; updated_at: string };

function statusBadgeClass(status: string): string {
  if (status === "open") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/50";
  if (status === "closed") return "bg-red-500/15 text-red-300 border-red-500/50";
  return "bg-amber-500/15 text-amber-200 border-amber-500/50";
}

function statusLabelFromCode(t: (key: string) => string, code: string): string {
  if (code === "open" || code === "closed" || code === "soon") return t(`visa.status.${code}`);
  return t("visa.status.unknown");
}

/** إسبانيا، فرنسا، وغيرها — نافذة خارجية كاملة عبر window.open فقط */
function openVisaCenterExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function VisaRadarModule() {
  const { token, approvedModules, user } = useAuth();
  const visaUnlocked = approvedModules.includes("visa");
  const { t, isRtl, locale, formatDateTime } = useI18n();
  const appLocale = locale as AppLocale;
  const [now, setNow] = useState(() => new Date());
  const [pulse, setPulse] = useState<Record<string, boolean>>({});
  const [profile, setProfile] = useState<VisaLocalProfile>(() => ({ ...EMPTY_VISA_PROFILE }));
  const [autoWatch, setAutoWatch] = useState(false);
  const [alerts, setAlerts] = useState<{ id: string; msg: string; at: string }[]>([]);
  const [statusByCenter, setStatusByCenter] = useState<Record<string, CenterRow>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [alarmPlaying, setAlarmPlaying] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const prevStatusSnapRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setProfile(readVisaProfileFromStorage());
  }, []);

  const pushInAppAlert = useCallback((msg: string) => {
    setAlerts((a) =>
      [{ id: crypto.randomUUID(), msg, at: new Date().toISOString() }, ...a].slice(0, 20)
    );
  }, []);

  const notifyBrowser = useCallback(
    (body: string) => {
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      try {
        new Notification(t("visa.notifyTitle"), { body, lang: locale.startsWith("ar") ? "ar" : "en" });
      } catch {
        /* ignore */
      }
    },
    [locale, t]
  );

  const triggerSlotAlarm = useCallback(() => {
    startAlarm();
    setAlarmPlaying(true);
  }, []);

  const stopSlotAlarm = useCallback(() => {
    stopAlarm();
    setAlarmPlaying(false);
  }, []);

  const filteredCenters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return VISA_CENTER_ENTRIES;
    return VISA_CENTER_ENTRIES.filter((e) => {
      const a = `${t(e.countryKey)} ${t(e.embassyKey)} ${t(e.cityKey)}`.toLowerCase();
      return a.includes(q);
    });
  }, [searchQuery, t]);

  const loadStatus = useCallback(
    async (opts?: { compareForAlerts?: boolean }) => {
      if (!token || !visaUnlocked) return;
      try {
        const r = await api<{ rows: CenterRow[] }>("/visa/appointment-status", { token });
        const map: Record<string, CenterRow> = {};
        for (const row of r.rows) {
          map[row.center_id] = row;
        }
        setStatusByCenter(map);

        if (opts?.compareForAlerts) {
          for (const e of VISA_CENTER_ENTRIES) {
            const prev = prevStatusSnapRef.current[e.id];
            const next = map[e.id]?.status ?? "soon";
            if (prev !== undefined && prev !== next) {
              const label = statusLabelFromCode(t, next);
              pushInAppAlert(`${t("visa.notifyChanged")}: ${t(e.countryKey)} — ${label}`);
              notifyBrowser(`${t(e.countryKey)}: ${label}`);
              if (next === "open" && prev !== "open") {
                triggerSlotAlarm();
              }
            }
          }
        }
        const snap: Record<string, string> = {};
        for (const e of VISA_CENTER_ENTRIES) snap[e.id] = map[e.id]?.status ?? "soon";
        prevStatusSnapRef.current = snap;
      } catch {
        /* ignore */
      }
    },
    [notifyBrowser, pushInAppAlert, t, token, triggerSlotAlarm, visaUnlocked]
  );

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const loadProfile = useCallback(async () => {
    if (!token || !visaUnlocked) return;
    try {
      const r = await api<{ profile: Record<string, string> | null }>("/visa/profile", { token });
      if (r.profile) {
        setProfile((prev) =>
          normalizeVisaProfile({
            full_name: nonEmptyApiField(r.profile!.full_name) ?? prev.full_name,
            passport_no: nonEmptyApiField(r.profile!.passport_no) ?? prev.passport_no,
            phone: nonEmptyApiField(r.profile!.phone) ?? prev.phone,
            email: nonEmptyApiField(r.profile!.email) ?? prev.email,
          })
        );
      }
    } catch {
      /* ignore */
    }
  }, [token, visaUnlocked]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    const saved = normalizeVisaProfile(profile);
    setProfile(saved);
    const formData = {
      full_name: saved.full_name,
      passport_no: saved.passport_no,
      phone: saved.phone,
      email: saved.email,
    };
    const payload = JSON.stringify(formData);
    try {
      localStorage.setItem("user_profile", payload);
      localStorage.setItem(VISA_USER_DATA_KEY, payload);
    } catch {
      window.alert(t("visa.saveError"));
      return;
    }
    if (token && visaUnlocked) {
      try {
        await api("/visa/profile", {
          method: "POST",
          token,
          body: payload,
        });
      } catch {
        /* نسخة محلية محفوظة */
      }
    }
    window.alert(t("visa.saveSuccess"));
  };

  const requestNotifyPermission = () => {
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission();
  };

  useEffect(() => {
    if (!autoWatch || !token || !visaUnlocked) return;
    const id = window.setInterval(() => {
      void loadStatus({ compareForAlerts: true });
    }, 1000);
    return () => window.clearInterval(id);
  }, [autoWatch, loadStatus, token, visaUnlocked]);

  useEffect(() => {
    return () => {
      stopAlarm();
    };
  }, []);

  const refreshCenter = async (centerId: string) => {
    if (!token || !visaUnlocked) return;
    setBusyId(centerId);
    try {
      const r = await api<{
        changed: boolean;
        status: string;
        center_id: string;
        previous_status: string;
      }>(`/visa/appointment-status/${encodeURIComponent(centerId)}/refresh`, {
        method: "POST",
        token,
      });
      await loadStatus();
      if (r.changed) {
        const label = statusLabelFromCode(t, r.status);
        const entry = VISA_CENTER_ENTRIES.find((e) => e.id === centerId);
        if (entry) {
          pushInAppAlert(`${t("visa.notifyChanged")}: ${t(entry.countryKey)} — ${label}`);
          notifyBrowser(label);
        }
        if (r.status === "open" && r.previous_status !== "open") {
          triggerSlotAlarm();
        }
      }
    } catch {
      pushInAppAlert(t("visa.refresh") + " — error");
    } finally {
      setBusyId(null);
    }
  };

  const waAlertHref = (() => {
    const phone = profile.phone.replace(/\D/g, "") || "212600000000";
    const text = encodeURIComponent(t("visa.waAlertText"));
    return `https://wa.me/${phone}?text=${text}`;
  })();

  const statusLabel = (s: string) => statusLabelFromCode(t, s);

  const formatUpdated = (iso?: string) => {
    if (!iso?.trim()) return t("visa.status.unknown");
    try {
      return formatDateTime(iso);
    } catch {
      return iso;
    }
  };

  const kingdomLine = officialKingdomHeader(appLocale);

  const exportVisaPdf = async () => {
    const rows = VISA_CENTER_ENTRIES.map((e) => {
      const st = statusByCenter[e.id];
      return [t(e.embassyKey), t(e.cityKey), statusLabel(st?.status ?? "soon"), formatUpdated(st?.updated_at)];
    });
    const inner = buildOfficialPdfTableHtml(
      [
        t("visa.col.embassy"),
        t("visa.col.city"),
        t("visa.col.status"),
        t("visa.col.updatedAt"),
      ],
      rows,
      isRtl ? "rtl" : "ltr"
    );
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml: inner,
      sectionTitle: t("visa.title"),
      fileName: `visa-radar-${Date.now()}.pdf`,
      direction: isRtl ? "rtl" : "ltr",
      lang: locale.startsWith("ar") ? "ar" : "en",
      dateLocale: locale,
      documentMode: "official",
      officialKingdomLine: kingdomLine,
    });
  };

  const exportVisaXlsx = async () => {
    const XLSX = await import("xlsx");
    const { downloadXlsxWorkbook } = await import("@/lib/excelDownload");
    const header = [
      t("visa.col.embassy"),
      t("visa.col.city"),
      t("visa.col.status"),
      t("visa.col.updatedAt"),
      t("visa.col.provider"),
    ];
    const aoa: string[][] = [
      [`\ufeff${header[0]}`, ...header.slice(1)],
      ...VISA_CENTER_ENTRIES.map((e) => {
        const st = statusByCenter[e.id];
        return [
          t(e.embassyKey),
          t(e.cityKey),
          statusLabel(st?.status ?? "soon"),
          formatUpdated(st?.updated_at),
          t(e.providerKey),
        ];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VisaCenters");
    downloadXlsxWorkbook(wb, `visa-radar-${Date.now()}.xlsx`);
  };

  const requestPremiumUnlock = async () => {
    if (!token) return;
    setUnlockBusy(true);
    try {
      const r = await api<{ whatsappNotifyUrl?: string }>("/visa/request-unlock", {
        method: "POST",
        token,
      });
      if (r.whatsappNotifyUrl) window.open(r.whatsappNotifyUrl, "_blank", "noopener,noreferrer");
    } catch {
      window.alert(t("pay.errGeneric"));
    } finally {
      setUnlockBusy(false);
    }
  };

  const visaPending = Boolean(user?.visa_unlock_requested_at?.trim());

  return (
    <div className="relative space-y-8 max-w-6xl pb-16 min-h-[50vh]">
      {alarmPlaying && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-red-500/60 bg-red-950/40 px-4 py-3 text-white">
          <span className="flex items-center gap-2 font-black">
            <Volume2 className="size-5 text-red-400 animate-pulse" />
            {t("visa.alarmActive")}
          </span>
          <Button type="button" variant="secondary" className="font-black gap-2 bg-white text-red-900 hover:bg-red-50" onClick={stopSlotAlarm}>
            <VolumeX className="size-4" />
            {t("visa.alarmStop")}
          </Button>
        </div>
      )}

      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 tracking-tight">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-slate-800 border border-slate-600">
              <Plane className="size-5 text-slate-200" strokeWidth={2.5} />
            </span>
            {t("visa.title")}
          </h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base max-w-2xl font-medium">{t("visa.subtitle")}</p>
        </div>
        <div className="inline-flex flex-col items-end gap-1 text-sm font-mono text-slate-300">
          <span className="flex items-center gap-2">
            <Clock className="size-4" />
            {formatDateTime(now)}
          </span>
          <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={() => void exportVisaPdf()}>
            <Download className="size-3.5" />
            PDF
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1 border-slate-600" onClick={() => void exportVisaXlsx()}>
            <FileSpreadsheet className="size-3.5" />
            Excel
          </Button>
          <Button type="button" size="sm" variant="ghost" className="text-slate-400 text-xs" onClick={requestNotifyPermission}>
            {t("visa.enableNotify")}
          </Button>
        </div>
      </header>

      <div className="relative max-w-xl">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("visa.searchPlaceholder")}
          className="ps-10 bg-[#0c1222] border-slate-700 text-white"
        />
        <p className="text-xs text-slate-500 mt-2">{t("visa.officialHint")}</p>
      </div>

      <Tabs defaultValue="radar" className="w-full">
        <TabsList className="flex flex-wrap h-auto bg-[#0a1628] border border-slate-800 p-1 gap-1">
          <TabsTrigger value="radar">{t("visa.tab.radar")}</TabsTrigger>
          <TabsTrigger value="alerts">{t("visa.tab.alerts")}</TabsTrigger>
          <TabsTrigger value="profile">{t("visa.tab.profile")}</TabsTrigger>
          <TabsTrigger value="auto">{t("visa.tab.auto")}</TabsTrigger>
        </TabsList>

        <TabsContent value="radar" className="mt-6 space-y-6">
          <Card className="border-slate-800 bg-[#0a1628]/90 overflow-hidden">
            <CardHeader className="border-b border-slate-800 py-3">
              <p className="font-black text-white text-sm md:text-base">{t("visa.tableTitle")}</p>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50 text-slate-300">
                    <th className="text-start p-3 font-bold">{t("visa.col.embassy")}</th>
                    <th className="text-start p-3 font-bold">{t("visa.col.city")}</th>
                    <th className="text-start p-3 font-bold">{t("visa.col.status")}</th>
                    <th className="text-start p-3 font-bold">{t("visa.col.updatedAt")}</th>
                    <th className="text-start p-2 font-bold">{t("visa.openOfficial")}</th>
                    <th className="text-end p-3 font-bold w-[100px]">{t("visa.refresh")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCenters.map((e) => {
                    const st = statusByCenter[e.id];
                    const s = st?.status ?? "soon";
                    return (
                      <tr key={e.id} className="border-b border-slate-800/80 hover:bg-slate-900/40">
                        <td className="p-3 text-white font-semibold">{t(e.embassyKey)}</td>
                        <td className="p-3 text-slate-300">{t(e.cityKey)}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md border text-xs font-bold ${statusBadgeClass(s)}`}
                          >
                            {statusLabel(s)}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 font-mono text-xs">{formatUpdated(st?.updated_at)}</td>
                        <td className="p-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="font-bold gap-1 border-slate-600 text-xs"
                            onClick={() => {
                              playEmbassyOpenChime();
                              openVisaCenterExternal(e.centerUrl);
                            }}
                          >
                            <ExternalLink className="size-3.5" />
                            {t("visa.openOfficial")}
                          </Button>
                        </td>
                        <td className="p-3 text-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={!token || busyId === e.id}
                            className="font-bold gap-1"
                            onClick={() => void refreshCenter(e.id)}
                          >
                            <RefreshCw className={`size-3.5 ${busyId === e.id ? "animate-spin" : ""}`} />
                            {busyId === e.id ? t("visa.refreshing") : t("visa.refresh")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCenters.map((e, i) => (
              <VisaCard
                key={e.id}
                entry={e}
                index={i}
                pulse={pulse[e.id]}
                status={statusByCenter[e.id]?.status ?? "soon"}
                onPulse={() => setPulse((p) => ({ ...p, [e.id]: true }))}
                onLeave={() => setPulse((p) => ({ ...p, [e.id]: false }))}
                onRefresh={() => void refreshCenter(e.id)}
                centerUrl={e.centerUrl}
                busy={busyId === e.id}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="mt-6 space-y-4">
          <Card className="border-slate-800 bg-[#0a1628]/80">
            <CardHeader className="flex flex-row items-center gap-2 border-b border-slate-800">
              <Bell className="size-5 text-slate-300" />
              <span className="font-black text-white">{t("visa.inAppAlerts")}</span>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {alerts.length === 0 ? (
                <p className="text-slate-500 text-sm">{t("visa.noAlerts")}</p>
              ) : (
                alerts.map((a) => (
                  <div key={a.id} className="text-sm border border-slate-700 rounded-lg px-3 py-2 text-slate-300">
                    <span className="text-xs text-slate-500">{a.at}</span>
                    <p className="font-medium">{a.msg}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Button
            type="button"
            variant="secondary"
            className="gap-2 bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40"
            asChild
          >
            <a href={waAlertHref} target="_blank" rel="noopener noreferrer">
              <Smartphone className="size-4" />
              {t("visa.openWhatsApp")}
            </a>
          </Button>
        </TabsContent>

        <TabsContent value="profile" className="mt-6 max-w-lg space-y-4">
          <p className="text-sm text-slate-400">{t("visa.profileHint")}</p>
          <p className="text-xs text-slate-500">{t("visa.localSaved")}</p>
          <div className="space-y-2">
            <Label className="text-slate-300">{t("visa.field.fullName")}</Label>
            <Input
              className="bg-[#0c1222] border-slate-700"
              value={profile.full_name}
              onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">{t("visa.field.passport")}</Label>
            <Input
              className="bg-[#0c1222] border-slate-700"
              value={profile.passport_no}
              onChange={(e) => setProfile((p) => ({ ...p, passport_no: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">{t("visa.field.phone")}</Label>
            <Input
              className="bg-[#0c1222] border-slate-700"
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">{t("visa.field.email")}</Label>
            <Input
              className="bg-[#0c1222] border-slate-700"
              value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <Button type="button" className="bg-[#0052CC]" onClick={() => void handleSave()}>
            {t("common.save")}
          </Button>
        </TabsContent>

        <TabsContent value="auto" className="mt-6 max-w-xl space-y-4">
          <Card className="border-slate-800 bg-[#0a1628]/80">
            <CardHeader className="flex flex-row items-center gap-2">
              <Bot className="size-6 text-slate-300" />
              <span className="font-black text-white">{t("visa.autoTitle")}</span>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-400">
              <p>{t("visa.autoDesc")}</p>
              <label className="flex items-center gap-2 cursor-pointer text-white font-bold">
                <input
                  type="checkbox"
                  checked={autoWatch}
                  onChange={(e) => {
                    setAutoWatch(e.target.checked);
                    if (e.target.checked) void requestNotifyPermission();
                  }}
                  className="rounded border-slate-600"
                />
                {t("visa.autoSimulate")}
              </label>
              <p className="text-xs text-slate-500">{t("visa.autoLegal")}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {!visaUnlocked && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-b from-slate-950/92 via-indigo-950/90 to-slate-950/95 backdrop-blur-md border-2 border-amber-400/50 p-6 text-center shadow-2xl shadow-amber-500/20">
          <LockIcon className="size-14 text-amber-400 drop-shadow-lg" />
          <h2 className="text-xl md:text-2xl font-black text-white max-w-md">{t("visa.lockedOverlayTitle")}</h2>
          <p className="text-sm text-slate-300 max-w-lg leading-relaxed">{t("visa.lockedOverlayDesc")}</p>
          <p className="text-xs font-bold text-fuchsia-300">
            +{VISA_PREMIUM_ADDON_DH} DH — {t("section.visa.short")}
          </p>
          {visaPending && (
            <p className="text-sm font-semibold text-emerald-400">{t("visa.pendingRequest")}</p>
          )}
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              type="button"
              className="font-black gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 hover:opacity-95"
              disabled={unlockBusy || visaPending}
              onClick={() => void requestPremiumUnlock()}
            >
              {t("visa.requestPremiumCta")}
            </Button>
            <Button type="button" variant="secondary" asChild>
              <Link to="/app/pay">{t("dashboard.subscribePay")}</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function VisaCard({
  entry,
  index,
  pulse,
  status,
  onPulse,
  onLeave,
  onRefresh,
  centerUrl,
  busy,
}: {
  entry: VisaCenterEntry;
  index: number;
  pulse: boolean;
  status: string;
  onPulse: () => void;
  onLeave: () => void;
  onRefresh: () => void;
  centerUrl: string;
  busy: boolean;
}) {
  const { t } = useI18n();

  const stClass = statusBadgeClass(status);

  return (
    <Card
      className="border-slate-800/80 bg-[#0a1628]/80 overflow-hidden hover:border-slate-600 transition-all duration-300 idara-animate-in group"
      style={{ animationDelay: `${index * 40}ms` }}
      onMouseEnter={onPulse}
      onMouseLeave={onLeave}
    >
      <CardHeader className="pb-2 border-b border-slate-800/60">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-4xl leading-none" aria-hidden>
            {entry.flag}
          </span>
          <Badge
            variant="outline"
            className={`border-2 font-black text-[11px] uppercase tracking-wide ${stClass} ${pulse ? "scale-105" : ""}`}
          >
            {statusLabelFromCode(t, status)}
          </Badge>
        </div>
        <h2 className="text-lg font-black text-white mt-3">{t(entry.countryKey)}</h2>
        <p className="text-sm text-slate-400 font-medium">{t(entry.embassyKey)}</p>
        <p className="text-sm text-slate-500 font-bold">{t(entry.providerKey)}</p>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-slate-400 text-sm leading-relaxed font-medium">{t("visa.cardHint")}</p>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Globe2 className="size-3.5 text-slate-400" />
          {t("visa.liveIndicator")}
        </div>
        <Button
          type="button"
          variant="default"
          className="w-full font-black gap-2 bg-slate-700 hover:bg-slate-600"
          onClick={() => {
            playEmbassyOpenChime();
            openVisaCenterExternal(centerUrl);
          }}
        >
          <ExternalLink className="size-4" />
          {t("visa.openOfficial")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full font-bold gap-2"
          disabled={busy}
          onClick={onRefresh}
        >
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? t("visa.refreshing") : t("visa.refresh")}
        </Button>
      </CardContent>
    </Card>
  );
}
