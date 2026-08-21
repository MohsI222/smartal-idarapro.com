import type { RefObject } from "react";
import { Download, FileSpreadsheet, Search, ShoppingCart, Edit, Trash2, Save, X } from "lucide-react";
import { BarcodeScannerHub } from "@/components/BarcodeScannerHub";
import { InventoryAiDocScannerButton } from "@/components/InventoryAiDocScannerButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VisionReceiptItem } from "@/lib/inventoryVisionTypes";
import type { DraftLine, Product, QuickUnit, SaleFormState } from "../types";

type TranslateFn = (key: string) => string;

type InventoryPosSectionProps = {
  token: string | null;
  t: TranslateFn;
  products: Product[];
  quickKbRef: RefObject<HTMLDivElement | null>;
  quickListRef: RefObject<HTMLDivElement | null>;
  quickSearch: string;
  quickListIndex: number;
  quickUnit: QuickUnit;
  filteredQuickProducts: Product[];
  currentLinePreview: {
    line: number;
    profit: number;
    pp: number;
  };
  draftLines: DraftLine[];
  sale: SaleFormState;
  manualTotalOverride: string;
  draftGrandTotal: number;
  effectiveSaleTotal: number;
  onBarcodeMatchedInPos: (productId: string) => void;
  onResolveGhostBarcode: (code: string) => void | Promise<void>;
  onApplyPosOcrText: (text: string) => void;
  onApplyPosVisionItems: (items: VisionReceiptItem[]) => void | Promise<void>;
  onQuickSearchChange: (value: string) => void;
  onDraftLineTotalChange: (id: string, raw: string) => void;
  onManualTotalOverrideChange: (value: string) => void;
  editingDraftLineId: string | null;
  onEditDraftLine: (lineId: string) => void;
  onCancelEditDraftLine: () => void;
  onSaveDraftLine: (lineId: string) => void | Promise<void>;
  onDeleteDraftLine: (lineId: string) => void;
  onEditDraftLineChange: (lineId: string, patch: Partial<DraftLine>) => void;
  editingDraftLineData: Partial<DraftLine>;
  onOpenCalculator: () => void;
  onSaleChange: (patch: Partial<SaleFormState>) => void;
  onSubmitQuickDraft: () => void | Promise<void>;
  onClearDraft: () => void;
  onExportDraftPdf: () => void | Promise<void>;
  onExportDraftExcel: () => void;
  quickConfirmFocused: boolean;
};

