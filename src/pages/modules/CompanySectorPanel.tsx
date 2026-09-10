import { useEffect, useMemo, useState } from "react";
import { supabase, fetchInventory, reserveMaterial, fetchProductsAwaitingQA, confirmProductQA, enqueueLogistics, fetchProductionRequests, createProductionRequest, fetchLogisticsQueue, fetchHrStaff, assignLogisticsItem } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CompanySectorPanel() {
  const [tab, setTab] = useState<"production" | "maintenance" | "quality">("production");
  const [query, setQuery] = useState("");
  const [inventory, setInventory] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [bomItems, setBomItems] = useState<Array<{ material_id: string; name: string; reference: string; quantity: number }>>([]);
  const [productionQty, setProductionQty] = useState<number>(1);
  const [productionRequests, setProductionRequests] = useState<any[]>([]);
  const [logisticsQueue, setLogisticsQueue] = useState<any[]>([]);
  const [hrStaff, setHrStaff] = useState<any[]>([]);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      fetchInventory().then(setInventory).catch(() => setInventory([]));
      fetchProductsAwaitingQA().then(setProducts).catch(() => setProducts([]));
      fetchProductionRequests().then(setProductionRequests).catch(() => setProductionRequests([]));
      fetchLogisticsQueue().then(setLogisticsQueue).catch(() => setLogisticsQueue([]));
      fetchHrStaff().then(setHrStaff).catch(() => setHrStaff([]));
    };

    refresh();

    const inventoryChannel = supabase?.channel("inventory-changes").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "inventory" },
      async () => {
        setInventory(await fetchInventory());
      }
    );
    const productChannel = supabase?.channel("products-changes").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "products" },
      async () => {
        setProducts(await fetchProductsAwaitingQA());
      }
    );
    const requestChannel = supabase?.channel("production-requests").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "production_requests" },
      async () => {
        setProductionRequests(await fetchProductionRequests());
      }
    );
    const logisticsChannel = supabase?.channel("logistics-queue").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "logistics_queue" },
      async () => {
        setLogisticsQueue(await fetchLogisticsQueue());
      }
    );

    inventoryChannel?.subscribe();
    productChannel?.subscribe();
    requestChannel?.subscribe();
    logisticsChannel?.subscribe();

    return () => {
      inventoryChannel?.unsubscribe();
      productChannel?.unsubscribe();
      requestChannel?.unsubscribe();
      logisticsChannel?.unsubscribe();
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query) return inventory;
    const q = query.toLowerCase();
    return inventory.filter((it) => (it.name || "").toLowerCase().includes(q) || (it.reference || "").toLowerCase().includes(q));
  }, [inventory, query]);

  function addToBom(item: any) {
    setBomItems((current) => {
      const existing = current.find((row) => row.material_id === item.id);
      if (existing) {
        return current.map((row) => (row.material_id === item.id ? { ...row, quantity: row.quantity + 1 } : row));
      }
      return [...current, { material_id: item.id, name: item.name || "مواد", reference: item.reference || "-", quantity: 1 }];
    });
  }

  function updateBomQuantity(materialId: string, quantity: number) {
    setBomItems((current) =>
      current
        .map((row) => (row.material_id === materialId ? { ...row, quantity: Math.max(1, quantity) } : row))
        .filter((row) => row.quantity > 0)
    );
  }

  async function createProductionRequestHandler() {
    if (bomItems.length === 0) return;
    setIsCreatingRequest(true);
    try {
      await createProductionRequest({
        title: `طلب إنتاج ${bomItems.length} مواد`,
        target_quantity: productionQty,
        bom_items: bomItems.map((item) => ({ material_id: item.material_id, quantity: item.quantity, name: item.name, reference: item.reference })),
        status: "pending",
        requested_by: "sys-production",
      });
      await Promise.all(bomItems.map((item) => reserveMaterial(item.material_id, item.quantity)));
      setBomItems([]);
      setProductionQty(1);
      setInventory(await fetchInventory());
      setProductionRequests(await fetchProductionRequests());
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingRequest(false);
    }
  }

  async function onAssign(logisticsId: string, staffId: string) {
    try {
      await assignLogisticsItem(logisticsId, staffId);
      setLogisticsQueue(await fetchLogisticsQueue());
    } catch (e) {
      console.error(e);
    }
  }

  async function onReserve(id: string) {
    try {
      await reserveMaterial(id, 1);
      const fresh = await fetchInventory();
      setInventory(fresh);
    } catch (e) {
      console.error(e);
    }
  }

  async function onConfirmQA(productId: string) {
    try {
      await confirmProductQA(productId);
      await enqueueLogistics(productId);
      const fresh = await fetchProductsAwaitingQA();
      setProducts(fresh);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className={`px-3 py-1 rounded ${tab === "production" ? "bg-sky-600 text-white" : "bg-white/5"}`} onClick={() => setTab("production")}>الإنتاج</button>
        <button className={`px-3 py-1 rounded ${tab === "maintenance" ? "bg-sky-600 text-white" : "bg-white/5"}`} onClick={() => setTab("maintenance")}>الصيانة</button>
        <button className={`px-3 py-1 rounded ${tab === "quality" ? "bg-sky-600 text-white" : "bg-white/5"}`} onClick={() => setTab("quality")}>الجودة والتعبئة</button>
      </div>

      <div>
        <Input placeholder="بحث ذكي بالاسم أو المرجع" value={query} onChange={(e: any) => setQuery(e.target.value)} />
      </div>

      {tab === "production" && (
        <div>
          <h3 className="font-semibold">المواد المتاحة</h3>
          <p className="text-sm text-slate-400">اختر كميات BOM لتوليد طلب إنتاج مرتبط بالمواد ويُحدّث المخزون مباشرة.</p>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {filtered.map((it) => (
              <div key={it.id} className="flex flex-col gap-3 rounded bg-white/3 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-sm text-slate-300">{it.reference} — Qty: {it.quantity}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={bomItems.find((row) => row.material_id === it.id)?.quantity ?? 1}
                    min={1}
                    className="w-24 bg-slate-950 text-white"
                    onChange={(e: any) => updateBomQuantity(it.id, Number(e.target.value))}
                  />
                  <Button onClick={() => addToBom(it)} size="sm">أضف إلى BOM</Button>
                </div>
              </div>
            ))}
          </div>

          {bomItems.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <h4 className="font-semibold">قائمة المواد في BOM</h4>
              <div className="grid gap-2 mt-3">
                {bomItems.map((item) => (
                  <div key={item.material_id} className="flex flex-col gap-3 rounded bg-white/5 p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-slate-300">{item.reference}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        min={1}
                        className="w-24 bg-slate-950 text-white"
                        onChange={(e: any) => updateBomQuantity(item.material_id, Number(e.target.value))}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-300">الكمية المستهدفة للإنتاج</label>
                  <Input type="number" min={1} value={productionQty} className="w-24 bg-slate-950 text-white" onChange={(e: any) => setProductionQty(Number(e.target.value))} />
                </div>
                <Button onClick={createProductionRequestHandler} disabled={isCreatingRequest}>
                  {isCreatingRequest ? "جاري الإنشاء..." : "إنشاء طلب إنتاج"}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
            <h4 className="font-semibold">طلبات الإنتاج الحديثة</h4>
            {productionRequests.length === 0 ? (
              <p className="text-sm text-slate-400 mt-2">لا توجد طلبات إنتاج حتى الآن.</p>
            ) : (
              <div className="grid gap-2 mt-3">
                {productionRequests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="font-medium">{request.title}</div>
                    <div className="text-sm text-slate-300">الحالة: {request.status} — الكمية: {request.target_quantity}</div>
                    <div className="text-xs text-slate-500 mt-2">مواد: {Array.isArray(request.bom_items) ? request.bom_items.map((item: any) => `${item.name || item.material_id} x${item.quantity}`).join(", ") : "-"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "maintenance" && (
        <div>
          <h3 className="font-semibold">قطع الغيار والآلات</h3>
          <p className="text-sm text-slate-400">لوحة مبسطة لإدارة مخزون الصيانة.</p>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {inventory.slice(0, 20).map((it) => (
              <div key={it.id} className="flex items-center justify-between p-3 rounded bg-white/3">
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-sm text-slate-300">{it.reference} — Qty: {it.quantity}</div>
                </div>
                <div>
                  <Button onClick={() => onReserve(it.id)} size="sm">حجز</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "quality" && (
        <div>
          <h3 className="font-semibold">منتجات بانتظار التأكيد</h3>
          <p className="text-sm text-slate-400">تأكيد الجودة يرسل المنتج مباشرة إلى جدول الشحن واللوجيستيك.</p>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded bg-white/3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-slate-300">Ref: {p.reference}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => onConfirmQA(p.id)} size="sm">تأكيد الجودة</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <h3 className="font-semibold">طابور اللوجيستيك</h3>
        <div className="grid gap-3 mt-3">
          {logisticsQueue.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium">منتج: {item.product_id}</div>
                  <div className="text-sm text-slate-300">الحالة: {item.status} — المعين إلى: {item.assigned_to || "غير معين"}</div>
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <select className="rounded bg-slate-900 p-2 text-white" value={item.assigned_to || ""} onChange={(e) => onAssign(item.id, e.target.value)}>
                    <option value="">تعيين موظف HR</option>
                    {hrStaff.map((hr) => (
                      <option key={hr.id} value={hr.id}>{hr.name || hr.email || hr.id}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
