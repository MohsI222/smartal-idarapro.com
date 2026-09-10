/** درج السلة — عرض المنتجات المختارة والكمية والمجموع قبل تأكيد الطلب. */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import type { Product } from "@/lib/deliveryHub/types";

export type CartEntry = { product: Product; quantity: number };

export function CartDrawer({
  open,
  onOpenChange,
  entries,
  onQuantityChange,
  onRemove,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: CartEntry[];
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}) {
  const total = entries.reduce((sum, e) => sum + e.product.price * e.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> سلة الطلب
          </DialogTitle>
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="py-8 text-center text-slate-400">السلة فارغة — أضف منتجاً لتبدأ الطلب.</p>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {entries.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center gap-3 rounded-xl border border-slate-800 p-2">
                <img src={product.image_url ?? undefined} alt={product.title} className="h-14 w-14 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-semibold text-white">{product.title}</p>
                  <p className="text-sm text-orange-400">{product.price} DH</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onQuantityChange(product.id, Math.max(1, quantity - 1))}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-6 text-center text-sm">{quantity}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onQuantityChange(product.id, quantity + 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => onRemove(product.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <span className="text-slate-400">الإجمالي</span>
          <span className="text-xl font-bold text-white">{total.toFixed(2)} DH</span>
        </div>
        <Button size="lg" className="w-full" disabled={entries.length === 0} onClick={onCheckout}>
          متابعة الطلب ⚡
        </Button>
      </DialogContent>
    </Dialog>
  );
}
