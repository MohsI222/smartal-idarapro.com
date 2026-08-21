import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  DollarSign, 
  AlertCircle, 
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from "lucide-react";
import type { Product } from "../types";

type TranslateFn = (key: string) => string;

type InventoryControlPanelProps = {
  t: TranslateFn;
  products: Product[];
  onRefresh?: () => void;
  onExport?: () => void;
};

export function InventoryControlPanel({ t, products, onRefresh, onExport }: InventoryControlPanelProps) {
  const safeProducts = products || [];
  const totalStock = safeProducts.reduce((sum, p) => sum + p.stock_pieces, 0);
  const totalValue = safeProducts.reduce((sum, p) => sum + (p.stock_pieces * p.unit_price), 0);
  const totalCost = safeProducts.reduce((sum, p) => sum + (p.stock_pieces * (p.cost_price || 0)), 0);
  const totalProfit = totalValue - totalCost;
  const lowStockItems = safeProducts.filter(p => p.stock_pieces <= (p.low_stock_alert || 10));
  const expiringItems = safeProducts.filter(p => {
    if (!p.expiry_date) return false;
    const expiryDate = new Date(p.expiry_date);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  });

  const averageStock = safeProducts.length > 0 ? totalStock / safeProducts.length : 0;
  const profitMargin = totalValue > 0 ? ((totalProfit / totalValue) * 100).toFixed(1) : 0;

  const stockByCategory = safeProducts.reduce((acc, p) => {
    const category = p.retail_type || "general";
    acc[category] = (acc[category] || 0) + p.stock_pieces;
    return acc;
  }, {} as Record<string, number>);

  const valueByCategory = safeProducts.reduce((acc, p) => {
    const category = p.retail_type || "general";
    acc[category] = (acc[category] || 0) + (p.stock_pieces * p.unit_price);
    return acc;
  }, {} as Record<string, number>);

  const topProducts = [...safeProducts]
    .sort((a, b) => (b.stock_pieces * b.unit_price) - (a.stock_pieces * a.unit_price))
    .slice(0, 5);

  const bottomStockProducts = [...safeProducts]
    .filter(p => p.stock_pieces > 0)
    .sort((a, b) => a.stock_pieces - b.stock_pieces)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-black text-white">{t("inv.controlPanel")}</h2>
          <span className="px-2 py-1 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-full text-xs font-bold text-cyan-400">
            {t("inv.live")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 hover:bg-slate-800"
            onClick={onRefresh}
          >
            <RefreshCw className="size-4 mr-2" />
            {t("inv.refresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 hover:bg-slate-800"
            onClick={onExport}
          >
            <Download className="size-4 mr-2" />
            {t("inv.export")}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          icon={<Package className="size-5 text-cyan-400" />}
          label={t("inv.totalStock")}
          value={totalStock.toLocaleString()}
          trend="+12%"
          trendUp={true}
          color="cyan"
        />
        <MetricCard
          icon={<DollarSign className="size-5 text-emerald-400" />}
          label={t("inv.totalValue")}
          value={totalValue.toLocaleString()}
          trend="+8%"
          trendUp={true}
          color="emerald"
        />
        <MetricCard
          icon={<TrendingUp className="size-5 text-purple-400" />}
          label={t("inv.totalProfit")}
          value={totalProfit.toLocaleString()}
          trend={profitMargin + "%"}
          trendUp={true}
          color="purple"
        />
        <MetricCard
          icon={<AlertCircle className="size-5 text-red-400" />}
          label={t("inv.lowStockItems")}
          value={lowStockItems.length.toString()}
          trend="-3%"
          trendUp={false}
          color="red"
        />
        <MetricCard
          icon={<BarChart3 className="size-5 text-amber-400" />}
          label={t("inv.averageStock")}
          value={averageStock.toFixed(0)}
          trend="+5%"
          trendUp={true}
          color="amber"
        />
        <MetricCard
          icon={<Calendar className="size-5 text-pink-400" />}
          label={t("inv.expiringSoon")}
          value={expiringItems.length.toString()}
          trend="+2"
          trendUp={false}
          color="pink"
        />
      </div>

      {/* Charts and Tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Stock by Category */}
        <Card className="border-slate-800 bg-[#0a1628]/90">
          <CardHeader className="border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white">{t("inv.stockByCategory")}</h3>
              <Filter className="size-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {Object.entries(stockByCategory).map(([category, count]) => {
                const percentage = (count / totalStock) * 100;
                return (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{category}</span>
                      <span className="text-slate-400">{count.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Value by Category */}
        <Card className="border-slate-800 bg-[#0a1628]/90">
          <CardHeader className="border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white">{t("inv.valueByCategory")}</h3>
              <DollarSign className="size-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {Object.entries(valueByCategory).map(([category, value]) => {
                const percentage = (value / totalValue) * 100;
                return (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{category}</span>
                      <span className="text-slate-400">{value.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="border-slate-800 bg-[#0a1628]/90">
          <CardHeader className="border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white">{t("inv.topProducts")}</h3>
              <TrendingUp className="size-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {topProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-white text-sm">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.stock_pieces} {t("inv.piece")}</p>
                    </div>
                  </div>
                  <p className="font-bold text-emerald-400">
                    {(product.stock_pieces * product.unit_price).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className="border-slate-800 bg-[#0a1628]/90">
          <CardHeader className="border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white">{t("inv.lowStockAlertTitle")}</h3>
              <AlertCircle className="size-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {lowStockItems.length === 0 ? (
              <p className="text-center text-slate-500 py-8">{t("inv.noLowStock")}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {lowStockItems.slice(0, 10).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20"
                  >
                    <div>
                      <p className="font-semibold text-white text-sm">{product.name}</p>
                      <p className="text-xs text-red-400">
                        {product.stock_pieces} / {product.low_stock_alert || 10} {t("inv.piece")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-400">{product.stock_pieces}</p>
                      <p className="text-xs text-slate-500">{t("inv.piece")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type MetricCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  color: "cyan" | "emerald" | "purple" | "red" | "amber" | "pink";
};

function MetricCard({ icon, label, value, trend, trendUp, color }: MetricCardProps) {
  const colorClasses = {
    cyan: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30",
    emerald: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    red: "from-red-500/20 to-red-600/10 border-red-500/30",
    amber: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
    pink: "from-pink-500/20 to-pink-600/10 border-pink-500/30",
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-lg p-4`}>
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 bg-slate-900/50 rounded-lg">{icon}</div>
        <div className={`flex items-center gap-1 text-xs font-bold ${trendUp ? "text-emerald-400" : "text-red-400"}`}>
          {trendUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {trend}
        </div>
      </div>
      <p className="text-2xl font-black text-white mb-1">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
