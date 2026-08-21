import { BarcodeScannerHub } from "@/components/BarcodeScannerHub";
import type { Product } from "../types";

type TranslateFn = (key: string) => string;

type InventoryBarcodeSectionProps = {
  t: TranslateFn;
  products: Product[];
  onMatchedProduct: (productId: string) => void;
  onUnknownBarcode: (code: string) => void | Promise<void>;
};

export function InventoryBarcodeSection({
  t,
  products,
  onMatchedProduct,
  onUnknownBarcode,
}: InventoryBarcodeSectionProps) {
  return (
    <div className="space-y-4">
      <BarcodeScannerHub
        products={products.map((product) => ({ id: product.id, name: product.name, sku: product.sku }))}
        onMatchedProduct={onMatchedProduct}
        onUnknownBarcode={onUnknownBarcode}
      />
      <p className="text-xs text-slate-500 max-w-xl">{t("inv.barcodeFootnote")}</p>
    </div>
  );
}
