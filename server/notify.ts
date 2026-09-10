/** رقم واتساب الإدارة للتنبيهات (بدون + في wa.me) */
export const ADMIN_NOTIFY_WHATSAPP_DIGITS = "212780290270";

export function buildAdminWhatsappUrl(message: string): string {
  const text = encodeURIComponent(message.slice(0, 3800));
  return `https://wa.me/${ADMIN_NOTIFY_WHATSAPP_DIGITS}?text=${text}`;
}
