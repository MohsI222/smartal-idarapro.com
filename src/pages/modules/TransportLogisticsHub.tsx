import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import { getPublicOrigin } from "@/lib/publicOrigin";
import { TL_DEPT_SLUGS, type TlDeptSlug } from "@/lib/tlApi";
import { fetchLogisticsQueue, assignLogisticsItem } from "@/lib/supabaseClient";

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
  const [logisticsQueue, setLogisticsQueue] = useState<any[]>([]);
  const [logisticsBusy, setLogisticsBusy] = useState(false);

  /** نفس منشأ الصفحة إن وُجد (يتفادى اختلاف www/apex عن VITE_PUBLIC_APP_URL عند نسخ الرابط أو فتح الـ manifest). */
  const shareOrigin = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.location.origin.replace(/\/$/, "");
    }
    return getPublicOrigin().replace(/\/$/, "");
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const queue = await fetchLogisticsQueue();
        if (active) setLogisticsQueue(Array.isArray(queue) ? queue : []);
      } catch (error) {
        console.error("[tl hub] fetchLogisticsQueue failed", error);
        if (active) setLogisticsQueue([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const assignAutoDispatch = async (id: string) => {
    setLogisticsBusy(true);
    try {
      await assignLogisticsItem(id, "auto-dispatch");
      const queue = await fetchLogisticsQueue();
      setLogisticsQueue(Array.isArray(queue) ? queue : []);
    } catch (error) {
      console.error("[tl hub] assignAutoDispatch failed", error);
    } finally {
      setLogisticsBusy(false);
    }
  };

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
          const pwaQs = "?pwa=1";
          const pwaUrl = `${shareOrigin}/dept/${slug}${pwaQs}`;
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
                      <Link to={`/dept/${slug}${pwaQs}`}>{t("tl.openStandalone")}</Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full border-white/15 text-xs gap-1"
                    >
                      <a
                        href={`${shareOrigin}/manifest-tl-${slug}.webmanifest`}
                        target="_blank"
                        rel="noreferrer"
                      >
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

      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader className="border-b border-slate-800">
          <p className="font-black text-white">Logistics Queue</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {logisticsQueue.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#020715]/80">
              <table className="w-full text-sm text-slate-200">
                <thead>
                  <tr className="text-left border-b border-slate-700 text-slate-400">
                    <th className="py-2 pe-4">Item</th>
                    <th className="py-2 pe-4">Status</th>
                    <th className="py-2">Assign</th>
                  </tr>
                </thead>
                <tbody>
                  {logisticsQueue.map((item) => (
                    <tr key={item.id} className="border-t border-slate-800">
                      <td className="py-2">{item.title ?? item.id}</td>
                      <td className="py-2 text-slate-300">{item.status ?? "pending"}</td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={logisticsBusy}
                          onClick={() => void assignAutoDispatch(item.id)}
                        >
                          Assign
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400">No logistics queue items available.</p>
          )}
        </CardContent>
      </Card>

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
