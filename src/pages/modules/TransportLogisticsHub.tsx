import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bus,
  Factory,
  Gauge,
  Link2,
  Settings,
  Shield,
  Train,
  Truck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { getPublicOrigin } from "@/lib/publicOrigin";
import { TL_DEPT_SLUGS, type TlDeptSlug } from "@/lib/tlApi";

const DEPT_ICONS: Record<TlDeptSlug, ReactNode> = {
  transport: <Train className="size-8 text-sky-400" />,
  logistics: <Truck className="size-8 text-emerald-400" />,
  production: <Factory className="size-8 text-amber-400" />,
  quality: <Gauge className="size-8 text-violet-400" />,
  maintenance: <Wrench className="size-8 text-orange-400" />,
  utilities: <Bus className="size-8 text-cyan-400" />,
};

export function TransportLogisticsHub() {
  const { t } = useI18n();
  const origin = getPublicOrigin();

  return (
    <div className="space-y-8 max-w-5xl pb-16">
      <header className="space-y-2 rounded-2xl border border-[#0052CC]/30 bg-gradient-to-br from-[#0a1628] to-[#050a12] p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[#FF8C00]">
          Smart Transport & Logistics Pro
        </p>
        <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-l from-[#FF8C00] to-[#0052CC] bg-clip-text text-transparent">
          {t("tl.hubTitle")}
        </h1>
        <p className="text-slate-400 text-sm max-w-2xl">{t("tl.hubSubtitle")}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild variant="secondary" className="gap-2 border border-white/15">
            <Link to="/app/tl/admin">
              <Settings className="size-4" />
              {t("tl.openAdmin")}
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TL_DEPT_SLUGS.map((slug) => {
          const pwaUrl = `${origin}/dept/${slug}`;
          return (
            <div
              key={slug}
              className="group rounded-2xl border border-white/10 bg-[#050a12]/80 p-5 shadow-lg shadow-black/20 hover:border-[#0052CC]/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white/5 p-3 border border-white/10">{DEPT_ICONS[slug]}</div>
                <div className="flex-1 min-w-0 space-y-2">
                  <h2 className="font-bold text-white text-lg">{t(`tl.dept.${slug}`)}</h2>
                  <p className="text-xs text-slate-500 line-clamp-2">{t("tl.standaloneHint")}</p>
                  <div className="flex flex-col gap-2 pt-1">
                    <Button asChild size="sm" className="w-full bg-[#0052CC] hover:bg-[#004099]">
                      <Link to={`/dept/${slug}`}>{t("tl.openStandalone")}</Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full border-white/15 text-xs gap-1"
                    >
                      <a href={`/manifest-tl-${slug}.webmanifest`} target="_blank" rel="noreferrer">
                        <Link2 className="size-3" />
                        PWA manifest
                      </a>
                    </Button>
                    <p className="text-[10px] text-slate-600 break-all font-mono">{pwaUrl}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-sm text-cyan-100/90">
        <p className="flex items-center gap-2 font-semibold text-cyan-300">
          <Shield className="size-4" />
          {t("tl.pwaNoteTitle")}
        </p>
        <p className="mt-2 text-slate-400 text-xs leading-relaxed">{t("tl.pwaNoteBody")}</p>
      </div>
    </div>
  );
}
