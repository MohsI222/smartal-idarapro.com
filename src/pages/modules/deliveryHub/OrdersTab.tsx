/** تبويب رادار الطلبات الحية — Live order kanban board with realtime chime + chat. */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, Phone, MapPin, ArrowRight, MessageSquare, X, Trash2 } from "lucide-react";
import {
  fetchOrders,
  subscribeToStoreOrders,
  updateOrderStatus,
  updateProductStock,
  deleteOrder,
} from "@/lib/deliveryHub/api";
import { playNewOrderChime } from "@/lib/deliveryHub/chime";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, type Order, type OrderStatus } from "@/lib/deliveryHub/types";
import { OrderChatModal } from "./ChatModal";

const NEXT_ACTION_LABEL: Record<OrderStatus, string> = {
  pending: "تأكيد الطلب",
  preparing: "إرسال مع الموزع",
  delivering: "إنهاء الطلب",
  completed: "—",
  cancelled: "—",
};

const WHATSAPP_MESSAGE_TEMPLATES: Record<OrderStatus, string> = {
  pending: "مرحباً {customer_name}، طلبك رقم {order_id} قيد الانتظار ⏳",
  preparing: "مرحباً {customer_name}، طلبك رقم {order_id} قيد التحضير 🍳",
  delivering: "مرحباً {customer_name}، طلبك رقم {order_id} في الطريق إليك 🛵",
  completed: "مرحباً {customer_name}، طلبك رقم {order_id} مكتمل، شكراً لتعاملك معنا",
  cancelled: "",
};

const COLUMN_COLORS: Record<OrderStatus, string> = {
  pending: "border-amber-500/40",
  preparing: "border-sky-500/40",
  delivering: "border-fuchsia-500/40",
  completed: "border-emerald-500/40",
  cancelled: "border-red-500/40",
};

function nextStatus(status: OrderStatus): OrderStatus | null {
  const idx = ORDER_STATUS_FLOW.indexOf(status);
  if (idx === -1 || idx === ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[idx + 1];
}

function getWhatsAppLink(order: Order): string {
  const template = WHATSAPP_MESSAGE_TEMPLATES[order.status] || "";
  if (!template) return "#";
  
  const message = template
    .replace("{customer_name}", order.customer_name)
    .replace("{order_id}", order.id);
  
  const cleanPhone = order.customer_phone.replace(/\D/g, "");
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

export function OrdersTab({
  storeId,
  orders,
  onOrdersChange,
  token,
  products,
  onProductsChange,
}: {
  storeId: string;
  orders: Order[];
  onOrdersChange: (orders: Order[]) => void;
  token: string | null;
  products: any[];
  onProductsChange: (products: any[]) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [chatOrder, setChatOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchOrders(storeId, token || undefined)
      .then((rows) => {
        if (!cancelled) onOrdersChange(rows);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "تعذر تحميل الطلبات"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = subscribeToStoreOrders(storeId, {
      onInsert: (order) => {
        onOrdersChange([order, ...ordersRef.current]);
        playNewOrderChime();
        toast.success(`طلب جديد من ${order.customer_name} 🔔`);
      },
      onUpdate: (order) => {
        onOrdersChange(ordersRef.current.map((o) => (o.id === order.id ? { ...o, ...order } : o)));
      },
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const columns = useMemo(() => {
    const groups: Record<OrderStatus, Order[]> = {
      pending: [],
      preparing: [],
      delivering: [],
      completed: [],
      cancelled: [],
    };
    for (const order of orders) {
      (groups[order.status] ?? groups.pending).push(order);
    }
    return groups;
  }, [orders]);

  async function handleAdvance(order: Order) {
    const next = nextStatus(order.status);
    if (!next || !token) return;
    setUpdatingId(order.id);
    try {
      await updateOrderStatus(token, order.id, next);
      onOrdersChange(orders.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
      toast.success(`تم تحديث حالة الطلب إلى: ${ORDER_STATUS_LABELS[next]}`);
      
      // Deduct stock when order is completed
      if (next === "completed" && order.order_items) {
        for (const item of order.order_items) {
          if (item.product_id) {
            try {
              // Find current product to get its stock
              const currentProduct = products.find(p => p.id === item.product_id);
              if (currentProduct) {
                const currentStock = currentProduct.stock_quantity || 0;
                const newStock = Math.max(0, currentStock - item.quantity);
                
                if (newStock !== currentStock) {
                  const updatedProduct = await updateProductStock(token, item.product_id, newStock);
                  // Update products list with the new stock
                  onProductsChange(products.map(p => p.id === item.product_id ? updatedProduct : p));
                }
              }
            } catch (err) {
              console.error("Failed to update stock:", err);
              toast.error(`فشل تحديث مخزون المنتج: ${item.title}`);
            }
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر تحديث الحالة");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCancel(order: Order) {
    if (!token) return;
    setUpdatingId(order.id);
    try {
      await updateOrderStatus(token, order.id, "cancelled");
      onOrdersChange(orders.map((o) => (o.id === order.id ? { ...o, status: "cancelled" } : o)));
      toast.success(`تم إلغاء الطلب ❌`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إلغاء الطلب");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(order: Order) {
    if (!token) return;
    if (!confirm("هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    setUpdatingId(order.id);
    try {
      await deleteOrder(token, order.id);
      onOrdersChange(orders.filter((o) => o.id !== order.id));
      toast.success(`تم حذف الطلب بنجاح`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر حذف الطلب");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {(["pending", "preparing", "delivering", "completed", "cancelled"] as OrderStatus[]).map((status) => (
        <Card key={status} className={`border-2 ${COLUMN_COLORS[status]}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>{ORDER_STATUS_LABELS[status]}</span>
              <Badge variant="outline">{columns[status].length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[65vh] overflow-y-auto">
            {columns[status].length === 0 && (
              <p className="text-center text-xs text-slate-600 py-6">لا توجد طلبات</p>
            )}
            {columns[status].map((order) => (
              <div key={order.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">{order.customer_name}</p>
                  <span className="text-xs text-slate-500">{order.total.toFixed(2)} DH</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {order.customer_phone}
                  </div>
                  {order.customer_phone && (
                    <a
                      href={getWhatsAppLink(order)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                      title="تواصل عبر واتساب"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                {order.address && (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="h-3.5 w-3.5" /> <span className="truncate">{order.address}</span>
                  </div>
                )}
                <ul className="text-xs text-slate-400 space-y-0.5">
                  {(order.order_items ?? []).map((it) => (
                    <li key={it.id}>
                      {it.title} × {it.quantity}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2 pt-1">
                  {nextStatus(order.status) && (
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={updatingId === order.id}
                      onClick={() => handleAdvance(order)}
                    >
                      {updatingId === order.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                      {NEXT_ACTION_LABEL[order.status]}
                    </Button>
                  )}
                  {order.status !== "cancelled" && order.status !== "completed" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={updatingId === order.id}
                      onClick={() => handleCancel(order)}
                      title="إلغاء الطلب"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {(order.status === "completed" || order.status === "cancelled") && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={updatingId === order.id}
                      onClick={() => handleDelete(order)}
                      title="حذف الطلب"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setChatOrder(order)}>
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {chatOrder && (
        <OrderChatModal
          open={!!chatOrder}
          onOpenChange={(open) => !open && setChatOrder(null)}
          orderId={chatOrder.id}
          customerName={chatOrder.customer_name}
        />
      )}
    </div>
  );
}
