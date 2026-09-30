/**
 * طبقة الوصول لبيانات قسم رادار الطلبات والتوصيل.
 *
 * جميع العمليات تمر عبر الخادم الموثوق للتطبيق (`/api/delivery-hub/*`)
 * باستخدام JWT الخاص بالتطبيق. راجع `server/deliveryHubRoutes.ts` للتفاصيل.
 */
import { api } from "@/lib/api";
import type { Order, OrderItem, OrderMessage, OrderStatus, Product, Store, StockAlert } from "./types";

export class DeliveryHubError extends Error {}

function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `store-${Math.random().toString(36).slice(2, 8)}`;
}

/** الصورة الافتراضية عند غياب صورة المنتج/الشعار — بدون أي اعتماد على Storage buckets. */
export const FALLBACK_IMAGES = {
  product1: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=60",
  product2: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=60",
  product3: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=800&q=60",
  banner: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=60",
  logo: "https://api.dicebear.com/7.x/shapes/svg?seed=delivery-hub",
};

/**
 * التأكد من وجود متجر لصاحب الحساب — إن لم يوجد، ينشئ متجر تجريبي فوراً
 * (مع 3 منتجات) بدون أي تدخل يدوي في SQL. تمر عبر خادم التطبيق الموثوق
 * (وليس Supabase مباشرة) حتى تعمل لأي مستخدم مسجّل دخول في التطبيق، بغض
 * النظر عن وجود جلسة Supabase Auth حقيقية من عدمها.
 */
export async function ensureStoreForUser(token: string): Promise<Store> {
  try {
    console.log("[ensureStoreForUser] Fetching store for user");
    const res = await api<{ store: Store }>("/delivery-hub/store", { token });
    console.log("[ensureStoreForUser] Store fetched successfully:", res.store.slug);
    return res.store;
  } catch (e) {
    console.error("[ensureStoreForUser] Error fetching store:", e);
    throw new DeliveryHubError(e instanceof Error ? e.message : "تعذر تحميل/إنشاء المتجر");
  }
}

export async function fetchStoreBySlug(slug: string): Promise<Store | null> {
  try {
    const res = await fetch(`/api/delivery-hub/stores/public/${slug}`);
    if (!res.ok) throw new DeliveryHubError("فشل في تحميل المتجر");
    const data = await res.json();
    return data.store as Store;
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "فشل في تحميل المتجر");
  }
}

export async function updateStore(token: string, patch: Partial<Store>): Promise<Store> {
  try {
    const res = await api<{ store: Store }>("/delivery-hub/store", {
      method: "PUT",
      token,
      body: JSON.stringify(patch),
    });
    return res.store;
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "تعذر تحديث بيانات المتجر");
  }
}

export function suggestSlug(name: string): string {
  return slugify(name);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export async function fetchProducts(storeId: string): Promise<Product[]> {
  try {
    const res = await fetch(`/api/delivery-hub/products/public?store_id=${storeId}`);
    if (!res.ok) throw new DeliveryHubError("فشل في تحميل المنتجات");
    const data = await res.json();
    return data.products as Product[];
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "فشل في تحميل المنتجات");
  }
}

export async function fetchProductsBySlug(slug: string): Promise<Product[]> {
  try {
    const res = await fetch(`/api/delivery-hub/products/public/${slug}`);
    if (!res.ok) throw new DeliveryHubError("فشل في تحميل المنتجات");
    const data = await res.json();
    return data.products as Product[];
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "فشل في تحميل المنتجات");
  }
}

export async function fetchProductsFromBackend(storeId: string, token: string): Promise<Product[]> {
  try {
    const res = await api<{ products: Product[] }>(`/delivery-hub/products?store_id=${storeId}`, { token });
    return res.products || [];
  } catch (e) {
    console.error("[fetchProductsFromBackend] Error:", e);
    throw new DeliveryHubError(e instanceof Error ? e.message : "تعذر تحميل المنتجات");
  }
}

