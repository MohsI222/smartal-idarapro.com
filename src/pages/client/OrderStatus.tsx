/** صفحة تتبع حالة الطلب — /order-status/:orderId */
import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send, CheckCircle2, ArrowRight } from "lucide-react";
import {
  fetchOrderById,
  fetchOrderMessages,
  sendOrderMessage,
  subscribeToOrder,
  subscribeToOrderMessages,
} from "@/lib/deliveryHub/api";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, type Order, type OrderMessage } from "@/lib/deliveryHub/types";

export function OrderStatus() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchOrderById(orderId), fetchOrderMessages(orderId)])
      .then(([o, msgs]) => {
        if (cancelled) return;
        if (!o) {
          setError("لم يتم العثور على هذا الطلب.");
          return;
        }
        setOrder(o);
        setMessages(msgs);
      })
      .catch((err) => {
        if (cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل الطلب");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubOrder = subscribeToOrder(orderId, (o) => setOrder((prev) => (prev ? { ...prev, ...o } : prev)));
    const unsubMsgs = subscribeToOrderMessages(orderId, (m) =>
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    );
    return () => {
      cancelled = true;
      unsubOrder();
      unsubMsgs();
    };
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!orderId || !text.trim()) return;
    const messageText = text.trim();
    setSending(true);
    try {
      await sendOrderMessage(orderId, "customer", messageText);
      setText("");
      // Add message locally immediately for instant feedback
      const tempMessage: OrderMessage = {
        id: `temp-${Date.now()}`,
        order_id: orderId,
        sender: "customer",
        message: messageText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMessage]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-slate-300">
        <p>{error}</p>
      </div>
    );
  }

  const currentIdx = ORDER_STATUS_FLOW.indexOf(order.status);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white" dir="rtl">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-4">
          <Link to={order.store_slug ? `/m/${order.store_slug}` : "/"} className="flex items-center gap-2 text-orange-500 hover:text-orange-400 transition-colors font-medium">
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm">العودة للمتجر</span>
          </Link>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold">تتبع طلبك</h1>
            <p className="text-sm text-slate-500">رقم الطلب: {order.id.slice(0, 8)}</p>
          </div>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>

        {/* Progress bar */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          {order.status === "cancelled" ? (
            <p className="text-center text-red-400 font-semibold">تم إلغاء هذا الطلب</p>
          ) : (
            <div className="flex items-center justify-between">
              {ORDER_STATUS_FLOW.map((status, idx) => (
                <div key={status} className="relative flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                      idx <= currentIdx ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-slate-700 text-slate-600"
                    }`}
                  >
                    {idx <= currentIdx ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                  </div>
                  <span className={`text-[11px] text-center ${idx <= currentIdx ? "text-white" : "text-slate-600"}`}>
                    {ORDER_STATUS_LABELS[status]}
                  </span>
                  {idx < ORDER_STATUS_FLOW.length - 1 && (
                    <div
                      className={`absolute top-4 h-0.5 w-full ${idx < currentIdx ? "bg-emerald-500" : "bg-slate-700"}`}
                      style={{ right: "50%", left: "-50%" }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order details */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <p className="font-semibold">تفاصيل الطلب</p>
          <ul className="space-y-1 text-sm text-slate-400">
            {(order.order_items ?? []).map((it) => (
              <li key={it.id} className="flex justify-between">
                <span>
                  {it.title} × {it.quantity}
                </span>
                <span>{(it.price * it.quantity).toFixed(2)} DH</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
            <span>الإجمالي</span>
            <span>{order.total.toFixed(2)} DH</span>
          </div>
        </div>

        {/* Chat */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <p className="font-semibold">محادثة مع المتجر</p>
          <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl bg-slate-950/50 p-3">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-slate-600 py-6">لا توجد رسائل بعد</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.sender === "customer"
                      ? "mr-auto max-w-[80%] rounded-xl rounded-tl-sm bg-orange-600 px-3 py-2 text-sm"
                      : "ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-slate-800 px-3 py-2 text-sm"
                  }
                >
                  {m.message}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSend();
              }}
              placeholder="اكتب رسالة للمتجر..."
            />
            <Button onClick={handleSend} disabled={sending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
