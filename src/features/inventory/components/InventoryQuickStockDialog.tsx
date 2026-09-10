import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product } from "../types";

type TranslateFn = (key: string) => string;

type InventoryQuickStockDialogProps = {
  t: TranslateFn;
  open: boolean;
  quickStockProductId: string | null;
  products: Product[];
  quickStockPieces: string;
  onOpenChange: (open: boolean) => void;
  onQuickStockPiecesChange: (value: string) => void;
  onCancel: () => void;
  onApply: () => void | Promise<void>;
};

export function InventoryQuickStockDialog({
  t,
  open,
  quickStockProductId,
  products,
  quickStockPieces,
  onOpenChange,
  onQuickStockPiecesChange,
  onCancel,
  onApply,
}: InventoryQuickStockDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-amber-500/25">
        <DialogHeader>
          <DialogTitle className="text-white">{t("inv.quickStockTitle")}</DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">{t("inv.quickStockDesc")}</DialogDescription>
        </DialogHeader>
        {quickStockProductId && (
          <p className="text-sm text-cyan-200 font-semibold">
            {products.find((product) => product.id === quickStockProductId)?.name ?? "—"}
          </p>
        )}
        <div>
          <Label>{t("inv.addPieces")}</Label>
          <Input
            type="number"
            min={1}
            className="mt-1 bg-[#0c1222] border-slate-700"
            value={quickStockPieces}
            onChange={(event) => onQuickStockPiecesChange(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" className="border-slate-600" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="button" className="bg-amber-600 hover:bg-amber-500" onClick={() => void onApply()}>
            {t("inv.applyStock")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