export async function upsertProduct(token: string, product: Partial<Product> & { store_id: string }): Promise<Product> {
  try {
    if (product.id) {
      const { id, ...patch } = product;
      const res = await api<{ product: Product }>(`/delivery-hub/products/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      return res.product;
    }
    const res = await api<{ product: Product }>("/delivery-hub/products", {
      method: "POST",
      token,
      body: JSON.stringify(product),
    });
    return res.product;
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "تعذر حفظ المنتج");
  }
}

export async function deleteProduct(token: string, id: string): Promise<void> {
  try {
    await api(`/delivery-hub/products/${id}`, { method: "DELETE", token });
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "تعذر حذف المنتج");
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export async function fetchOrders(storeId: string, token?: string): Promise<Order[]> {
  if (token) {
    // Use backend API to bypass RLS
    try {
      const res = await api<{ orders: Order[] }>(`/delivery-hub/orders?store_id=${storeId}`, { token });
      return res.orders;
    } catch (e) {
      throw new DeliveryHubError(e instanceof Error ? e.message : "تعذر تحميل الطلبات");
    }
  }
  // Use public backend endpoint (for public/client access)
  try {
    const res = await fetch(`/api/delivery-hub/orders/public?store_id=${storeId}`);
    if (!res.ok) throw new DeliveryHubError("فشل في تحميل الطلبات");
    const data = await res.json();
    return data.orders as Order[];
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "فشل في تحميل الطلبات");
  }
}

export async function fetchOrderById(orderId: string): Promise<Order | null> {
  // Use public backend endpoint to bypass RLS
  try {
    const res = await fetch(`/api/delivery-hub/orders/${orderId}`);
    if (!res.ok) throw new DeliveryHubError("فشل في تحميل الطلب");
    const data = await res.json();
    return data.order as Order;
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "فشل في تحميل الطلب");
  }
}

export async function updateOrderStatus(token: string, orderId: string, status: OrderStatus): Promise<void> {
  try {
    await api(`/delivery-hub/orders/${orderId}/status`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status }),
    });
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "تعذر تحديث حالة الطلب");
  }
}

export async function updateProductStock(token: string, productId: string, quantity: number): Promise<Product> {
  try {
    const res = await api<{ product: Product }>(`/delivery-hub/products/${productId}/stock`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ stock_quantity: quantity }),
    });
    return res.product;
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "تعذر تحديث المخزون");
  }
}

export async function deleteOrder(token: string, orderId: string): Promise<void> {
  try {
    await api(`/delivery-hub/orders/${orderId}`, {
      method: "DELETE",
      token,
    });
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "تعذر حذف الطلب");
  }
}

export type NewOrderInput = {
  store_id: string;
  customer_name: string;
  customer_phone: string;
  address?: string;
  notes?: string;
  lat?: number | null;
  lng?: number | null;
  items: { product_id: string | null; title: string; price: number; quantity: number }[];
};

export async function placeOrder(input: NewOrderInput): Promise<string> {
  // Use public backend endpoint (for public client access)
  try {
    const res = await fetch("/api/delivery-hub/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new DeliveryHubError("فشل إنشاء الطلب");
    const data = await res.json();
    return data.order_id;
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "فشل إنشاء الطلب");
  }
}

// ---------------------------------------------------------------------------
// Order messages (chat)
// ---------------------------------------------------------------------------
export async function fetchOrderMessages(orderId: string): Promise<OrderMessage[]> {
  // Use public backend endpoint to bypass RLS
  try {
    const res = await fetch(`/api/delivery-hub/orders/${orderId}/messages`);
    if (!res.ok) throw new DeliveryHubError("فشل في تحميل الرسائل");
    const data = await res.json();
    return data.messages as OrderMessage[];
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "فشل في تحميل الرسائل");
  }
}

export async function sendOrderMessage(
  orderId: string,
  sender: "customer" | "merchant",
  message: string
): Promise<void> {
  // Use public backend endpoint to bypass RLS
  try {
    const res = await fetch(`/api/delivery-hub/orders/${orderId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender, message }),
    });
    if (!res.ok) throw new DeliveryHubError("فشل إرسال الرسالة");
  } catch (e) {
    throw new DeliveryHubError(e instanceof Error ? e.message : "فشل إرسال الرسالة");
  }
}

