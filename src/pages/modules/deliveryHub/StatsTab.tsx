/** تبويب إحصائيات المبيعات — لوحة KPI ملونة + رسم بياني + تصدير PDF/Excel حقيقي. */
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  CheckCircle2,
  TrendingUp,
  Clock,
  XCircle,
  Wallet,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Package,
  AlertTriangle,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ORDER_STATUS_LABELS, type Order, type Store, type StockAlert } from "@/lib/deliveryHub/types";
import { buildSalesReport, exportDeliveryHubSalesExcel, exportDeliveryHubSalesPdf } from "@/lib/deliveryHub/reportExport";
import { getStockAlerts as fetchStockAlerts } from "@/lib/deliveryHub/api";

const KPI_CARDS: {
  key: "revenueToday" | "revenueWeek" | "revenueMonth" | "averageOrderValue";
  label: string;
  icon: typeof DollarSign;
  gradient: string;
  suffix?: string;
}[] = [
  { key: "revenueToday", label: "مبيعات اليوم", icon: DollarSign, gradient: "from-emerald-500 to-teal-500", suffix: " DH" },
  { key: "revenueWeek", label: "مبيعات هذا الأسبوع", icon: TrendingUp, gradient: "from-sky-500 to-indigo-500", suffix: " DH" },
  { key: "revenueMonth", label: "مبيعات هذا الشهر", icon: Wallet, gradient: "from-fuchsia-500 to-purple-600", suffix: " DH" },
  { key: "averageOrderValue", label: "متوسط قيمة الطلب", icon: TrendingUp, gradient: "from-orange-500 to-amber-500", suffix: " DH" },
];

