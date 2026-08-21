/** أنواع بيانات قسم رادار الطلبات والتوصيل — Delivery Hub shared types. */

export type OrderStatus = "pending" | "preparing" | "delivering" | "completed" | "cancelled";

export type StoreTheme = "neon-modern" | "warm-gourmet" | "electric-blue" | "sunset-orange";

export type SupportedLanguage = "ar" | "en" | "fr";

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; name: string; flag: string }[] = [
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
];

export const STORE_THEMES: { id: StoreTheme; labelAr: string; from: string; to: string; accent: string }[] = [
  { id: "neon-modern", labelAr: "نيون عصري", from: "#7c3aed", to: "#06b6d4", accent: "#22d3ee" },
  { id: "warm-gourmet", labelAr: "دافئ فاخر", from: "#b91c1c", to: "#f59e0b", accent: "#fbbf24" },
  { id: "electric-blue", labelAr: "أزرق كهربائي", from: "#1d4ed8", to: "#0ea5e9", accent: "#38bdf8" },
  { id: "sunset-orange", labelAr: "برتقالي الغروب", from: "#ea580c", to: "#db2777", accent: "#fb923c" },
];

export type Store = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  banner_url: string | null;
  promo_video_url: string | null;
  theme: StoreTheme;
  phone: string | null;
  whatsapp: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  custom_domain: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  store_id: string;
  title: string;
  category: string | null;
  description: string | null;
  price: number;
  original_price: number | null;
  image_url: string | null;
  video_url: string | null;
  in_stock: boolean;
  sort_order: number;
  sku: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  title: string;
  price: number;
  quantity: number;
  created_at: string;
};

export type Order = {
  id: string;
  store_id: string;
  store_slug?: string;
  customer_name: string;
  customer_phone: string;
  address: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  status: OrderStatus;
  total: number;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
};

export type OrderMessage = {
  id: string;
  order_id: string;
  sender: "customer" | "merchant";
  message: string;
  created_at: string;
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "قيد الانتظار ⏳",
  preparing: "قيد التحضير 🍳",
  delivering: "في الطريق 🛵",
  completed: "مكتمل ✅",
  cancelled: "ملغى ❌",
};

export const ORDER_STATUS_FLOW: OrderStatus[] = ["pending", "preparing", "delivering", "completed"];

export type StockAlert = {
  product_id: string;
  product_title: string;
  product_sku: string | null;
  current_quantity: number;
  low_stock_threshold: number;
  status: "low" | "out" | "ok";
};

export type StockMovement = {
  id: string;
  product_id: string;
  product_title: string;
  type: "in" | "out";
  quantity: number;
  reason: string;
  created_at: string;
};
