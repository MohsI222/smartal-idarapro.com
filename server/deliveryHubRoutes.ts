import type express from "express";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";

/**
 * مسارات قسم رادار الطلبات والتوصيل (Delivery Hub) على الخادم الموثوق.
 *
 * لماذا هذا الملف ضروري: جداول Supabase الخاصة بالقسم (stores/products/orders)
 * محمية بسياسات RLS تشترط `auth.uid() = user_id` لعمليات المالك (إنشاء/تعديل/
 * حذف المتجر والمنتجات، وتحديث حالة الطلب). لكن حسابات هذا التطبيق (بما فيها
 * حساب الأدمن/المالك) تُصادَق عبر نظام JWT خاص بالتطبيق وليس بالضرورة عبر
 * جلسة Supabase Auth حقيقية — فتفشل هذه العمليات لمن لا يملك جلسة كهذه.
 *
 * الحل: هذه المسارات تُدار عبر هذا الخادم فقط (اتصاله بقاعدة البيانات يتجاوز
 * RLS)، وتتحقق من الملكية بنفسها عبر `owner_id` داخلي مربوط بمعرّف مستخدم
 * التطبيق (`delivery_hub_owners`، أنشئ تلقائياً في server/schema.sql).
 *
 * القراءة العامة (واجهة المتجر للعميل، تتبع الطلب، الدردشة) تبقى كما هي عبر
 * Supabase مباشرة من العميل (سياسات RLS العامة already تسمح بها) — لا علاقة
 * لها بهذا الملف.
 */

type Req = express.Request & { userId: string };

async function getOrCreateOwnerId(userId: string): Promise<string> {
  console.log("[getOrCreateOwnerId] Creating/Getting owner for user:", userId);
  const existing = await db.prepare(`SELECT owner_id FROM delivery_hub_owners WHERE app_user_id = ?`).get<{
    owner_id: string;
  }>(userId);
  if (existing) {
    console.log("[getOrCreateOwnerId] Found existing owner:", existing.owner_id);
    return existing.owner_id;
  }

  console.log("[getOrCreateOwnerId] Creating new owner for user:", userId);
  const ownerId = randomUUID();
  try {
    await db
      .prepare(`INSERT INTO delivery_hub_owners (app_user_id, owner_id) VALUES (?, ?) ON CONFLICT (app_user_id) DO NOTHING`)
      .run(userId, ownerId);
    console.log("[getOrCreateOwnerId] Inserted owner record:", ownerId);
  } catch (insertErr) {
    console.error("[getOrCreateOwnerId] Insert error:", insertErr);
    throw insertErr;
  }

  const row = await db.prepare(`SELECT owner_id FROM delivery_hub_owners WHERE app_user_id = ?`).get<{
    owner_id: string;
  }>(userId);
  if (!row) {
    console.error("[getOrCreateOwnerId] Failed to retrieve owner after insert");
    throw new Error("تعذر إنشاء معرّف المالك لقسم رادار الطلبات والتوصيل");
  }
  console.log("[getOrCreateOwnerId] Successfully retrieved owner:", row.owner_id);
  return row.owner_id;
}

const FALLBACK_IMAGES = {
  product1: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=60",
  product2: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=60",
  product3: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=800&q=60",
  banner: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=60",
};