// ---------------------------------------------------------------------------
// Polling functions (replaces Realtime subscriptions)
// ---------------------------------------------------------------------------
export function pollStoreOrders(
  storeId: string,
  handlers: { onInsert?: (order: Order) => void; onUpdate?: (order: Order) => void },
  intervalMs: number = 30000
): () => void {
  let lastOrders: Order[] = [];
  
  const interval = setInterval(async () => {
    try {
      const orders = await fetchOrders(storeId);
      
      // Check for new orders
      if (handlers.onInsert) {
        const newOrders = orders.filter(o => !lastOrders.find(lo => lo.id === o.id));
        newOrders.forEach(handlers.onInsert);
      }
      
      // Check for updated orders
      if (handlers.onUpdate) {
        orders.forEach(order => {
          const lastOrder = lastOrders.find(lo => lo.id === order.id);
          if (lastOrder && lastOrder.status !== order.status) {
            handlers.onUpdate!(order);
          }
        });
      }
      
      lastOrders = orders;
    } catch (error) {
      console.error("[pollStoreOrders] Error:", error);
    }
  }, intervalMs);
  
  return () => clearInterval(interval);
}

export function pollOrder(orderId: string, onUpdate: (order: Order) => void, intervalMs: number = 30000): () => void {
  let lastStatus: string | null = null;
  
  const interval = setInterval(async () => {
    try {
      const order = await fetchOrderById(orderId);
      if (order && lastStatus !== null && order.status !== lastStatus) {
        onUpdate(order);
      }
      if (order) lastStatus = order.status;
    } catch (error) {
      console.error("[pollOrder] Error:", error);
    }
  }, intervalMs);
  
  return () => clearInterval(interval);
}

export function pollOrderMessages(orderId: string, onInsert: (message: OrderMessage) => void, intervalMs: number = 30000): () => void {
  let lastMessages: OrderMessage[] = [];
  
  const interval = setInterval(async () => {
    try {
      const messages = await fetchOrderMessages(orderId);
      
      const newMessages = messages.filter(m => !lastMessages.find(lm => lm.id === m.id));
      newMessages.forEach(onInsert);
      
      lastMessages = messages;
    } catch (error) {
      console.error("[pollOrderMessages] Error:", error);
    }
  }, intervalMs);
  
  return () => clearInterval(interval);
}

export type OrderItemInput = OrderItem;

// ---------------------------------------------------------------------------
// Stock Management
// ---------------------------------------------------------------------------
export async function getStockAlerts(storeId: string): Promise<StockAlert[]> {
  try {
    const res = await fetch(`/api/delivery-hub/products/public?store_id=${storeId}`);
    if (!res.ok) throw new DeliveryHubError("فشل في تحميل المنتجات");
    const data = await res.json();
    const products = data.products as { id: string; title: string; sku: string | null; stock_quantity: number; low_stock_threshold: number }[];
    
    if (!products || products.length === 0) {
      console.log("No products found for store:", storeId);
      return [];
    }

    console.log("Products fetched:", products.length);
    
    const alerts = products
      .map((p) => {
        const quantity = p.stock_quantity ?? 0;
        const threshold = p.low_stock_threshold ?? 5;
        const status: "low" | "out" | "ok" = quantity === 0 ? "out" : quantity <= threshold ? "low" : "ok";
        
        return {
          product_id: p.id,
          product_title: p.title,
          product_sku: p.sku,
          current_quantity: quantity,
          low_stock_threshold: threshold,
          status,
        };
      })
      .filter((p) => p.status === "out" || p.status === "low"); // Only show products with alerts
    
    console.log("Stock alerts calculated:", alerts.length);
    return alerts;
  } catch (err) {
    console.error("Error in getStockAlerts:", err);
    throw err;
  }
}

