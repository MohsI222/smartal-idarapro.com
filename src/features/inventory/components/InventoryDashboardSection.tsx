import type { ChangeEvent, RefObject } from "react";
import { Download, FileSpreadsheet, FileText, Plus, Upload, Edit, Trash2, Save, X } from "lucide-react";
import { InventoryAiDocScannerButton } from "@/components/InventoryAiDocScannerButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VisionReceiptItem } from "@/lib/inventoryVisionTypes";
import { UNIT_KINDS } from "../constants";
import type {
  BrandingPrefs,
  NewProductFormState,
  Product,
  StockAddFormState,
} from "../types";
import {
  InventoryProductionSection,
  type InventoryProductionSectionProps,
} from "./InventoryProductionSection";
import { InventoryAiAssistant } from "./InventoryAiAssistant";
import { InventoryControlPanel } from "./InventoryControlPanel";

type TranslateFn = (key: string) => string;

// Helper function to convert YouTube URL to embed URL
function getYouTubeEmbedUrl(url: string): string {
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

type InventoryDashboardSectionProps = {
  t: TranslateFn;
  token: string | null;
  brandingPrefs: BrandingPrefs;
  retailTypes: readonly string[];
  onBrandingPrefsChange: (patch: Partial<BrandingPrefs>) => void;
  onSaveBrandingActivity: () => void;
  isSavingActivity: boolean;
  onApplyStockOcrText: (text: string) => void | Promise<void>;
  onApplyStockVisionItems: (items: VisionReceiptItem[]) => void | Promise<void>;
  inventoryImportInputRef: RefObject<HTMLInputElement | null>;
  onInventoryImportChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  isImportingInventory: boolean;
  onExportPdf: () => void | Promise<void>;
  onExportStockWord: () => void | Promise<void>;
  onExportExcel: () => void;
  onExportInvoicesExcel: () => void;
  onExportInvoicesPdf: () => void | Promise<void>;
  onExportInvoicesWord: () => void | Promise<void>;
  newProduct: NewProductFormState;
  onNewProductChange: (patch: Partial<NewProductFormState>) => void;
  onAddProduct: () => void | Promise<void>;
  isAddingProduct: boolean;
  products: Product[];
  stockAdd: StockAddFormState;
  onStockAddChange: (patch: Partial<StockAddFormState>) => void;
  onAddStock: () => void | Promise<void>;
  productionProps: InventoryProductionSectionProps;
  editingProductId: string | null;
  onEditProduct: (productId: string) => void;
  onCancelEdit: () => void;
  onSaveProduct: (productId: string) => void | Promise<void>;
  onDeleteProduct: (productId: string) => void | Promise<void>;
  onEditProductChange: (productId: string, patch: Partial<Product>) => void;
  editingProductData: Partial<Product>;
  inventoryKbRef: RefObject<HTMLDivElement | null>;
  inventoryListIndex: number;
  onInventoryRowClick: (index: number) => void;
  onRefreshControlPanel: () => void;
  onExportControlPanel: () => void;
  selectedProductIds: Set<string>;
  onToggleProductSelection: (productId: string) => void;
  onSelectAllProducts: () => void;
  onDeleteSelectedProducts: () => void | Promise<void>;
};

export function InventoryDashboardSection({
  t,
  token,
  brandingPrefs,
  retailTypes,
  onBrandingPrefsChange,
  onSaveBrandingActivity,
  isSavingActivity,
  onApplyStockOcrText,
  onApplyStockVisionItems,
  inventoryImportInputRef,
  onInventoryImportChange,
  isImportingInventory,
  onExportPdf,
  onExportStockWord,
  onExportExcel,
  onExportInvoicesExcel,
  onExportInvoicesPdf,
  onExportInvoicesWord,
  newProduct,
  onNewProductChange,
  onAddProduct,
  isAddingProduct,
  products,
  stockAdd,
  onStockAddChange,
  onAddStock,
  productionProps,
  editingProductId,
  onEditProduct,
  onCancelEdit,
  onSaveProduct,
  onDeleteProduct,
  onEditProductChange,
  editingProductData,
  inventoryKbRef,
  inventoryListIndex,
  onInventoryRowClick,
  onRefreshControlPanel,
  onExportControlPanel,
  selectedProductIds,
  onToggleProductSelection,
  onSelectAllProducts,
  onDeleteSelectedProducts,
}: InventoryDashboardSectionProps) {
  const safeProducts = products || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/25 bg-[#0a1628]/90 px-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{t("inv.stockAiSectionTitle")}</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">{t("inv.stockAiSectionHint")}</p>
        </div>
        <InventoryAiDocScannerButton
          token={token}
          label={t("inv.aiDocScanner")}
          onTextExtracted={(text) => void onApplyStockOcrText(text)}
          onVisionItems={(items) => void onApplyStockVisionItems(items)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={inventoryImportInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,image/*"
          className="hidden"
          onChange={(event) => void onInventoryImportChange(event)}
        />
        <Button type="button" variant="secondary" className="gap-2" data-nav-index="0" data-nav-group="inventory-export" onClick={() => void onExportPdf()}>
          <Download className="size-4" />
          {t("inv.exportPdfStock")}
        </Button>
        <Button type="button" variant="secondary" className="gap-2" data-nav-index="1" data-nav-group="inventory-export" onClick={() => void onExportStockWord()}>
          <FileText className="size-4" />
          {t("inv.exportWordStock")}
        </Button>
        <Button type="button" variant="secondary" className="gap-2" data-nav-index="2" data-nav-group="inventory-export" onClick={onExportExcel}>
          <FileSpreadsheet className="size-4" />
          {t("inv.exportExcelStock")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          disabled={isImportingInventory}
          data-nav-index="3" data-nav-group="inventory-export"
          onClick={() => inventoryImportInputRef.current?.click()}
        >
          <Upload className="size-4" />
          {isImportingInventory ? t("common.processing") : t("inv.importInventory")}
        </Button>
        <Button type="button" variant="outline" className="gap-2 border-slate-600" data-nav-index="4" data-nav-group="inventory-export" onClick={onExportInvoicesExcel}>
          <FileSpreadsheet className="size-4" />
          {t("inv.exportSales")}
        </Button>
        <Button type="button" variant="outline" className="gap-2 border-slate-600" data-nav-index="5" data-nav-group="inventory-export" onClick={() => void onExportInvoicesPdf()}>
          <Download className="size-4" />
          {t("inv.exportPdfInvoices")}
        </Button>
        <Button type="button" variant="outline" className="gap-2 border-slate-600" data-nav-index="6" data-nav-group="inventory-export" onClick={() => void onExportInvoicesWord()}>
          <FileText className="size-4" />
          {t("inv.exportWordInvoices")}
        </Button>
      </div>

      <Card className="border-white/10 bg-white/5 backdrop-blur-xl border-slate-800">
        <CardHeader className="border-b border-slate-800 py-3">
          <p className="font-black text-white text-sm">{t("inv.activityLabel")}</p>
        </CardHeader>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-slate-300">{t("inv.col.sector")}</Label>
            <select
              className="mt-1 h-10 min-w-[220px] rounded-md border border-slate-700 bg-[#0c1222] px-2 text-sm text-white"
              value={brandingPrefs.activityType}
              data-nav-index="7" data-nav-group="inventory-activity"
              onChange={(e) => onBrandingPrefsChange({ activityType: e.target.value })}
            >
              {retailTypes.map((retailType) => (
                <option key={retailType} value={retailType}>
                  {t(`inv.retail.${retailType}`)}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={isSavingActivity}
            data-nav-index="8" data-nav-group="inventory-activity"
            onClick={onSaveBrandingActivity}
          >
            {isSavingActivity ? t("common.processing") : t("common.save")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader className="border-b border-slate-800">
          <p className="font-black text-white">{t("inv.addProduct")}</p>
        </CardHeader>
        <CardContent className="pt-4 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label className="text-slate-300">{t("inv.col.name")}</Label>
            <Input
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={newProduct.name}
              data-nav-index="9" data-nav-group="inventory-add-product"
              onChange={(e) => onNewProductChange({ name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-slate-300">{t("inv.col.sku")}</Label>
            <Input
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={newProduct.sku}
              data-nav-index="10" data-nav-group="inventory-add-product"
              onChange={(e) => onNewProductChange({ sku: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-slate-300">{t("inv.col.sector")}</Label>
            <select
              className="w-full mt-1 h-10 rounded-md border border-slate-700 bg-[#0c1222] px-2 text-sm text-white"
              value={newProduct.retail_type}
              data-nav-index="11" data-nav-group="inventory-add-product"
              onChange={(e) => onNewProductChange({ retail_type: e.target.value })}
            >
              {retailTypes.map((retailType) => (
                <option key={retailType} value={retailType}>
                  {t(`inv.retail.${retailType}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-slate-300">{t("inv.col.ppc")}</Label>
            <Input
              type="number"
              min={1}
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={newProduct.pieces_per_carton}
              data-nav-index="12" data-nav-group="inventory-add-product"
              onChange={(e) => onNewProductChange({ pieces_per_carton: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-slate-300">{t("inv.col.price")}</Label>
            <Input
              type="number"
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={newProduct.unit_price}
              data-nav-index="13" data-nav-group="inventory-add-product"
              onChange={(e) => onNewProductChange({ unit_price: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-slate-300">{t("inv.col.stockP")}</Label>
            <Input
              type="number"
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={newProduct.stock_pieces}
              data-nav-index="14" data-nav-group="inventory-add-product"
              onChange={(e) => onNewProductChange({ stock_pieces: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-slate-300">{t("inv.col.unitKind")}</Label>
            <select
              className="w-full mt-1 h-10 rounded-md border border-slate-700 bg-[#0c1222] px-2 text-sm text-white"
              value={newProduct.unit_kind}
              data-nav-index="15" data-nav-group="inventory-add-product"
              onChange={(e) => onNewProductChange({ unit_kind: e.target.value })}
            >
              {UNIT_KINDS.map((unitKind) => (
                <option key={unitKind} value={unitKind}>
                  {t(`inv.unit.${unitKind}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-slate-300">{t("inv.costPrice")}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={newProduct.cost_price}
              data-nav-index="16" data-nav-group="inventory-add-product"
              onChange={(e) => onNewProductChange({ cost_price: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-slate-300">{t("inv.expiryDate")}</Label>
            <Input
              type="date"
              lang="en"
              dir="ltr"
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={newProduct.expiry_date}
              data-nav-index="17" data-nav-group="inventory-add-product"
              onChange={(e) => onNewProductChange({ expiry_date: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-slate-300">{t("inv.lowStockAlert")}</Label>
            <Input
              type="number"
              min={0}
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={newProduct.low_stock_alert}
              data-nav-index="18" data-nav-group="inventory-add-product"
              onChange={(e) => onNewProductChange({ low_stock_alert: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <Label className="text-slate-300">فيديو المنتج (اختياري)</Label>
            <div className="mt-1 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="رابط YouTube أو MP4"
                  className="flex-1 h-10 rounded-md border border-slate-700 bg-[#0c1222] px-3 text-sm text-white"
                  value={newProduct.video_url}
                  onChange={(e) => onNewProductChange({ video_url: e.target.value })}
                />
                <button
                  type="button"
                  className="h-10 px-3 rounded-md bg-[#0052CC] text-white text-sm hover:bg-[#0044aa]"
                  onClick={() => {
                    if (newProduct.video_url) {
                      onNewProductChange({ video_url: "" });
                    }
                  }}
                >
                  مسح
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">أو رفع ملف:</span>
                <input
                  type="file"
                  accept="video/*"
                  className="flex-1 h-8 rounded-md border border-slate-700 bg-[#0c1222] px-2 text-xs text-white file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-[#0052CC] file:text-white file:text-xs hover:file:bg-[#0044aa]"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append("file", file);
                    try {
                      const res = await fetch("/api/inventory/product-video", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${localStorage.getItem("idara_token")}` },
                        body: formData,
                      });
                      if (!res.ok) throw new Error("فشل في رفع الفيديو");
                      const data = await res.json();
                      onNewProductChange({
                        video_url: data.video_url,
                        video_file_path: data.video_file_path,
                        video_file_name: data.video_file_name,
                        video_mime: data.video_mime,
                      });
                      alert("تم رفع الفيديو بنجاح");
                    } catch (err) {
                      alert("فشل في رفع الفيديو");
                    }
                  }}
                />
              </div>
              {newProduct.video_url && (
                <div className="mt-2 rounded-lg overflow-hidden border border-slate-700 bg-[#0c1222]">
                  {newProduct.video_url.includes('youtube.com') || newProduct.video_url.includes('youtu.be') ? (
                    <iframe
                      src={getYouTubeEmbedUrl(newProduct.video_url)}
                      className="w-full aspect-video"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  ) : (
                    <video
                      src={newProduct.video_url}
                      controls
                      className="w-full aspect-video"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <Button
              type="button"
              className="bg-[#0052CC]"
              disabled={isAddingProduct || !newProduct.name.trim()}
              data-nav-index="19" data-nav-group="inventory-add-product"
              onClick={() => void onAddProduct()}
            >
              <Plus className="size-4 me-1" />
              {isAddingProduct ? t("common.processing") : t("inv.addProduct")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
          <p className="font-black text-white">{t("inv.stockTable")}</p>
          {selectedProductIds.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void onDeleteSelectedProducts()}
            >
              {t("inv.deleteSelected")} ({selectedProductIds.size})
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-4 overflow-x-auto">
          <div
            ref={inventoryKbRef}
            data-inventory-root
            tabIndex={0}
            className="outline-none rounded-2xl ring-offset-0 focus-visible:ring-2 focus-visible:ring-[#0052CC]/50"
          >
          <table className="w-full text-sm text-slate-200">
            <thead>
              <tr className="text-left border-b border-slate-700 text-slate-400">
                <th className="py-2 pe-4">{t("inv.col.name")}</th>
                <th className="py-2 pe-4">{t("inv.col.unitKind")}</th>
                <th className="py-2 pe-4">{t("inv.col.ppc")}</th>
                <th className="py-2 pe-4">{t("inv.col.price")}</th>
                <th className="py-2 pe-4">{t("inv.costPrice")}</th>
                <th className="py-2 pe-4">{t("inv.piece")}</th>
                <th className="py-2">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.size === safeProducts.length && safeProducts.length > 0}
                    onChange={onSelectAllProducts}
                    className="cursor-pointer"
                  />
                </th>
                <th className="py-2">{t("inv.carton")}</th>
                <th className="py-2 pe-4 text-xs">{t("inv.expiryDate")}</th>
                <th className="py-2 text-xs">{t("inv.lowStockAlert")}</th>
                <th className="py-2 text-xs">فيديو</th>
                <th className="py-2 text-xs">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {safeProducts.map((product, index) => {
                const isEditing = editingProductId === product.id;
                const isFocused = index === inventoryListIndex && !isEditing;
                const currentData = isEditing ? editingProductData : product;
                const isSelected = selectedProductIds.has(product.id);
                return (
                  <tr
                    key={product.id}
                    data-inventory-idx={index}
                    onClick={() => onInventoryRowClick(index)}
                    className={`border-b border-slate-800/80 transition-colors cursor-pointer ${
                      isEditing ? "bg-[#0052CC]/10" : isFocused ? "bg-[#0052CC]/20 border-l-4 border-[#FF8C00]" : isSelected ? "bg-[#FF8C00]/10" : "hover:bg-white/5"
                    }`}
                  >
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleProductSelection(product.id);
                        }}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <Input
                          className="h-8 bg-[#0c1222] border-slate-700 text-sm"
                          value={currentData.name || ""}
                          onChange={(e) => onEditProductChange(product.id, { name: e.target.value })}
                        />
                      ) : (
                        <span className="font-semibold">{product.name}</span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-slate-400">
                      {isEditing ? (
                        <select
                          className="h-8 rounded border border-slate-700 bg-[#0c1222] px-2 text-sm text-white"
                          value={currentData.unit_kind || "piece"}
                          onChange={(e) => onEditProductChange(product.id, { unit_kind: e.target.value })}
                        >
                          {UNIT_KINDS.map((unitKind) => (
                            <option key={unitKind} value={unitKind}>
                              {t(`inv.unit.${unitKind}`)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        UNIT_KINDS.includes((product.unit_kind || "piece") as (typeof UNIT_KINDS)[number])
                          ? t(`inv.unit.${product.unit_kind || "piece"}`)
                          : product.unit_kind || "—"
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={1}
                          className="h-8 w-20 bg-[#0c1222] border-slate-700 text-sm"
                          value={currentData.pieces_per_carton || 1}
                          onChange={(e) => onEditProductChange(product.id, { pieces_per_carton: e.target.value })}
                        />
                      ) : (
                        product.pieces_per_carton
                      )}
                    </td>
                    <td className="py-2">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-24 bg-[#0c1222] border-slate-700 text-sm"
                          value={currentData.unit_price || 0}
                          onChange={(e) => onEditProductChange(product.id, { unit_price: e.target.value })}
                        />
                      ) : (
                        product.unit_price
                      )}
                    </td>
                    <td className="py-2 text-slate-400">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-8 w-20 bg-[#0c1222] border-slate-700 text-sm"
                          value={currentData.cost_price || 0}
                          onChange={(e) => onEditProductChange(product.id, { cost_price: e.target.value })}
                        />
                      ) : (
                        product.cost_price ?? 0
                      )}
                    </td>
                    <td className="py-2 text-emerald-400 font-bold">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-20 bg-[#0c1222] border-slate-700 text-sm text-emerald-400 font-bold"
                          value={currentData.stock_pieces || 0}
                          onChange={(e) => onEditProductChange(product.id, { stock_pieces: e.target.value })}
                        />
                      ) : (
                        product.stock_pieces
                      )}
                    </td>
                    <td className="py-2 text-[#FF8C00] font-bold">
                      {Math.floor((currentData.stock_pieces || product.stock_pieces) / Math.max(1, currentData.pieces_per_carton || product.pieces_per_carton))}
                    </td>
                    <td className="py-2 text-xs text-slate-400">
                      {isEditing ? (
                        <Input
                          type="date"
                          lang="en"
                          dir="ltr"
                          className="h-8 bg-[#0c1222] border-slate-700 text-sm"
                          value={currentData.expiry_date || ""}
                          onChange={(e) => onEditProductChange(product.id, { expiry_date: e.target.value })}
                        />
                      ) : (
                        product.expiry_date ?? "—"
                      )}
                    </td>
                    <td className="py-2 text-xs">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-16 bg-[#0c1222] border-slate-700 text-sm"
                          value={currentData.low_stock_alert || 10}
                          onChange={(e) => onEditProductChange(product.id, { low_stock_alert: e.target.value })}
                        />
                      ) : (
                        product.low_stock_alert ?? 10
                      )}
                    </td>
                    <td className="py-2">
                      {product.video_url ? (
                        <div className="w-32 h-20 rounded overflow-hidden border border-slate-700 bg-[#0c1222]">
                          {product.video_url.includes('youtube.com') || product.video_url.includes('youtu.be') ? (
                            <iframe
                              src={getYouTubeEmbedUrl(product.video_url)}
                              className="w-full h-full"
                              allowFullScreen
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            />
                          ) : (
                            <video
                              src={product.video_url}
                              controls
                              className="w-full h-full"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-300"
                              onClick={() => void onSaveProduct(product.id)}
                            >
                              <Save className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                              onClick={onCancelEdit}
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
                              onClick={() => onEditProduct(product.id)}
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                              onClick={() => void onDeleteProduct(product.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <InventoryAiAssistant t={t} products={products} />

      <InventoryControlPanel 
        t={t} 
        products={products} 
        onRefresh={onRefreshControlPanel}
        onExport={onExportControlPanel}
      />

      <InventoryProductionSection {...productionProps} />

      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader>
          <p className="font-black text-white">{t("inv.addStock")}</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-slate-300">{t("inv.col.name")}</Label>
            <select
              className="mt-1 h-10 min-w-[200px] rounded-md border border-slate-700 bg-[#0c1222] px-2 text-sm text-white"
              value={stockAdd.product_id}
              data-nav-index="20" data-nav-group="inventory-add-stock"
              onChange={(e) => onStockAddChange({ product_id: e.target.value })}
            >
              <option value="">—</option>
              {safeProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-slate-300">{t("inv.addPieces")}</Label>
            <Input
              type="number"
              className="mt-1 w-32 bg-[#0c1222] border-slate-700"
              value={stockAdd.add}
              data-nav-index="21" data-nav-group="inventory-add-stock"
              onChange={(e) => onStockAddChange({ add: e.target.value })}
            />
          </div>
          <Button type="button" variant="secondary" data-nav-index="22" data-nav-group="inventory-add-stock" onClick={() => void onAddStock()}>
            {t("inv.applyStock")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
