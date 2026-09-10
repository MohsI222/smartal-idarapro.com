/** صفحة المتجر العامة للزبون — /m/:storeSlug */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Phone,
  MessageCircle,
  ShoppingCart,
  Search,
  PlayCircle,
  Facebook,
  Instagram,
  Youtube,
  Share2,
} from "lucide-react";
import { fetchProducts, fetchProductsFromBackend, fetchStoreBySlug, ensureStoreForUser } from "@/lib/deliveryHub/api";
import { STORE_THEMES, type Product, type Store } from "@/lib/deliveryHub/types";
import { buildWhatsAppLink } from "@/lib/deliveryHub/whatsapp";
import { CartDrawer, type CartEntry } from "@/components/client/CartDrawer";
import { CheckoutModal } from "@/components/client/CheckoutModal";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

function isVideoSrc(value: string): boolean {
  return value.startsWith("data:video") || /\.(mp4|webm|ogg)(\?.*)?$/i.test(value);
}

function toEmbedVideoUrl(url: string): string {
  // Convert YouTube URLs to embed format
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/,
    /youtube\.com\/shorts\/([\w-]{6,})/,
  ];
  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  }
  return url;
}

export function StoreFront() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("الكل");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (!storeSlug) return;
    let cancelled = false;
    setLoading(true);
    setVideoError(false); // Reset video error on store change
    
    // First try to fetch store by slug (public access)
    fetchStoreBySlug(storeSlug)
      .then(async (s) => {
        if (s) {
          // Store found, load products
          // Use backend for logged-in users to bypass RLS, otherwise use Supabase directly
          const prods = token 
            ? await fetchProductsFromBackend(s.id, token)
            : await fetchProducts(s.id);
          
          if (!cancelled) {
            setStore(s);
            setProducts(prods.filter((p) => p.in_stock));
            
            // Clean up cart - remove items for products that no longer exist or are out of stock
            const validProductIds = new Set(prods.filter(p => p.in_stock).map(p => p.id));
            setCart(prevCart => {
              const cleanedCart = prevCart.filter(entry => validProductIds.has(entry.product.id));
              if (cleanedCart.length < prevCart.length) {
                console.log("Cart cleanup: removed invalid items");
              }
              return cleanedCart;
            });
          }
        } else if (token) {
          // Store not found but user is logged in - try to ensure store exists
          try {
            const userStore = await ensureStoreForUser(token);
            console.log("[StoreFront] User store found:", userStore.slug, "Requested slug:", storeSlug);
            
            // Check if the user's store slug matches the requested slug
            if (userStore.slug === storeSlug) {
              const prods = await fetchProductsFromBackend(userStore.id, token);
              if (!cancelled) {
                setStore(userStore);
                setProducts(prods.filter((p) => p.in_stock));
                
                const validProductIds = new Set(prods.filter(p => p.in_stock).map(p => p.id));
                setCart(prevCart => {
                  const cleanedCart = prevCart.filter(entry => validProductIds.has(entry.product.id));
                  if (cleanedCart.length < prevCart.length) {
                    console.log("Cart cleanup: removed invalid items");
                  }
                  return cleanedCart;
                });
              }
            } else {
              // User's store has different slug, redirect to correct store
              console.log("[StoreFront] Redirecting to correct slug:", userStore.slug);
              if (!cancelled) {
                navigate(`/m/${userStore.slug}`, { replace: true });
              }
            }
          } catch (err) {
            console.error("[StoreFront] Error ensuring store:", err);
            if (!cancelled) setError("المتجر غير موجود أو غير متاح حالياً.");
          }
        } else {
          // Store not found and user is not logged in
          if (!cancelled) setError("المتجر غير موجود أو غير متاح حالياً.");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل المتجر");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeSlug, token, navigate]);

  // Real-time subscription for product changes
  useEffect(() => {
    if (!store || !supabase) return;

    const channel = supabase
      .channel(`products-${store.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_hub_products',
          filter: `store_id=eq.${store.id}`
        },
        async (payload) => {
          console.log('[StoreFront] Product change detected:', payload.eventType, payload.new);
          
          // Refresh products from appropriate source
          try {
            const updatedProducts = token 
              ? await fetchProductsFromBackend(store.id, token)
              : await fetchProducts(store.id);
            
            setProducts(updatedProducts.filter((p) => p.in_stock));
            
            // Clean up cart if needed
            const validProductIds = new Set(updatedProducts.filter(p => p.in_stock).map(p => p.id));
            setCart(prevCart => {
              const cleanedCart = prevCart.filter(entry => validProductIds.has(entry.product.id));
              return cleanedCart;
            });
          } catch (err) {
            console.error('[StoreFront] Error refreshing products:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log('[StoreFront] Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [store, token]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || "عام"));
    return ["الكل", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = category === "الكل" || (p.category || "عام") === category;
      const matchesSearch = !search.trim() || p.title.toLowerCase().includes(search.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, category, search]);

  const theme = STORE_THEMES.find((t) => t.id === store?.theme) ?? STORE_THEMES[0];

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((e) => e.product.id === product.id);
      if (existing) {
        return prev.map((e) => (e.product.id === product.id ? { ...e, quantity: e.quantity + 1 } : e));
      }
      return [...prev, { product, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((prev) => prev.map((e) => (e.product.id === productId ? { ...e, quantity } : e)));
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((e) => e.product.id !== productId));
  }

  function handleOrderPlaced(orderId: string) {
    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
    navigate(`/order-status/${orderId}`);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-slate-300">
        <p>{error}</p>
      </div>
    );
  }

  const cartCount = cart.reduce((sum, e) => sum + e.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white" dir="rtl">
      {/* Hero */}
      <div
        className="relative overflow-hidden px-4 pb-10 pt-8 text-center"
        style={{ background: `linear-gradient(160deg, ${theme.from}, ${theme.to})` }}
      >
        {/* Only show banner if no video is present */}
        {!store.promo_video_url && store.banner_url && (
          <img
            src={store.banner_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        )}
        <div className="relative z-10 mx-auto max-w-2xl space-y-3">
          {store.logo_url && (
            <img src={store.logo_url} alt={store.name} className="mx-auto h-20 w-20 rounded-full border-4 border-white/30 object-cover" />
          )}
          <h1 className="text-3xl font-extrabold">{store.name}</h1>
          {store.tagline && <p className="text-white/90">{store.tagline}</p>}
          <Badge className="bg-emerald-500/90 text-white border-none">مفتوح للطلبات الآن 🟢</Badge>
          {store.promo_video_url && (
            <div className="mx-auto mt-4 max-w-md overflow-hidden rounded-xl border border-white/20 aspect-video">
              {videoError ? (
                <div className="h-full w-full flex flex-col items-center justify-center bg-black/50 p-4 text-center">
                  <p className="text-sm text-white/90 mb-2">فشل تحميل الفيديو</p>
                  <a
                    href={isVideoSrc(store.promo_video_url) ? store.promo_video_url : `https://www.youtube.com/watch?v=${store.promo_video_url.match(/[\w-]{11}/)?.[0]}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-orange-400 hover:text-orange-300"
                  >
                    مشاهدة الفيديو مباشرة
                  </a>
                </div>
              ) : isVideoSrc(store.promo_video_url) ? (
                <video
                  src={store.promo_video_url}
                  controls
                  autoPlay
                  loop
                  muted
                  className="h-full w-full"
                  playsInline
                  onError={() => setVideoError(true)}
                />
              ) : (
                <iframe
                  src={toEmbedVideoUrl(store.promo_video_url)}
                  title="فيديو ترويجي"
                  className="h-full w-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  onError={() => setVideoError(true)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="pr-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${
                category === c ? "border-orange-500 bg-orange-500/20 text-orange-300" : "border-slate-700 text-slate-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.length === 0 ? (
          <p className="col-span-full py-16 text-center text-slate-500">لا توجد منتجات مطابقة</p>
        ) : (
          filtered.map((product) => (
            <div key={product.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col">
              <div className="relative">
                {product.video_url ? (
                  <div className="h-32 w-full sm:h-36 bg-black">
                    {product.video_url.includes('youtube.com') || product.video_url.includes('youtu.be') ? (
                      <iframe
                        src={toEmbedVideoUrl(product.video_url)}
                        className="h-full w-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    ) : (
                      <video
                        src={product.video_url}
                        controls
                        autoPlay
                        loop
                        muted
                        className="h-full w-full object-cover"
                        playsInline
                      />
                    )}
                  </div>
                ) : (
                  <img src={product.image_url ?? undefined} alt={product.title} className="h-32 w-full object-cover sm:h-36" />
                )}
                {product.original_price != null && product.original_price > product.price && (
                  <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold">
                    خصم مميز 🔥
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <p className="line-clamp-1 text-sm font-semibold">{product.title}</p>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="font-bold text-orange-400">{product.price} DH</span>
                  {product.original_price != null && product.original_price > product.price && (
                    <span className="text-xs text-slate-500 line-through">{product.original_price} DH</span>
                  )}
                </div>
                <Button size="sm" className="mt-auto w-full" onClick={() => addToCart(product)}>
                  أطلبه الآن ⚡
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating call / whatsapp */}
      <div className="fixed bottom-24 left-4 z-30 flex flex-col gap-2">
        {store.phone && (
          <a
            href={`tel:${store.phone}`}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 shadow-lg"
          >
            <Phone className="h-5 w-5" />
          </a>
        )}
        {(store.whatsapp || store.phone) && (
          <a
            href={buildWhatsAppLink("+212780290270", `مرحباً، أريد الاستفسار عن الطلب من متجر ${store.name}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 shadow-lg"
          >
            <MessageCircle className="h-5 w-5" />
          </a>
        )}
      </div>

      {/* Floating cart button */}
      <button
        onClick={() => setCartOpen(true)}
        className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-orange-500 px-5 py-3 font-bold shadow-2xl"
      >
        <ShoppingCart className="h-5 w-5" />
        السلة
        {cartCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-orange-600">
            {cartCount}
          </span>
        )}
      </button>

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        entries={cart}
        onQuantityChange={updateQuantity}
        onRemove={removeFromCart}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />
      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        store={store}
        entries={cart}
        onOrderPlaced={handleOrderPlaced}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900 px-4 py-8 text-center">
        {/* Social Media Links */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-slate-400 mb-4">{t("store.footer.followUs")}</p>
          <div className="flex justify-center gap-4">
            {store.facebook_url && (
              <a
                href={store.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-blue-500/50 hover:shadow-2xl"
              >
                <Facebook className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded bg-blue-600 px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                  {t("store.footer.social.facebook")}
                </span>
              </a>
            )}
            {store.instagram_url && (
              <a
                href={store.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-500 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-pink-500/50 hover:shadow-2xl"
              >
                <Instagram className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded bg-pink-600 px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                  {t("store.footer.social.instagram")}
                </span>
              </a>
            )}
            {store.tiktok_url && (
              <a
                href={store.tiktok_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-gray-800 to-black text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-gray-500/50 hover:shadow-2xl"
              >
                <Share2 className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded bg-gray-700 px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                  {t("store.footer.social.tiktok")}
                </span>
              </a>
            )}
            {store.youtube_url && (
              <a
                href={store.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-red-500/50 hover:shadow-2xl"
              >
                <Youtube className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded bg-red-600 px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                  {t("store.footer.social.youtube")}
                </span>
              </a>
            )}
          </div>
        </div>

        {/* Legal Links */}
        <div className="flex flex-wrap justify-center gap-4 mb-4 text-xs text-slate-500">
          <button
            onClick={() => navigate(`/m/${storeSlug}/shipping-policy`)}
            className="hover:text-slate-300 transition-colors"
          >
            {t("store.footer.shippingPolicy")}
          </button>
          <button
            onClick={() => navigate(`/m/${storeSlug}/return-policy`)}
            className="hover:text-slate-300 transition-colors"
          >
            {t("store.footer.returnPolicy")}
          </button>
          <button
            onClick={() => navigate(`/m/${storeSlug}/terms`)}
            className="hover:text-slate-300 transition-colors"
          >
            {t("store.footer.terms")}
          </button>
          <button
            onClick={() => navigate(`/m/${storeSlug}/about`)}
            className="hover:text-slate-300 transition-colors"
          >
            {t("store.footer.about")}
          </button>
        </div>

        {/* Copyright */}
        <p className="text-xs text-slate-600">
          © {new Date().getFullYear()} {store.name} — {t("store.footer.rights")}
        </p>
      </footer>
    </div>
  );
}
