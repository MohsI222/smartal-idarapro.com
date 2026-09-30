/** لوحة تحكم التاجر — رادار الطلبات والتوصيل (/app/delivery-hub). */
import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Radio, LayoutTemplate, QrCode, BarChart3, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { ensureStoreForUser, fetchProductsFromBackend, fetchOrders } from "@/lib/deliveryHub/api";
import type { Order, Product, Store } from "@/lib/deliveryHub/types";
import { OrdersTab } from "./deliveryHub/OrdersTab";
import { CatalogTab } from "./deliveryHub/CatalogTab";
import { QrTab } from "./deliveryHub/QrTab";
import { StatsTab } from "./deliveryHub/StatsTab";

export function DeliveryHubModule() {
  const { token, isAdmin, isApproved, approvedModules } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const deliveryHubAllowed = isAdmin || (isApproved && approvedModules.includes("delivery_hub"));

  // Memoized callbacks to prevent re-renders
  const handleProductsChange = useCallback((newProducts: Product[]) => {
    setProducts(newProducts);
  }, []);

  const handleOrdersChange = useCallback((newOrders: Order[]) => {
    setOrders(newOrders);
  }, []);

  const handleStoreChange = useCallback((newStore: Store) => {
    setStore(newStore);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setError("انتهت مهلة التحميل. يرجى المحاولة مرة أخرى.");
        setLoading(false);
      }
    }, 30000); // 30 second timeout for initial load

    async function bootstrap() {
      if (!token) {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setError("يجب تسجيل الدخول للوصول إلى رادار الطلبات والتوصيل.");
          setLoading(false);
        }
        return;
      }
      try {
        console.log("[DeliveryHubModule] Bootstrapping for user, isAdmin:", isAdmin);
        const activeStore = await ensureStoreForUser(token);
        const [productRows, orderRows] = await Promise.all([
          fetchProductsFromBackend(activeStore.id, token),
          fetchOrders(activeStore.id, token),
        ]);
        clearTimeout(timeoutId);
        if (!cancelled) {
          setStore(activeStore);
          setProducts(productRows);
          setOrders(orderRows);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error("[DeliveryHubModule] Bootstrap error:", err);
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : "تعذر تحميل بيانات المتجر";
          setError(errorMessage);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [token, isAdmin]);

  // Polling for orders and products updates (replaces Supabase Realtime)
  useEffect(() => {
    if (!store?.id || !token) return;
    
    const interval = setInterval(async () => {
      try {
        const [ordersData, productsData] = await Promise.all([
          fetchOrders(store.id, token),
          fetchProductsFromBackend(store.id, token)
        ]);
        setOrders(ordersData);
        setProducts(productsData);
      } catch (err) {
        console.error('Error polling delivery hub data:', err);
      }
    }, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, [store?.id, token]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!deliveryHubAllowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4 max-w-lg mx-auto">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("inventory.lockedTitle")}</h2>
        <p className="text-slate-400">{t("inventory.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-500/30 bg-red-950/20 p-6 text-center text-red-200">
        <p className="font-semibold">تعذر تحميل رادار الطلبات والتوصيل</p>
        <p className="mt-2 text-sm text-red-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("deliveryHub.title")}</h1>
        <p className="text-sm text-slate-400">{store.name} — {t("deliveryHub.subtitle")}</p>
      </div>

      <Tabs defaultValue="orders" dir="rtl">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="orders">
            <Radio className="h-4 w-4" /> {t("deliveryHub.tab.orders")}
          </TabsTrigger>
          <TabsTrigger value="catalog">
            <LayoutTemplate className="h-4 w-4" /> {t("deliveryHub.tab.catalog")}
          </TabsTrigger>
          <TabsTrigger value="qr">
            <QrCode className="h-4 w-4" /> {t("deliveryHub.tab.qr")}
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4" /> {t("deliveryHub.tab.stats")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <OrdersTab storeId={store.id} orders={orders} onOrdersChange={handleOrdersChange} token={token} products={products} onProductsChange={handleProductsChange} />
        </TabsContent>
        <TabsContent value="catalog">
          <CatalogTab
            store={store}
            products={products}
            onStoreChange={handleStoreChange}
            onProductsChange={handleProductsChange}
            token={token}
          />
        </TabsContent>
        <TabsContent value="qr">
          <QrTab store={store} />
        </TabsContent>
        <TabsContent value="stats">
          <StatsTab store={store} orders={orders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
