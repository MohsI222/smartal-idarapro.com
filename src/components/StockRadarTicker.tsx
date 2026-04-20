import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Package } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  stock_pieces: number;
  low_stock_alert?: number;
  expiry_date?: string | null;
};

function parseIso(d: string | null | undefined): number | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = new Date(d + "T12:00:00").getTime();
  return Number.isNaN(t) ? null : t;
}

export function StockRadarTicker() {
  const { token, isApproved, approvedModules } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<string[]>([]);

  const canInv = isApproved && approvedModules.includes("inventory");

  const load = useCallback(async () => {
    if (!token || !canInv) {
      setItems([]);
      return;
    }
    try {
      const r = await api<{ products: ProductRow[] }>("/inventory/products", { token });
      const now = Date.now();
      const dayMs = 86400000;
      const alerts: string[] = [];
      for (const p of r.products) {
        const rawTh = p.low_stock_alert;
        const threshold =
          rawTh !== undefined && rawTh !== null && Number.isFinite(Number(rawTh))
            ? Math.max(0, Number(rawTh))
            : 10;
        if (p.stock_pieces <= threshold) {
          alerts.push(t("radar.lowStockLine").replace("{name}", p.name).replace("{n}", String(p.stock_pieces)));
        }
        const exp = parseIso(p.expiry_date ?? null);
        if (exp !== null) {
          const days = Math.ceil((exp - now) / dayMs);
          if (days < 0) {
            alerts.push(t("radar.expiredLine").replace("{name}", p.name));
          } else if (days <= 14) {
            alerts.push(
              t("radar.expiringSoonLine").replace("{name}", p.name).replace("{d}", String(days))
            );
          }
        }
      }
      setItems(alerts);
    } catch {
      setItems([]);
    }
  }, [token, canInv, t]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(id);
  }, [load]);

  const text = useMemo(() => {
    if (!canInv) return "";
    if (items.length === 0) return t("radar.allOk");
    return items.join("  •  ");
  }, [canInv, items, t]);

  if (!token || !canInv) return null;

  return (
    <div
      className="relative overflow-hidden border-b border-cyan-500/25 bg-black/40 print:hidden"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] sm:text-xs">
        <Package className="size-3.5 shrink-0 text-cyan-400" aria-hidden />
        <AlertTriangle className="size-3.5 shrink-0 text-amber-400" aria-hidden />
        <p className="text-slate-500 shrink-0 font-bold">{t("radar.badge")}</p>
      </div>
      <div className="relative h-7 overflow-hidden">
        <div className="animate-stock-ticker whitespace-nowrap text-[11px] sm:text-xs font-medium px-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]">
          <span className="inline-block pe-24">{text}</span>
          <span className="inline-block pe-24">{text}</span>
        </div>
      </div>
      <p className="px-3 pb-1 text-[9px] text-slate-600 leading-tight">{t("radar.privacyNote")}</p>
    </div>
  );
}
