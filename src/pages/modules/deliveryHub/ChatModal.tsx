/** نافذة الدردشة المباشرة بين التاجر والزبون حول طلب معيّن. */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";
import { fetchOrderMessages, sendOrderMessage, subscribeToOrderMessages } from "@/lib/deliveryHub/api";
import type { OrderMessage } from "@/lib/deliveryHub/types";

export function OrderChatModal({
  open,
  onOpenChange,
  orderId,
  customerName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  customerName: string;
}) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchOrderMessages(orderId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "تعذر تحميل الرسائل"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const unsubscribe = subscribeToOrderMessages(orderId, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [open, orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendOrderMessage(orderId, "merchant", trimmed);
      setText("");
      // Add message locally immediately for instant feedback
      const tempMessage: OrderMessage = {
        id: `temp-${Date.now()}`,
        order_id: orderId,
        sender: "merchant",
        message: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMessage]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>محادثة مع {customerName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 min-h-[240px]">
          {loading ? (
            <div className="flex justify-center py-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">لا توجد رسائل بعد</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.sender === "merchant"
                    ? "ml-auto max-w-[80%] rounded-xl rounded-tl-sm bg-orange-600 px-3 py-2 text-sm text-white"
                    : "mr-auto max-w-[80%] rounded-xl rounded-tr-sm bg-slate-800 px-3 py-2 text-sm text-slate-100"
                }
              >
                {m.message}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2 pt-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSend();
            }}
            placeholder="اكتب رسالتك..."
          />
          <Button onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
