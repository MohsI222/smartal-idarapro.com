import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bus,
  Factory,
  Gauge,
  Link2,
  MapPin,
  Settings,
  Shield,
  Train,
  Trash2,
  Truck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { useServerEvents } from "@/hooks/useServerEvents";
import { GpsDashboard } from "@/components/GpsDashboard";
import { getPublicOrigin } from "@/lib/publicOrigin";
import { TL_DEPT_SLUGS, tlWorkers, type TlDeptSlug, type TlWorker } from "@/lib/tlApi";
import { api } from "@/lib/api";
import type { LogisticsQueueItem } from "@/lib/types";

const DEPT_ICONS: Record<TlDeptSlug, ReactNode> = {
  transport: <Train className="size-8 text-sky-400" />,
  logistics: <Truck className="size-8 text-emerald-400" />,
  production: <Factory className="size-8 text-amber-400" />,
  quality: <Gauge className="size-8 text-violet-400" />,
  maintenance: <Wrench className="size-8 text-orange-400" />,
  utilities: <Bus className="size-8 text-cyan-400" />,
};

export function TransportLogisticsHub() {
  const { t, token } = useI18n();
  const { user } = useAuth();
  const [logisticsQueue, setLogisticsQueue] = useState<any[]>([]);
  const [logisticsBusy, setLogisticsBusy] = useState(false);
  const [selectedLogisticsItems, setSelectedLogisticsItems] = useState<Set<string>>(new Set());
  const [workers, setWorkers] = useState<TlWorker[]>([]);
  const [selectedWorkerForGps, setSelectedWorkerForGps] = useState<TlWorker | null>(null);
  const [gpsDialogOpen, setGpsDialogOpen] = useState(false);

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
        const res = await api<{ items: LogisticsQueueItem[] }>("/inventory/logistics-queue");
        const queue = res.items || [];
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
      await api(`/inventory/logistics-queue/${id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ status: "auto-dispatch" }),
      });
      const res = await api<{ items: LogisticsQueueItem[] }>("/inventory/logistics-queue");
      const queue = res.items || [];
      setLogisticsQueue(Array.isArray(queue) ? queue : []);
    } catch (error) {
      console.error("[tl hub] assignAutoDispatch failed", error);
    } finally {
      setLogisticsBusy(false);
    }
  };

  // Delete functionality temporarily disabled - needs backend implementation
  const deleteLogisticsItemHandler = async (id: string) => {
    console.warn("[tl hub] deleteLogisticsItem not implemented");
  };

  // Load workers for GPS tracking
  useEffect(() => {
    if (!token) return;
    let active = true;
    void (async () => {
      try {
        const data = await tlWorkers(token);
        if (active) setWorkers(data);
      } catch (error) {
        console.error("[tl hub] Failed to load workers:", error);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  // Realtime sync for TL workers using SSE (magic link hub)
  useServerEvents({
    table: 'tl_workers',
    enabled: !!token,
    onUpdate: (payload) => {
      console.log('[SSE] TL worker updated in hub, refreshing...');
      setWorkers(prev => prev.map(w => w.id === payload.row?.id ? { ...w, ...payload.row } : w));
    },
    onInsert: (payload) => {
      console.log('[SSE] TL worker inserted in hub, adding...');
      if (payload.row) setWorkers(prev => [...prev, payload.row]);
    },
    onDelete: (payload) => {
      console.log('[SSE] TL worker deleted in hub, removing...');
      setWorkers(prev => prev.filter(w => w.id !== payload.id));
    }
  });

  const deleteSelectedLogisticsItems = async () => {
    console.warn("[tl hub] deleteSelectedLogisticsItems not implemented");
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
          <div className="flex items-center justify-between">
            <p className="font-black text-white">Logistics Queue</p>
            {selectedLogisticsItems.size > 0 && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="gap-1"
                disabled={logisticsBusy}
                onClick={() => void deleteSelectedLogisticsItems()}
              >
                <Trash2 className="size-3" />
                Delete Selected ({selectedLogisticsItems.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {logisticsQueue.length ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#020715]/80">
              <table className="w-full text-sm text-slate-200">
                <thead>
                  <tr className="text-left border-b border-slate-700 text-slate-400">
                    <th className="py-2 pe-4 w-10">Select</th>
                    <th className="py-2 pe-4">Item</th>
                    <th className="py-2 pe-4">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logisticsQueue.map((item) => (
                    <tr key={item.id} className="border-t border-slate-800">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={selectedLogisticsItems.has(item.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedLogisticsItems);
                            if (e.target.checked) {
                              newSet.add(item.id);
                            } else {
                              newSet.delete(item.id);
                            }
                            setSelectedLogisticsItems(newSet);
                          }}
                        />
                      </td>
                      <td className="py-2">{item.title ?? item.id}</td>
                      <td className="py-2 text-slate-300">{item.status ?? "pending"}</td>
                      <td className="py-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={logisticsBusy}
                          onClick={() => void assignAutoDispatch(item.id)}
                        >
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          disabled={logisticsBusy}
                          onClick={() => void deleteLogisticsItemHandler(item.id)}
                        >
                          <Trash2 className="size-4" />
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

      {/* GPS Tracking Section */}
      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader className="border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MapPin className="size-5 text-emerald-400" />
            <p className="font-black text-white">{t("tl.gpsTrackingTitle")}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {workers.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {workers.map((worker) => (
                <Button
                  key={worker.id}
                  variant="outline"
                  className="justify-start border-white/15 hover:border-emerald-500/50 hover:bg-emerald-950/20"
                  onClick={() => {
                    setSelectedWorkerForGps(worker);
                    setGpsDialogOpen(true);
                  }}
                >
                  <MapPin className="size-4 mr-2 text-emerald-400" />
                  <span className="truncate">{worker.full_name}</span>
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">{t("tl.noWorkersForGps")}</p>
          )}
        </CardContent>
      </Card>

      {/* GPS Dialog */}
      <Dialog open={gpsDialogOpen} onOpenChange={setGpsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-emerald-500/50">
          <DialogHeader>
            <DialogTitle className="text-emerald-200">
              {t("tl.gpsTrackingTitle")} - {selectedWorkerForGps?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selectedWorkerForGps && (
            <GpsDashboard
              workerId={selectedWorkerForGps.id}
              context="magic-link-tl"
              token={token}
            />
          )}
        </DialogContent>
      </Dialog>

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
