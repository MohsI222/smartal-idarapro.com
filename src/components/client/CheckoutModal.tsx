/** نافذة تأكيد الطلب السريع — express checkout with GPS + WhatsApp fallback. */
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, MessageCircle, Rocket } from "lucide-react";
import { placeOrder } from "@/lib/deliveryHub/api";
import { buildWhatsAppLink, buildWhatsAppOrderMessage } from "@/lib/deliveryHub/whatsapp";
import type { Store } from "@/lib/deliveryHub/types";
import type { CartEntry } from "./CartDrawer";

export function CheckoutModal({
  open,
  onOpenChange,
  store,
  entries,
  onOrderPlaced,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: Store;
  entries: CartEntry[];
  onOrderPlaced: (orderId: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const total = entries.reduce((sum, e) => sum + e.product.price * e.quantity, 0);

  function handleLocate() {
    if (!navigator.geolocation) {
      toast.error("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAddress((prev) => prev || `الموقع: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setLocating(false);
        toast.success("تم تحديد موقعك ✅");
      },
      () => {
        setLocating(false);
        toast.error("تعذر تحديد الموقع — تحقق من صلاحيات الموقع");
      }
    );
  }

  function validate(): boolean {
    if (!name.trim()) {
      toast.error("الرجاء إدخال اسم الزبون");
      return false;
    }
    if (!phone.trim()) {
      toast.error("الرجاء إدخال رقم الهاتف");
      return false;
    }
    if (entries.length === 0) {
      toast.error("السلة فارغة");
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const orderId = await placeOrder({
        store_id: store.id,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        items: entries.map((e) => ({
          product_id: e.product.id,
          title: e.product.title,
          price: e.product.price,
          quantity: e.quantity,
        })),
      });
      localStorage.setItem("deliveryHub:lastOrderId", orderId);
      toast.success("تم تأكيد الطلب بنجاح 🚀");
      onOrderPlaced(orderId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إرسال الطلب");
    } finally {
      setSubmitting(false);
    }
  }

  function handleWhatsAppOrder() {
    if (!validate()) return;
    const message = buildWhatsAppOrderMessage(
      store,
      entries.map((e) => ({ title: e.product.title, price: e.product.price, quantity: e.quantity })),
      { name, phone, address }
    );
    const link = buildWhatsAppLink(store.whatsapp ?? store.phone, message);
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تأكيد بيانات التوصيل</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>اسم الزبون</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" />
          </div>
          <div className="grid gap-2">
            <Label>رقم الهاتف</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06XXXXXXXX" />
          </div>
          <div className="grid gap-2">
            <Label>العنوان والملاحظات</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="العنوان الكامل" />
            <Button type="button" variant="outline" size="sm" onClick={handleLocate} disabled={locating}>
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              تحديد موقعي التلقائي 📍
            </Button>
          </div>
          <div className="grid gap-2">
            <Label>ملاحظات إضافية (اختياري)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: الطابق الثاني" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-800 p-3">
            <span className="text-slate-400">الإجمالي</span>
            <span className="text-xl font-bold text-white">{total.toFixed(2)} DH</span>
          </div>
        </div>
        <div className="grid gap-2 pt-2">
          <Button size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
            تأكيد الطلب بنجاح 🚀
          </Button>
          <Button size="lg" variant="secondary" onClick={handleWhatsAppOrder} disabled={submitting}>
            <MessageCircle className="h-5 w-5" /> طلب سريع عبر الواتساب 💬
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
