/** تبويب محرر صفحة الهبوط والمنتجات — landing page customizer + product CRUD. */
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Eye, Loader2, Monitor, Smartphone, Download, Upload, AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { deleteProduct, updateStore, upsertProduct, exportProductsToExcel, exportProductsToPDF } from "@/lib/deliveryHub/api";
import { STORE_THEMES, type Product, type Store, type StoreTheme } from "@/lib/deliveryHub/types";
import { ProductFormModal } from "./ProductFormModal";
import { MediaUploadField } from "./MediaUploadField";

// Helper function to convert YouTube URL to embed URL
function toEmbedVideoUrl(url: string): string {
  if (!url) return '';
  
  // Handle youtu.be short URLs
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0]?.split('&')[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  }
  
  // Handle standard YouTube URLs
  if (url.includes('youtube.com/watch')) {
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const videoId = urlParams.get('v');
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  }
  
  // Handle embed URLs (already in correct format)
  if (url.includes('youtube.com/embed/')) {
    return url;
  }
  
  return '';
}

export function CatalogTab({
  store,
  products,
  onStoreChange,
  onProductsChange,
  token,
}: {
  store: Store;
  products: Product[];
  onStoreChange: (store: Store) => void;
  onProductsChange: (products: Product[]) => void;
  token: string | null;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(store.name);
  const [tagline, setTagline] = useState(store.tagline ?? "");
  const [logoUrl, setLogoUrl] = useState(store.logo_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(store.banner_url ?? "");
  const [promoVideoUrl, setPromoVideoUrl] = useState(store.promo_video_url ?? "");
  const [phone, setPhone] = useState(store.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(store.whatsapp ?? "");
  const [facebookUrl, setFacebookUrl] = useState(store.facebook_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(store.instagram_url ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(store.tiktok_url ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(store.youtube_url ?? "");
  const [customDomain, setCustomDomain] = useState(store.custom_domain ?? "");
  const [theme, setTheme] = useState<StoreTheme>(store.theme);
  const [saving, setSaving] = useState(false);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("mobile");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSaveLanding() {
    if (!token) return;
    
    // Frontend validation before submission
    if (name.trim().length > 500) {
      toast.error("اسم المتجر طويل جداً (الحد الأقصى 500 حرف)");
      return;
    }
    if (tagline.trim().length > 1000) {
      toast.error("الشعار طويل جداً (الحد الأقصى 1000 حرف)");
      return;
    }
    if (phone.trim().length > 50) {
      toast.error("رقم الهاتف طويل جداً (الحد الأقصى 50 حرف)");
      return;
    }
    if (whatsapp.trim().length > 50) {
      toast.error("رقم الواتساب طويل جداً (الحد الأقصى 50 حرف)");
      return;
    }
    
    setSaving(true);
    try {
      const updated = await updateStore(token, {
        name: name.trim() || store.name,
        tagline: tagline.trim(),
        logo_url: logoUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
        promo_video_url: promoVideoUrl.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        facebook_url: facebookUrl.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        tiktok_url: tiktokUrl.trim() || null,
        youtube_url: youtubeUrl.trim() || null,
        custom_domain: customDomain.trim() || null,
        theme,
      });
      onStoreChange(updated);
      toast.success("تم حفظ صفحة الهبوط بنجاح ✅");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStock(product: Product) {
    if (!token) return;
    try {
      const updated = await upsertProduct(token, { id: product.id, store_id: store.id, in_stock: !product.in_stock });
      onProductsChange(products.map((p) => (p.id === product.id ? updated : p)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر التحديث");
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      await deleteProduct(token, id);
      onProductsChange(products.filter((p) => p.id !== id));
      toast.success("تم حذف المنتج");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الحذف");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  async function handleExportToExcel() {
    if (!token) return;
    setExporting(true);
    try {
      const blob = await exportProductsToExcel(store.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products-${store.slug}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("deliveryHub.exportSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر التصدير");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportToPDF() {
    if (!token) return;
    setExporting(true);
    try {
      const blob = await exportProductsToPDF(store.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products-${store.slug}-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("deliveryHub.exportSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر التصدير");
    } finally {
      setExporting(false);
    }
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setImporting(true);
    try {
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

      // Read first product row to fill the form
      if (lines.length > 1) {
        const values = lines[1].split(",").map((v) => v.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
        
        const importedProduct: Partial<Product> = {
          title: titleIndex >= 0 ? values[titleIndex] : "",
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

        // Open product form modal with imported data
        setEditingProduct(importedProduct as Product);
        setProductModalOpen(true);
        toast.success(t("deliveryHub.importSuccess"));
      } else {
        toast.error("الملف فارغ أو لا يحتوي على بيانات");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر قراءة الملف");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const previewUrl = `${window.location.origin}/m/${store.slug}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>الهيدر والصفحة الرئيسية</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>اسم المتجر</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>الشعار / Tagline</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <MediaUploadField
            label="شعار المتجر"
            kind="image"
            value={logoUrl}
            onChange={setLogoUrl}
          />
          <MediaUploadField
            label="صورة البانر"
            kind="image"
            value={bannerUrl}
            onChange={setBannerUrl}
          />
          <div className="md:col-span-2">
            <MediaUploadField
              label="فيديو ترويجي (رابط YouTube/MP4 أو رفع ملف)"
              kind="video"
              value={promoVideoUrl}
              onChange={setPromoVideoUrl}
              placeholder="https://youtube.com/..."
            />
            {promoVideoUrl && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setPromoVideoUrl("")}
                className="mt-2 w-full gap-2"
              >
                <Trash2 className="size-4" />
                حذف الفيديو الترويجي
              </Button>
            )}
          </div>
          <div className="grid gap-2">
            <Label>رقم الهاتف</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06XXXXXXXX" />
          </div>
          <div className="grid gap-2">
            <Label>رقم الواتساب</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="2126XXXXXXXX" />
          </div>
          <div className="grid gap-2">
            <Label>رابط فيسبوك</Label>
            <Input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/..." />
          </div>
          <div className="grid gap-2">
            <Label>رابط إنستغرام</Label>
            <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." />
          </div>
          <div className="grid gap-2">
            <Label>رابط تيك توك</Label>
            <Input value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://tiktok.com/..." />
          </div>
          <div className="grid gap-2">
            <Label>رابط يوتيوب</Label>
            <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>الدومين المخصص (Custom Domain)</Label>
            <Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="example.com (بدون http:// أو www)" />
            <p className="text-xs text-slate-500">أدخل الدومين الخاص بك (مثال: mystore.com). يجب أن تشير سجلات DNS إلى هذا السيرفر.</p>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>ألوان العلامة التجارية</Label>
            <div className="flex flex-wrap gap-2">
              {STORE_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    theme === t.id ? "border-orange-500 bg-orange-500/10" : "border-slate-700"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
                  />
                  {t.labelAr}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4" /> معاينة صفحة الهبوط
            </Button>
            <Button onClick={handleSaveLanding} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ التغييرات
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>المنتجات ({products.length})</CardTitle>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => {
                try {
                  console.log("[CatalogTab] File input changed");
                  handleImportCSV(e);
                  e.target.value = "";
                } catch (error) {
                  console.error("[CatalogTab] Error in file input onChange:", error);
                }
              }}
            />
            <Button size="sm" variant="outline" onClick={handleExportToExcel} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              تصدير Excel
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportToPDF} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              تصدير PDF
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingProduct(null);
                setProductModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> إضافة منتج
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-center text-slate-500 py-10">لا توجد منتجات بعد — أضف أول منتج للمتجر.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <div key={product.id} className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
                  {product.video_url ? (
                    <div className="h-32 w-full bg-black">
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
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  ) : (
                    <img
                      src={product.image_url ?? undefined}
                      alt={product.title}
                      className="h-32 w-full object-cover"
                    />
                  )}
                  <div className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white truncate">{product.title}</p>
                      <Badge variant={product.in_stock ? "success" : "destructive"}>
                        {product.in_stock ? "متوفر" : "غير متوفر"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">{product.category}</p>
                    {product.sku && (
                      <p className="text-xs text-slate-400">SKU: {product.sku}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-orange-400">{product.price} DH</span>
                      {product.original_price != null && (
                        <span className="text-slate-500 line-through">{product.original_price} DH</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>المخزون: {product.stock_quantity}</span>
                      {product.stock_quantity === 0 ? (
                        <span className="text-red-500 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="h-3 w-3" />
                          نفذ
                        </span>
                      ) : product.stock_quantity <= product.low_stock_threshold ? (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          منخفض
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          متوفر
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => handleToggleStock(product)}>
                        {product.in_stock ? "إخفاء" : "إظهار"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingProduct(product);
                          setProductModalOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setConfirmDeleteId(product.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProductFormModal
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
        storeId={store.id}
        product={editingProduct}
        token={token}
        onSaved={(saved) => {
          const exists = products.some((p) => p.id === saved.id);
          onProductsChange(exists ? products.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...products]);
        }}
      />

      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400">هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>
              حذف نهائياً
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>معاينة صفحة الهبوط</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={previewMode === "desktop" ? "default" : "outline"}
                  onClick={() => setPreviewMode("desktop")}
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={previewMode === "mobile" ? "default" : "outline"}
                  onClick={() => setPreviewMode("mobile")}
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center bg-slate-950 rounded-xl p-4">
            <iframe
              src={previewUrl}
              title="معاينة المتجر"
              className={`rounded-xl border border-slate-800 bg-white ${
                previewMode === "mobile" ? "w-[380px] h-[70vh]" : "w-full h-[70vh]"
              }`}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
