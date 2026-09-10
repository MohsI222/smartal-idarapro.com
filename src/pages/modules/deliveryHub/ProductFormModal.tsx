/** نموذج إضافة/تعديل منتج — Delivery Hub product CRUD modal. */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { upsertProduct, FALLBACK_IMAGES } from "@/lib/deliveryHub/api";
import type { Product } from "@/lib/deliveryHub/types";
import { MediaUploadField } from "./MediaUploadField";

export function ProductFormModal({
  open,
  onOpenChange,
  storeId,
  product,
  onSaved,
  token,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  product: Product | null;
  onSaved: (product: Product) => void;
  token: string | null;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [sku, setSku] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(product?.title ?? "");
    setCategory(product?.category ?? "");
    setDescription(product?.description ?? "");
    setPrice(product ? String(product.price) : "");
    setOriginalPrice(product?.original_price != null ? String(product.original_price) : "");
    setImageUrl(product?.image_url ?? "");
    setVideoUrl(product?.video_url ?? "");
    setSku(product?.sku ?? "");
    setStockQuantity(product?.stock_quantity != null ? String(product.stock_quantity) : "0");
    setLowStockThreshold(product?.low_stock_threshold != null ? String(product.low_stock_threshold) : "5");
  }, [open, product]);

  async function handleSave() {
    if (!title.trim()) {
      toast.error("اسم المنتج مطلوب");
      return;
    }
    if (!token) {
      toast.error("يجب تسجيل الدخول");
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error("السعر غير صحيح");
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertProduct(token, {
        id: product?.id,
        store_id: storeId,
        title: title.trim(),
        category: category.trim() || "عام",
        description: description.trim() || null,
        price: priceNum,
        original_price: originalPrice.trim() ? Number(originalPrice) : null,
        image_url: imageUrl.trim() || FALLBACK_IMAGES.product1,
        video_url: videoUrl.trim() || null,
        in_stock: product?.in_stock ?? true,
        sku: sku.trim() || null,
        stock_quantity: parseInt(stockQuantity) || 0,
        low_stock_threshold: parseInt(lowStockThreshold) || 5,
      });
      onSaved(saved);
      toast.success("تم حفظ المنتج بنجاح ✅");
      // Close modal immediately after successful save
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر حفظ المنتج");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>عنوان المنتج</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: برجر لحم فاخر" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>رقم المنتج (SKU)</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="PRD-001" />
            </div>
            <div className="grid gap-2">
              <Label>الفئة</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="أطباق رئيسية" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>السعر (DH)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="45" />
            </div>
            <div className="grid gap-2">
              <Label>السعر الأصلي (اختياري — للخصم)</Label>
              <Input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="60"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>الوصف</Label>
            <textarea
              className="flex min-h-20 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف مختصر للمنتج..."
            />
          </div>
          <MediaUploadField
            label="صورة المنتج"
            kind="image"
            value={imageUrl}
            onChange={setImageUrl}
          />
          <MediaUploadField
            label="فيديو عرض المنتج (رابط YouTube/MP4 أو رفع ملف)"
            kind="video"
            value={videoUrl}
            onChange={setVideoUrl}
            placeholder="https://youtube.com/..."
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>كمية المخزون</Label>
              <Input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
            <div className="grid gap-2">
              <Label>حد الطلب المنخفض</Label>
              <Input
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                placeholder="5"
                min="0"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
