import { useEffect, useMemo, useState } from "react";
import {
  BatteryCharging,
  Copy,
  Landmark,
  MessageCircle,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { PremiumPlanCard } from "@/components/pricing/PremiumPlanCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { OFFICIAL_WHATSAPP_DIGITS } from "@/constants/contact";
import {
  PLAN_OPTIONS,
  type BillingPeriod,
  planPriceDh,
  yearlySavingsDh,
  yearlySavingsPercent,
} from "@/constants/plans";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { id: "bank_transfer", labelKey: "pay.method.bank", icon: Landmark },
  { id: "wafacash", labelKey: "pay.method.wafacash", icon: Smartphone },
  { id: "cashplus", labelKey: "pay.method.cashplus", icon: Wallet },
  { id: "recharge", labelKey: "pay.method.recharge", icon: BatteryCharging },
] as const;

export function Pay() {
  const { token, refresh } = useAuth();
  const { t, isRtl, formatNumber } = useI18n();
  const [searchParams] = useSearchParams();
  const planFromUrl = searchParams.get("plan");
  const initialPlan = useMemo(() => {
    const id = planFromUrl?.trim();
    if (id && PLAN_OPTIONS.some((p) => p.id === id)) return id;
    return PLAN_OPTIONS[0].id;
  }, [planFromUrl]);
  const [planId, setPlanId] = useState(initialPlan);
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]["id"]>("bank_transfer");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [pubSettings, setPubSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    setPlanId(initialPlan);
  }, [initialPlan]);

  useEffect(() => {
    void fetch("/api/settings/public")
      .then((r) => r.json() as Promise<{ settings?: Record<string, string> }>)
      .then((j) => setPubSettings(j.settings ?? {}))
      .catch(() => undefined);
  }, []);

  const copyField = (v: string) => {
    void navigator.clipboard.writeText(v);
  };

  const selected = PLAN_OPTIONS.find((p) => p.id === planId)!;
  const priceNow = planPriceDh(selected, billing);
  const savePct = yearlySavingsPercent(selected);

  const whatsappHref = useMemo(() => {
    const text = encodeURIComponent(
      `Smart Al-Idara Pro — ${t(selected.labelKey)} — ${formatNumber(priceNow, { maximumFractionDigits: 0 })} DH (${billing}) — ${method}`
    );
    return `https://wa.me/${OFFICIAL_WHATSAPP_DIGITS}?text=${text}`;
  }, [selected, method, t, priceNow, billing, formatNumber]);

  const submit = async () => {
    if (!token) {
      setMsg(t("pay.loginFirst"));
      return;
    }
    setStatus("loading");
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("plan_id", planId);
      fd.append("payment_method", method);
      fd.append("modules", JSON.stringify(selected.modules));
      fd.append("billing_period", billing);
      if (file) fd.append("receipt", file);

      const res = await fetch("/api/subscription/request", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        whatsappNotifyUrl?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("pay.errGeneric"));
      if (data.whatsappNotifyUrl && typeof window !== "undefined") {
        window.open(data.whatsappNotifyUrl, "_blank", "noopener,noreferrer");
      }
      setStatus("done");
      setMsg(t("pay.success"));
      await refresh();
    } catch (e) {
      setStatus("err");
      setMsg(e instanceof Error ? e.message : t("pay.errGeneric"));
    }
  };

  return (
    <div
      className="relative pb-28"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -end-40 -top-32 h-[22rem] w-[22rem] rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="absolute -start-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 start-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl space-y-10 px-3 sm:px-4">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-bold text-fuchsia-100 shadow-lg shadow-fuchsia-500/10 backdrop-blur-md">
            <Sparkles className="size-4 text-amber-300" />
            {t("pay.title")}
          </div>
          <p className="text-sm text-slate-400">{t("pay.subtitle")}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 shadow-inner shadow-black/20 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={cn(
              "rounded-xl px-6 py-2.5 text-sm font-black transition-all",
              billing === "monthly"
                ? "bg-white text-slate-900 shadow-lg"
                : "text-slate-300 hover:text-white"
            )}
          >
            {t("pay.billingMonthly")}
          </button>
          <button
            type="button"
            onClick={() => setBilling("yearly")}
            className={cn(
              "rounded-xl px-6 py-2.5 text-sm font-black transition-all",
              billing === "yearly"
                ? "bg-gradient-to-r from-orange-400 to-rose-500 text-white shadow-lg shadow-orange-500/30"
                : "text-slate-300 hover:text-white"
            )}
          >
            {t("pay.billingYearly")}
          </button>
        </div>

        <p className="text-center text-xs font-semibold text-emerald-400/90">
          {t("pay.yearlySavingsHint").replace(
            "{pct}",
            formatNumber(savePct, { maximumFractionDigits: 0 })
          )}
        </p>
        {billing === "yearly" && (
          <p className="text-center text-[11px] text-slate-500">
            {t("pay.savingsDhYearly").replace(
              "{dh}",
              formatNumber(yearlySavingsDh(selected), { maximumFractionDigits: 0 })
            )}
          </p>
        )}

        <div className="space-y-4">
          <Label className="text-base font-bold text-white">{t("pay.planLabel")}</Label>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {PLAN_OPTIONS.map((p) => (
              <PremiumPlanCard
                key={p.id}
                mode="pay"
                plan={p}
                billing={billing}
                selected={planId === p.id}
                onSelect={() => setPlanId(p.id)}
              />
            ))}
          </div>
        </div>

        <Card className="border-white/10 bg-white/5 shadow-xl backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("pay.methodTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENT_METHODS.map((m) => (
              <Button
                key={m.id}
                type="button"
                variant={method === m.id ? "default" : "outline"}
                className="h-auto justify-start border-cyan-500/30 py-3"
                onClick={() => setMethod(m.id)}
              >
                <m.icon className="size-5" />
                {t(m.labelKey)}
              </Button>
            ))}
          </CardContent>
        </Card>

        {method === "bank_transfer" && (
          <Card className="border-emerald-500/20 bg-emerald-950/20 shadow-lg backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Landmark className="size-5 text-emerald-400" />
                {t("pay.bankDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">
                  <span className="text-slate-500">{t("pay.bankNameLabel")}</span>
                  <span className="font-mono text-slate-200">{pubSettings.bank_name ?? "—"}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">
                  <span className="text-slate-500">{t("pay.bankHolderLabel")}</span>
                  <span className="font-mono text-slate-200">{pubSettings.bank_holder ?? "—"}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">
                  <span className="text-slate-500">{t("pay.ribLabel")}</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-emerald-300">{pubSettings.bank_rib ?? "—"}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={() => copyField(pubSettings.bank_rib ?? "")}
                    >
                      <Copy className="size-3.5" />
                      {t("pay.copyField")}
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">
                  <span className="text-slate-500">{t("pay.ibanLabel")}</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-xs text-slate-200">{pubSettings.bank_iban ?? "—"}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={() => copyField(pubSettings.bank_iban ?? "")}
                    >
                      <Copy className="size-3.5" />
                      {t("pay.copyField")}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-[#25D366]/30 bg-gradient-to-br from-emerald-950/40 to-slate-950/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="size-5 text-[#25D366]" />
              {t("pay.whatsappHint")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className={cn(
                "w-full gap-2 border-0 py-6 text-base font-black shadow-lg sm:w-auto",
                "bg-gradient-to-r from-[#128C7E] to-[#25D366] text-white",
                "shadow-[#25D366]/35 hover:opacity-95 hover:shadow-xl hover:shadow-[#25D366]/40",
                "animate-[pulse_2.8s_ease-in-out_infinite] motion-reduce:animate-none"
              )}
              asChild
            >
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-5" strokeWidth={2.25} />
                {t("pay.whatsappOpen")}
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base">{t("pay.receiptTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="text-sm text-slate-400"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-2 text-xs text-slate-500">{t("pay.receiptHint")}</p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button size="lg" disabled={status === "loading"} onClick={() => void submit()}>
            {status === "loading" ? t("pay.submitting") : t("pay.submit")}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app">{t("pay.back")}</Link>
          </Button>
        </div>

        {msg && (
          <p className={`text-sm ${status === "err" ? "text-red-400" : "text-emerald-400"}`}>{msg}</p>
        )}
      </div>

      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "fixed bottom-6 z-50 flex h-16 w-16 items-center justify-center rounded-full sm:h-[4.25rem] sm:w-[4.25rem]",
          "bg-[#25D366] text-white shadow-[0_12px_40px_rgba(37,211,102,0.45)]",
          "ring-4 ring-[#25D366]/35 transition-transform duration-300 hover:scale-105 hover:shadow-[0_16px_48px_rgba(37,211,102,0.55)]",
          "animate-[pulse_2.4s_ease-in-out_infinite]",
          isRtl ? "start-6" : "end-6"
        )}
        title={t("pay.whatsappOpen")}
        aria-label={t("sub.dashboardWhatsapp")}
      >
        <MessageCircle className="size-8 sm:size-9" strokeWidth={2.25} />
      </a>
    </div>
  );
}
