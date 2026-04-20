import type { PlanOption } from "./plans";

/** Per-plan glass + gradient border + glow for premium pricing UI */
export type PlanVisualTheme = {
  /** Tailwind classes for the 1px gradient ring wrapper */
  borderGradient: string;
  /** Extra shadow / glow (best-value plan gets strongest glow) */
  glowShadow: string;
  /** Inner panel gradient (glass) */
  innerGradient: string;
  /** Price text gradient */
  priceGradient: string;
  /** Module list icon tint */
  featureIconClass: string;
  /** Small ribbon / accent line */
  accentLine: string;
};

const DEFAULT_THEME: PlanVisualTheme = {
  borderGradient: "from-slate-500/80 via-slate-400/50 to-slate-600/80",
  glowShadow: "shadow-xl shadow-slate-900/50",
  innerGradient: "from-slate-950/85 via-slate-900/75 to-slate-950/90",
  priceGradient: "from-white via-slate-100 to-slate-300",
  featureIconClass: "text-slate-300",
  accentLine: "from-slate-500 to-slate-600",
};

/** Gold / diamond — enterprises & schools */
const GOLD: PlanVisualTheme = {
  borderGradient: "from-amber-200 via-yellow-300 to-amber-500",
  glowShadow:
    "shadow-[0_0_0_1px_rgba(251,191,36,0.2),0_25px_60px_-12px_rgba(251,191,36,0.45),0_0_80px_-10px_rgba(234,179,8,0.35)]",
  innerGradient: "from-amber-950/50 via-slate-950/88 to-slate-950/95",
  priceGradient: "from-amber-100 via-yellow-50 to-amber-200",
  featureIconClass: "text-amber-200/95",
  accentLine: "from-amber-400 via-yellow-300 to-orange-400",
};

/** Deep blue — lawyers */
const LAW_BLUE: PlanVisualTheme = {
  borderGradient: "from-blue-400 via-indigo-500 to-slate-900",
  glowShadow: "shadow-[0_20px_50px_-12px_rgba(59,130,246,0.4)]",
  innerGradient: "from-blue-950/55 via-slate-950/90 to-slate-950/95",
  priceGradient: "from-sky-200 via-blue-100 to-indigo-200",
  featureIconClass: "text-sky-300/95",
  accentLine: "from-blue-500 to-indigo-600",
};

const CYAN_LIB: PlanVisualTheme = {
  borderGradient: "from-cyan-400 via-teal-500 to-slate-800",
  glowShadow: "shadow-[0_18px_45px_-14px_rgba(34,211,238,0.35)]",
  innerGradient: "from-cyan-950/40 via-slate-950/88 to-slate-950/95",
  priceGradient: "from-cyan-100 via-teal-50 to-cyan-200",
  featureIconClass: "text-cyan-200/95",
  accentLine: "from-cyan-500 to-teal-500",
};

const FUCHSIA_LIB: PlanVisualTheme = {
  borderGradient: "from-fuchsia-500 via-purple-600 to-indigo-900",
  glowShadow: "shadow-[0_18px_45px_-14px_rgba(192,38,211,0.38)]",
  innerGradient: "from-fuchsia-950/45 via-slate-950/90 to-slate-950/95",
  priceGradient: "from-fuchsia-100 via-violet-100 to-fuchsia-200",
  featureIconClass: "text-fuchsia-200/95",
  accentLine: "from-fuchsia-500 to-purple-600",
};

/** Emerald — retail / shops */
const EMERALD: PlanVisualTheme = {
  borderGradient: "from-emerald-400 via-green-500 to-teal-900",
  glowShadow: "shadow-[0_20px_48px_-14px_rgba(16,185,129,0.42)]",
  innerGradient: "from-emerald-950/45 via-slate-950/88 to-slate-950/95",
  priceGradient: "from-emerald-100 via-green-50 to-emerald-200",
  featureIconClass: "text-emerald-200/95",
  accentLine: "from-emerald-400 to-teal-500",
};

const VIOLET_INST: PlanVisualTheme = {
  borderGradient: "from-violet-400 via-purple-600 to-slate-900",
  glowShadow: "shadow-[0_18px_45px_-14px_rgba(139,92,246,0.38)]",
  innerGradient: "from-violet-950/45 via-slate-950/90 to-slate-950/95",
  priceGradient: "from-violet-100 via-purple-50 to-violet-200",
  featureIconClass: "text-violet-200/95",
  accentLine: "from-violet-500 to-purple-600",
};

const SKY_ACC: PlanVisualTheme = {
  borderGradient: "from-sky-400 via-blue-500 to-slate-900",
  glowShadow: "shadow-[0_18px_45px_-14px_rgba(56,189,248,0.35)]",
  innerGradient: "from-sky-950/45 via-slate-950/90 to-slate-950/95",
  priceGradient: "from-sky-100 via-blue-50 to-sky-200",
  featureIconClass: "text-sky-200/95",
  accentLine: "from-sky-500 to-blue-600",
};

export function getPlanVisual(planId: PlanOption["id"]): PlanVisualTheme {
  switch (planId) {
    case "enterprises_schools":
      return GOLD;
    case "lawyers":
      return LAW_BLUE;
    case "libraries_base":
      return CYAN_LIB;
    case "libraries_plus":
      return FUCHSIA_LIB;
    case "retail":
      return EMERALD;
    case "institutes":
      return VIOLET_INST;
    case "accountants":
      return SKY_ACC;
    default:
      return DEFAULT_THEME;
  }
}
