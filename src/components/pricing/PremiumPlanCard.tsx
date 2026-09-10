import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Check, Crown, Gavel, GraduationCap, Package, Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingPeriod, PlanOption } from "@/constants/plans";
import { planPriceDh, yearlySavingsDh, yearlySavingsPercent } from "@/constants/plans";
import { getPlanVisual } from "@/constants/planVisuals";
import { SECTIONS, type SectionId } from "@/constants/sections";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/** Semantic Lucide icons for quick scanning (education, law, stock, …) */
const ICON_OVERRIDES: Partial<Record<SectionId, LucideIcon>> = {
  edu: GraduationCap,
  law: Scale,
  lawyer: Gavel,
  inventory: Package,
};

function moduleIcon(id: SectionId) {
  const def = SECTIONS.find((s) => s.id === id);
  return ICON_OVERRIDES[id] ?? def?.icon ?? SECTIONS[0]!.icon;
}

type Props =
  | {
      plan: PlanOption;
      billing: BillingPeriod;
      mode: "pay";
      selected: boolean;
      onSelect: () => void;
    }
  | {
      plan: PlanOption;
      mode: "landing";
      registerHref: string;
      ctaLabel: string;
    };

export function PremiumPlanCard(props: Props) {
  const { t, isRtl, formatNumber } = useI18n();
  const { plan } = props;
  const visual = getPlanVisual(plan.id);
  const savePct = yearlySavingsPercent(plan);
  const saveDh = yearlySavingsDh(plan);

  const priceMain =
    props.mode === "pay" ? planPriceDh(plan, props.billing) : plan.priceMonthlyDh;

  const inner = (
    <div
      className={cn(
        "relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-[22px]",
        "border border-white/15 ring-1 ring-inset ring-white/10",
        "bg-gradient-to-br backdrop-blur-2xl backdrop-saturate-150",
        visual.innerGradient
      )}
    >
      {plan.spotlight && (
        <div
          className={cn(
            "absolute start-0 top-0 z-10 flex items-center gap-1.5 rounded-br-2xl border-b border-e border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-950",
            "bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 shadow-lg shadow-amber-500/20"
          )}
        >
          <Crown className="size-3.5 shrink-0" aria-hidden />
          {t("pay.bestValueBadge")}
        </div>
      )}

      <div className={cn("flex flex-1 flex-col p-5 pt-8", plan.spotlight && "pt-10")}>
        <div className={cn("mb-3 h-1 w-14 rounded-full bg-gradient-to-r opacity-90", visual.accentLine)} />

        <div className="space-y-1.5 text-start">
          <h3 className="text-lg font-black leading-snug text-white md:text-xl">{t(plan.labelKey)}</h3>
          <p className="text-xs font-medium leading-relaxed text-slate-400 md:text-sm">{t(plan.blurbKey)}</p>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/5 pb-4">
          <div className="min-w-0 flex-1 text-start">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {props.mode === "pay"
                ? props.billing === "yearly"
                  ? t("pay.billingYearly")
                  : t("pay.billingMonthly")
                : t("pay.billingMonthly")}
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <span
                dir="ltr"
                className={cn(
                  "bg-gradient-to-l bg-clip-text font-black tabular-nums font-digits-latin tracking-tight text-transparent",
                  "text-4xl md:text-5xl lg:text-[3.25rem]",
                  visual.priceGradient
                )}
              >
                {formatNumber(priceMain, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-base font-bold tracking-wide text-slate-400 md:text-lg">DH</span>
            </div>

            {props.mode === "landing" && (
              <p className="mt-2 text-sm text-slate-500">
                <span dir="ltr" className="font-semibold text-slate-300 font-digits-latin">
                  {formatNumber(plan.priceYearlyDh, { maximumFractionDigits: 0 })} DH
                </span>{" "}
                / {t("pay.billingYearly").split(" / ")[0] ?? t("pay.billingYearly")}
              </p>
            )}

            {props.mode === "pay" && props.billing === "yearly" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  dir="ltr"
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black tabular-nums font-digits-latin",
                    "bg-gradient-to-r from-orange-500 via-rose-500 to-orange-600 text-white shadow-md shadow-orange-500/30"
                  )}
                >
                  −{formatNumber(savePct, { maximumFractionDigits: 0 })}%
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  {t("pay.savingsDhYearly").replace("{dh}", formatNumber(saveDh, { maximumFractionDigits: 0 }))}
                </span>
              </div>
            )}

            {props.mode === "landing" && (
              <p className="mt-2 text-[11px] font-semibold text-emerald-400/95">
                {t("pay.yearlySavingsHint").replace(
                  "{pct}",
                  formatNumber(savePct, { maximumFractionDigits: 0 })
                )}
              </p>
            )}
          </div>

          {props.mode === "pay" && (
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                props.selected
                  ? "border-transparent bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/35"
                  : "border-white/15 bg-white/5 opacity-70 group-hover:opacity-100"
              )}
              aria-hidden
            >
              <Check
                className={cn(
                  "size-5 text-white drop-shadow-sm",
                  props.selected ? "animate-plan-check-pop opacity-100" : "scale-75 opacity-0"
                )}
              />
            </div>
          )}
        </div>

        <div className="mt-3 min-h-0 flex-1">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {t("pay.modulesLabel")}
          </p>
          <ul className="max-h-44 space-y-2 overflow-y-auto pe-1 text-start [scrollbar-width:thin] md:max-h-52">
            {plan.modules.map((mid) => {
              const Icon = moduleIcon(mid);
              const def = SECTIONS.find((s) => s.id === mid);
              return (
                <li key={mid} className="flex items-start gap-2.5 text-sm text-slate-200/95">
                  <Icon className={cn("mt-0.5 size-[1.05rem] shrink-0 opacity-95", visual.featureIconClass)} aria-hidden />
                  <span className="leading-snug">{def ? t(def.shortTitleKey) : mid}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {props.mode === "landing" ? (
          <Button
            className={cn(
              "mt-5 w-full border-0 py-6 text-base font-black shadow-lg transition-all",
              "bg-gradient-to-r from-orange-500 via-rose-500 to-fuchsia-600 hover:opacity-95",
              "shadow-orange-500/25 hover:shadow-xl hover:shadow-fuchsia-500/20"
            )}
            asChild
          >
            <Link to={props.registerHref}>{props.ctaLabel}</Link>
          </Button>
        ) : (
          <div
            className={cn(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black transition-all",
              props.selected ? "bg-white/10 text-white" : "bg-white/5 text-slate-300"
            )}
          >
            <Sparkles className="size-4 opacity-80" aria-hidden />
            {props.selected ? t("pay.planSelected") : t("pay.selectPlan")}
          </div>
        )}
      </div>
    </div>
  );

  const shell = (
    <div
      className={cn(
        "group relative rounded-3xl p-[1px] transition-all duration-300 ease-out will-change-transform",
        "bg-gradient-to-br",
        visual.borderGradient,
        visual.glowShadow,
        plan.spotlight && "md:ring-1 md:ring-amber-400/40",
        plan.spotlight &&
          "hover:shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_28px_70px_-14px_rgba(251,191,36,0.5),0_0_100px_-12px_rgba(234,179,8,0.4)]",
        "hover:scale-[1.02] hover:-translate-y-1 hover:shadow-2xl",
        props.mode === "pay" && props.selected && "scale-[1.01] ring-2 ring-white/25 ring-offset-2 ring-offset-[#050a12] md:scale-[1.02]"
      )}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {inner}
    </div>
  );

  if (props.mode === "pay") {
    return (
      <button
        type="button"
        onClick={props.onSelect}
        aria-pressed={props.selected}
        className="w-full cursor-pointer text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a12]"
      >
        {shell}
      </button>
    );
  }

  return <div>{shell}</div>;
}