export function InventoryPosSection({
  token,
  t,
  products,
  quickKbRef,
  quickListRef,
  quickSearch,
  quickListIndex,
  quickUnit,
  filteredQuickProducts,
  currentLinePreview,
  draftLines,
  sale,
  manualTotalOverride,
  draftGrandTotal,
  effectiveSaleTotal,
  onBarcodeMatchedInPos,
  onResolveGhostBarcode,
  onApplyPosOcrText,
  onApplyPosVisionItems,
  onQuickSearchChange,
  onDraftLineTotalChange,
  onManualTotalOverrideChange,
  onOpenCalculator,
  onSaleChange,
  onSubmitQuickDraft,
  onClearDraft,
  editingDraftLineId,
  onEditDraftLine,
  quickConfirmFocused,
  onCancelEditDraftLine,
  onSaveDraftLine,
  onDeleteDraftLine,
  onEditDraftLineChange,
  editingDraftLineData,
  onExportDraftPdf,
  onExportDraftExcel,
}: InventoryPosSectionProps) {
  return (
    <div
      ref={quickKbRef}
      data-quick-sale-root
      tabIndex={0}
      className="outline-none rounded-2xl ring-offset-0 focus-visible:ring-2 focus-visible:ring-[#0052CC]/50"
    >
      <div className="mb-4 flex flex-col lg:flex-row lg:items-start gap-4 lg:justify-between">
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs font-bold text-slate-400">{t("inv.barcodeInPosTitle")}</p>
          <BarcodeScannerHub
            compact
            products={products.map((product) => ({ id: product.id, name: product.name, sku: product.sku }))}
            onMatchedProduct={onBarcodeMatchedInPos}
            onUnknownBarcode={onResolveGhostBarcode}
          />
        </div>
        <div className="shrink-0 flex flex-col items-stretch lg:items-end gap-2 max-w-full lg:max-w-[280px]">
          <InventoryAiDocScannerButton
            token={token}
            label={t("inv.aiDocScanner")}
            onTextExtracted={onApplyPosOcrText}
            onVisionItems={(items) => void onApplyPosVisionItems(items)}
          />
          <p className="text-[10px] text-slate-600 text-center lg:text-end leading-snug">
            {t("inv.aiDocScannerHintPos")}
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="border-slate-800 bg-[#0a1628]/90 overflow-hidden lg:sticky lg:top-4 z-10 shadow-xl">
          <CardHeader className="flex flex-row items-center gap-2 border-b border-slate-800 py-3">
            <ShoppingCart className="size-5 text-[#0052CC] shrink-0" />
            <div>
              <span className="font-black text-white block">{t("inv.saleTitle")}</span>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{t("inv.quickHints")}</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div
              ref={quickListRef}
              className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain border-b border-slate-800"
            >
              <div className="px-3 pt-3 pb-1">
                <div className="relative">
                  <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={quickSearch}
                    onChange={(e) => onQuickSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && filteredQuickProducts.length > 0) {
                        e.preventDefault();
                        // Add the first matching product to the cart
                        const firstProduct = filteredQuickProducts[0];
                        if (firstProduct) {
                          onBarcodeMatchedInPos(firstProduct.id);
                          onQuickSearchChange("");
                        }
                      } else if (e.key === "ArrowDown" && filteredQuickProducts.length > 0) {
                        e.preventDefault();
                        // Focus on the first product in the list
                        const firstProduct = quickListRef.current?.querySelector('[data-quick-product-index="0"]') as HTMLElement;
                        firstProduct?.focus();
                      }
                    }}
                    placeholder={t("inv.quickSearchPlaceholder")}
                    className="w-full rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-white placeholder:text-slate-500 ps-8 pe-3 py-1.5 outline-none focus:ring-1 focus:ring-[#0052CC]/60"
                  />
                  {quickSearch && (
                    <button
                      type="button"
                      onClick={() => onQuickSearchChange("")}
                      className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    />
                  )}
                </div>
              </div>
              {filteredQuickProducts.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">{t("inv.quickEmptyProducts")}</p>
              ) : (
                filteredQuickProducts.map((product, index) => {
                  const active = index === quickListIndex;
                  return (
                    <div
                      key={product.id}
                      data-quick-product-index={index}
                      data-quick-idx={index}
                      tabIndex={0}
                      className={`flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-800/80 text-sm transition-colors outline-none focus:ring-1 focus:ring-[#0052CC]/60 ${
                        active ? "bg-[#0052CC]/25 border-s-4 border-[#FF8C00]" : "hover:bg-white/5"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{product.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {t("inv.col.stockP")}: {product.stock_pieces} · {t("inv.col.price")} {product.unit_price}
                        </p>
                      </div>
                      {active && (
                        <span className="shrink-0 text-[10px] font-bold uppercase text-[#FF8C00]">●</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-4 space-y-2 bg-black/20">
              <p className="text-xs font-bold text-slate-400">{t("inv.quickCurrentUnit")}</p>
              <div className="flex flex-wrap items-center gap-2">
                {(["piece", "box", "bag"] as const).map((unit) => (
                  <span
                    key={unit}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      quickUnit === unit ? "bg-[#0052CC] text-white" : "bg-slate-800/80 text-slate-400"
                    }`}
                  >
                    {t(`inv.unit.${unit}`)}
                  </span>
                ))}
              </div>
              {filteredQuickProducts[quickListIndex] && (
                <p className="text-xs text-slate-400">
                  {t("inv.quickLinePreview")}:{" "}
                  <span className="text-white font-mono tabular-nums">{currentLinePreview.line.toFixed(2)}</span> ·{" "}
                  {t("inv.lineProfit")}:{" "}
                  <span className="text-emerald-400 font-mono tabular-nums">
                    {currentLinePreview.profit.toFixed(2)}
                  </span>
                </p>
              )}
              {filteredQuickProducts[quickListIndex] &&
                (() => {
                  const product = filteredQuickProducts[quickListIndex];
                  const reserved = draftLines
                    .filter((line) => line.product_id === product.id)
                    .reduce((sum, line) => sum + line.qty_pieces, 0);
                  const available = product.stock_pieces - reserved;
                  const needed = currentLinePreview.pp;
                  const ok = available >= needed;
                  return (
                    <p className={`text-[11px] ${ok ? "text-slate-500" : "text-red-400 font-bold"}`}>
                      {ok
                        ? `${t("inv.quickStockAfterReserve")}: ${available} ${t("inv.piece")}`
                        : t("inv.quickNoStock")}
                    </p>
                  );
                })()}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-800 bg-[#0a1628]/90">
            <CardHeader className="border-b border-slate-800 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-white">{t("inv.quickDraftTitle")}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{t("inv.quickDraftHint")}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                    onClick={() => void onExportDraftPdf()}
                  >
                    <Download className="size-4 mr-1" />
                    PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                    onClick={onExportDraftExcel}
                  >
                    <FileSpreadsheet className="size-4 mr-1" />
                    Excel
                  </Button>
                  {draftLines.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="bg-red-900/30 border-red-700 text-red-300 hover:text-white hover:bg-red-900/50"
                      onClick={() => void onClearDraft()}
                    >
                      <X className="size-4 mr-1" />
                      {t("common.cancel")}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {draftLines.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">{t("inv.quickDraftEmpty")}</p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {draftLines.map((line) => {
                    const isEditing = editingDraftLineId === line.id;
                    const currentData = isEditing ? editingDraftLineData : line;
                    return (
                      <li
                        key={line.id}
                        className={`flex flex-wrap items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2 ${
                          isEditing ? "border-[#0052CC] bg-[#0052CC]/10" : "border-slate-800 bg-black/20"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isEditing ? (
                            <Input
                              type="number"
                              min={1}
                              className="w-20 h-8 bg-[#0c1222] border-slate-700 text-sm"
                              value={currentData.qty_pieces || 0}
                              onChange={(e) => onEditDraftLineChange(line.id, { qty_pieces: Number(e.target.value) || 0 })}
                            />
                          ) : (
                            <span className="text-slate-200 truncate">
                              {line.product_name}
                              <span className="text-slate-500 text-xs ms-1">
                                · {t(`inv.unit.${line.sale_unit}`)}
                                {line.sale_unit !== "piece" ? ` (${line.qty_pieces} ${t("inv.piece")})` : ""}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="w-28 h-9 text-[#FF8C00] font-mono tabular-nums text-sm bg-[#0c1222] border-slate-700 shrink-0"
                            aria-label={t("inv.lineTotalEdit")}
                            value={Number.isFinite(currentData.line_total) ? String(currentData.line_total) : ""}
                            onChange={(e) => isEditing ? onEditDraftLineChange(line.id, { line_total: Number(e.target.value) || 0 }) : onDraftLineTotalChange(line.id, e.target.value)}
                          />
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-300"
                                  onClick={() => void onSaveDraftLine(line.id)}
                                >
                                  <Save className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                                  onClick={onCancelEditDraftLine}
                                >
                                  <X className="size-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-[#0052CC] hover:text-[#0052CC]/80"
                                  onClick={() => onEditDraftLine(line.id)}
                                >
                                  <Edit className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                                  onClick={() => onDeleteDraftLine(line.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black text-white shrink-0">{t("inv.quickGrandTotal")}</span>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="w-36 font-mono text-lg font-black text-[#FF8C00] bg-[#0c1222] border-slate-700"
                      placeholder={draftGrandTotal.toFixed(2)}
                      value={manualTotalOverride}
                      onChange={(e) => onManualTotalOverrideChange(e.target.value)}
                      aria-label={t("inv.totalOverrideAria")}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0 font-bold"
                      data-calculator="true"
                      onClick={onOpenCalculator}
                    >
                      ∑
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  {t("inv.lineSum")}:{" "}
                  <span className="text-slate-300 font-mono tabular-nums">{draftGrandTotal.toFixed(2)}</span> ·{" "}
                  {t("inv.savedTotal")}:{" "}
                  <span className="text-[#FF8C00] font-mono font-bold tabular-nums">
                    {effectiveSaleTotal.toFixed(2)}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0a1628]/90">
            <CardContent className="pt-4 space-y-3">
              <div>
                <Label>{t("inv.customer")}</Label>
                <Input
                  className="mt-1 bg-[#0c1222] border-slate-700"
                  value={sale.customer}
                  onChange={(e) => onSaleChange({ customer: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("inv.paid")}</Label>
                <Input
                  type="number"
                  className="mt-1 bg-[#0c1222] border-slate-700"
                  value={sale.paid}
                  onChange={(e) => onSaleChange({ paid: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("inv.dueDate")}</Label>
                <Input
                  type="date"
                  lang="en"
                  dir="ltr"
                  className="mt-1 bg-[#0c1222] border-slate-700"
                  value={sale.due_at}
                  onChange={(e) => onSaleChange({ due_at: e.target.value })}
                />
              </div>
              <Button
                type="button"
                className={`w-full bg-[#0052CC] ${quickConfirmFocused ? "ring-2 ring-white ring-offset-2 ring-offset-[#0052CC]" : ""}`}
                disabled={draftLines.length === 0}
                onClick={() => {
                  void onSubmitQuickDraft();
                }}
              >
                {t("inv.quickConfirmBatch")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
