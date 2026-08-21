/** تنسيق رسالة واتساب لطلب سريع من واجهة الزبون. */
import type { Store } from "./types";

export type CartLine = { title: string; price: number; quantity: number };

export function buildWhatsAppOrderMessage(
  store: Store,
  lines: CartLine[],
  customer: { name?: string; phone?: string; address?: string }
): string {
  const itemsText = lines
    .map((l) => `• ${l.title} × ${l.quantity} = ${(l.price * l.quantity).toFixed(2)} DH`)
    .join("\n");
  const total = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const parts = [
    `مرحباً 👋 أريد طلب من ${store.name}:`,
    "",
    itemsText,
    "",
    `الإجمالي: ${total.toFixed(2)} DH`,
  ];
  if (customer.name) parts.push("", `الاسم: ${customer.name}`);
  if (customer.phone) parts.push(`الهاتف: ${customer.phone}`);
  if (customer.address) parts.push(`العنوان: ${customer.address}`);
  return parts.join("\n");
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string): string {
  const digits = (phone ?? "").replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