export function StatsTab({ store, orders }: { store: Store; orders: Order[] }) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [resettingStock, setResettingStock] = useState(false);

  const report = useMemo(() => buildSalesReport(orders), [orders]);

  useEffect(() => {
    async function loadStockAlerts() {
      try {
        console.log("Loading stock alerts for store:", store.id);
        const alerts = await fetchStockAlerts(store.id);
        console.log("Stock alerts loaded:", alerts);
        setStockAlerts(alerts);
      } catch (err) {
        console.error("Failed to load stock alerts:", err);
        toast.error("فشل تحميل تنبيهات المخزون");
      }
    }
    loadStockAlerts();
  }, [store.id]);

  async function handleResetStock() {
    const token = localStorage.getItem("idara_token");
    if (!token) {
      toast.error("يجب تسجيل الدخول");
      return;
    }
    setResettingStock(true);
    try {
      const res = await fetch("/api/delivery-hub/reset-stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("فشل إعادة تعيين المخزون");
      const data = await res.json();
      toast.success(`تم تحديث ${data.updated} منتج بقيم مخزون واقعية ✅`);
      // Reload stock alerts
      const alerts = await fetchStockAlerts(store.id);
      setStockAlerts(alerts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إعادة تعيين المخزون");
    } finally {
      setResettingStock(false);
    }
  }

  const topProduct = report.topProducts[0]?.title ?? "—";
  const topProductQty = report.topProducts[0]?.quantity ?? 0;

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      await exportDeliveryHubSalesPdf(store, orders, report);
      toast.success("تم تصدير تقرير PDF بنجاح ✅");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر تصدير التقرير PDF");
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      await exportDeliveryHubSalesExcel(store, orders, report);
      toast.success("تم تصدير تقرير Excel بنجاح ✅");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر تصدير التقرير Excel");
    } finally {
      setExportingExcel(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-gradient-to-l from-slate-900 to-slate-950 p-4">
        <div>
          <h3 className="text-lg font-bold text-white">تقارير المبيعات</h3>
          <p className="text-sm text-slate-400">بيانات حقيقية محسوبة مباشرة من طلبات متجرك.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportPdf} disabled={exportingPdf} className="bg-red-600 hover:bg-red-500">
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            تصدير PDF
          </Button>
          <Button onClick={handleExportExcel} disabled={exportingExcel} className="bg-emerald-600 hover:bg-emerald-500">
            {exportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            تصدير Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          const value = report[kpi.key];
          return (
            <Card key={kpi.key} className="overflow-hidden border-0">
              <div className={`bg-gradient-to-br ${kpi.gradient} p-4`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/90">{kpi.label}</span>
                  <Icon className="h-5 w-5 text-white/90" />
                </div>
                <p className="mt-2 text-2xl font-extrabold text-white">
                  {value.toFixed(2)}
                  {kpi.suffix}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-slate-400">الطلبات المكتملة</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{report.completedOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-slate-400">الطلبات النشطة</CardTitle>
            <Clock className="h-5 w-5 text-sky-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{report.activeOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-slate-400">الطلبات الملغاة</CardTitle>
            <XCircle className="h-5 w-5 text-rose-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{report.cancelledOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-slate-400">المنتج الأكثر مبيعاً</CardTitle>
            <TrendingUp className="h-5 w-5 text-orange-400" />
          </CardHeader>
          <CardContent>
            <p className="truncate text-xl font-bold text-white">{topProduct}</p>
            {topProductQty > 0 && <p className="text-xs text-slate-500">{topProductQty} قطعة مباعة</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الإيرادات خلال آخر 7 أيام</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                  formatter={(value: number) => [`${value.toFixed(2)} DH`, "الإيرادات"]}
                />
                <Bar dataKey="revenue" fill="#fb923c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>توزيع الطلبات حسب الحالة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(Object.keys(ORDER_STATUS_LABELS) as (keyof typeof ORDER_STATUS_LABELS)[]).map((status) => {
              const count = report.statusCounts[status] ?? 0;
              const total = orders.length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{ORDER_STATUS_LABELS[status]}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-orange-500 to-amber-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أفضل المنتجات مبيعاً</CardTitle>
          </CardHeader>
          <CardContent>
            {report.topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">لا توجد مبيعات مكتملة بعد.</p>
            ) : (
              <div className="space-y-2">
                {report.topProducts.slice(0, 5).map((p, idx) => (
                  <div
                    key={p.title}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 text-xs font-bold text-orange-300">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-white">{p.title}</span>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <p>{p.quantity} قطعة</p>
                      <p className="font-semibold text-emerald-400">{p.revenue.toFixed(2)} DH</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-400" />
            تنبيهات المخزون
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleResetStock} 
              disabled={resettingStock}
              className="text-xs"
            >
              {resettingStock ? <Loader2 className="h-3 w-3 animate-spin" /> : "إعادة تعيين المخزون"}
            </Button>
            <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-slate-800 to-slate-900 px-3 py-1 border border-slate-700">
              <span className={`flex items-center gap-1 text-xs font-semibold ${stockAlerts.filter(a => a.status === "out").length > 0 ? "text-red-400" : stockAlerts.filter(a => a.status === "low").length > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {stockAlerts.filter(a => a.status === "out").length > 0 && <AlertTriangle className="h-3 w-3" />}
                {stockAlerts.filter(a => a.status === "out").length} نفذ
              </span>
              <span className="text-slate-600">|</span>
              <span className={`flex items-center gap-1 text-xs font-semibold ${stockAlerts.filter(a => a.status === "low").length > 0 ? "text-amber-400" : "text-slate-400"}`}>
                {stockAlerts.filter(a => a.status === "low").length > 0 && <AlertTriangle className="h-3 w-3" />}
                {stockAlerts.filter(a => a.status === "low").length} منخفض
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stockAlerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">جميع المنتجات في المخزون بمستوى جيد ✅</p>
          ) : (
            <div className="space-y-2">
              {stockAlerts.map((alert) => (
                <div
                  key={alert.product_id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    alert.status === "out"
                      ? "border-red-500/50 bg-red-950/20"
                      : alert.status === "low"
                      ? "border-amber-500/50 bg-amber-950/20"
                      : "border-emerald-500/50 bg-emerald-950/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {alert.status === "out" ? (
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    ) : alert.status === "low" ? (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    ) : (
                      <Package className="h-4 w-4 text-emerald-400" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm text-white">{alert.product_title}</span>
                      {alert.product_sku && (
                        <span className="text-xs text-slate-400">{alert.product_sku}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-slate-400">الكمية: {alert.current_quantity}</p>
                    <p className="text-slate-500">الحد الأدنى: {alert.low_stock_threshold}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