export async function exportProductsToExcel(storeId: string): Promise<Blob> {
  const products = await fetchProducts(storeId);
  const headers = ["العنوان", "الفئة", "السعر", "السعر الأصلي", "الكمية", "حد الطلب المنخفض", "الوصف", "رابط الصورة", "رابط الفيديو"];
  const rows = products.map((p) => [
    p.title,
    p.category || "",
    p.price,
    p.original_price || "",
    p.stock_quantity,
    p.low_stock_threshold,
    p.description || "",
    p.image_url || "",
    p.video_url || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  return new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
}

export async function importProductsFromCSV(
  token: string,
  storeId: string,
  file: File
): Promise<{ success: number; errors: string[] }> {
  const text = await file.text();
  const lines = text.split("\n").filter((line) => line.trim());
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

  const titleIndex = headers.findIndex((h) => h.includes("العنوان") || h.toLowerCase().includes("title"));
  const categoryIndex = headers.findIndex((h) => h.includes("الفئة") || h.toLowerCase().includes("category"));
  const priceIndex = headers.findIndex((h) => h.includes("السعر") || h.toLowerCase().includes("price"));
  const originalPriceIndex = headers.findIndex((h) => h.includes("الأصلي") || h.toLowerCase().includes("original"));
  const quantityIndex = headers.findIndex((h) => h.includes("الكمية") || h.toLowerCase().includes("quantity"));
  const thresholdIndex = headers.findIndex((h) => h.includes("الحد") || h.toLowerCase().includes("threshold"));
  const descriptionIndex = headers.findIndex((h) => h.includes("الوصف") || h.toLowerCase().includes("description"));
  const imageIndex = headers.findIndex((h) => h.includes("الصورة") || h.toLowerCase().includes("image"));
  const videoIndex = headers.findIndex((h) => h.includes("الفيديو") || h.toLowerCase().includes("video"));

  let success = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
      
      const title = values[titleIndex] || "";
      if (!title) {
        errors.push(`السطر ${i + 1}: العنوان مطلوب`);
        continue;
      }

      const product: Partial<Product> & { store_id: string } = {
        store_id: storeId,
        title,
        category: categoryIndex >= 0 ? values[categoryIndex] : "عام",
        price: priceIndex >= 0 ? parseFloat(values[priceIndex]) || 0 : 0,
        original_price: originalPriceIndex >= 0 ? parseFloat(values[originalPriceIndex]) || null : null,
        stock_quantity: quantityIndex >= 0 ? parseInt(values[quantityIndex]) || 0 : 0,
        low_stock_threshold: thresholdIndex >= 0 ? parseInt(values[thresholdIndex]) || 5 : 5,
        description: descriptionIndex >= 0 ? values[descriptionIndex] : null,
        image_url: imageIndex >= 0 ? values[imageIndex] : null,
        video_url: videoIndex >= 0 ? values[videoIndex] : null,
        in_stock: true,
        sort_order: 0,
      };

      await upsertProduct(token, product);
      success++;
    } catch (e) {
      errors.push(`السطر ${i + 1}: ${e instanceof Error ? e.message : "خطأ غير معروف"}`);
    }
  }

  return { success, errors };
}

export async function exportProductsToPDF(storeId: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");
  
  const products = await fetchProducts(storeId);
  const doc = new jsPDF();
  
  doc.setFont("helvetica");
  doc.setFontSize(18);
  doc.text("Product Inventory", 14, 22);
  
  doc.setFontSize(11);
  doc.text(`Store: ${storeId}`, 14, 30);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);
  
  const tableData = products.map((p) => [
    p.title,
    p.category || "-",
    `${p.price} DH`,
    p.stock_quantity.toString(),
    p.low_stock_threshold.toString(),
  ]);
  
  autoTable(doc, {
    startY: 45,
    head: [["Title", "Category", "Price", "Stock", "Low Stock Alert"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [124, 58, 237] },
    styles: { fontSize: 9 },
  });
  
  return doc.output("blob");
}