async function ensureStoreForOwner(ownerId: string) {
  console.log("[ensureStoreForOwner] Checking for existing store for owner:", ownerId);
  const existing = await db
    .prepare(`SELECT * FROM public.delivery_hub_stores WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`)
    .get(ownerId);
  if (existing) {
    console.log("[ensureStoreForOwner] Found existing store:", existing.id);
    return existing;
  }

  console.log("[ensureStoreForOwner] Creating new store for owner:", ownerId);
  let slug = "demo-store";
  const taken = await db.prepare(`SELECT id FROM public.delivery_hub_stores WHERE slug = ?`).get(slug);
  if (taken) slug = `demo-store-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const store = await db
      .prepare(
        `INSERT INTO public.delivery_hub_stores (id, user_id, name, slug, tagline, theme, banner_url, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, true) RETURNING *`
      )
      .get(
        randomUUID(),
        ownerId,
        "متجر التميز والسرعة",
        slug,
        "أسرع توصيل بأفضل جودة 🚀",
        "neon-modern",
        FALLBACK_IMAGES.banner
      );
    if (!store) throw new Error("تعذر إنشاء المتجر التجريبي");

    console.log("[ensureStoreForOwner] Store created successfully:", store.id);

    const demoProducts: [string, string, string, string, number, number | null, string, number][] = [
      [
        randomUUID(),
        "برجر لحم مشوي فاخر",
        "أطباق رئيسية",
        "برجر لحم طازج مع جبنة وصلصة خاصة",
        45,
        60,
        FALLBACK_IMAGES.product1,
        0,
      ],
      [randomUUID(), "بيتزا مارغريتا", "بيتزا", "عجينة رقيقة مع جبنة موزاريلا وصلصة طماطم طازجة", 65, null, FALLBACK_IMAGES.product2, 1],
      [randomUUID(), "عصير طبيعي مثلج", "مشروبات", "عصير فواكه طازج بدون سكر مضاف", 20, 25, FALLBACK_IMAGES.product3, 2],
    ];
    const storeId = (store as { id: string }).id;
    for (const [id, title, category, description, price, originalPrice, imageUrl, sortOrder] of demoProducts) {
      await db
        .prepare(
          `INSERT INTO public.delivery_hub_products (id, store_id, title, category, description, price, original_price, image_url, in_stock, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, ?)`
        )
        .run(id, storeId, title, category, description, price, originalPrice, imageUrl, sortOrder);
    }
    console.log("[ensureStoreForOwner] Demo products created successfully");
    return store;
  } catch (createErr) {
    console.error("[ensureStoreForOwner] Error creating store:", createErr);
    // Fallback: return the demo store if creation fails
    console.log("[ensureStoreForOwner] Falling back to demo store");
    const demoStore = await db
      .prepare(`SELECT * FROM public.delivery_hub_stores WHERE slug = 'demo-store'`)
      .get();
    if (demoStore) {
      console.log("[ensureStoreForOwner] Using demo store as fallback:", demoStore.id);
      return demoStore;
    }
    throw createErr;
  }
}

export function registerDeliveryHubRoutes(app: express.Application, authMiddleware: express.RequestHandler) {
  app.get("/api/delivery-hub/store", authMiddleware, async (req, res) => {
    try {
      const userId = (req as Req).userId;
      const ownerId = await getOrCreateOwnerId(userId);
      const store = await ensureStoreForOwner(ownerId);
      res.json({ store });
    } catch (error) {
      console.error("[delivery-hub/store] Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "فشل تحميل المتجر" });
    }
  });

  app.put("/api/delivery-hub/store", authMiddleware, async (req, res) => {
    try {
      const userId = (req as Req).userId;
      const ownerId = await getOrCreateOwnerId(userId);
      const b = req.body as Record<string, unknown>;
      
      // Validate field lengths
      if (b.name && typeof b.name === 'string' && b.name.length > 500) {
        res.status(400).json({ error: "اسم المتجر طويل جداً (الحد الأقصى 500 حرف)" });
        return;
      }
      if (b.tagline && typeof b.tagline === 'string' && b.tagline.length > 1000) {
        res.status(400).json({ error: "الشعار طويل جداً (الحد الأقصى 1000 حرف)" });
        return;
      }
      if (b.slug && typeof b.slug === 'string' && b.slug.length > 200) {
        res.status(400).json({ error: "الرابط المختصر طويل جداً (الحد الأقصى 200 حرف)" });
        return;
      }
      if (b.phone && typeof b.phone === 'string' && b.phone.length > 50) {
        res.status(400).json({ error: "رقم الهاتف طويل جداً (الحد الأقصى 50 حرف)" });
        return;
      }
      if (b.whatsapp && typeof b.whatsapp === 'string' && b.whatsapp.length > 50) {
        res.status(400).json({ error: "رقم الواتساب طويل جداً (الحد الأقصى 50 حرف)" });
        return;
      }
      // Validate social media URL lengths
      if (b.facebook_url && typeof b.facebook_url === 'string' && b.facebook_url.length > 500) {
        res.status(400).json({ error: "رابط فيسبوك طويل جداً (الحد الأقصى 500 حرف)" });
        return;
      }
      if (b.instagram_url && typeof b.instagram_url === 'string' && b.instagram_url.length > 500) {
        res.status(400).json({ error: "رابط إنستغرام طويل جداً (الحد الأقصى 500 حرف)" });
        return;
      }
      if (b.tiktok_url && typeof b.tiktok_url === 'string' && b.tiktok_url.length > 500) {
        res.status(400).json({ error: "رابط تيك توك طويل جداً (الحد الأقصى 500 حرف)" });
        return;
      }
      if (b.youtube_url && typeof b.youtube_url === 'string' && b.youtube_url.length > 500) {
        res.status(400).json({ error: "رابط يوتيوب طويل جداً (الحد الأقصى 500 حرف)" });
        return;
      }
      // Validate custom domain length and format
      if (b.custom_domain && typeof b.custom_domain === 'string') {
        if (b.custom_domain.length > 255) {
          res.status(400).json({ error: "الدومين المخصص طويل جداً (الحد الأقصى 255 حرف)" });
          return;
        }
        // Basic domain validation (no protocol, no www prefix)
        const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (!domainPattern.test(b.custom_domain.trim())) {
          res.status(400).json({ error: "صيغة الدومين المخصص غير صحيحة (استخدم مثال: mystore.com)" });
          return;
        }
      }
      // Validate video URL length (Base64 videos can be very large)
      if (b.promo_video_url && typeof b.promo_video_url === 'string' && b.promo_video_url.length > 10000000) {
        res.status(400).json({ error: "رابط الفيديو طويل جداً - يرجى استخدام رابط خارجي أو ملف أصغر" });
        return;
      }
      // Validate logo/banner URL length
      if (b.logo_url && typeof b.logo_url === 'string' && b.logo_url.length > 1000000) {
        res.status(400).json({ error: "رابط الشعار طويل جداً - يرجى استخدام صورة أصغر" });
        return;
      }
      if (b.banner_url && typeof b.banner_url === 'string' && b.banner_url.length > 1000000) {
        res.status(400).json({ error: "رابط البانر طويل جداً - يرجى استخدام صورة أصغر" });
        return;
      }
      
      const allowed = [
        "name",
        "slug",
        "tagline",
        "logo_url",
        "banner_url",
        "promo_video_url",
        "theme",
        "phone",
        "whatsapp",
        "facebook_url",
        "instagram_url",
        "tiktok_url",
        "youtube_url",
        "custom_domain",
        "is_active",
      ] as const;
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const key of allowed) {
        if (key in b) {
          sets.push(`${key} = ?`);
          values.push(b[key]);
        }
      }
      if (sets.length === 0) {
        res.status(400).json({ error: "لا توجد بيانات للتحديث" });
        return;
      }
      values.push(ownerId);
      const store = await db
        .prepare(`UPDATE public.delivery_hub_stores SET ${sets.join(", ")} WHERE user_id = ? RETURNING *`)
        .get(...values);
      if (!store) {
        res.status(404).json({ error: "المتجر غير موجود" });
        return;
      }
      res.json({ store });
    } catch (error) {
      console.error("[Delivery Hub] Error updating store:", error);
      if (error instanceof Error) {
        // Check for specific database errors
        if (error.message.includes('UNIQUE constraint') || error.message.includes('duplicate key')) {
          res.status(400).json({ error: "الرابط المختصر (slug) مستخدم مسبقاً" });
          return;
        }
        if (error.message.includes('string too long') || error.message.includes('value too long')) {
          res.status(400).json({ error: "بعض الحقول طويلة جداً" });
          return;
        }
      }
      res.status(500).json({ error: "حدث خطأ في الخادم أثناء حفظ البيانات" });
    }
  });

  // GET /api/delivery-hub/products - Fetch products for a store (bypasses RLS for logged-in users)
  app.get("/api/delivery-hub/products", authMiddleware, async (req, res) => {
    try {
      const userId = (req as Req).userId;
      const ownerId = await getOrCreateOwnerId(userId);
      const storeId = req.query.store_id as string;

      if (!storeId) {
        res.status(400).json({ error: "store_id is required" });
        return;
      }

      // Verify the store belongs to this owner
      const owned = await db
        .prepare(`SELECT id FROM public.delivery_hub_stores WHERE id = ? AND user_id = ?`)
        .get(storeId, ownerId);

      if (!owned) {
        res.status(403).json({ error: "لا تملك هذا المتجر" });
        return;
      }

      const products = await db.prepare(`
        SELECT * FROM public.delivery_hub_products 
        WHERE store_id = ? 
        ORDER BY sort_order ASC
      `).all(storeId);

      res.json({ products: products || [] });
    } catch (error) {
      console.error("[delivery-hub/products GET] Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "فشل تحميل المنتجات" });
    }
  });

  app.post("/api/delivery-hub/products", authMiddleware, async (req, res) => {
    const userId = (req as Req).userId;
    const ownerId = await getOrCreateOwnerId(userId);
    const b = req.body as {
      store_id: string;
      title: string;
      category?: string;
      description?: string;
      price?: number;
      original_price?: number | null;
      image_url?: string;
      video_url?: string;
      in_stock?: boolean;
      sort_order?: number;
      sku?: string | null;
      stock_quantity?: number;
      low_stock_threshold?: number;
    };
    const owned = await db
      .prepare(`SELECT id FROM public.delivery_hub_stores WHERE id = ? AND user_id = ?`)
      .get(b.store_id, ownerId);
    if (!owned) {
      res.status(403).json({ error: "لا تملك هذا المتجر" });
      return;
    }
    if (!b.title?.trim()) {
      res.status(400).json({ error: "اسم المنتج مطلوب" });
      return;
    }
    const id = randomUUID();
    const product = await db
      .prepare(
        `INSERT INTO public.delivery_hub_products (id, store_id, title, category, description, price, original_price, image_url, video_url, in_stock, sort_order, sku, stock_quantity, low_stock_threshold)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
      )
      .get(
        id,
        b.store_id,
        b.title.trim(),
        b.category ?? "عام",
        b.description ?? null,
        b.price ?? 0,
        b.original_price ?? null,
        b.image_url ?? null,
        b.video_url ?? null,
        b.in_stock ?? true,
        b.sort_order ?? 0,
        b.sku ?? null,
        b.stock_quantity ?? 0,
        b.low_stock_threshold ?? 5
      );
    res.json({ product });
  });

  app.patch("/api/delivery-hub/products/:id", authMiddleware, async (req, res) => {
    const userId = (req as Req).userId;
    const ownerId = await getOrCreateOwnerId(userId);
    const productId = String(req.params.id);
    const b = req.body as Record<string, unknown>;
    const allowed = [
      "title",
      "category",
      "description",
      "price",
      "original_price",
      "image_url",
      "video_url",
      "in_stock",
      "sort_order",
      "sku",
      "stock_quantity",
      "low_stock_threshold",
    ] as const;
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      if (key in b) {
        sets.push(`${key} = ?`);
        values.push(b[key]);
      }
    }
    if (sets.length === 0) {
      res.status(400).json({ error: "لا توجد بيانات للتحديث" });
      return;
    }
    values.push(productId, ownerId);
    const product = await db
      .prepare(
        `UPDATE public.delivery_hub_products SET ${sets.join(", ")}
         WHERE id = ? AND store_id IN (SELECT id FROM public.delivery_hub_stores WHERE user_id = ?)
         RETURNING *`
      )
      .get(...values);
    if (!product) {
      res.status(404).json({ error: "المنتج غير موجود أو لا تملكه" });
      return;
    }
    res.json({ product });
  });

  app.delete("/api/delivery-hub/products/:id", authMiddleware, async (req, res) => {
    const userId = (req as Req).userId;
    const ownerId = await getOrCreateOwnerId(userId);
    const productId = String(req.params.id);
    const r = await db
      .prepare(
        `DELETE FROM public.delivery_hub_products WHERE id = ? AND store_id IN (SELECT id FROM public.delivery_hub_stores WHERE user_id = ?)`
      )
      .run(productId, ownerId);
    if (r.changes === 0) {
      res.status(404).json({ error: "المنتج غير موجود أو لا تملكه" });
      return;
    }
    res.json({ ok: true });
  });

  app.patch("/api/delivery-hub/orders/:id/status", authMiddleware, async (req, res) => {
    const userId = (req as Req).userId;
    const ownerId = await getOrCreateOwnerId(userId);
    const orderId = String(req.params.id);
    const status = String((req.body as { status?: string })?.status ?? "");
    const validStatuses = ["pending", "preparing", "delivering", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: "حالة غير صالحة" });
      return;
    }
    const r = await db
      .prepare(
        `UPDATE public.delivery_hub_orders SET status = ?
         WHERE id = ? AND store_id IN (SELECT id FROM public.delivery_hub_stores WHERE user_id = ?)`
      )
      .run(status, orderId, ownerId);
    if (r.changes === 0) {
      res.status(404).json({ error: "الطلب غير موجود أو لا تملكه" });
      return;
    }
    res.json({ ok: true });
  });

  // Stock Management Routes
  app.patch("/api/delivery-hub/products/:id/stock", authMiddleware, async (req, res) => {
    const userId = (req as Req).userId;
    const ownerId = await getOrCreateOwnerId(userId);
    const productId = String(req.params.id);
    const b = req.body as { stock_quantity?: number; low_stock_threshold?: number };
    
    const sets: string[] = [];
    const values: unknown[] = [];
    
    if (typeof b.stock_quantity === "number") {
      sets.push("stock_quantity = ?");
      values.push(b.stock_quantity);
    }
    if (typeof b.low_stock_threshold === "number") {
      sets.push("low_stock_threshold = ?");
      values.push(b.low_stock_threshold);
    }
    
    if (sets.length === 0) {
      res.status(400).json({ error: "لا توجد بيانات للتحديث" });
      return;
    }
    
    values.push(productId, ownerId);
    const product = await db
      .prepare(
        `UPDATE public.delivery_hub_products SET ${sets.join(", ")}
         WHERE id = ? AND store_id IN (SELECT id FROM public.delivery_hub_stores WHERE user_id = ?)
         RETURNING *`
      )
      .get(...values);
    
    if (!product) {
      res.status(404).json({ error: "المنتج غير موجود أو لا تملكه" });
      return;
    }
    
    res.json({ product });
  });

  // Reset stock quantities to realistic values (for testing/demo purposes)
  app.post("/api/delivery-hub/reset-stock", authMiddleware, async (req, res) => {
    const userId = (req as Req).userId;
    const ownerId = await getOrCreateOwnerId(userId);
    
    // Get all products for this owner
    const products = await db.prepare(`
      SELECT id FROM public.delivery_hub_products 
      WHERE store_id IN (SELECT id FROM public.delivery_hub_stores WHERE user_id = ?)
    `).all(ownerId);
    
    if (!products || products.length === 0) {
      res.json({ message: "No products found", updated: 0 });
      return;
    }
    
    // Update each product with a random realistic stock quantity (10-50)
    let updated = 0;
    for (const product of products) {
      const randomStock = Math.floor(Math.random() * 40) + 10; // 10-50
      const randomThreshold = Math.floor(Math.random() * 5) + 3; // 3-8
      await db.prepare(`
        UPDATE public.delivery_hub_products 
        SET stock_quantity = ?, low_stock_threshold = ?
        WHERE id = ?
      `).run(randomStock, randomThreshold, (product as { id: string }).id);
      updated++;
    }
    
    res.json({ message: `Updated ${updated} products with realistic stock values`, updated });
  });

  app.post("/api/delivery-hub/products/batch", authMiddleware, async (req, res) => {
    const userId = (req as Req).userId;
    const ownerId = await getOrCreateOwnerId(userId);
    const b = req.body as { store_id: string; products: Array<{ id?: string; title: string; category?: string; description?: string; price?: number; original_price?: number | null; image_url?: string; video_url?: string; in_stock?: boolean; sort_order?: number; stock_quantity?: number; low_stock_threshold?: number }> };
    
    if (!b.store_id) {
      res.status(400).json({ error: "معرف المتجر مطلوب" });
      return;
    }
    
    const owned = await db
      .prepare(`SELECT id FROM public.delivery_hub_stores WHERE id = ? AND user_id = ?`)
      .get(b.store_id, ownerId);
    if (!owned) {
      res.status(403).json({ error: "لا تملك هذا المتجر" });
      return;
    }
    
    if (!Array.isArray(b.products) || b.products.length === 0) {
      res.status(400).json({ error: "قائمة المنتجات مطلوبة" });
      return;
    }
    
    const results = [];
    const errors = [];
    
    for (const productData of b.products) {
      try {
        if (!productData.title?.trim()) {
          errors.push({ title: productData.title, error: "العنوان مطلوب" });
          continue;
        }
        
        const id = productData.id || randomUUID();
        const product = await db
          .prepare(
            `INSERT INTO public.delivery_hub_products (id, store_id, title, category, description, price, original_price, image_url, video_url, in_stock, sort_order, stock_quantity, low_stock_threshold)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET
               title = excluded.title,
               category = excluded.category,
               description = excluded.description,
               price = excluded.price,
               original_price = excluded.original_price,
               image_url = excluded.image_url,
               video_url = excluded.video_url,
               in_stock = excluded.in_stock,
               sort_order = excluded.sort_order,
               stock_quantity = excluded.stock_quantity,
               low_stock_threshold = excluded.low_stock_threshold
             RETURNING *`
          )
          .get(
            id,
            b.store_id,
            productData.title.trim(),
            productData.category ?? "عام",
            productData.description ?? null,
            productData.price ?? 0,
            productData.original_price ?? null,
            productData.image_url ?? null,
            productData.video_url ?? null,
            productData.in_stock ?? true,
            productData.sort_order ?? 0,
            productData.stock_quantity ?? 0,
            productData.low_stock_threshold ?? 5
          );
        
        results.push(product);
      } catch (e) {
        errors.push({ title: productData.title, error: e instanceof Error ? e.message : "خطأ غير معروف" });
      }
    }
    
    res.json({ success: results.length, errors, products: results });
  });

  // Fetch orders via backend to bypass RLS
  app.get("/api/delivery-hub/orders", authMiddleware, async (req, res) => {
    const userId = (req as Req).userId;
    const ownerId = await getOrCreateOwnerId(userId);
    const storeId = String(req.query.store_id || "");
    
    if (!storeId) {
      res.status(400).json({ error: "معرف المتجر مطلوب" });
      return;
    }
    
    // Verify ownership
    const owned = await db
      .prepare(`SELECT id FROM public.delivery_hub_stores WHERE id = ? AND user_id = ?`)
      .get(storeId, ownerId);
    if (!owned) {
      res.status(403).json({ error: "لا تملك هذا المتجر" });
      return;
    }
    
    // Fetch orders with items
    const orders = await db.prepare(`
      SELECT 
        o.id,
        o.store_id,
        o.customer_name,
        o.customer_phone,
        o.address,
        o.notes,
        o.lat,
        o.lng,
        o.status,
        o.created_at,
        CAST(o.total AS REAL) as total,
        json_agg(
          json_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'product_id', oi.product_id,
            'title', oi.title,
            'price', CAST(oi.price AS REAL),
            'quantity', oi.quantity
          )
        ) as order_items
      FROM public.delivery_hub_orders o
      LEFT JOIN public.delivery_hub_order_items oi ON o.id = oi.order_id
      WHERE o.store_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).all(storeId);
    
    res.json({ orders: orders || [] });
  });

  // Create order via backend to bypass RLS (for public client access)
  app.post("/api/delivery-hub/orders", async (req, res) => {
    try {
      const b = req.body as {
        store_id: string;
        customer_name: string;
        customer_phone: string;
        address?: string;
        notes?: string;
        lat?: number | null;
        lng?: number | null;
        items: { product_id: string | null; title: string; price: number; quantity: number }[];
      };

      if (!b.store_id || !b.customer_name || !b.customer_phone) {
        res.status(400).json({ error: "البيانات المطلوبة ناقصة" });
        return;
      }

      if (!Array.isArray(b.items) || b.items.length === 0) {
        res.status(400).json({ error: "الطلب يجب أن يحتوي على منتج واحد على الأقل" });
        return;
      }

      // Validate product IDs exist
      const productIds = b.items.map(item => item.product_id).filter(id => id !== null) as string[];
      if (productIds.length > 0) {
        const existingProducts = await db.prepare(`
          SELECT id FROM public.delivery_hub_products WHERE id IN (${productIds.map(() => '?').join(',')})
        `).all(...productIds);
        const existingIds = new Set((existingProducts || []).map((p: any) => p.id));
        const invalidItems = b.items.filter(item => item.product_id && !existingIds.has(item.product_id));
        if (invalidItems.length > 0) {
          res.status(400).json({ error: "بعض المنتجات لم تعد متوفرة" });
          return;
        }
      }

      const total = b.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
      const orderId = randomUUID();

      await db.prepare(`
        INSERT INTO public.delivery_hub_orders (id, store_id, customer_name, customer_phone, address, notes, lat, lng, total, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(orderId, b.store_id, b.customer_name, b.customer_phone, b.address || null, b.notes || null, b.lat || null, b.lng || null, total);

      for (const item of b.items) {
        const itemId = randomUUID();
        await db.prepare(`
          INSERT INTO public.delivery_hub_order_items (id, order_id, product_id, title, price, quantity)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(itemId, orderId, item.product_id, item.title, item.price, item.quantity);
      }

      res.json({ order_id: orderId });
    } catch (error) {
      console.error("[Delivery Hub] Error creating order:", error);
      res.status(500).json({ error: "فشل إنشاء الطلب" });
    }
  });

  // Public endpoint to fetch order by ID (for order tracking page - no auth required)
  app.get("/api/delivery-hub/orders/:id", async (req, res) => {
    try {
      const orderId = String(req.params.id);
      
      const order = await db.prepare(`
        SELECT 
          o.id,
          o.store_id,
          s.slug as store_slug,
          o.customer_name,
          o.customer_phone,
          o.address,
          o.notes,
          o.lat,
          o.lng,
          o.status,
          o.created_at,
          CAST(o.total AS REAL) as total,
          json_agg(
            json_build_object(
              'id', oi.id,
              'order_id', oi.order_id,
              'product_id', oi.product_id,
              'title', oi.title,
              'price', CAST(oi.price AS REAL),
              'quantity', oi.quantity
            )
          ) as order_items
        FROM public.delivery_hub_orders o
        LEFT JOIN public.delivery_hub_stores s ON o.store_id = s.id
        LEFT JOIN public.delivery_hub_order_items oi ON o.id = oi.order_id
        WHERE o.id = ?
        GROUP BY o.id, s.slug
      `).get(orderId);
      
      if (!order) {
        res.status(404).json({ error: "الطلب غير موجود" });
        return;
      }
      
      res.json({ order });
    } catch (error) {
      console.error("[Delivery Hub] Error fetching order:", error);
      res.status(500).json({ error: "فشل تحميل الطلب" });
    }
  });

  // Public endpoint to fetch order messages (for order tracking page - no auth required)
  app.get("/api/delivery-hub/orders/:id/messages", async (req, res) => {
    try {
      const orderId = String(req.params.id);
      
      const messages = await db.prepare(`
        SELECT * FROM public.delivery_hub_order_messages
        WHERE order_id = ?
        ORDER BY created_at ASC
      `).all(orderId);
      
      res.json({ messages: messages || [] });
    } catch (error) {
      console.error("[Delivery Hub] Error fetching order messages:", error);
      res.status(500).json({ error: "فشل تحميل الرسائل" });
    }
  });

  // Public endpoint to send order message (for order tracking page - no auth required)
  app.post("/api/delivery-hub/orders/:id/messages", async (req, res) => {
    try {
      const orderId = String(req.params.id);
      const b = req.body as { sender: "customer" | "merchant"; message: string };
      
      if (!b.sender || !b.message?.trim()) {
        res.status(400).json({ error: "البيانات المطلوبة ناقصة" });
        return;
      }
      
      const messageId = randomUUID();
      await db.prepare(`
        INSERT INTO public.delivery_hub_order_messages (id, order_id, sender, message)
        VALUES (?, ?, ?, ?)
      `).run(messageId, orderId, b.sender, b.message.trim());
      
      res.json({ message_id: messageId });
    } catch (error) {
      console.error("[Delivery Hub] Error sending order message:", error);
      res.status(500).json({ error: "فشل إرسال الرسالة" });
    }
  });

  // Delete order (for completed/cancelled orders cleanup)
  app.delete("/api/delivery-hub/orders/:id", authMiddleware, async (req, res) => {
    try {
      const userId = (req as Req).userId;
      const ownerId = await getOrCreateOwnerId(userId);
      const orderId = String(req.params.id);
      
      // Verify order ownership
      const order = await db.prepare(`
        SELECT o.id, o.store_id
        FROM public.delivery_hub_orders o
        INNER JOIN public.delivery_hub_stores s ON o.store_id = s.id
        WHERE o.id = ? AND s.user_id = ?
      `).get(orderId, ownerId);
      
      if (!order) {
        res.status(404).json({ error: "الطلب غير موجود" });
        return;
      }
      
      // Delete order items first
      await db.prepare(`DELETE FROM public.delivery_hub_order_items WHERE order_id = ?`).run(orderId);
      
      // Delete order messages
      await db.prepare(`DELETE FROM public.delivery_hub_order_messages WHERE order_id = ?`).run(orderId);
      
      // Delete order
      await db.prepare(`DELETE FROM public.delivery_hub_orders WHERE id = ?`).run(orderId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Delivery Hub] Error deleting order:", error);
      res.status(500).json({ error: "فشل حذف الطلب" });
    }
  });
}
