import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import type { ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  FileText,
  Lock,
  ScanBarcode,
  Search,
  ShoppingCart,
} from "lucide-react";
import { InventoryDashboardSection } from "@/features/inventory/components/InventoryDashboardSection";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { postBackendReportDocx } from "@/lib/backendExportClient";
import * as XLSX from 'xlsx';
import {
  buildOfficialPdfTableHtml,
  exportSmartAlIdaraPdfPreferBackend,
  escapeHtmlPdf,
} from "@/lib/pdfExport";
import { downloadTableAsWordDocx } from "@/lib/wordExport";
import { downloadXlsxWorkbook } from "@/lib/excelDownload";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import {
  assignLogisticsItemBackend,
  createProductionRequestBackend,
  fetchLogisticsQueueBackend,
  fetchProductionRequestsBackend,
  reserveProductionMaterialBackend,
} from "@/lib/productionApi";
import {
  fetchHrStaff,
  fetchInventory,
  reserveMaterial,
  updateProductStock,
  type HrStaffRow,
  type InventoryItem,
  type LogisticsQueueItem,
  type ProductionRequestRow,
} from "@/lib/supabaseClient";
import {
  tlDownloadMessageAttachment,
  tlMessageRecipients,
  tlMessages,
  tlResolveMagic,
  tlSendMessage,
  tlSendMessageWithFile,
  tlWorkers,
  type TlMessage,
  type TlWorker,
} from "@/lib/tlApi";
import { BarcodeScannerHub } from "@/components/BarcodeScannerHub";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProcessingBar } from "@/components/ProcessingBar";
import { lookupBarcodeWithPrice } from "@/lib/barcodeGlobalLookup";
import { MiniCalculatorDialog } from "@/components/MiniCalculatorDialog";
import { InventoryAiDocScannerButton } from "@/components/InventoryAiDocScannerButton";
import { extractPlainTextFromInventoryFile } from "@/lib/inventoryDocumentImport";
import type { VisionReceiptItem } from "@/lib/inventoryVisionTypes";
import { todayIsoLocal } from "@/lib/todayIso";
import {
  parseDraftLinesFromPlainText,
  parseStockRowsFromPlainText,
  bestCatalogMatch,
  heuristicReceiptItemsFromPlainText,
  type ProductLite,
} from "@/lib/inventoryReceiptParse";
import { useBarcodeScanner } from "@/lib/useBarcodeScanner";

type Product = {
  id: string;
  name: string;
  sku: string;
  retail_type: string;
  pieces_per_carton: number;
  unit_price: number;
  stock_pieces: number;
  unit_kind?: string;
  cost_price?: number;
  expiry_date?: string | null;
  low_stock_alert?: number;
  video_url?: string | null;
  video_file_path?: string | null;
  video_file_name?: string | null;
  video_mime?: string | null;
  user_id?: string;
};

type Invoice = {
  id: string;
  customer_name: string;
  lines_json: string;
  total: number;
  paid: number;
  credit: number;
  due_at: string | null;
  created_at: string;
  status?: string;
};

const RETAIL_TYPES = [
  "grocery",
  "lawyer_office",
  "pharmacy",
  "wedding_hall",
  "supermarket",
  "bookstore",
  "cafe",
  "hardware",
  "company",
  "laboratory",
  "retail",
] as const;

const UNIT_KINDS = ["piece", "box", "bag", "kg"] as const;

const INV_TABS = ["dash", "pos", "barcode", "credit", "reports"] as const;

const QUICK_UNITS = ["piece", "box", "bag"] as const;
type QuickUnit = (typeof QUICK_UNITS)[number];

type DraftLine = {
  id: string;
  product_id: string;
  product_name: string;
  qty_pieces: number;
  sale_unit: QuickUnit;
  line_total: number;
};

type ProductsResponse = { products: Product[] };
type InvoicesResponse = { invoices: Invoice[] };
type ProductCreateResponse = { id: string };
type ProductWritePayload = {
  name: string;
  sku: string;
  retail_type: string;
  pieces_per_carton: number;
  unit_price: number;
  stock_pieces: number;
  unit_kind: string;
  cost_price: number;
  expiry_date?: string | null;
  low_stock_alert: number;
  video_url?: string | null;
  video_file_path?: string | null;
  video_file_name?: string | null;
  video_mime?: string | null;
};

type ProductionBomItem = {
  material_id: string;
  name: string;
  quantity: number;
  available: number;
  reference?: string;
  source: "supabase" | "inventory_products";
};

type InventorySourceRow = {
  id: string;
  name: string;
  qty: number;
  sku: string;
  barcode: string;
  reference: string;
  source: "supabase" | "inventory_products";
};

type SheetCell = string | number | boolean | Date | null | undefined;
type InventoryImportKey =
  | "name"
  | "sku"
  | "retail_type"
  | "unit_kind"
  | "pieces_per_carton"
  | "unit_price"
  | "cost_price"
  | "stock_pieces"
  | "expiry_date"
  | "low_stock_alert";

const IMPORT_FALLBACK_INDEX: Record<InventoryImportKey, number> = {
  name: 0,
  sku: 1,
  retail_type: 2,
  unit_kind: 3,
  pieces_per_carton: 4,
  unit_price: 5,
  cost_price: 6,
  stock_pieces: 7,
  expiry_date: 8,
  low_stock_alert: 9,
};

const IMPORT_HEADER_ALIASES: Record<InventoryImportKey, string[]> = {
  name: ["name", "product", "item", "designation", "produit", "الصنف", "المنتج", "الاسم"],
  sku: ["sku", "barcode", "bar code", "code", "reference", "référence", "كود", "باركود", "المرجع"],
  retail_type: ["sector", "retail_type", "retail type", "activity", "activité", "قطاع", "النشاط"],
  unit_kind: ["unit_kind", "unit kind", "unit", "kind", "unité", "وحدة", "نوع الوحدة"],
  pieces_per_carton: [
    "ppc",
    "pieces_per_carton",
    "pieces per carton",
    "per carton",
    "carton",
    "colis",
    "كرتون",
    "علبة",
  ],
  unit_price: ["unit_price", "unit price", "price", "prix", "ثمن", "السعر"],
  cost_price: ["cost_price", "cost price", "cost", "coût", "تكلفة", "ثمن الشراء"],
  stock_pieces: ["stock_pieces", "stock pieces", "stock", "quantity", "qty", "quantité", "مخزون", "الكمية"],
  expiry_date: ["expiry_date", "expiry", "expiration", "date expiration", "صلاحية", "انتهاء"],
  low_stock_alert: ["low_stock_alert", "low stock", "alert", "seuil", "تنبيه", "حد أدنى"],
};

function piecesPerQuickUnit(p: Product, u: QuickUnit): number {
  const ppc = Math.max(1, Math.floor(Number(p.pieces_per_carton) || 1));
  if (u === "piece") return 1;
  return ppc;
}

function textCell(cell: SheetCell): string {
  if (cell == null) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
}

function normalizeHeader(cell: SheetCell): string {
  return textCell(cell)
    .toLowerCase()
    .replace(/[()[\]{}:؛،,._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderIndex(header: SheetCell[], aliases: string[]): number {
  const normalizedAliases = aliases.map((a) => normalizeHeader(a));
  return header.findIndex((cell) => {
    const h = normalizeHeader(cell);
    if (!h) return false;
    return normalizedAliases.some((a) => h === a || (a.length > 3 && h.includes(a)));
  });
}

function parseNumberCell(cell: SheetCell, fallback: number): number {
  if (typeof cell === "number" && Number.isFinite(cell)) return cell;
  const txt = textCell(cell).replace(/\s/g, "").replace(",", ".");
  if (!txt) return fallback;
  const n = Number(txt);
  return Number.isFinite(n) ? n : fallback;
}

function parseIntCell(cell: SheetCell, fallback: number, min: number): number {
  return Math.max(min, Math.floor(parseNumberCell(cell, fallback)));
}

function parseDateCell(cell: SheetCell): string | null {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) return cell.toISOString().slice(0, 10);
  if (typeof cell === "number" && Number.isFinite(cell) && cell > 20000) {
    const formatted = XLSX.SSF.format("yyyy-mm-dd", cell);
    return /^\d{4}-\d{2}-\d{2}$/.test(formatted) ? formatted : null;
  }
  const raw = textCell(cell);
  if (!raw) return null;
  const iso = raw.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const local = raw.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (!local) return null;
  const [, d, m, y] = local;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizeRetailType(cell: SheetCell, fallback: string): string {
  const raw = textCell(cell);
  return (RETAIL_TYPES as readonly string[]).includes(raw) ? raw : fallback || "retail";
}

function normalizeUnitKind(cell: SheetCell): string {
  const raw = textCell(cell);
  return (UNIT_KINDS as readonly string[]).includes(raw) ? raw : "piece";
}

function normalizeLookupText(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.codePointAt(0)! - 0x06f0))
    .toLowerCase()
    .trim();
}

function isBarcodeLike(value: string): boolean {
  return /^[A-Z0-9][A-Z0-9\s._-]{2,119}$/i.test(value) && /\d/.test(value);
}

function productIdentityFromCells(nameCell: SheetCell, skuCell: SheetCell, fallbackIndex: number) {
  const rawName = textCell(nameCell).slice(0, 240);
  const rawSku = textCell(skuCell).slice(0, 120);
  const sku = rawSku || (isBarcodeLike(rawName) ? rawName.slice(0, 120) : "");
  const name = rawName || (sku ? `Product ${sku}` : `Product ${fallbackIndex + 1}`);
  return { name, sku };
}

function inventoryRowFromSupabase(item: InventoryItem): InventorySourceRow {
  const name = String(item.name ?? item.sku ?? item.reference ?? item.id).trim() || item.id;
  return {
    id: item.id,
    name,
    qty: Math.max(0, Number(item.quantity ?? item.stock_pieces ?? 0) || 0),
    sku: String(item.sku ?? "").trim(),
    barcode: String(item.barcode ?? "").trim(),
    reference: String(item.reference ?? "").trim(),
    source: "supabase",
  };
}

function inventoryRowFromProduct(product: Product): InventorySourceRow {
  return {
    id: product.id,
    name: product.name,
    qty: Math.max(0, Number(product.stock_pieces) || 0),
    sku: product.sku,
    barcode: product.sku,
    reference: product.retail_type,
    source: "inventory_products",
  };
}

function parseInventoryImportRows(rows: SheetCell[][], defaultRetailType: string): ProductWritePayload[] {
  console.log("[parseInventoryImportRows] Input rows:", rows.length);
  const visibleRows = rows.filter((row) => row.some((cell) => textCell(cell) !== ""));
  console.log("[parseInventoryImportRows] Visible rows:", visibleRows.length);
  if (visibleRows.length === 0) return [];

  const firstRow = visibleRows[0] ?? [];
  console.log("[parseInventoryImportRows] First row:", firstRow);
  const namedIndexes = Object.fromEntries(
    Object.entries(IMPORT_HEADER_ALIASES).map(([key, aliases]) => [
      key,
      findHeaderIndex(firstRow, aliases),
    ])
  ) as Record<InventoryImportKey, number>;
  console.log("[parseInventoryImportRows] Named indexes:", namedIndexes);
  const hasHeader = Object.values(namedIndexes).some((idx) => idx >= 0);
  const indexes: Record<InventoryImportKey, number> = { ...IMPORT_FALLBACK_INDEX };
  if (hasHeader) {
    for (const key of Object.keys(indexes) as InventoryImportKey[]) {
      if (namedIndexes[key] >= 0) indexes[key] = namedIndexes[key];
    }
  }
  console.log("[parseInventoryImportRows] Final indexes:", indexes, "hasHeader:", hasHeader);

  const dataRows = hasHeader ? visibleRows.slice(1) : visibleRows;
  console.log("[parseInventoryImportRows] Data rows:", dataRows.length);
  const parsed: ProductWritePayload[] = [];
  for (const [rowIndex, row] of dataRows.entries()) {
    const { name, sku } = productIdentityFromCells(row[indexes.name], row[indexes.sku], rowIndex);
    const item = {
      name,
      sku,
      retail_type: normalizeRetailType(row[indexes.retail_type], defaultRetailType),
      pieces_per_carton: parseIntCell(row[indexes.pieces_per_carton], 1, 1),
      unit_price: Math.max(0, parseNumberCell(row[indexes.unit_price], 0)),
      stock_pieces: parseIntCell(row[indexes.stock_pieces], 0, 0),
      unit_kind: normalizeUnitKind(row[indexes.unit_kind]),
      cost_price: Math.max(0, parseNumberCell(row[indexes.cost_price], 0)),
      expiry_date: parseDateCell(row[indexes.expiry_date]),
      low_stock_alert: parseIntCell(row[indexes.low_stock_alert], 10, 0),
    };
    console.log("[parseInventoryImportRows] Parsed item", rowIndex, ":", item);
    parsed.push(item);
  }
  console.log("[parseInventoryImportRows] Total parsed:", parsed.length);
  return parsed;
}

export function InventoryPosModule() {
  const { token, user, isApproved, approvedModules, isAdmin } = useAuth();
  const { t, isRtl, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const magicParam = searchParams.get("magic");
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [productionRequests, setProductionRequests] = useState<ProductionRequestRow[]>([]);
  const [logisticsQueue, setLogisticsQueue] = useState<LogisticsQueueItem[]>([]);
  const [hrStaff, setHrStaff] = useState<HrStaffRow[]>([]);
  const [tlWorkerList, setTlWorkerList] = useState<TlWorker[]>([]);
  const [ctxWorker, setCtxWorker] = useState<TlWorker | null>(null);
  const [bomItems, setBomItems] = useState<ProductionBomItem[]>([]);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [isAssigningLogistics, setIsAssigningLogistics] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedProductionWorkerId, setSelectedProductionWorkerId] = useState("");
  const [selectedLogisticsAssignee, setSelectedLogisticsAssignee] = useState("");
  const [messages, setMessages] = useState<TlMessage[]>([]);
  const [messageRecipients, setMessageRecipients] = useState<
    { id: string; full_name: string; hierarchy_role?: string; department?: string }[]
  >([]);
  const [messageTo, setMessageTo] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageFile, setMessageFile] = useState<File | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [brandingPrefs, setBrandingPrefs] = useState({
    activityType: "retail",
    companyName: "",
    logoDataUrl: "",
  });
  const [invTab, setInvTab] = useState(() => {
    const q = searchParams.get("tab");
    return q && (INV_TABS as readonly string[]).includes(q) ? q : "dash";
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && (INV_TABS as readonly string[]).includes(tab)) setInvTab(tab);
  }, [searchParams]);

  const onInvTabChange = (v: string) => {
    setInvTab(v);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", v);
        return next;
      },
      { replace: true }
    );
  };
  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    retail_type: "retail",
    pieces_per_carton: "12",
    unit_price: "",
    stock_pieces: "0",
    unit_kind: "piece",
    cost_price: "",
    expiry_date: "",
    low_stock_alert: "10",
    video_url: "",
    video_file_path: "",
    video_file_name: "",
    video_mime: "",
  });
  const [sale, setSale] = useState({
    customer: "",
    paid: "",
    due_at: todayIsoLocal(),
  });
  const [quickListIndex, setQuickListIndex] = useState(0);
  const [quickSearch, setQuickSearch] = useState("");
  const [quickUnit, setQuickUnit] = useState<QuickUnit>("piece");
  const [shiftGroup, setShiftGroup] = useState<"A" | "B" | "C">("A");
  const [shiftStartTime, setShiftStartTime] = useState<Date | null>(null);
  const [shiftEndTime, setShiftEndTime] = useState<Date | null>(null);
  const [manualShiftStartTime, setManualShiftStartTime] = useState<string>("");
  const [manualShiftEndTime, setManualShiftEndTime] = useState<string>("");
  const [selectedShiftReport, setSelectedShiftReport] = useState<any>(null);
  const [shiftWeek, setShiftWeek] = useState<number>(1);
  const [shiftCustomerName, setShiftCustomerName] = useState<string>("");
  const [shiftCustomerPhone, setShiftCustomerPhone] = useState<string>("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [previousDraftLines, setPreviousDraftLines] = useState<DraftLine[]>([]);
  const quickKbRef = useRef<HTMLDivElement>(null);
  const quickListRef = useRef<HTMLDivElement>(null);
  const quickStateRef = useRef({
    invTab: "dash",
    products: [] as Product[],
    quickListIndex: 0,
    quickUnit: "piece" as QuickUnit,
    draftLines: [] as DraftLine[],
  });
  const [stockAdd, setStockAdd] = useState({ product_id: "", add: "0" });
  const [exportProcessing, setExportProcessing] = useState<{
    active: boolean;
    label: string;
    progress?: number;
  }>({ active: false, label: "" });
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isImportingInventory, setIsImportingInventory] = useState(false);
  const [manualTotalOverride, setManualTotalOverride] = useState("");
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [quickStockOpen, setQuickStockOpen] = useState(false);
  const [quickStockProductId, setQuickStockProductId] = useState<string | null>(null);
  const [quickStockPieces, setQuickStockPieces] = useState("1");
  const [quickConfirmFocused, setQuickConfirmFocused] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductData, setEditingProductData] = useState<Partial<Product>>({});
  const [inventoryListIndex, setInventoryListIndex] = useState(0);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const inventoryKbRef = useRef<HTMLDivElement>(null);
  const inventoryImportInputRef = useRef<HTMLInputElement>(null);

  const runExport = useCallback(async (label: string, fn: () => Promise<void>) => {
    setExportProcessing({ active: true, label, progress: 0.06 });
    try {
      await fn();
      setExportProcessing((s) => ({ ...s, progress: 1 }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    } finally {
      window.setTimeout(() => setExportProcessing({ active: false, label: "" }), 420);
    }
  }, [t]);

  const ghostBarcodeBusyRef = useRef<string | null>(null);

  const refreshInventoryTables = useCallback(async () => {
    if (!supabase || !token) return;
    // Use user.id from AuthContext
    const authUserId = user?.id;
    if (!authUserId) {
      console.error("[refreshInventoryTables] No user ID from AuthContext");
      return;
    }
    console.log("[refreshInventoryTables] Fetching inventory for user:", authUserId);

    // Use fetchInventory which now uses Express API for consistency
    const [productsData, invoicesData] = await Promise.all([
      fetchInventory(authUserId),
      api<InvoicesResponse>("/inventory/invoices", { token }),
    ]);
    startTransition(() => {
      setProducts(productsData as Product[]);
      setInvoices(invoicesData.invoices);
    });
  }, [token, user?.id]);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    if (!token) {
      setLoading(false);
      return;
    }
    // Don't fetch inventory if user_id is not available yet
    if (!user?.id) {
      console.log("load: user_id not available yet, skipping inventory fetch");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Use fetchInventory which now uses Express API for consistency
      const productsPromise = isAdmin 
        ? api<Product[]>("/super-admin/inventory-products", { token })
        : fetchInventory(user.id);

      const [productsData, inv, br, supInv, prodRequests, prodLogistics, supHr, tlStaff] = await Promise.allSettled([
        productsPromise,
        api<InvoicesResponse>("/inventory/invoices", { token }),
        api<{
          branding: { activityType?: string; companyName?: string; logoDataUrl?: string };
        }>("/user/branding", { token }),
        fetchInventory(user.id),
        fetchProductionRequestsBackend(token),
        fetchLogisticsQueueBackend(token),
        fetchHrStaff(),
        tlWorkers(token),
      ]);
      startTransition(() => {
        // Ensure products are fetched from database directly
        const products = productsData.status === "fulfilled" 
          ? (Array.isArray(productsData.value) ? productsData.value : (productsData.value.data || [])) 
          : [];
        setProducts(products as Product[]);
        setInvoices(inv.status === "fulfilled" ? inv.value.invoices : []);
        if (supInv.status === "fulfilled") setInventoryItems(supInv.value);
        if (prodRequests.status === "fulfilled") setProductionRequests(prodRequests.value);
        if (prodLogistics.status === "fulfilled") setLogisticsQueue(prodLogistics.value);
        if (supHr.status === "fulfilled") setHrStaff(supHr.value);
        if (tlStaff.status === "fulfilled") {
          const workers = Array.isArray(tlStaff.value) ? tlStaff.value : [];
          setTlWorkerList(workers);
          setSelectedProductionWorkerId((prev) => prev || (workers.length > 0 ? workers[0].id : ""));
          setSelectedLogisticsAssignee((prev) => prev || (workers.length > 0 ? workers[0].id : ""));
        }
        if (br.status === "fulfilled" && br.value.branding) {
          const act = br.value.branding.activityType || "retail";
          setBrandingPrefs({
            activityType: act,
            companyName: br.value.branding.companyName || "",
            logoDataUrl: br.value.branding.logoDataUrl || "",
          });
          setNewProduct((n) => ({ ...n, retail_type: act }));
        }
      });
      
      // Force refresh inventory tables to ensure UI shows latest data from DB
      await refreshInventoryTables();
    } catch (err) {
      console.error("[InventoryPosModule] load failed", err);
    } finally {
      setLoading(false);
    }
  }, [token, user?.id]);

  const saveBrandingActivity = async () => {
    if (!token || isSavingActivity) return;
    setIsSavingActivity(true);
    try {
      const res = await api<{ ok: boolean }>("/user/branding", {
        method: "PUT",
        token,
        body: JSON.stringify({
          companyName: brandingPrefs.companyName,
          activityType: brandingPrefs.activityType,
          logoDataUrl: brandingPrefs.logoDataUrl,
        }),
      });
      if (!res.ok) throw new Error(t("pay.errGeneric"));
      setNewProduct((n) => ({ ...n, retail_type: brandingPrefs.activityType || "retail" }));
      toast.success(t("common.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    } finally {
      setIsSavingActivity(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !magicParam) {
      setCtxWorker(null);
      return;
    }
    let active = true;
    void tlResolveMagic(magicParam, token)
      .then((res) => {
        if (active) setCtxWorker(res?.worker ?? null);
      })
      .catch(() => {
        if (active) setCtxWorker(null);
      });
    return () => {
      active = false;
    };
  }, [token, magicParam]);

  const refreshProductionData = useCallback(async () => {
    if (!token) return;
    const [backendRequests, backendLogistics, supInv] = await Promise.allSettled([
      fetchProductionRequestsBackend(token),
      fetchLogisticsQueueBackend(token),
      fetchInventory(user?.id),
    ]);
    if (backendRequests.status === "fulfilled") setProductionRequests(backendRequests.value);
    if (backendLogistics.status === "fulfilled") setLogisticsQueue(backendLogistics.value);
    if (supInv.status === "fulfilled") setInventoryItems(supInv.value);
  }, [token, user?.id]);

  const inventorySourceRows = useMemo(() => {
    const supabaseRows = inventoryItems.map(inventoryRowFromSupabase);
    if (supabaseRows.length > 0) return supabaseRows;
    return products.map(inventoryRowFromProduct);
  }, [inventoryItems, products]);

  const filteredInventoryRows = useMemo(() => {
    const q = normalizeLookupText(inventorySearch);
    if (!q) return inventorySourceRows;
    return inventorySourceRows.filter((row) => {
      const haystack = [row.name, row.sku, row.barcode, row.reference, row.id]
        .map(normalizeLookupText)
        .join(" ");
      return haystack.includes(q);
    });
  }, [inventorySourceRows, inventorySearch]);

  const productionWorkers = useMemo(
    () =>
      tlWorkerList.filter((worker) =>
        ["production", "logistics", "quality"].includes(worker.department)
      ),
    [tlWorkerList]
  );

  const effectiveSender = useMemo(() => {
    if (ctxWorker) return ctxWorker;
    return (
      tlWorkerList.find((worker) => worker.id === selectedProductionWorkerId) ??
      productionWorkers.find((worker) => ["manager", "hr", "admin"].includes(worker.hierarchy_role)) ??
      productionWorkers[0] ??
      tlWorkerList[0] ??
      null
    );
  }, [ctxWorker, productionWorkers, selectedProductionWorkerId, tlWorkerList]);

  const workerNameById = useMemo(
    () => new Map(tlWorkerList.map((worker) => [worker.id, worker.full_name])),
    [tlWorkerList]
  );

  const loadInventoryMessages = useCallback(async () => {
    if (!token || !effectiveSender) {
      setMessages([]);
      setMessageRecipients([]);
      return;
    }
    try {
      const [msg, rec] = await Promise.all([
        tlMessages(token, effectiveSender.id),
        tlMessageRecipients(token, effectiveSender.id),
      ]);
      setMessages(msg.messages);
      setMessageRecipients(rec.recipients);
      setMessageTo((prev) =>
        prev && rec.recipients.some((recipient) => recipient.id === prev)
          ? prev
          : rec.recipients[0]?.id ?? ""
      );
    } catch (err) {
      setMessages([]);
      setMessageRecipients([]);
      if (approvedModules.includes("transport_logistics")) {
        toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
      }
    }
  }, [approvedModules, effectiveSender, t, token]);

  useEffect(() => {
    void loadInventoryMessages();
  }, [loadInventoryMessages]);

  const addBomItem = (item: InventorySourceRow) => {
    setBomItems((current) => {
      const existing = current.find((i) => i.material_id === item.id);
      if (existing) {
        return current.map((i) =>
          i.material_id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...current,
        {
          material_id: item.id,
          name: item.name,
          quantity: 1,
          available: item.qty,
          reference: item.sku || item.barcode || item.reference || undefined,
          source: item.source,
        },
      ];
    });
  };

  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume audio context if suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (e) {
      console.error("Error playing success sound:", e);
    }
  };

  const playWarningSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 300;
      oscillator.type = 'sawtooth';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Ignore audio errors
    }
  };

  const undoSale = async () => {
    if (!previousDraftLines?.length) return;
    try {
      // Restore stock for each line
      for (const line of previousDraftLines) {
        await updateProductStock(line.product_id, line.qty_pieces);
      }

      // Restore draft lines
      setDraftLines(previousDraftLines);
      setPreviousDraftLines([]);

      // Update local state immediately
      setProducts((prevProducts) => 
        prevProducts.map((product) => {
          const restoredLine = previousDraftLines.find((l) => l.product_id === product.id);
          if (restoredLine) {
            return {
              ...product,
              stock_pieces: Number(product.stock_pieces || 0) + restoredLine.qty_pieces,
            };
          }
          return product;
        })
      );

      toast.success("تم التراجع عن البيع بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const updateBomQuantity = (materialId: string, quantity: number) => {
    setBomItems((current) =>
      current.map((item) =>
        item.material_id === materialId
          ? { ...item, quantity: Math.max(1, Math.floor(Number(quantity) || 1)) }
          : item
      )
    );
  };

  const reserveBomMaterial = async (materialId: string) => {
    const item = bomItems.find((row) => row.material_id === materialId);
    if (!item || !token) return;
    try {
      if (item.source === "supabase") {
        // Pass user.id from AuthContext to reserveMaterial
        await reserveMaterial(materialId, item.quantity, user?.id);

        // Update local state immediately without full refresh - use map to preserve all products
        setProducts((prevProducts) =>
          prevProducts.map((product) => {
            if (product.id === materialId) {
              return {
                ...product,
                stock_pieces: Math.max(0, Number(product.stock_pieces || 0) - item.quantity),
              };
            }
            return product; // Keep all other products unchanged
          })
        );
      } else {
        await reserveProductionMaterialBackend(token, {
          product_id: materialId,
          quantity: item.quantity,
          source: item.source,
        });
        await load();
      }
      await refreshProductionData();
      toast.success(t("common.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const createProductionRequestHandler = async () => {
    if (!bomItems?.length || !token) return;
    setIsCreatingRequest(true);
    try {
      const requestedBy = selectedLogisticsAssignee || effectiveSender?.id || selectedProductionWorkerId || "inventory-module";
      const inserted = await createProductionRequestBackend(token, {
        title: `${t("inv.production.requestTitlePrefix")} - ${bomItems.map((item) => item.name).join(", ").slice(0, 140)}`,
        target_quantity: bomItems.reduce((sum, item) => sum + item.quantity, 0),
        status: "pending",
        requested_by: requestedBy,
        bom_items: bomItems.map((item) => ({
          material_id: item.material_id,
          quantity: item.quantity,
          name: item.name,
          reference: item.reference,
          source: item.source,
        })),
      });
      await refreshProductionData();
      setBomItems([]);
      if (inserted?.id) toast.success(t("common.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    } finally {
      setIsCreatingRequest(false);
    }
  };

  const addFirstSearchMatchToBom = () => {
    const first = filteredInventoryRows[0];
    if (!first) {
      toast.error(t("inv.production.noSearchMatch"));
      return;
    }
    addBomItem(first);
  };

  const assignLogisticsQueueItem = async (id: string) => {
    if (!selectedLogisticsAssignee || !token) {
      toast.error(t("inv.production.pickAssignee"));
      return;
    }
    setIsAssigningLogistics(true);
    try {
      await assignLogisticsItemBackend(token, id, selectedLogisticsAssignee);
      await refreshProductionData();
      toast.success(t("common.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    } finally {
      setIsAssigningLogistics(false);
    }
  };

  const sendInventoryMessage = async () => {
    if (!token || !effectiveSender || !messageTo) return;
    if (!messageBody.trim() && !messageFile) {
      toast.error(t("inv.msg.needTextOrFile"));
      return;
    }
    setIsSendingMessage(true);
    try {
      if (messageFile) {
        await tlSendMessageWithFile(
          token,
          {
            from_worker_id: effectiveSender.id,
            to_worker_id: messageTo,
            body: messageBody.trim() || t("inv.msg.attachmentFallback"),
          },
          messageFile
        );
      } else {
        await tlSendMessage(token, {
          from_worker_id: effectiveSender.id,
          to_worker_id: messageTo,
          body: messageBody.trim(),
        });
      }
      setMessageBody("");
      setMessageFile(null);
      await loadInventoryMessages();
      toast.success(t("common.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    } finally {
      setIsSendingMessage(false);
    }
  };

  const openInventoryMessageAttachment = async (message: TlMessage) => {
    if (!token || !message.attachment_stored_path) return;
    try {
      await tlDownloadMessageAttachment(
        token,
        message.id,
        message.attachment_original_name || "download"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const addProduct = async () => {
    const name = newProduct.name.trim();
    if (!token || isAddingProduct || !name) return;
    setIsAddingProduct(true);
    try {
      const payload: ProductWritePayload = {
        name,
        sku: newProduct.sku.trim(),
        retail_type: newProduct.retail_type || brandingPrefs.activityType || "retail",
        pieces_per_carton: Math.max(1, Math.floor(Number(newProduct.pieces_per_carton) || 1)),
        unit_price: Math.max(0, Number(newProduct.unit_price) || 0),
        stock_pieces: Math.max(0, Math.floor(Number(newProduct.stock_pieces) || 0)),
        unit_kind: newProduct.unit_kind || "piece",
        cost_price: Math.max(0, Number(newProduct.cost_price) || 0),
        expiry_date: newProduct.expiry_date.trim() || null,
        low_stock_alert: Math.max(0, Math.floor(Number(newProduct.low_stock_alert) || 10)),
        video_url: newProduct.video_url?.trim() || null,
        video_file_path: newProduct.video_file_path?.trim() || null,
        video_file_name: newProduct.video_file_name?.trim() || null,
        video_mime: newProduct.video_mime?.trim() || null,
      };
      const created = await api<ProductCreateResponse>("/inventory/products", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      const fresh = await api<ProductsResponse>("/inventory/products", { token });
      startTransition(() => {
        setProducts(fresh.products);
        const idx = fresh.products.findIndex((p) => p.id === created.id);
        if (idx >= 0) setQuickListIndex(idx);
      });
      setNewProduct((n) => ({
        ...n,
        name: "",
        sku: "",
        stock_pieces: "0",
        video_url: "",
        video_file_path: "",
        video_file_name: "",
        video_mime: "",
      }));
      toast.success(t("common.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    } finally {
      setIsAddingProduct(false);
    }
  };

  const addStock = async () => {
    if (!token || !stockAdd.product_id) return;
    try {
      await api("/inventory/stock-add", {
        method: "POST",
        token,
        body: JSON.stringify({
          product_id: stockAdd.product_id,
          add_pieces: Number(stockAdd.add) || 0,
        }),
      });
      setStockAdd({ product_id: "", add: "0" });
      await refreshInventoryTables();
      
      // Log the operation
      await logShiftOperation('إضافة مخزون', `إضافة ${stockAdd.add} قطعة للمنتج: ${stockAdd.product_id}`);
      
      toast.success(t("common.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const submitQuickDraft = async () => {
    if (!supabase || !draftLines?.length) return;
    const ovRaw = manualTotalOverride.trim().replace(",", ".");
    let override_total: number | undefined;
    if (ovRaw !== "") {
      const n = parseFloat(ovRaw);
      if (Number.isFinite(n) && n >= 0) override_total = n;
    }
    try {
      console.log("submitQuickDraft - Starting sale process");
      console.log("submitQuickDraft - draftLines:", JSON.stringify(draftLines, null, 2));
      console.log("submitQuickDraft - user_id:", user?.id);

      // Use user.id from AuthContext
      const authUserId = user?.id;
      if (!authUserId) {
        console.error("[submitQuickDraft] No user ID from AuthContext");
        toast.error(locale.startsWith("ar") ? 'يجب تسجيل الدخول' : 'Must be logged in');
        return;
      }
      console.log("[submitQuickDraft] Using user ID from AuthContext:", authUserId);

      // Deduct stock from inventory_products table
      for (const line of draftLines) {
        console.log("submitQuickDraft - Deducting stock for product:", line.product_id, "qty:", line.qty_pieces);
        await updateProductStock(line.product_id, -line.qty_pieces, authUserId);
      }

      console.log("submitQuickDraft - Calling sale-batch API");
      const saleResponse = await api<{ id: string; total: number; credit: number }>("/inventory/sale-batch", {
        method: "POST",
        token,
        body: JSON.stringify({
          lines: draftLines.map((l) => ({
            product_id: l.product_id,
            qty_pieces: l.qty_pieces,
            line_total: l.line_total,
          })),
          customer_name: sale.customer,
          paid: Number(sale.paid) || 0,
          due_at: sale.due_at || null,
          ...(override_total != null ? { override_total } : {}),
        }),
      });
      
      console.log("submitQuickDraft - Sale API response:", saleResponse);
      
      // Store draft lines for undo functionality
      const previousDraftLines = [...draftLines];
      setPreviousDraftLines(previousDraftLines);
      
      setDraftLines([]);
      setManualTotalOverride("");
      
      // Update local state immediately without full refresh
      setProducts((prevProducts) => 
        prevProducts.map((product) => {
          const soldLine = draftLines.find((l) => l.product_id === product.id);
          if (soldLine) {
            return {
              ...product,
              stock_pieces: Math.max(0, Number(product.stock_pieces || 0) - soldLine.qty_pieces),
            };
          }
          return product;
        })
      );
      
      // Play success sound
      playSuccessSound();
      
      // Log the operation
      await logShiftOperation('بيع', `بيع ${draftLines.length} منتجات: ${draftLines.map(l => l.product_name).join(', ')}`);
      
      toast.success("تم تأكيد بيع المسودة بنجاح");
      
      // Move to next product in the list
      const currentIdx = quickListIndex;
      const nextIdx = Math.min(currentIdx + 1, Math.max(0, products.length - 1));
      setQuickListIndex(nextIdx);
      
      // Scroll to next product
      setTimeout(() => {
        const nextProductElement = quickListRef.current?.querySelector(`[data-quick-product-index="${nextIdx}"]`) as HTMLElement;
        nextProductElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      
    } catch (err) {
      console.error("Sale error:", JSON.stringify(err, null, 2));
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const voidSale = async (saleId: string) => {
    if (!token) return;
    if (!window.confirm(t("inv.confirmVoidSale"))) return;
    try {
      // Use API endpoint to void the invoice
      const res = await api<{ success: boolean }>(`/inventory/invoices/${saleId}/void`, {
        method: "PUT",
        token,
      });

      if (!res.success) {
        throw new Error(locale.startsWith("ar") ? "فشل إلغاء البيع" : "Failed to void sale");
      }

      // Update invoices list to reflect voided status
      setInvoices(prev =>
        prev.map(inv =>
          inv.id === saleId ? { ...inv, status: "voided" } : inv
        )
      );

      // Refresh products to get updated stock
      await refreshInventoryTables();

      toast.success(t("inv.saleVoided"));
    } catch (err) {
      console.error("[voidSale] Error:", err);
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const handleEditProduct = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setEditingProductId(productId);
      setEditingProductData({ ...product });
    }
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
    setEditingProductData({});
  };

  const handleSaveProduct = async (productId: string) => {
    if (!supabase) return;
    try {
      console.log("handleSaveProduct - productId:", productId);
      console.log("handleSaveProduct - editingProductData:", JSON.stringify(editingProductData, null, 2));
      
      // Type sanitization - convert string values to numbers
      const sanitizedData = {
        ...editingProductData,
        unit_price: editingProductData.unit_price !== undefined ? Number(editingProductData.unit_price) : 0,
        cost_price: editingProductData.cost_price !== undefined ? Number(editingProductData.cost_price) : 0,
        stock_pieces: editingProductData.stock_pieces !== undefined ? Number(editingProductData.stock_pieces) : 0,
        pieces_per_carton: editingProductData.pieces_per_carton !== undefined ? Number(editingProductData.pieces_per_carton) : 1,
        low_stock_alert: editingProductData.low_stock_alert !== undefined ? Number(editingProductData.low_stock_alert) : 10,
      };

      console.log("handleSaveProduct - sanitizedData:", JSON.stringify(sanitizedData, null, 2));

      // Use Express API for update to bypass RLS and ensure consistency
      await api(`/inventory/products/${productId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(sanitizedData),
      });

      console.log("handleSaveProduct - Update successful via Express API");

      setEditingProductId(null);
      setEditingProductData({});
      
      // Reload from database to ensure state is consistent with latest data
      const freshProducts = await fetchInventory(user?.id);
      setProducts(freshProducts as Product[]);
      
      // Log the operation
      await logShiftOperation('تعديل مخزون', `تعديل المنتج: ${productId}`);
      
      toast.success("تم الحفظ بنجاح");
    } catch (err) {
      console.error("Supabase Error Details - handleSaveProduct:", JSON.stringify(err, null, 2));
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const logShiftOperation = async (operationType: string, details: string) => {
    if (!supabase || !user?.id) {
      console.log("logShiftOperation: supabase or user not available");
      return;
    }

    try {
      // Use user.id from AuthContext
      const authUserId = user?.id;
      if (!authUserId) {
        console.warn("[logShiftOperation] No user ID from AuthContext - skipping shift log (non-critical)");
        return;
      }
      console.log("[logShiftOperation] Using user ID from AuthContext:", authUserId);

      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

      console.log("logShiftOperation called:", { operationType, details, today, shiftGroup, userId: authUserId });

      // Super Admin: use Express API for shift reports
      let existingReport = null;
      if (isAdmin) {
        try {
          const reports = await api<any[]>("/super-admin/shift-reports", { token });
          existingReport = reports.find((r: any) => 
            r.shift_date === today && 
            r.shift_group === shiftGroup && 
            r.user_id === authUserId
          ) || null;
        } catch (error) {
          console.error("[Super Admin] Error fetching shift reports:", error);
          return;
        }
      } else {
        // Regular user: use Supabase
        const { data: existingReportData, error: fetchError } = await supabase
          .from("shift_reports")
          .select("*")
          .eq("shift_date", today)
          .eq("shift_group", shiftGroup)
          .eq("user_id", authUserId)
          .maybeSingle();

        if (fetchError) {
          console.error("Error fetching shift report:", fetchError);
          return;
        }
        existingReport = existingReportData;
      }

      const operationLog = {
        date: today,
        time: time,
        shift: `Shift ${shiftGroup}`,
        user: user.name || user.email || 'Unknown',
        action: operationType,
        type: operationType,
        details: details,
        product_name: details.match(/Product:\s*([^,]+)/)?.[1] || null,
        product_sku: details.match(/SKU:\s*([^,]+)/)?.[1] || details.match(/Barcode:\s*([^,]+)/)?.[1] || null
      };

      if (existingReport) {
        console.log("Updating existing report:", existingReport.id);
        // Update existing report
        const updates: any = {
          operations_log: [...(existingReport.operations_log || []), operationLog],
          total_operations: (existingReport.total_operations || 0) + 1
        };

        // Increment specific counter based on operation type
        switch (operationType) {
          case 'بيع':
            updates.sales_count = (existingReport.sales_count || 0) + 1;
            break;
          case 'إضافة مخزون':
            updates.stock_add_count = (existingReport.stock_add_count || 0) + 1;
            break;
          case 'تعديل مخزون':
            updates.stock_edit_count = (existingReport.stock_edit_count || 0) + 1;
            break;
          case 'استيراد':
            updates.import_count = (existingReport.import_count || 0) + 1;
            break;
          case 'تصدير':
            updates.export_count = (existingReport.export_count || 0) + 1;
            break;
          case 'حذف':
            updates.delete_count = (existingReport.delete_count || 0) + 1;
            break;
        }

        try {
          if (isAdmin) {
            // Super Admin: use Express API
            await api(`/super-admin/shift-reports/${existingReport.id}`, {
              method: "PUT",
              token,
              body: JSON.stringify({
                ...updates,
                customer_name: shiftCustomerName || existingReport.customer_name,
                customer_number: shiftCustomerPhone || existingReport.customer_number,
                week: shiftWeek || existingReport.week
              })
            });
          } else {
            // Regular user: use Supabase
            const { data: updatedReport, error: updateError } = await supabase
              .from("shift_reports")
              .update({
                ...updates,
                customer_name: shiftCustomerName || existingReport.customer_name,
                customer_number: shiftCustomerPhone || existingReport.customer_number,
                week: shiftWeek || existingReport.week
              })
              .eq("id", existingReport.id)
              .select()
              .single();

            if (updateError) {
              console.error("Error updating shift report:", updateError);
            } else if (updatedReport) {
              console.log("Report updated successfully:", updatedReport);
              // Update selectedShiftReport to reflect changes in UI immediately
              setSelectedShiftReport(updatedReport);
              // Force reload to ensure UI shows latest data
              await loadShiftReport();
            }
          }
        } catch (error) {
          console.error("Error updating shift report:", error);
        }  
    } else {
      console.log("Creating new report");
      // Create new shift report
      const newReport = {
        id: crypto.randomUUID(),
        user_id: authUserId,
        shift_group: shiftGroup,
        shift_date: today,
        start_time: shiftStartTime?.toISOString() || now,
        end_time: shiftEndTime?.toISOString() || null,
        shift_description: shiftGroup === 'A' ? 'النوبة الصباحية (08:00 - 14:00)' : shiftGroup === 'B' ? 'النوبة المسائية (14:00 - 22:00)' : 'النوبة الليلية (22:00 - 06:00)',
        sales_count: operationType === 'بيع' ? 1 : 0,
        stock_add_count: operationType === 'إضافة مخزون' ? 1 : 0,
        stock_edit_count: operationType === 'تعديل مخزون' ? 1 : 0,
        import_count: operationType === 'استيراد' ? 1 : 0,
        export_count: operationType === 'تصدير' ? 1 : 0,
        delete_count: operationType === 'حذف' ? 1 : 0,
        total_operations: 1,
        operations_log: [operationLog],
        customer_name: shiftCustomerName,
        customer_number: shiftCustomerPhone,
        week: shiftWeek
      };

      try {
        if (isAdmin) {
          // Super Admin: use Express API
          await api("/super-admin/shift-reports", {
            method: "POST",
            token,
            body: JSON.stringify(newReport)
          });
        } else {
          // Regular user: use Supabase
          const { data: createdReport, error: insertError } = await supabase
            .from("shift_reports")
            .insert([newReport])
            .select()
            .single();

          if (insertError) {
            console.error("Error creating shift report:", insertError);
          } else if (createdReport) {
            console.log("Report created successfully:", createdReport);
            setSelectedShiftReport(createdReport);
            // Force reload to ensure UI shows latest data
            await loadShiftReport();
          }
        }
      } catch (insertError) {
        console.error("Silent error in insert operation:", insertError);
      }
    }
  } catch (error) {
    console.error("Silent error in logShiftOperation:", error);
    // Silent catch - don't affect main operations
  }
};

  const loadShiftReport = async () => {
    if (!user?.id) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      console.log("Loading shift report for:", { today, shiftGroup, userId: user.id });
      
      let report = null;
      if (isAdmin) {
        // Super Admin: use Express API
        const reports = await api<any[]>("/super-admin/shift-reports", { token });
        report = reports.find((r: any) => 
          r.shift_date === today && 
          r.shift_group === shiftGroup && 
          r.user_id === user.id
        ) || null;
      } else {
        // Regular user: use Supabase
        const { data: reportData, error } = await supabase
          .from("shift_reports")
          .select("*")
          .eq("shift_date", today)
          .eq("shift_group", shiftGroup)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.log("No existing shift report found, will calculate from activity logs");
        }
        report = reportData;
      }

      if (report) {
        console.log("Found shift report:", report);
        // Ensure operations_log is an array
        if (!report.operations_log || !Array.isArray(report.operations_log)) {
          report.operations_log = [];
        }
        setSelectedShiftReport(report);
        // Load saved customer info
        if (report.customer_name) setShiftCustomerName(report.customer_name);
        if (report.customer_number) setShiftCustomerPhone(report.customer_number);
        if (report.week) setShiftWeek(report.week);
      } else {
        console.log("No shift report found, calculating from all shift_reports for today");
        // Calculate statistics from shift_reports table - fetch all reports for user and date (no shift requirement)
        const { data: allReports, error: reportsError } = await supabase
          .from("shift_reports")
          .select("*")
          .eq("shift_date", today)
          .eq("user_id", user.id);

        console.log("All shift reports query result:", { reportsError, reports: allReports?.length });

        if (!reportsError && allReports && allReports.length > 0) {
          // Aggregate all operations from all shift reports for today
          const allOperations = allReports.flatMap(report => 
            (report.operations_log && Array.isArray(report.operations_log)) ? report.operations_log : []
          );

          console.log("Total operations found:", allOperations.length);

          // Calculate counts from operations_log - check Arabic action values
          const salesCount = allOperations.filter((op: any) => 
            op.action === 'بيع' || op.action === 'بيع منتج'
          ).length;
          const stockAddCount = allOperations.filter((op: any) => 
            op.action === 'إضافة مخزون'
          ).length;
          const stockEditCount = allOperations.filter((op: any) => 
            op.action === 'تعديل مخزون'
          ).length;
          const importCount = allOperations.filter((op: any) => 
            op.action === 'استيراد'
          ).length;
          const exportCount = allOperations.filter((op: any) => 
            op.action === 'تصدير'
          ).length;
          const deleteCount = allOperations.filter((op: any) => 
            op.action === 'حذف'
          ).length;

          console.log("Calculated counts:", { salesCount, stockAddCount, stockEditCount, importCount, exportCount, deleteCount });

          // Create a temporary report with calculated statistics
          const tempReport = {
            id: 'temp',
            shift_date: today,
            shift_group: shiftGroup,
            user_id: user.id,
            sales_count: salesCount,
            stock_add_count: stockAddCount,
            stock_edit_count: stockEditCount,
            import_count: importCount,
            export_count: exportCount,
            delete_count: deleteCount,
            total_operations: allOperations.length,
            operations_log: allOperations
          };
          
          console.log("Created temporary report from shift_reports:", tempReport);
          setSelectedShiftReport(tempReport);
        } else {
          console.log("No shift reports found either, clearing state");
          setSelectedShiftReport(null);
        }
      }
    } catch (error) {
      console.error("Error loading shift report:", error);
    }
  };

  // Load shift report when shift group changes or component mounts
  useEffect(() => {
    loadShiftReport();
  }, [shiftGroup, user?.id]);

  // Auto-load shift report when reports tab is opened
  useEffect(() => {
    if (invTab === "reports") {
      loadShiftReport();
    }
  }, [invTab]);

  // Auto-load shift report after any operation to ensure UI is updated
  useEffect(() => {
    if (selectedShiftReport) {
      loadShiftReport();
    }
  }, [selectedShiftReport?.total_operations, selectedShiftReport?.sales_count, selectedShiftReport?.stock_add_count, selectedShiftReport?.stock_edit_count, selectedShiftReport?.import_count, selectedShiftReport?.export_count, selectedShiftReport?.delete_count]);

  const handleDeleteProduct = async (productId: string) => {
    if (!supabase) return;
    if (!window.confirm(t("inv.confirmDelete"))) return;
    try {
      console.log("handleDeleteProduct - Deleting product:", productId);
      console.log("handleDeleteProduct - user_id:", user?.id);

      // Use Express API for deletion to bypass RLS and ensure consistency
      await api(`/inventory/products/${productId}`, {
        method: "DELETE",
        token,
      });

      console.log("handleDeleteProduct - Delete successful via Express API");

      // Immediately remove from local state to prevent UI lag
      setProducts((prev) => prev.filter((p) => p.id !== productId));

      // Reload from database to ensure state is consistent
      const freshProducts = await fetchInventory(user?.id);
      setProducts(freshProducts as Product[]);

      // Force refresh inventory tables to ensure UI is updated
      await refreshInventoryTables();

      // Log the operation
      await logShiftOperation('حذف', `حذف المنتج: ${productId}`);

      toast.success("تم الحذف بنجاح");
    } catch (err) {
      console.error("Supabase Error Details - handleDeleteProduct:", JSON.stringify(err, null, 2));
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const handleEditProductChange = (productId: string, patch: Partial<Product>) => {
    setEditingProductData((prev) => ({ ...prev, ...patch }));
  };

  const handleInventoryRowClick = (index: number) => {
    setInventoryListIndex(index);
  };

  const handleRefreshControlPanel = async () => {
    await refreshInventoryTables();
  };

  const handleExportControlPanel = () => {
    void exportExcel();
  };

  const handleDeleteProductionRequest = async (id: string) => {
    if (!token) return;
    if (!window.confirm(t("inv.confirmDelete"))) return;
    try {
      await api(`/inventory/production-requests/${id}`, {
        method: "DELETE",
        token,
      });
      await refreshInventoryTables();
      toast.success("تم الحذف بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const handleDeleteLogisticsQueueItem = async (id: string) => {
    if (!token) return;
    if (!window.confirm(t("inv.confirmDelete"))) return;
    try {
      await api(`/inventory/logistics-queue/${id}`, {
        method: "DELETE",
        token,
      });
      await refreshInventoryTables();
      toast.success("تم الحذف بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const handleDeleteSelectedProductionRequests = async (ids: string[]) => {
    if (!token) return;
    if (!ids?.length) return;
    if (!window.confirm(t("inv.confirmDelete"))) return;
    try {
      await api("/inventory/production-requests/batch-delete", {
        method: "POST",
        token,
        body: JSON.stringify({ ids }),
      });
      await refreshInventoryTables();
      toast.success("تم الحذف بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const handleDeleteSelectedLogisticsQueueItems = async (ids: string[]) => {
    if (!token) return;
    if (!ids?.length) return;
    if (!window.confirm(t("inv.confirmDelete"))) return;
    try {
      await api("/inventory/logistics-queue/batch-delete", {
        method: "POST",
        token,
        body: JSON.stringify({ ids }),
      });
      await refreshInventoryTables();
      toast.success("تم الحذف بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const handleToggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectAllProducts = () => {
    if (selectedProductIds.size === products.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(products.map((p) => p.id)));
    }
  };

  const handleDeleteSelectedProducts = async () => {
    if (!token) return;
    if (selectedProductIds.size === 0) return;
    if (!window.confirm(t("inv.confirmDelete"))) return;
    try {
      // Use Express API for batch deletion to bypass RLS and ensure consistency
      for (const productId of selectedProductIds) {
        await api(`/inventory/products/${productId}`, {
          method: "DELETE",
          token,
        });
      }
      
      // Remove only the deleted products from local state
      setProducts(prev => prev.filter(p => !selectedProductIds.has(p.id)));
      setSelectedProductIds(new Set());
      
      // Reload from database to ensure state is consistent
      await refreshInventoryTables();
      
      // Log the operation
      await logShiftOperation('حذف', `حذف ${selectedProductIds.size} منتجات`);
      
      toast.success("تم الحذف بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pay.errGeneric"));
    }
  };

  const filteredQuickProducts = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) return products;
    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    );
    // Sort: products that start with the query first, then others
    return filtered.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q);
      const bStarts = b.name.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [products, quickSearch]);

  const overdueCredits = useMemo(
    () =>
      invoices.filter(
        (i) => (i.credit ?? 0) > 0 && i.due_at && new Date(i.due_at) < new Date()
      ),
    [invoices]
  );

  const currentLinePreview = useMemo(() => {
    const p = filteredQuickProducts[quickListIndex];
    if (!p) return { line: 0, profit: 0, pp: 1 };
    const pp = piecesPerQuickUnit(p, quickUnit);
    const line = pp * p.unit_price;
    const cost = Math.max(0, Number(p.cost_price) || 0);
    const profit = pp * (p.unit_price - cost);
    return { line, profit, pp };
  }, [filteredQuickProducts, quickListIndex, quickUnit]);

  const draftGrandTotal = useMemo(
    () => draftLines.reduce((s, l) => s + l.line_total, 0),
    [draftLines]
  );

  const effectiveSaleTotal = useMemo(() => {
    const raw = manualTotalOverride.trim().replace(",", ".");
    if (raw === "") return draftGrandTotal;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n >= 0 ? n : draftGrandTotal;
  }, [manualTotalOverride, draftGrandTotal]);

  const productsLite = useMemo(
    (): ProductLite[] =>
      products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        unit_price: p.unit_price,
        stock_pieces: p.stock_pieces,
        pieces_per_carton: p.pieces_per_carton,
      })),
    [products]
  );

  const applyPosVisionItems = useCallback(
    async (items: VisionReceiptItem[]) => {
      if (!token || !items?.length) return;
      const lite: ProductLite[] = productsLite.map((p) => ({ ...p }));
      const newDraft: DraftLine[] = [];
      for (const it of items) {
        const qtyWant = Math.max(1, Math.floor(it.quantity));
        let p = bestCatalogMatch(it.product_name, lite);
        if (!p) {
          const r = await api<{ id: string }>("/inventory/products", {
            method: "POST",
            token,
            body: JSON.stringify({
              name: it.product_name.trim().slice(0, 240),
              sku: `AI-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
              retail_type: brandingPrefs.activityType || "retail",
              pieces_per_carton: 1,
              unit_price: it.unit_price > 0 ? it.unit_price : 0,
              stock_pieces: qtyWant,
              unit_kind: "piece",
              cost_price: 0,
              low_stock_alert: 10,
            }),
          });
          p = {
            id: r.id,
            name: it.product_name.trim(),
            sku: "",
            unit_price: it.unit_price > 0 ? it.unit_price : 0,
            stock_pieces: qtyWant,
            pieces_per_carton: 1,
          };
          lite.push(p);
        }
        const unit = it.unit_price > 0 ? it.unit_price : p.unit_price;
        newDraft.push({
          id: crypto.randomUUID(),
          product_id: p.id,
          product_name: p.name,
          qty_pieces: qtyWant,
          sale_unit: "piece",
          line_total: Math.round(qtyWant * unit * 100) / 100,
        });
      }
      setDraftLines((d) => [...d, ...newDraft]);
      await load();
    },
    [token, productsLite, brandingPrefs.activityType, load]
  );

  const applyStockVisionItems = useCallback(
    async (items: VisionReceiptItem[]) => {
      if (!token || !items?.length) return;
      const lite: ProductLite[] = productsLite.map((p) => ({ ...p }));
      for (const it of items) {
        const add = Math.max(0, Math.floor(it.quantity));
        let p = bestCatalogMatch(it.product_name, lite);
        if (!p) {
          const r = await api<{ id: string }>("/inventory/products", {
            method: "POST",
            token,
            body: JSON.stringify({
              name: it.product_name.trim().slice(0, 240),
              sku: `STK-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
              retail_type: brandingPrefs.activityType || "retail",
              pieces_per_carton: 1,
              unit_price: it.unit_price > 0 ? it.unit_price : 0,
              stock_pieces: add,
              unit_kind: "piece",
              cost_price: 0,
              low_stock_alert: 10,
            }),
          });
          p = {
            id: r.id,
            name: it.product_name.trim(),
            sku: "",
            unit_price: it.unit_price > 0 ? it.unit_price : 0,
            stock_pieces: add,
            pieces_per_carton: 1,
          };
          lite.push(p);
          continue;
        }
        if (it.unit_price > 0 && Number.isFinite(it.unit_price)) {
          await api(`/inventory/products/${p.id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ unit_price: it.unit_price }),
          });
        }
        if (add > 0) {
          await api("/inventory/stock-add", {
            method: "POST",
            token,
            body: JSON.stringify({
              product_id: p.id,
              add_pieces: add,
            }),
          });
        }
      }
      
      // Reload from database to ensure all imported items are visible immediately
      const freshProducts = await fetchInventory(user?.id);
      setProducts(freshProducts as Product[]);
    },
    [token, productsLite, brandingPrefs.activityType, user?.id]
  );

  const applyPosOcrText = useCallback(
    (text: string) => {
      const rows = parseDraftLinesFromPlainText(text, productsLite, quickUnit);
      if (rows.length > 0) {
        setDraftLines((d) => [...d, ...rows]);
        return;
      }
      const loose = heuristicReceiptItemsFromPlainText(text);
      if (loose.length === 0) {
        window.alert(t("inv.ocrNoMatch"));
        return;
      }
      void applyPosVisionItems(loose);
    },
    [productsLite, quickUnit, t, applyPosVisionItems]
  );

  const applyStockOcrText = useCallback(
    async (text: string): Promise<void> => {
      const rows = parseStockRowsFromPlainText(text, productsLite);
      if (!token) return;
      if (rows.length > 0) {
        for (const row of rows) {
          if (row.unit_price != null && Number.isFinite(row.unit_price)) {
            await api(`/inventory/products/${row.product_id}`, {
              method: "PATCH",
              token,
              body: JSON.stringify({ unit_price: row.unit_price }),
            });
          }
          await updateProductStock(row.product_id, row.add_pieces);
        }
        return;
      }
      const loose = heuristicReceiptItemsFromPlainText(text);
      if (loose.length === 0) {
        window.alert(t("inv.ocrNoMatch"));
        return;
      }
      await applyStockVisionItems(loose);
    },
    [productsLite, token, load, applyStockVisionItems, t]
  );

  const upsertImportedProducts = async (imported: ProductWritePayload[]) => {
    if (!supabase) return 0;

    console.log("[upsertImportedProducts] Starting import with", imported.length, "items");

    // Use user.id from AuthContext instead of getSession()
    const authUserId = user?.id;
    if (!authUserId) {
      console.error("[upsertImportedProducts] No user ID from AuthContext - cannot proceed");
      return 0;
    }

    console.log("[upsertImportedProducts] Using user ID from AuthContext:", authUserId);

    // Filter existing products to only include those belonging to the current user
    const userProducts = products.filter(p => p.user_id === authUserId);
    console.log("[upsertImportedProducts] Filtered products from", products.length, "to", userProducts.length, "for user:", authUserId);

    const bySku = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const p of userProducts) {
      const sku = p.sku?.trim().toLowerCase() || "";
      if (sku) bySku.set(sku, p.id);
      byName.set(p.name.trim().toLowerCase(), p.id);
    }

    const toUpdate: Array<{ id: string; data: any }> = [];
    const toInsert: Array<any> = [];
    const errors: Array<{ row: number; item: string; error: string }> = [];

    for (let idx = 0; idx < imported.length; idx += 1) {
      const item = imported[idx];

      // Validate required fields
      if (!item.name || item.name.trim() === '') {
        errors.push({
          row: idx + 1,
          item: item.sku || 'unknown',
          error: 'Missing product name'
        });
        console.warn("[upsertImportedProducts] Skipping row", idx + 1, "- missing product name");
        continue;
      }

      const skuKey = item.sku?.trim().toLowerCase() || "";
      const nameKey = item.name.trim().toLowerCase();
      const existingId = (skuKey ? bySku.get(skuKey) : undefined) ?? byName.get(nameKey);

      // Type sanitization with explicit number conversion and validation
      const sanitizedItem = {
        name: item.name.trim(),
        sku: item.sku?.trim() || "",
        unit_price: typeof item.unit_price === 'number' && Number.isFinite(item.unit_price) ? item.unit_price : (Number(item.unit_price) || 0),
        cost_price: typeof item.cost_price === 'number' && Number.isFinite(item.cost_price) ? item.cost_price : (item.cost_price !== undefined ? Number(item.cost_price) : 0),
        stock_pieces: typeof item.stock_pieces === 'number' && Number.isFinite(item.stock_pieces) ? item.stock_pieces : (Number(item.stock_pieces) || 1),
        pieces_per_carton: typeof item.pieces_per_carton === 'number' && Number.isFinite(item.pieces_per_carton) ? item.pieces_per_carton : (item.pieces_per_carton !== undefined ? Number(item.pieces_per_carton) : 1),
        low_stock_alert: typeof item.low_stock_alert === 'number' && Number.isFinite(item.low_stock_alert) ? item.low_stock_alert : (item.low_stock_alert !== undefined ? Number(item.low_stock_alert) : 10),
        retail_type: item.retail_type || 'retail',
        unit_kind: item.unit_kind || 'piece',
      };

      // Additional validation to ensure all numeric fields are valid numbers
      if (!Number.isFinite(sanitizedItem.unit_price)) sanitizedItem.unit_price = 0;
      if (!Number.isFinite(sanitizedItem.cost_price)) sanitizedItem.cost_price = 0;
      if (!Number.isFinite(sanitizedItem.stock_pieces)) sanitizedItem.stock_pieces = 1;
      if (!Number.isFinite(sanitizedItem.pieces_per_carton)) sanitizedItem.pieces_per_carton = 1;
      if (!Number.isFinite(sanitizedItem.low_stock_alert)) sanitizedItem.low_stock_alert = 10;

      if (existingId) {
        toUpdate.push({ id: existingId, data: sanitizedItem });
      } else {
        toInsert.push({ ...sanitizedItem, user_id: authUserId });
      }

      setExportProcessing((s) => ({
        ...s,
        progress: 0.16 + ((idx + 1) / Math.max(1, imported.length)) * 0.72,
      }));
    }

    // Batch updates
    if (toUpdate.length > 0) {
      console.log("[upsertImportedProducts] Batch updating", toUpdate.length, "products");
      if (isAdmin && token) {
        // Super Admin: use Express API to bypass RLS
        for (const { id, data } of toUpdate) {
          try {
            await api(`/super-admin/inventory-products/${id}`, {
              method: "PUT",
              token,
              body: JSON.stringify(data),
            });
          } catch (err) {
            console.error("[upsertImportedProducts] Update error for product", id, ":", err);
            errors.push({ row: -1, item: id, error: String(err) });
          }
        }
      } else {
        // Regular user: use Express API batch endpoint (it handles UPSERT logic)
        try {
          const result = await api<{ inserted: string[]; updated: string[]; errors: Array<{ index: number; error: string }> }>("/inventory/products/batch", {
            method: "POST",
            token,
            body: JSON.stringify(toUpdate.map(u => ({ ...u.data, id: u.id }))),
          });
          console.log("[upsertImportedProducts] Successfully updated", result?.updated?.length || 0, "products via Express API");
          if (result?.errors && result.errors.length > 0) {
            console.warn("[upsertImportedProducts] Batch update had errors:", result.errors);
            result.errors.forEach((err, idx) => {
              errors.push({ row: err.index, item: `item ${err.index}`, error: err.error });
            });
          }
        } catch (err) {
          console.error("[upsertImportedProducts] Batch update exception via Express API:", err);
          errors.push({ row: -1, item: 'batch', error: String(err) });
        }
      }
    }

    // Batch inserts
    if (toInsert.length > 0) {
      console.log("[upsertImportedProducts] Batch inserting", toInsert.length, "products");
      if (isAdmin && token) {
        // Super Admin: use Express API to bypass RLS
        try {
          const inserted = await api<{ id: string }[]>("/super-admin/inventory-products", {
            method: "POST",
            token,
            body: JSON.stringify(toInsert),
          });
          console.log("[upsertImportedProducts] Successfully inserted", inserted?.length || 0, "products via Express API");
        } catch (err) {
          console.error("[upsertImportedProducts] Batch insert exception via Express API:", err);
          errors.push({ row: -1, item: 'batch', error: String(err) });
        }
      } else {
        // Regular user: use Express API batch endpoint
        try {
          const result = await api<{ inserted: string[]; updated: string[]; errors: Array<{ index: number; error: string }> }>("/inventory/products/batch", {
            method: "POST",
            token,
            body: JSON.stringify(toInsert),
          });
          console.log("[upsertImportedProducts] Successfully inserted", result?.inserted?.length || 0, "products via Express API");
          if (result?.errors && result.errors.length > 0) {
            console.warn("[upsertImportedProducts] Batch insert had errors:", result.errors);
            result.errors.forEach((err, idx) => {
              errors.push({ row: err.index, item: `item ${err.index}`, error: err.error });
            });
          }
        } catch (err) {
          console.error("[upsertImportedProducts] Batch insert exception via Express API:", err);
          errors.push({ row: -1, item: 'batch', error: String(err) });
        }
      }
    }

    // Log errors if any
    if (errors.length > 0) {
      console.error("[upsertImportedProducts] Import completed with", errors.length, "errors:", errors);
      // Show error summary to user
      const errorSummary = errors.slice(0, 5).map(e => `Row ${e.row}: ${e.error}`).join('\n');
      if (errors.length > 5) {
        console.warn(`... and ${errors.length - 5} more errors`);
      }
    }

    console.log("[upsertImportedProducts] Finished importing", imported.length, "items (", toUpdate.length, "updated,", toInsert.length, "inserted,", errors.length, "errors)");

    // Reload from database to ensure all imported items are visible
    // Use authUserId to ensure we fetch the products we just inserted
    const freshProducts = await fetchInventory(authUserId);
    console.log("[upsertImportedProducts] Fetched", freshProducts.length, "products from database with user_id:", authUserId);
    setProducts(freshProducts as Product[]);
    console.log("[upsertImportedProducts] Updated products state");

    // Clear search filter to ensure all products are visible
    setQuickSearch("");
    setInventorySearch("");

    return toUpdate.length + toInsert.length;
  };

  const importInventoryFromText = async (text: string) => {
    if (!supabase) return 0;
    
    // Use user.id from AuthContext instead of getSession()
    const authUserId = user?.id;
    if (!authUserId) {
      console.error("[importInventoryFromText] No user ID from AuthContext - cannot proceed");
      return 0;
    }
    console.log("[importInventoryFromText] Using user ID from AuthContext:", authUserId);
    
    const rows = parseStockRowsFromPlainText(text, productsLite);
    if (rows.length > 0) {
      for (const row of rows) {
        if (row.unit_price != null && Number.isFinite(row.unit_price)) {
          // Use Express API for update to bypass RLS and ensure consistency
          await api(`/inventory/products/${row.product_id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ unit_price: Number(row.unit_price) }),
          });
        }
        await updateProductStock(row.product_id, row.add_pieces, authUserId);
      }
      
      // Reload from database to ensure updated items are visible
      console.log("[importInventoryFromText] Reloading from database with user_id:", authUserId);
      const freshProducts = await fetchInventory(authUserId);
      console.log("[importInventoryFromText] Fetched", freshProducts.length, "products from database");
      setProducts(freshProducts as Product[]);
      console.log("[importInventoryFromText] Updated products state");

      // Clear search filter to ensure all products are visible
      setQuickSearch("");
      setInventorySearch("");

      return rows.length;
    }

    const loose = heuristicReceiptItemsFromPlainText(text);
    if (loose.length === 0) {
      window.alert(t("inv.ocrNoMatch"));
      return;
    }
    await applyStockVisionItems(loose);
    return loose.length;
  };

  const handleInventoryImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file || !token || isImportingInventory) return;

    setIsImportingInventory(true);
    setExportProcessing({ active: true, label: t("inv.importProcessing"), progress: 0.08 });
    try {
      const lowerName = file.name.toLowerCase();
      const isSpreadsheet =
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".xls") ||
        lowerName.endsWith(".csv") ||
        file.type.includes("spreadsheet") ||
        file.type === "text/csv";

      let affected = 0;
      if (isSpreadsheet) {
        // Read file with UTF-8 encoding to fix Arabic text corruption
        const wb = XLSX.read(await file.arrayBuffer(), { 
          type: "array", 
          cellDates: true,
          codepage: 65001  // UTF-8 codepage
        });
        const sheetName = wb.SheetNames[0];
        const sheet = sheetName ? wb.Sheets[sheetName] : null;
        if (!sheet) throw new Error(t("inv.importEmptyWorkbook"));
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: true,
        }) as SheetCell[][];
        const imported = parseInventoryImportRows(rows, brandingPrefs.activityType || "retail");
        if (imported.length > 0) {
          affected = await upsertImportedProducts(imported);
        } else {
          // Convert to CSV with UTF-8 encoding
          const text = XLSX.utils.sheet_to_csv(sheet, { FS: "\t" });
          // Decode as UTF-8 to fix encoding issues
          const decodedText = new TextDecoder('utf-8').decode(new TextEncoder().encode(text));
          affected = await importInventoryFromText(decodedText) || 0;
        }
      } else {
        const text = await extractPlainTextFromInventoryFile(file, token);
        // Ensure UTF-8 encoding for text files
        const decodedText = new TextDecoder('utf-8').decode(new TextEncoder().encode(text));
        affected = await importInventoryFromText(decodedText) || 0;
      }

      setExportProcessing((s) => ({ ...s, progress: 1 }));
      
      // Force refresh inventory tables to ensure UI is updated
      await refreshInventoryTables();
      
      // Log the operation
      await logShiftOperation('استيراد', `استيراد ${affected} منتجات من الملف: ${file.name}`);
      
      toast.success(`${t("common.saved")} (${affected})`);
    } catch (err) {
      console.error("Supabase Error Details - handleInventoryImportFile:", err);
      const errorMessage = err instanceof Error ? err.message : t("pay.errGeneric");
      toast.error(errorMessage);
      
      // Send error details to AI assistant
      const errorDetails = {
        message: errorMessage,
        file: "InventoryPosModule.tsx",
        line: 2039,
        stack: err instanceof Error ? err.stack : undefined,
        context: "handleInventoryImportFile - CSV/Excel import"
      };
      
      // Store in localStorage for AI assistant to pick up
      const aiErrors = JSON.parse(localStorage.getItem('superadmin_errors') || '[]');
      aiErrors.unshift({
        id: crypto.randomUUID(),
        type: 'error',
        message: errorMessage,
        file: 'InventoryPosModule.tsx',
        line: 2039,
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date(),
        arabicExplanation: 'فشل استيراد ملف المخزون. السبب المحتمل: عدم تحويل الأسعار والكميات لأرقام أو غياب user_id.',
        fixedCode: `// Fix: Ensure proper type conversion and user_id in handleInventoryImportFile
const sanitizedItem = {
  name: item.name.trim(),
  sku: item.sku?.trim() || "",
  unit_price: Number(item.unit_price) || 0,
  cost_price: Number(item.cost_price) || 0,
  stock_pieces: Number(item.stock_pieces) || 1,
  pieces_per_carton: Number(item.pieces_per_carton) || 1,
  low_stock_alert: Number(item.low_stock_alert) || 10,
  retail_type: item.retail_type || 'retail',
  unit_kind: item.unit_kind || 'piece',
};

const authUserId = session?.user?.id || user?.id;
if (!authUserId) {
  console.error('No auth user ID available');
  return 0;
}

toInsert.push({ ...sanitizedItem, user_id: authUserId });`,
        devonPrompt: `Fix inventory import failure in InventoryPosModule.tsx at handleInventoryImportFile (line 2039):

Error: ${errorMessage}
File: InventoryPosModule.tsx
Line: 2039

1. Ensure all numeric fields are converted using Number()
2. Add user_id from auth.session.user.id to all insert operations
3. Add null checks before processing each row
4. Handle the case where auth session is not available

Apply the fix to ensure CSV/Excel imports work correctly.`
      });
      localStorage.setItem('superadmin_errors', JSON.stringify(aiErrors.slice(0, 50)));
    } finally {
      setIsImportingInventory(false);
      window.setTimeout(() => setExportProcessing({ active: false, label: "" }), 420);
      // Clear any cached import data to prevent state bleeding into manual add
      setQuickSearch("");
      setProducts(await fetchInventory(user?.id));
    }
  };

  const applyQuickStock = async () => {
    if (!supabase || !quickStockProductId) return;
    const add = Math.max(0, Math.floor(Number(quickStockPieces) || 0));
    if (add <= 0) {
      setQuickStockOpen(false);
      setQuickStockProductId(null);
      return;
    }
    await updateProductStock(quickStockProductId, add);
    setQuickStockOpen(false);
    setQuickStockProductId(null);
    await refreshInventoryTables();
  };

  const tryAddQuickLineForProductId = useCallback(
    (productId: string, unitOverride?: QuickUnit) => {
      const u = unitOverride ?? quickUnit;
      const p = products.find((x) => x.id === productId);
      if (!p) return false;
      const pp = piecesPerQuickUnit(p, u);
      const reserved = draftLines
        .filter((l) => l.product_id === p.id)
        .reduce((s, l) => s + l.qty_pieces, 0);
      const available = p.stock_pieces - reserved;
      if (available < pp) {
        playWarningSound();
        // Allow adding to draft even if stock is insufficient - will be checked at sale confirmation
        const lineTotal = pp * p.unit_price;
        setDraftLines((d) => [
          ...d,
          {
            id: crypto.randomUUID(),
            product_id: p.id,
            product_name: p.name,
            qty_pieces: pp,
            sale_unit: u,
            line_total: lineTotal,
          },
        ]);
        const n = products.length;
        const idx = products.findIndex((x) => x.id === productId);
        if (idx >= 0) setQuickListIndex(Math.min(idx + 1, Math.max(0, n - 1)));
        return true;
      }
      const lineTotal = pp * p.unit_price;
      setDraftLines((d) => [
        ...d,
        {
          id: crypto.randomUUID(),
          product_id: p.id,
          product_name: p.name,
          qty_pieces: pp,
          sale_unit: u,
          line_total: lineTotal,
        },
      ]);
      const n = products.length;
      const idx = products.findIndex((x) => x.id === productId);
      if (idx >= 0) setQuickListIndex(Math.min(idx + 1, Math.max(0, n - 1)));
      return true;
    },
    [products, quickUnit, draftLines]
  );

  const resolveGhostBarcode = useCallback(
    async (code: string) => {
      const c = code.trim();
      if (!token || !c) return;
      if (ghostBarcodeBusyRef.current === c) return;
      ghostBarcodeBusyRef.current = c;
      try {
        const existing = products.find((p) => (p.sku || "").trim() === c);
        if (existing) {
          console.log("[resolveGhostBarcode] Found existing product:", existing.name);
          const idx = products.findIndex((p) => p.id === existing.id);
          if (idx >= 0) {
            setQuickListIndex(idx);
            setQuickUnit("piece");
          }

          // Check if product is already in draft lines - if so, increase quantity
          const existingLineIndex = draftLines.findIndex((line) => line.product_id === existing.id);
          if (existingLineIndex >= 0) {
            const existingLine = draftLines[existingLineIndex];
            const newQty = existingLine.qty_pieces + 1;
            const lineTotal = newQty * existing.unit_price;
            setDraftLines((d) => {
              const updated = [...d];
              updated[existingLineIndex] = {
                ...existingLine,
                qty_pieces: newQty,
                line_total: lineTotal,
              };
              return updated;
            });
            console.log("[resolveGhostBarcode] Increased quantity for existing line:", newQty);
          } else {
            // Add new line if not in draft
            const ok = tryAddQuickLineForProductId(existing.id, "piece");
            if (!ok) {
              setQuickStockProductId(existing.id);
              setQuickStockPieces("1");
              setQuickStockOpen(true);
            }
          }
          return;
        }

        // Product not found - create new one
        console.log("[resolveGhostBarcode] Creating new product for barcode:", c);
        const r = await api<{ id: string }>("/inventory/products", {
          method: "POST",
          token,
          body: JSON.stringify({
            name: `${t("inv.ghostBarcodeName")} ${c}`,
            sku: c,
            retail_type: brandingPrefs.activityType || "retail",
            pieces_per_carton: 1,
            unit_kind: "piece",
            stock_pieces: 0,
            unit_price: 0,
            cost_price: 0,
            low_stock_alert: 10,
          }),
        });

        try {
          const info = await lookupBarcodeWithPrice(c);
          if (info) {
            await api(`/inventory/products/${r.id}`, {
              method: "PATCH",
              token,
              body: JSON.stringify({
                name: info.name,
                unit_price: info.price || 0,
              }),
            });
            console.log("[resolveGhostBarcode] Updated product from Open Food Facts:", info.name, "price:", info.price);
          }
        } catch {
          /* ignore */
        }

        try {
          const freshProducts = await fetchInventory(user?.id);
          setProducts(freshProducts as Product[]);
          const idx = freshProducts.findIndex((p) => p.id === r.id);
          if (idx >= 0) {
            setQuickListIndex(idx);
            setQuickUnit("piece");
          }
          const ok = tryAddQuickLineForProductId(r.id, "piece");
          if (!ok) {
            setQuickStockProductId(r.id);
            setQuickStockPieces("1");
            setQuickStockOpen(true);
          }
          console.log("[resolveGhostBarcode] New product added to inventory");
        } catch {
          /* ignore */
        }
      } finally {
        window.setTimeout(() => {
          if (ghostBarcodeBusyRef.current === c) ghostBarcodeBusyRef.current = null;
        }, 400);
      }
    },
    [token, products, brandingPrefs.activityType, t, tryAddQuickLineForProductId, draftLines]
  );

  quickStateRef.current = {
    invTab,
    products,
    quickListIndex,
    quickUnit,
    draftLines,
  };

  useEffect(() => {
    if (products.length === 0) {
      setQuickListIndex(0);
      return;
    }
    setQuickListIndex((i) => Math.min(Math.max(0, i), products.length - 1));
  }, [products.length]);

  useEffect(() => {
    if (invTab !== "pos") return;
    const el = quickListRef.current?.querySelector(
      `[data-quick-idx="${quickListIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [invTab, quickListIndex]);

  // Auto-scroll to first matching product when search changes
  useEffect(() => {
    if (invTab !== "pos" || !quickSearch.trim()) return;
    // Reset to first result when searching
    setQuickListIndex(0);
    // Scroll to first result after a small delay to ensure DOM is updated
    setTimeout(() => {
      const el = quickListRef.current?.querySelector(
        `[data-quick-idx="0"]`
      );
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
  }, [quickSearch, invTab]);

  useEffect(() => {
    if (invTab !== "pos") return;
    const t = window.setTimeout(() => quickKbRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [invTab, products.length]);

  useEffect(() => {
    quickStateRef.current = {
      invTab,
      products,
      quickListIndex,
      quickUnit,
      draftLines,
    };
  }, [invTab, products, quickListIndex, quickUnit, draftLines]);

  // دعم مسدس الباركود السلكي واللاسلكي
  useBarcodeScanner({
    maxKeyInterval: 80, // مسدس الباركود يرسل الأحرف بسرعة عالية
    minBarcodeLength: 3,
    onBarcodeScanned: useCallback(async (barcode: string) => {
      if (invTab !== "pos") return;
      
      // إعادة جلب أحدث بيانات المخزون قبل البحث عن المنتج
      try {
        const freshProducts = await fetchInventory(user?.id);
        setProducts(freshProducts as Product[]);
        
        // البحث عن المنتج بالباركود في البيانات المحدثة
        const product = freshProducts.find(p => p.sku === barcode);
        if (product) {
          console.log("[BarcodeScanner] Product found:", product.name, "stock_pieces:", product.stock_pieces, "unit_price:", product.unit_price);
          
          // التحقق من المخزون الكافي قبل الإضافة
          const reserved = draftLines.filter((l) => l.product_id === product.id).reduce((s, l) => s + l.qty_pieces, 0);
          const available = product.stock_pieces - reserved;
          const need = piecesPerQuickUnit(product, quickUnit);
          
          console.log("[BarcodeScanner] Stock check - available:", available, "need:", need, "reserved:", reserved);
          
          if (available < need) {
            toast.error(t("inv.quickNoStock"));
            return;
          }
          
          // إضافة المنتج إلى المسودة
          setDraftLines(prev => {
            const existing = prev.find(d => d.product_id === product.id);
            if (existing) {
              const newQty = existing.qty_pieces + need;
              const unitPrice = product.unit_price || 0;
              return prev.map(d => d.product_id === product.id 
                ? { ...d, qty_pieces: newQty, line_total: newQty * unitPrice }
                : d);
            }
            return [...prev, {
              id: crypto.randomUUID(),
              product_id: product.id,
              product_name: product.name,
              qty_pieces: need,
              sale_unit: quickUnit,
              line_total: need * (product.unit_price || 0)
            }];
          });
          playSuccessSound();
          toast.success(`${t("inv.barcodeScanned")}: ${product.name}`);
          
          // تحذير إذا كان السعر 0
          if (!product.unit_price || product.unit_price === 0) {
            toast.warning(locale.startsWith("ar") 
              ? "⚠️ سعر المنتج 0 - يرجى تعديل السعر قبل التأكيد" 
              : locale.startsWith("fr")
              ? "⚠️ Prix du produit 0 - Veuillez modifier le prix avant confirmation"
              : "⚠️ Product price is 0 - Please update price before confirmation");
          }
        } else {
          // إذا لم يوجد المنتج، استخدم resolveGhostBarcode
          void resolveGhostBarcode(barcode);
        }
      } catch (err) {
        console.error("[BarcodeScanner] Error fetching fresh inventory:", err);
        // في حالة الخطأ، نحاول استخدام البيانات المحلية
        const product = products.find(p => p.sku === barcode);
        if (product) {
          // التحقق من المخزون الكافي قبل الإضافة
          const reserved = draftLines.filter((l) => l.product_id === product.id).reduce((s, l) => s + l.qty_pieces, 0);
          const available = product.stock_pieces - reserved;
          const need = piecesPerQuickUnit(product, quickUnit);
          
          if (available < need) {
            toast.error(t("inv.quickNoStock"));
            return;
          }
          
          setDraftLines(prev => {
            const existing = prev.find(d => d.product_id === product.id);
            if (existing) {
              const newQty = existing.qty_pieces + need;
              const unitPrice = product.unit_price || 0;
              return prev.map(d => d.product_id === product.id 
                ? { ...d, qty_pieces: newQty, line_total: newQty * unitPrice }
                : d);
            }
            return [...prev, {
              id: crypto.randomUUID(),
              product_id: product.id,
              product_name: product.name,
              qty_pieces: need,
              sale_unit: quickUnit,
              line_total: need * (product.unit_price || 0)
            }];
          });
          playSuccessSound();
          toast.success(`${t("inv.barcodeScanned")}: ${product.name}`);
          
          // تحذير إذا كان السعر 0
          if (!product.unit_price || product.unit_price === 0) {
            toast.warning(locale.startsWith("ar") 
              ? "⚠️ سعر المنتج 0 - يرجى تعديل السعر قبل التأكيد" 
              : locale.startsWith("fr")
              ? "⚠️ Prix du produit 0 - Veuillez modifier le prix avant confirmation"
              : "⚠️ Product price is 0 - Please update price before confirmation");
          }
        } else {
          void resolveGhostBarcode(barcode);
        }
      }
    }, [invTab, products, quickUnit, resolveGhostBarcode, t, user?.id, draftLines, locale]),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { invTab: tab, products: prods, quickListIndex: idx, quickUnit: qUnit, draftLines: draft } =
        quickStateRef.current;
      if (tab !== "pos") return;

      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "Enter" && target?.closest("button")) return;

      const n = prods.length;

      const cycleUnit = (delta: number) => {
        const cur = QUICK_UNITS.indexOf(qUnit);
        const next = (cur + delta + QUICK_UNITS.length) % QUICK_UNITS.length;
        setQuickUnit(QUICK_UNITS[next]);
      };

      switch (e.key) {
        case "ArrowDown": {
          if (n === 0) return;
          e.preventDefault();
          setQuickListIndex((i) => Math.min(i + 1, n - 1));
          break;
        }
        case "ArrowUp": {
          if (n === 0) return;
          e.preventDefault();
          setQuickListIndex((i) => Math.max(i - 1, 0));
          break;
        }
        case "ArrowRight": {
          if (n === 0) return;
          e.preventDefault();
          cycleUnit(1);
          break;
        }
        case "ArrowLeft": {
          if (n === 0) return;
          e.preventDefault();
          cycleUnit(-1);
          break;
        }
        case "Enter": {
          e.preventDefault();
          // Always add a line to draft, never submit on Enter
          if (n === 0) return;
          const p = prods[idx];
          if (!p) return;
          const pp = piecesPerQuickUnit(p, qUnit);
          const reserved = draft.filter((l) => l.product_id === p.id).reduce((s, l) => s + l.qty_pieces, 0);
          const available = p.stock_pieces - reserved;
          if (available < pp) return;
          const lineTotal = pp * p.unit_price;
          setDraftLines((d) => [
            ...d,
            {
              id: crypto.randomUUID(),
              product_id: p.id,
              product_name: p.name,
              qty_pieces: pp,
              sale_unit: qUnit,
              line_total: lineTotal,
            },
          ]);
          setQuickListIndex((i) => Math.min(i + 1, n - 1));
          break;
        }
        case "Backspace":
        case "Delete": {
          if (draft.length === 0) return;
          e.preventDefault();
          setDraftLines((d) => d.slice(0, -1));
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const inventoryAllowed = isAdmin || (isApproved && approvedModules.includes("inventory"));
  if (!inventoryAllowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4 max-w-lg mx-auto">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("inventory.lockedTitle")}</h2>
        <p className="text-slate-400">{t("inventory.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  const exportPdf = async () => {
    await runExport(t("inv.exportProcessing"), async () => {
    const rows = products.map((p) => [
      p.name,
      p.sku,
      t(`inv.retail.${p.retail_type}`),
      String(p.pieces_per_carton),
      String(p.unit_price),
      String(p.stock_pieces),
      String(Math.floor(p.stock_pieces / Math.max(1, p.pieces_per_carton))),
    ]);
    const tableOnly = buildOfficialPdfTableHtml(
      [
        t("inv.col.name"),
        t("inv.col.sku"),
        t("inv.col.sector"),
        t("inv.col.ppc"),
        t("inv.col.price"),
        t("inv.col.stockP"),
        t("inv.col.stockC"),
      ],
      rows,
      isRtl ? "rtl" : "ltr"
    );
    const inner = `
      <h2 style="color:#0f172a;font-size:15px;font-weight:800;margin-bottom:12px;">${escapeHtmlPdf(t("inv.reportStock"))}</h2>
      ${tableOnly}
    `;
    const lang = locale.startsWith("ar") ? "ar" : "en";
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml: inner,
      innerHtmlForBackend: tableOnly,
      sectionTitle: t("inv.title"),
      fileName: `inventory-${Date.now()}.pdf`,
      direction: isRtl ? "rtl" : "ltr",
      lang,
      dateLocale: locale,
      documentMode: "creative",
      officialKingdomLine: "المملكة المغربية",
      userId: user?.id,
    });
    
    // Log the operation
    await logShiftOperation('تصدير', `تصدير PDF للمخزون (${products.length} منتج)`);
    });
  };

  const exportStockWord = async () => {
    await runExport(t("inv.exportProcessing"), async () => {
    const rows = products.map((p) => [
      p.name,
      p.sku,
      t(`inv.retail.${p.retail_type}`),
      String(p.pieces_per_carton),
      String(p.unit_price),
      String(p.stock_pieces),
      String(Math.floor(p.stock_pieces / Math.max(1, p.pieces_per_carton))),
    ]);
    const headers = [
      t("inv.col.name"),
      t("inv.col.sku"),
      t("inv.col.sector"),
      t("inv.col.ppc"),
      t("inv.col.price"),
      t("inv.col.stockP"),
      t("inv.col.stockC"),
    ];
    if (
      await postBackendReportDocx({
        fileName: `inventory-stock-${Date.now()}.docx`,
        title: t("inv.reportStock"),
        subtitle: t("inv.title"),
        headers,
        rows,
        rtl: isRtl,
      })
    ) {
      return;
    }
    await downloadTableAsWordDocx(
      `المملكة المغربية — ${t("inv.reportStock")}`,
      headers,
      rows,
      `inventory-stock-${Date.now()}`
    );
    });
  };

  const exportInvoicesPdf = async () => {
    await runExport(t("inv.exportProcessing"), async () => {
    const rows = invoices.map((i) => [
      i.customer_name || "—",
      String(i.total),
      String(i.paid),
      String(i.credit),
      i.due_at ?? "—",
      i.created_at,
    ]);
    const invTable = buildOfficialPdfTableHtml(
      [
        t("inv.customer"),
        t("inv.total"),
        t("inv.paid"),
        t("inv.credit"),
        t("inv.dueDate"),
        t("inv.col.date"),
      ],
      rows,
      isRtl ? "rtl" : "ltr"
    );
    const inner = `
      <h2 style="color:#0f172a;font-size:15px;font-weight:800;margin-bottom:12px;">${escapeHtmlPdf(t("inv.creditList"))}</h2>
      ${invTable}
    `;
    const invLang = locale.startsWith("ar") ? "ar" : "en";
    await exportSmartAlIdaraPdfPreferBackend({
      innerHtml: inner,
      innerHtmlForBackend: invTable,
      sectionTitle: t("inv.invoiceReportTitle"),
      fileName: `invoices-${Date.now()}.pdf`,
      direction: isRtl ? "rtl" : "ltr",
      lang: invLang,
      dateLocale: locale,
      documentMode: "creative",
      officialKingdomLine: "المملكة المغربية",
      userId: user?.id,
    });
    });
  };

  const exportInvoicesWord = async () => {
    await runExport(t("inv.exportProcessing"), async () => {
    const rows = invoices.map((i) => [
      i.customer_name || "—",
      String(i.total),
      String(i.paid),
      String(i.credit),
      i.due_at ?? "—",
      i.created_at,
    ]);
    const invHeaders = [
      t("inv.customer"),
      t("inv.total"),
      t("inv.paid"),
      t("inv.credit"),
      t("inv.dueDate"),
      t("inv.col.date"),
    ];
    if (
      await postBackendReportDocx({
        fileName: `invoices-${Date.now()}.docx`,
        title: t("inv.creditList"),
        subtitle: t("inv.invoiceReportTitle"),
        headers: invHeaders,
        rows,
        rtl: isRtl,
      })
    ) {
      return;
    }
    await downloadTableAsWordDocx(
      `المملكة المغربية — ${t("inv.creditList")}`,
      invHeaders,
      rows,
      `invoices-${Date.now()}`
    );
    });
  };

  const exportExcel = () => {
    void runExport(t("inv.exportProcessing"), async () => {
    const aoa = [
      [
        t("inv.col.name"),
        t("inv.col.sku"),
        t("inv.col.sector"),
        t("inv.col.unitKind"),
        "ppc",
        t("inv.col.price"),
        t("inv.costPrice"),
        t("inv.col.stockP"),
      ],
      ...products.map((p) => [
        p.name,
        p.sku,
        p.retail_type,
        p.unit_kind || "piece",
        p.pieces_per_carton,
        p.unit_price,
        p.cost_price ?? 0,
        p.stock_pieces,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    await downloadXlsxWorkbook(wb, `inventory-${Date.now()}.xlsx`);
    
    // Log the operation
    await logShiftOperation('تصدير', `تصدير Excel للمخزون (${products.length} منتج)`);
    });
  };

  const exportInvoicesExcel = () => {
    void runExport(t("inv.exportProcessing"), async () => {
    const aoa = [
      ["id", "customer", "total", "paid", "credit", "due", "created"],
      ...invoices.map((i) => [
        i.id,
        i.customer_name,
        i.total,
        i.paid,
        i.credit,
        i.due_at ?? "",
        i.created_at,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    await downloadXlsxWorkbook(wb, `invoices-${Date.now()}.xlsx`);
    });
  };

  if (loading) {
    return (
      <div className="text-slate-400 py-12 text-center">{t("common.loading")}</div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl pb-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
          <Boxes className="size-8 text-[#FF8C00]" />
          {t("inv.title")}
        </h1>
        <p className="text-slate-400 text-sm max-w-3xl">{t("inv.subtitle")}</p>
      </header>

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
              onChange={(e) =>
                setBrandingPrefs((s) => ({ ...s, activityType: e.target.value }))
              }
            >
              {RETAIL_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {t(`inv.retail.${rt}`)}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={isSavingActivity}
            onClick={() => void saveBrandingActivity()}
          >
            {isSavingActivity ? t("common.processing") : t("common.save")}
          </Button>
        </CardContent>
      </Card>

      <Tabs value={invTab} onValueChange={onInvTabChange} className="w-full">
        <TabsList className="flex flex-wrap h-auto bg-[#0a1628] border border-slate-800 p-1 gap-1">
          <TabsTrigger value="dash">{t("inv.tab.dash")}</TabsTrigger>
          <TabsTrigger value="pos">{t("inv.tab.pos")}</TabsTrigger>
          <TabsTrigger value="barcode" className="gap-1">
            <ScanBarcode className="size-4" />
            {t("inv.tab.barcode")}
          </TabsTrigger>
          <TabsTrigger value="credit">{t("inv.tab.credit")}</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1">
            <FileText className="size-4" />
            {t("inv.tab.reports") || "التقارير"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dash" className="mt-6">
          <InventoryDashboardSection
            t={t}
            token={token}
            brandingPrefs={brandingPrefs}
            retailTypes={RETAIL_TYPES}
            onBrandingPrefsChange={(patch) => setBrandingPrefs((s) => ({ ...s, ...patch }))}
            onSaveBrandingActivity={() => void saveBrandingActivity()}
            isSavingActivity={isSavingActivity}
            onApplyStockOcrText={applyStockOcrText}
            onApplyStockVisionItems={applyStockVisionItems}
            inventoryImportInputRef={inventoryImportInputRef}
            onInventoryImportChange={handleInventoryImportFile}
            isImportingInventory={isImportingInventory}
            onExportPdf={() => void exportPdf()}
            onExportStockWord={() => void exportStockWord()}
            onExportExcel={exportExcel}
            onExportInvoicesExcel={exportInvoicesExcel}
            onExportInvoicesPdf={() => void exportInvoicesPdf()}
            onExportInvoicesWord={() => void exportInvoicesWord()}
            newProduct={newProduct}
            onNewProductChange={(patch) => setNewProduct((n) => ({ ...n, ...patch }))}
            onAddProduct={() => void addProduct()}
            isAddingProduct={isAddingProduct}
            products={products}
            stockAdd={stockAdd}
            onStockAddChange={(patch) => setStockAdd((s) => ({ ...s, ...patch }))}
            onAddStock={() => void addStock()}
            productionProps={{
              t,
              inventoryItemsCount: inventoryItems.length,
              inventorySearch,
              filteredInventoryRows,
              onInventorySearchChange: setInventorySearch,
              onAddBomItem: addBomItem,
              bomItems,
              onBomQuantityChange: updateBomQuantity,
              onReserveBomMaterial: reserveBomMaterial,
              isCreatingRequest,
              onCreateProductionRequest: createProductionRequestHandler,
              productionRequests,
              logisticsQueue,
              isAssigningLogistics,
              selectedLogisticsAssignee,
              onAssignLogisticsQueueItem: assignLogisticsQueueItem,
              hrStaff,
              tlWorkerList,
              selectedProductionWorkerId,
              onSelectedProductionWorkerIdChange: setSelectedProductionWorkerId,
              onSelectedLogisticsAssigneeChange: setSelectedLogisticsAssignee,
              ctxWorker,
              effectiveSender,
              messageTo,
              onMessageToChange: setMessageTo,
              messageBody,
              onMessageBodyChange: setMessageBody,
              messageFile,
              onMessageFileChange: setMessageFile,
              isSendingMessage,
              onSendInventoryMessage: sendInventoryMessage,
              messages,
              messageRecipients,
              onOpenInventoryMessageAttachment: openInventoryMessageAttachment,
              onAddFirstSearchMatchToBom: addFirstSearchMatchToBom,
              workerNameById: new Map(),
              onDeleteProductionRequest: handleDeleteProductionRequest,
              onDeleteLogisticsQueueItem: handleDeleteLogisticsQueueItem,
              onDeleteSelectedProductionRequests: handleDeleteSelectedProductionRequests,
              onDeleteSelectedLogisticsQueueItems: handleDeleteSelectedLogisticsQueueItems,
              onExportInventoryPdf: () => void exportPdf(),
              onExportInventoryExcel: exportExcel,
            }}
            editingProductId={editingProductId}
            onEditProduct={handleEditProduct}
            onCancelEdit={handleCancelEdit}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onEditProductChange={handleEditProductChange}
            editingProductData={editingProductData}
            inventoryKbRef={inventoryKbRef}
            inventoryListIndex={inventoryListIndex}
            onInventoryRowClick={handleInventoryRowClick}
            onRefreshControlPanel={handleRefreshControlPanel}
            onExportControlPanel={handleExportControlPanel}
            selectedProductIds={selectedProductIds}
            onToggleProductSelection={handleToggleProductSelection}
            onSelectAllProducts={handleSelectAllProducts}
            onDeleteSelectedProducts={handleDeleteSelectedProducts}
          />
        </TabsContent>

        <TabsContent value="pos" className="mt-6">
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
                  products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
                  onMatchedProduct={async (productId) => {
                    // إعادة جلب أحدث بيانات المخزون قبل معالجة المنتج
                    try {
                      const freshProducts = await fetchInventory(user?.id);
                      setProducts(freshProducts as Product[]);
                      
                      const product = freshProducts.find(p => p.id === productId);
                      if (product) {
                        console.log("[BarcodeScannerHub] Product found:", product.name, "stock_pieces:", product.stock_pieces, "unit_price:", product.unit_price);
                        
                        // التحقق من المخزون الكافي قبل الإضافة
                        const reserved = draftLines.filter((l) => l.product_id === productId).reduce((s, l) => s + l.qty_pieces, 0);
                        const available = product.stock_pieces - reserved;
                        const need = piecesPerQuickUnit(product, quickUnit);
                        
                        console.log("[BarcodeScannerHub] Stock check - available:", available, "need:", need, "reserved:", reserved);
                        
                        if (available < need) {
                          toast.error(t("inv.quickNoStock"));
                          return;
                        }
                        
                        setDraftLines(prev => {
                          const existing = prev.find(d => d.product_id === productId);
                          if (existing) {
                            const newQty = existing.qty_pieces + need;
                            const unitPrice = product.unit_price || 0;
                            return prev.map(d => d.product_id === productId 
                              ? { ...d, qty_pieces: newQty, line_total: newQty * unitPrice }
                              : d);
                          }
                          return [...prev, {
                            id: crypto.randomUUID(),
                            product_id: productId,
                            product_name: product.name,
                            qty_pieces: need,
                            sale_unit: quickUnit,
                            line_total: need * (product.unit_price || 0)
                          }];
                        });
                        
                        // تحذير إذا كان السعر 0
                        if (!product.unit_price || product.unit_price === 0) {
                          toast.warning(locale.startsWith("ar") 
                            ? "⚠️ سعر المنتج 0 - يرجى تعديل السعر قبل التأكيد" 
                            : locale.startsWith("fr")
                            ? "⚠️ Prix du produit 0 - Veuillez modifier le prix avant confirmation"
                            : "⚠️ Product price is 0 - Please update price before confirmation");
                        }
                      }
                    } catch (err) {
                      console.error("[BarcodeScannerHub] Error fetching fresh inventory:", err);
                      // في حالة الخطأ، نحاول استخدام البيانات المحلية
                      const product = products.find(p => p.id === productId);
                      if (product) {
                        // التحقق من المخزون الكافي قبل الإضافة
                        const reserved = draftLines.filter((l) => l.product_id === productId).reduce((s, l) => s + l.qty_pieces, 0);
                        const available = product.stock_pieces - reserved;
                        const need = piecesPerQuickUnit(product, quickUnit);
                        
                        if (available < need) {
                          toast.error(t("inv.quickNoStock"));
                          return;
                        }
                        
                        setDraftLines(prev => {
                          const existing = prev.find(d => d.product_id === productId);
                          if (existing) {
                            const newQty = existing.qty_pieces + need;
                            const unitPrice = product.unit_price || 0;
                            return prev.map(d => d.product_id === productId 
                              ? { ...d, qty_pieces: newQty, line_total: newQty * unitPrice }
                              : d);
                          }
                          return [...prev, {
                            id: crypto.randomUUID(),
                            product_id: productId,
                            product_name: product.name,
                            qty_pieces: need,
                            sale_unit: quickUnit,
                            line_total: need * (product.unit_price || 0)
                          }];
                        });
                        
                        // تحذير إذا كان السعر 0
                        if (!product.unit_price || product.unit_price === 0) {
                          toast.warning(locale.startsWith("ar") 
                            ? "⚠️ سعر المنتج 0 - يرجى تعديل السعر قبل التأكيد" 
                            : locale.startsWith("fr")
                            ? "⚠️ Prix du produit 0 - Veuillez modifier le prix avant confirmation"
                            : "⚠️ Product price is 0 - Please update price before confirmation");
                        }
                      }
                    }
                  }}
                  onUnknownBarcode={resolveGhostBarcode}
                />
              </div>
              <div className="shrink-0 flex flex-col items-stretch lg:items-end gap-2 max-w-full lg:max-w-[280px]">
                <InventoryAiDocScannerButton
                  token={token}
                  label={t("inv.aiDocScanner")}
                  onTextExtracted={applyPosOcrText}
                  onVisionItems={(items) => void applyPosVisionItems(items)}
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
                  <div className="px-3 pt-3 pb-1">
                    <div className="relative">
                      <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500 pointer-events-none" />
                      <input
                        type="text"
                        value={quickSearch}
                        onChange={(e) => setQuickSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown" && filteredQuickProducts.length > 0) {
                            e.preventDefault();
                            setQuickListIndex(0);
                            // Focus on first product after a small delay
                            setTimeout(() => {
                              const firstProduct = quickListRef.current?.querySelector('[data-quick-idx="0"]') as HTMLElement;
                              firstProduct?.focus();
                              firstProduct?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                            }, 50);
                          } else if (e.key === "Enter" && filteredQuickProducts.length > 0) {
                            e.preventDefault();
                            // Add first matching product to cart
                            const firstProduct = filteredQuickProducts[0];
                            if (firstProduct) {
                              tryAddQuickLineForProductId(firstProduct.id);
                              setQuickSearch("");
                            }
                          }
                        }}
                        placeholder={t("inv.quickSearchPlaceholder")}
                        className="w-full rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-white placeholder:text-slate-500 ps-8 pe-3 py-1.5 outline-none focus:ring-1 focus:ring-[#0052CC]/60"
                      />
                      {quickSearch && (
                        <button
                          type="button"
                          onClick={() => setQuickSearch("")}
                          className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    ref={quickListRef}
                    className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain border-b border-slate-800"
                  >
                    {filteredQuickProducts.map((product, idx) => (
                      <div
                        key={product.id}
                        data-quick-idx={idx}
                        tabIndex={0}
                        className={`p-3 border-b border-slate-800 cursor-pointer transition-colors outline-none focus:ring-1 focus:ring-[#0052CC]/60 ${
                          idx === quickListIndex ? 'bg-[#0052CC]/20 border-l-2 border-l-[#0052CC]' : 'hover:bg-slate-800/50'
                        }`}
                        onClick={() => setQuickListIndex(idx)}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            const nextIdx = Math.min(idx + 1, filteredQuickProducts.length - 1);
                            setQuickListIndex(nextIdx);
                            setTimeout(() => {
                              const nextProduct = quickListRef.current?.querySelector(`[data-quick-idx="${nextIdx}"]`) as HTMLElement;
                              nextProduct?.focus();
                              nextProduct?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                            }, 50);
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            const prevIdx = Math.max(idx - 1, 0);
                            setQuickListIndex(prevIdx);
                            setTimeout(() => {
                              const prevProduct = quickListRef.current?.querySelector(`[data-quick-idx="${prevIdx}"]`) as HTMLElement;
                              prevProduct?.focus();
                              prevProduct?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                            }, 50);
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            tryAddQuickLineForProductId(product.id);
                          }
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{product.name}</p>
                            {product.sku && (
                              <p className="text-xs text-slate-400">{product.sku}</p>
                            )}
                          </div>
                          <div className="text-right ml-2">
                            <p className="text-sm font-bold text-white">{product.unit_price.toFixed(2)}</p>
                            <p className="text-xs text-slate-400">{product.stock_pieces} {t("inv.piece")}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredQuickProducts.length === 0 && (
                      <div className="p-8 text-center text-slate-500">
                        {quickSearch ? t("inv.noResults") : t("inv.noProducts")}
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2 bg-black/20">
                    <p className="text-xs font-bold text-slate-400">{t("inv.quickCurrentUnit")}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {QUICK_UNITS.map((u) => (
                        <span
                          key={u}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            quickUnit === u
                              ? "bg-[#0052CC] text-white"
                              : "bg-slate-800/80 text-slate-400"
                          }`}
                        >
                          {t(`inv.unit.${u}`)}
                        </span>
                      ))}
                    </div>
                    {filteredQuickProducts[quickListIndex] && (
                      <p className="text-xs text-slate-400">
                        {t("inv.quickLinePreview")}:{" "}
                        <span className="text-white font-mono tabular-nums">
                          {currentLinePreview.line.toFixed(2)}
                        </span>{" "}
                        · {t("inv.lineProfit")}:{" "}
                        <span className="text-emerald-400 font-mono tabular-nums">
                          {currentLinePreview.profit.toFixed(2)}
                        </span>
                      </p>
                    )}
                    {filteredQuickProducts[quickListIndex] &&
                      (() => {
                        const p = filteredQuickProducts[quickListIndex];
                        const reserved = draftLines
                          .filter((l) => l.product_id === p.id)
                          .reduce((s, l) => s + l.qty_pieces, 0);
                        const avail = p.stock_pieces - reserved;
                        const need = currentLinePreview.pp;
                        const ok = avail >= need;
                        return (
                          <p className={`text-[11px] ${ok ? "text-slate-500" : "text-red-400 font-bold"}`}>
                            {ok
                              ? `${t("inv.quickStockAfterReserve")}: ${avail} ${t("inv.piece")}`
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
                    <p className="font-black text-white">{t("inv.quickDraftTitle")}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{t("inv.quickDraftHint")}</p>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    {draftLines.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">{t("inv.quickDraftEmpty")}</p>
                    ) : (
                      <ul className="space-y-2 max-h-48 overflow-y-auto">
                        {draftLines.map((l) => (
                          <li
                            key={l.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm border border-slate-800 rounded-lg px-3 py-2 bg-black/20"
                          >
                            <span className="text-slate-200 truncate min-w-0 flex-1">
                              {l.product_name}
                              <span className="text-slate-500 text-xs ms-1">
                                · {t(`inv.unit.${l.sale_unit}`)}
                                {l.sale_unit !== "piece"
                                  ? ` (${l.qty_pieces} ${t("inv.piece")})`
                                  : ""}
                              </span>
                            </span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              className="w-28 h-9 text-[#FF8C00] font-mono tabular-nums text-sm bg-[#0c1222] border-slate-700 shrink-0"
                              aria-label={t("inv.lineTotalEdit")}
                              value={Number.isFinite(l.line_total) ? String(l.line_total) : ""}
                              onChange={(e) => {
                                const raw = e.target.value.trim().replace(",", ".");
                                setDraftLines((rows) =>
                                  rows.map((row) => {
                                    if (row.id !== l.id) return row;
                                    if (raw === "" || raw === ".") return { ...row, line_total: 0 };
                                    const n = parseFloat(raw);
                                    if (Number.isFinite(n) && n >= 0) {
                                      return { ...row, line_total: Math.round(n * 100) / 100 };
                                    }
                                    return row;
                                  })
                                );
                              }}
                            />
                          </li>
                        ))}
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
                            onChange={(e) => setManualTotalOverride(e.target.value)}
                            aria-label={t("inv.totalOverrideAria")}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="shrink-0 font-bold"
                            onClick={() => setCalculatorOpen(true)}
                          >
                            ∑
                          </Button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {t("inv.lineSum")}:{" "}
                        <span className="text-slate-300 font-mono tabular-nums">{draftGrandTotal.toFixed(2)}</span>
                        {" · "}
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
                        onChange={(e) => setSale((s) => ({ ...s, customer: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>{t("inv.paid")}</Label>
                      <Input
                        type="number"
                        className="mt-1 bg-[#0c1222] border-slate-700"
                        value={sale.paid}
                        onChange={(e) => setSale((s) => ({ ...s, paid: e.target.value }))}
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
                        onChange={(e) => setSale((s) => ({ ...s, due_at: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="flex-1 bg-[#0052CC]"
                        disabled={draftLines.length === 0}
                        onClick={() => void submitQuickDraft()}
                      >
                        {t("inv.quickConfirmBatch")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        disabled={draftLines.length === 0}
                        onClick={() => {
                          setDraftLines([]);
                          setManualTotalOverride("");
                          toast.success("تم مسح المسودة");
                        }}
                      >
                        إلغاء
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="barcode" className="mt-6 space-y-4">
          <BarcodeScannerHub
            products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
            onMatchedProduct={(productId) => {
              const idx = products.findIndex((p) => p.id === productId);
              if (idx >= 0) {
                setQuickListIndex(idx);
                setQuickUnit("piece");
              }
              const ok = tryAddQuickLineForProductId(productId, "piece");
              if (!ok) {
                setQuickStockProductId(productId);
                setQuickStockPieces("1");
                setQuickStockOpen(true);
              } else onInvTabChange("pos");
            }}
            onUnknownBarcode={resolveGhostBarcode}
          />
          <p className="text-xs text-slate-500 max-w-xl">{t("inv.barcodeFootnote")}</p>
        </TabsContent>

        <TabsContent value="credit" className="mt-6 space-y-4">
          {overdueCredits.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-2 text-amber-200">
              <AlertTriangle className="size-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-black">{t("inv.overdueAlert")}</p>
                <ul className="text-sm mt-1 list-disc ms-4">
                  {overdueCredits.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-4">
                      <span>{i.customer_name || "—"} — {i.credit} MAD — {i.due_at}</span>
                      {i.status !== "voided" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs h-6 px-2"
                          onClick={() => voidSale(i.id)}
                        >
                          {t("inv.voidSale")}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <Card className="border-slate-800 bg-[#0a1628]/90">
            <CardHeader>
              <p className="font-black text-white">{t("inv.creditList")}</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="py-2 text-start">{t("inv.customer")}</th>
                    <th className="py-2 text-start">{t("inv.total")}</th>
                    <th className="py-2 text-start">{t("inv.paid")}</th>
                    <th className="py-2 text-start">{t("inv.credit")}</th>
                    <th className="py-2 text-start">{t("inv.dueDate")}</th>
                    <th className="py-2 text-start">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id} className="border-b border-slate-800/80 text-slate-200">
                      <td className="py-2">{i.customer_name || "—"}</td>
                      <td className="py-2">{i.total}</td>
                      <td className="py-2">{i.paid}</td>
                      <td className="py-2 text-orange-300">{i.credit}</td>
                      <td className="py-2 text-xs">{i.due_at ?? "—"}</td>
                      <td className="py-2">
                        {i.status !== "voided" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs"
                            onClick={() => voidSale(i.id)}
                          >
                            {t("inv.voidSale")}
                          </Button>
                        )}
                        {i.status === "voided" && (
                          <span className="text-xs text-slate-500">{t("inv.voided")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-6 space-y-4">
          <Card className="bg-[#0a1628] border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{locale.startsWith("ar") ? "التقارير السريعة" : "Quick Reports"}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      // Allow operation if super admin override is active
                      if (!supabase || !user?.id) {
                        if (!isAdmin) {
                          toast.error(locale.startsWith("ar") ? 'يجب تسجيل الدخول' : 'Must be logged in');
                          return;
                        }
                      }

                      // Use user.id from AuthContext
                      const authUserId = user?.id;
                      if (!authUserId) {
                        console.error("[Start shift] No user ID from AuthContext");
                        toast.error(locale.startsWith("ar") ? 'يجب تسجيل الدخول' : 'Must be logged in');
                        return;
                      }

                      const today = new Date().toISOString().split('T')[0];
                      const now = new Date().toISOString();

                      try {
                        if (!supabase) {
                          toast.error(locale.startsWith("ar") ? 'خطأ في الاتصال بقاعدة البيانات' : 'Database connection error');
                          return;
                        }
                        const { data: existingReport } = await supabase
                          .from("shift_reports")
                          .select("*")
                          .eq("shift_date", today)
                          .eq("shift_group", shiftGroup)
                          .eq("user_id", authUserId)
                          .maybeSingle();

                        if (existingReport) {
                          toast.info(locale.startsWith("ar") ? 'النوبة مفتوحة بالفعل' : 'Shift already started');
                          setSelectedShiftReport(existingReport);
                          return;
                        }

                        const newReport = {
                          id: crypto.randomUUID(),
                          user_id: authUserId,
                          shift_group: shiftGroup,
                          shift_date: today,
                          start_time: now,
                          end_time: null,
                          shift_description: shiftGroup === 'A' ? 'النوبة الصباحية (08:00 - 14:00)' : shiftGroup === 'B' ? 'النوبة المسائية (14:00 - 22:00)' : 'النوبة الليلية (22:00 - 06:00)',
                          sales_count: 0,
                          stock_add_count: 0,
                          stock_edit_count: 0,
                          import_count: 0,
                          export_count: 0,
                          delete_count: 0,
                          total_operations: 0,
                          operations_log: [],
                          customer_name: shiftCustomerName,
                          customer_phone: shiftCustomerPhone,
                          week: shiftWeek
                        };

                        if (!supabase) {
                          toast.error(locale.startsWith("ar") ? 'خطأ في الاتصال بقاعدة البيانات' : 'Database connection error');
                          return;
                        }
                        const { data: createdReport, error } = await supabase
                          .from("shift_reports")
                          .insert([newReport])
                          .select()
                          .single();

                        if (error) throw error;
                        setSelectedShiftReport(createdReport);
                        toast.success(locale.startsWith("ar") ? 'تم بدء النوبة بنجاح' : 'Shift started successfully');
                      } catch (error) {
                        console.error("Error starting shift:", error);
                        toast.error(locale.startsWith("ar") ? 'فشل بدء النوبة' : 'Failed to start shift');
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold"
                  >
                    {locale.startsWith("ar") ? "بدء النوبة" : "Start Shift"}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* فلاتر النوبة والأسبوع */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg p-4">
                  <label className="text-xs text-slate-400 mb-2 block">{locale.startsWith("ar") ? "النوبة" : "Shift"}</label>
                  <select
                    value={shiftGroup}
                    onChange={(e) => setShiftGroup(e.target.value as 'A' | 'B' | 'C')}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="A">Shift A - {locale.startsWith("ar") ? "النوبة الصباحية (08:00 - 14:00)" : "Morning (08:00 - 14:00)"}</option>
                    <option value="B">Shift B - {locale.startsWith("ar") ? "النوبة المسائية (14:00 - 22:00)" : "Evening (14:00 - 22:00)"}</option>
                    <option value="C">Shift C - {locale.startsWith("ar") ? "النوبة الليلية (22:00 - 06:00)" : "Night (22:00 - 06:00)"}</option>
                  </select>
                </div>
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg p-4">
                  <label className="text-xs text-slate-400 mb-2 block">{locale.startsWith("ar") ? "الأسبوع" : "Week"}</label>
                  <select
                    value={shiftWeek || 1}
                    onChange={(e) => setShiftWeek(parseInt(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="1">{locale.startsWith("ar") ? "الأسبوع 1" : "Week 1"}</option>
                    <option value="2">{locale.startsWith("ar") ? "الأسبوع 2" : "Week 2"}</option>
                    <option value="3">{locale.startsWith("ar") ? "الأسبوع 3" : "Week 3"}</option>
                    <option value="4">{locale.startsWith("ar") ? "الأسبوع 4" : "Week 4"}</option>
                  </select>
                </div>
              </div>

              {/* معلومات العميل */}
              <div className="mt-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-white">{locale.startsWith("ar") ? "معلومات العميل" : "Customer Information"}</h4>
                  <button
                    onClick={async () => {
                      // Allow operation if super admin override is active
                      if (!supabase || !user?.id) {
                        if (!isAdmin) {
                          toast.error(locale.startsWith("ar") ? 'يجب تسجيل الدخول' : 'Must be logged in');
                          return;
                        }
                      }

                      const today = new Date().toISOString().split('T')[0];
                      const now = new Date().toISOString();

                      try {
                        console.log("=== Save customer info ===");
                        console.log("Shift customer name:", shiftCustomerName);
                        console.log("Shift customer phone:", shiftCustomerPhone);
                        console.log("Shift week:", shiftWeek);
                        console.log("Selected shift report:", selectedShiftReport);

                        // Use user.id from AuthContext
                        const authUserId = user?.id;
                        if (!authUserId) {
                          console.error("[Save customer info] No user ID from AuthContext");
                          toast.error(locale.startsWith("ar") ? 'يجب تسجيل الدخول' : 'Must be logged in');
                          return;
                        }
                        console.log("[Save customer info] Using user ID from AuthContext:", authUserId);

                        if (selectedShiftReport) {
                          console.log("Updating existing shift report:", selectedShiftReport.id);
                          if (!supabase) {
                            toast.error(locale.startsWith("ar") ? 'خطأ في الاتصال بقاعدة البيانات' : 'Database connection error');
                            return;
                          }
                          const { error } = await supabase
                            .from("shift_reports")
                            .update({
                              customer_name: shiftCustomerName,
                              customer_phone: shiftCustomerPhone,
                              week: shiftWeek
                            })
                            .eq("id", selectedShiftReport.id)
                            .eq("user_id", authUserId);

                          if (error) {
                            console.error("Update error:", error);
                            throw error;
                          }

                          setSelectedShiftReport({
                            ...selectedShiftReport,
                            customer_name: shiftCustomerName,
                            customer_number: shiftCustomerPhone,
                            week: shiftWeek
                          });
                          console.log("Updated successfully");
                        } else {
                          console.log("No existing shift report, creating new one");
                          const newReport = {
                            id: crypto.randomUUID(),
                            user_id: authUserId,
                            shift_group: shiftGroup,
                            shift_date: today,
                            start_time: shiftStartTime?.toISOString() || now,
                            end_time: shiftEndTime?.toISOString() || null,
                            shift_description: shiftGroup === 'A' ? 'النوبة الصباحية (08:00 - 14:00)' : shiftGroup === 'B' ? 'النوبة المسائية (14:00 - 22:00)' : 'النوبة الليلية (22:00 - 06:00)',
                            sales_count: 0,
                            stock_add_count: 0,
                            stock_edit_count: 0,
                            import_count: 0,
                            export_count: 0,
                            delete_count: 0,
                            total_operations: 0,
                            operations_log: [],
                            customer_name: shiftCustomerName,
                            customer_number: shiftCustomerPhone,
                            week: shiftWeek
                          };

                          console.log("Creating new report:", newReport);
                          if (!supabase) {
                            toast.error(locale.startsWith("ar") ? 'خطأ في الاتصال بقاعدة البيانات' : 'Database connection error');
                            return;
                          }
                          const { data: createdReport, error } = await supabase
                            .from("shift_reports")
                            .insert([newReport])
                            .select()
                            .single();

                          if (error) {
                            console.error("Insert error:", error);
                            throw error;
                          }
                          console.log("Created successfully:", createdReport);
                          setSelectedShiftReport(createdReport);
                        }

                        await loadShiftReport();
                        toast.success(locale.startsWith("ar") ? 'تم الحفظ بنجاح' : 'Saved successfully');
                      } catch (error) {
                        console.error("Error saving customer info:", (error as any)?.message || (error as any)?.details || JSON.stringify(error));
                        toast.error(locale.startsWith("ar") ? 'فشل الحفظ' : 'Failed to save');
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold"
                  >
                    {locale.startsWith("ar") ? 'حفظ' : 'Save'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-2 block">{locale.startsWith("ar") ? "اسم العميل" : "Customer Name"}</label>
                    <Input
                      type="text"
                      value={shiftCustomerName || selectedShiftReport?.customer_name || ''}
                      onChange={(e) => setShiftCustomerName(e.target.value)}
                      placeholder={locale.startsWith("ar") ? "أدخل اسم العميل" : "Enter customer name"}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-2 block">{locale.startsWith("ar") ? "رقم العميل" : "Customer Number"}</label>
                    <Input
                      type="text"
                      value={shiftCustomerPhone || selectedShiftReport?.customer_number || ''}
                      onChange={(e) => setShiftCustomerPhone(e.target.value)}
                      placeholder={locale.startsWith("ar") ? "أدخل رقم العميل" : "Enter customer number"}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* ملخص العمليات */}
              <div className="mt-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-bold text-white mb-4">{locale.startsWith("ar") ? "ملخص العمليات" : "Operations Summary"}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-400 mb-1">{locale.startsWith("ar") ? "المبيعات" : "Sales"}</p>
                    <p className="text-xl font-bold text-white">{(selectedShiftReport?.sales_count || 0).toLocaleString('en-US')}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-blue-400 mb-1">{locale.startsWith("ar") ? "إضافة مخزون" : "Stock Add"}</p>
                    <p className="text-xl font-bold text-white">{(selectedShiftReport?.stock_add_count || 0).toLocaleString('en-US')}</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-500/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-yellow-400 mb-1">{locale.startsWith("ar") ? "تعديل مخزون" : "Stock Edit"}</p>
                    <p className="text-xl font-bold text-white">{(selectedShiftReport?.stock_edit_count || 0).toLocaleString('en-US')}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-purple-400 mb-1">{locale.startsWith("ar") ? "استيراد" : "Import"}</p>
                    <p className="text-xl font-bold text-white">{(selectedShiftReport?.import_count || 0).toLocaleString('en-US')}</p>
                  </div>
                  <div className="bg-gradient-to-br from-pink-600/20 to-pink-800/20 border border-pink-500/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-pink-400 mb-1">{locale.startsWith("ar") ? "تصدير" : "Export"}</p>
                    <p className="text-xl font-bold text-white">{(selectedShiftReport?.export_count || 0).toLocaleString('en-US')}</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-500/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-400 mb-1">{locale.startsWith("ar") ? "حذف" : "Delete"}</p>
                    <p className="text-xl font-bold text-white">{(selectedShiftReport?.delete_count || 0).toLocaleString('en-US')}</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-500/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-orange-400 mb-1">{locale.startsWith("ar") ? "الإجمالي" : "Total"}</p>
                    <p className="text-xl font-bold text-white">{(selectedShiftReport?.total_operations || 0).toLocaleString('en-US')}</p>
                  </div>
                </div>
              </div>

              {/* التقارير السريعة */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* تقرير المبيعات */}
                <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-lg p-4 hover:from-green-600/30 hover:to-green-800/30 transition-all cursor-pointer">
                  <h4 className="text-sm font-bold text-white mb-2">{locale.startsWith("ar") ? "تقرير المبيعات" : "Sales Report"}</h4>
                  <p className="text-xs text-green-400 mb-3">{locale.startsWith("ar") ? "عرض آخر المبيعات والإحصائيات" : "View recent sales and statistics"}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const salesLogs = selectedShiftReport?.operations_log?.filter((log: { action: string }) => log.action === 'بيع') || [];
                        if (salesLogs.length === 0) {
                          toast.info(locale.startsWith("ar") ? 'لا توجد مبيعات' : 'No sales found');
                          return;
                        }
                        const reportData = salesLogs.map((log: { date: string; time: string; details: string }) => ({
                          Date: log.date,
                          Time: log.time,
                          User: log.user,
                          Details: log.details
                        })).map((row: any) => ({
                          ...row,
                          Time: row.Time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                        }));
                        const ws = XLSX.utils.json_to_sheet(reportData);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, locale.startsWith("ar") ? 'المبيعات' : 'Sales');
                        XLSX.writeFile(wb, `sales-report-${new Date().toISOString().split('T')[0]}.xlsx`);
                        toast.success(locale.startsWith("ar") ? 'تم تصدير تقرير المبيعات' : 'Sales report exported');
                      }}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-bold"
                    >
                      {locale.startsWith("ar") ? "Excel" : "Excel"}
                    </button>
                    <button
                      onClick={() => {
                        const salesLogs = selectedShiftReport?.operations_log?.filter((log: any) => log.action === 'بيع') || [];
                        if (salesLogs.length === 0) {
                          toast.info(locale.startsWith("ar") ? 'لا توجد مبيعات' : 'No sales found');
                          return;
                        }
                        const tableOnly = buildOfficialPdfTableHtml(
                          [locale.startsWith("ar") ? "التاريخ" : "Date", locale.startsWith("ar") ? "الوقت" : "Time", locale.startsWith("ar") ? "المستخدم" : "User", locale.startsWith("ar") ? "التفاصيل" : "Details"],
                          salesLogs.map((log: any) => [log.date, log.time, log.user, log.details]),
                          isRtl ? "rtl" : "ltr"
                        );
                        const inner = `
                          <h2 style="color:#0f172a;font-size:15px;font-weight:800;margin-bottom:12px;">${locale.startsWith("ar") ? "تقرير المبيعات" : "Sales Report"}</h2>
                          ${tableOnly}
                        `;
                        const lang = locale.startsWith("ar") ? "ar" : "en";
                        exportSmartAlIdaraPdfPreferBackend({
                          innerHtml: inner,
                          innerHtmlForBackend: tableOnly,
                          sectionTitle: locale.startsWith("ar") ? "تقرير المبيعات" : "Sales Report",
                          fileName: `sales-report-${new Date().toISOString().split('T')[0]}.pdf`,
                          direction: isRtl ? "rtl" : "ltr",
                          lang,
                          dateLocale: locale,
                          documentMode: "creative",
                          officialKingdomLine: locale.startsWith("ar") ? "المملكة المغربية" : "Kingdom of Morocco",
                          userId: user?.id,
                        }).then(() => {
                          toast.success(locale.startsWith("ar") ? 'تم تصدير PDF بنجاح' : 'PDF exported successfully');
                        });
                      }}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-bold"
                    >
                      {locale.startsWith("ar") ? "PDF" : "PDF"}
                    </button>
                  </div>
                </div>

                {/* تقرير المخزون */}
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-lg p-4 hover:from-blue-600/30 hover:to-blue-800/30 transition-all cursor-pointer">
                  <h4 className="text-sm font-bold text-white mb-2">{locale.startsWith("ar") ? "تقرير المخزون" : "Inventory Report"}</h4>
                  <p className="text-xs text-blue-400 mb-3">{locale.startsWith("ar") ? "عرض عمليات المخزون والإضافات" : "View inventory operations and additions"}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const stockLogs = selectedShiftReport?.operations_log?.filter((log: { action: string }) => log.action === 'إضافة مخزون' || log.action === 'تعديل مخزون') || [];
                        if (stockLogs.length === 0) {
                          toast.info(locale.startsWith("ar") ? 'لا توجد عمليات مخزون' : 'No inventory operations found');
                          return;
                        }
                        const reportData = stockLogs.map((log: { date: string; time: string; details: string }) => ({
                          Date: log.date,
                          Time: log.time,
                          User: log.user,
                          Action: log.action,
                          Details: log.details
                        })).map((row: any) => ({
                          ...row,
                          Time: row.Time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                        }));
                        const ws = XLSX.utils.json_to_sheet(reportData);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, locale.startsWith("ar") ? 'المخزون' : 'Inventory');
                        XLSX.writeFile(wb, `inventory-report-${new Date().toISOString().split('T')[0]}.xlsx`);
                        toast.success(locale.startsWith("ar") ? 'تم تصدير تقرير المخزون' : 'Inventory report exported');
                      }}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold"
                    >
                      {locale.startsWith("ar") ? "Excel" : "Excel"}
                    </button>
                    <button
                      onClick={() => {
                        const stockLogs = selectedShiftReport?.operations_log?.filter((log: any) => log.action === 'إضافة مخزون' || log.action === 'تعديل مخزون') || [];
                        if (stockLogs.length === 0) {
                          toast.info(locale.startsWith("ar") ? 'لا توجد عمليات مخزون' : 'No inventory operations found');
                          return;
                        }
                        const tableOnly = buildOfficialPdfTableHtml(
                          [locale.startsWith("ar") ? "التاريخ" : "Date", locale.startsWith("ar") ? "الوقت" : "Time", locale.startsWith("ar") ? "المستخدم" : "User", locale.startsWith("ar") ? "الإجراء" : "Action", locale.startsWith("ar") ? "التفاصيل" : "Details"],
                          stockLogs.map((log: any) => [log.date, log.time, log.user, log.action, log.details]),
                          isRtl ? "rtl" : "ltr"
                        );
                        const inner = `
                          <h2 style="color:#0f172a;font-size:15px;font-weight:800;margin-bottom:12px;">${locale.startsWith("ar") ? "تقرير المخزون" : "Inventory Report"}</h2>
                          ${tableOnly}
                        `;
                        const lang = locale.startsWith("ar") ? "ar" : "en";
                        exportSmartAlIdaraPdfPreferBackend({
                          innerHtml: inner,
                          innerHtmlForBackend: tableOnly,
                          sectionTitle: locale.startsWith("ar") ? "تقرير المخزون" : "Inventory Report",
                          fileName: `inventory-report-${new Date().toISOString().split('T')[0]}.pdf`,
                          direction: isRtl ? "rtl" : "ltr",
                          lang,
                          dateLocale: locale,
                          documentMode: "creative",
                          officialKingdomLine: locale.startsWith("ar") ? "المملكة المغربية" : "Kingdom of Morocco",
                          userId: user?.id,
                        }).then(() => {
                          toast.success(locale.startsWith("ar") ? 'تم تصدير PDF بنجاح' : 'PDF exported successfully');
                        });
                      }}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-bold"
                    >
                      {locale.startsWith("ar") ? "PDF" : "PDF"}
                    </button>
                  </div>
                </div>

                {/* تقرير الإنتاج */}
                <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-lg p-4 hover:from-purple-600/30 hover:to-purple-800/30 transition-all cursor-pointer">
                  <h4 className="text-sm font-bold text-white mb-2">{locale.startsWith("ar") ? "تقرير الإنتاج" : "Production Report"}</h4>
                  <p className="text-xs text-purple-400 mb-3">{locale.startsWith("ar") ? "عرض عمليات الاستيراد والتصدير" : "View import and export operations"}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const prodLogs = selectedShiftReport?.operations_log?.filter((log: { action: string }) => log.action === 'استيراد' || log.action === 'تصدير') || [];
                        if (prodLogs.length === 0) {
                          toast.info(locale.startsWith("ar") ? 'لا توجد عمليات إنتاج' : 'No production operations found');
                          return;
                        }
                        const reportData = prodLogs.map((log: { date: string; time: string; details: string }) => ({
                          Date: log.date,
                          Time: log.time,
                          User: log.user,
                          Action: log.action,
                          Details: log.details
                        })).map((row: any) => ({
                          ...row,
                          Time: row.Time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                        }));
                        const ws = XLSX.utils.json_to_sheet(reportData);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, locale.startsWith("ar") ? 'الإنتاج' : 'Production');
                        XLSX.writeFile(wb, `production-report-${new Date().toISOString().split('T')[0]}.xlsx`);
                        toast.success(locale.startsWith("ar") ? 'تم تصدير تقرير الإنتاج' : 'Production report exported');
                      }}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-bold"
                    >
                      {locale.startsWith("ar") ? "Excel" : "Excel"}
                    </button>
                    <button
                      onClick={() => {
                        const prodLogs = selectedShiftReport?.operations_log?.filter((log: any) => log.action === 'استيراد' || log.action === 'تصدير') || [];
                        if (prodLogs.length === 0) {
                          toast.info(locale.startsWith("ar") ? 'لا توجد عمليات إنتاج' : 'No production operations found');
                          return;
                        }
                        const tableOnly = buildOfficialPdfTableHtml(
                          [locale.startsWith("ar") ? "التاريخ" : "Date", locale.startsWith("ar") ? "الوقت" : "Time", locale.startsWith("ar") ? "المستخدم" : "User", locale.startsWith("ar") ? "الإجراء" : "Action", locale.startsWith("ar") ? "التفاصيل" : "Details"],
                          prodLogs.map((log: any) => [log.date, log.time, log.user, log.action, log.details]),
                          isRtl ? "rtl" : "ltr"
                        );
                        const inner = `
                          <h2 style="color:#0f172a;font-size:15px;font-weight:800;margin-bottom:12px;">${locale.startsWith("ar") ? "تقرير الإنتاج" : "Production Report"}</h2>
                          ${tableOnly}
                        `;
                        const lang = locale.startsWith("ar") ? "ar" : "en";
                        exportSmartAlIdaraPdfPreferBackend({
                          innerHtml: inner,
                          innerHtmlForBackend: tableOnly,
                          sectionTitle: locale.startsWith("ar") ? "تقرير الإنتاج" : "Production Report",
                          fileName: `production-report-${new Date().toISOString().split('T')[0]}.pdf`,
                          direction: isRtl ? "rtl" : "ltr",
                          lang,
                          dateLocale: locale,
                          documentMode: "creative",
                          officialKingdomLine: locale.startsWith("ar") ? "المملكة المغربية" : "Kingdom of Morocco",
                          userId: user?.id,
                        }).then(() => {
                          toast.success(locale.startsWith("ar") ? 'تم تصدير PDF بنجاح' : 'PDF exported successfully');
                        });
                      }}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-bold"
                    >
                      {locale.startsWith("ar") ? "PDF" : "PDF"}
                    </button>
                  </div>
                </div>
              </div>

              {/* جدول العمليات */}
              <div className="mt-6 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-bold text-white mb-4">{locale.startsWith("ar") ? "تفاصيل العمليات" : "Operations Details"}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-right py-2 px-3 text-xs text-slate-400 font-bold">{locale.startsWith("ar") ? "التاريخ" : "Date"}</th>
                        <th className="text-right py-2 px-3 text-xs text-slate-400 font-bold">{locale.startsWith("ar") ? "الوقت" : "Time"}</th>
                        <th className="text-right py-2 px-3 text-xs text-slate-400 font-bold">{locale.startsWith("ar") ? "المستخدم" : "User"}</th>
                        <th className="text-right py-2 px-3 text-xs text-slate-400 font-bold">{locale.startsWith("ar") ? "الإجراء" : "Action"}</th>
                        <th className="text-right py-2 px-3 text-xs text-slate-400 font-bold">{locale.startsWith("ar") ? "اسم المنتج" : "Product Name"}</th>
                        <th className="text-right py-2 px-3 text-xs text-slate-400 font-bold">{locale.startsWith("ar") ? "رقم المنتج" : "SKU/Barcode"}</th>
                        <th className="text-right py-2 px-3 text-xs text-slate-400 font-bold">{locale.startsWith("ar") ? "التفاصيل" : "Details"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedShiftReport?.operations_log && selectedShiftReport.operations_log.length > 0 ? (
                        selectedShiftReport.operations_log.map((log: any, idx: number) => (
                          <tr key={`${log.date}-${log.time}-${log.user}-${idx}`} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="py-2 px-3 text-white">{log.date}</td>
                            <td className="py-2 px-3 text-white">{log.time}</td>
                            <td className="py-2 px-3 text-white">{log.user}</td>
                            <td className="py-2 px-3 text-white">{log.action}</td>
                            <td className="py-2 px-3 text-white">{log.product_name || '-'}</td>
                            <td className="py-2 px-3 text-white">{log.product_sku || '-'}</td>
                            <td className="py-2 px-3 text-white">{log.details}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-500">
                            {selectedShiftReport ? (locale.startsWith("ar") ? "لا توجد عمليات" : "No operations") : (locale.startsWith("ar") ? "ابدأ النوبة أولاً" : "Start a shift first")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MiniCalculatorDialog
        open={calculatorOpen}
        onOpenChange={setCalculatorOpen}
        initialValue={effectiveSaleTotal}
        title={t("inv.calculatorTitle")}
        onApply={(v) => setManualTotalOverride(String(v))}
      />

      <Dialog
        open={quickStockOpen}
        onOpenChange={(o) => {
          if (!o) {
            setQuickStockOpen(false);
            setQuickStockProductId(null);
          }
        }}
      >
        <DialogContent className="max-w-md border-amber-500/25">
          <DialogHeader>
            <DialogTitle className="text-white">{t("inv.quickStockTitle")}</DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">{t("inv.quickStockDesc")}</DialogDescription>
          </DialogHeader>
          {quickStockProductId && (
            <p className="text-sm text-cyan-200 font-semibold">
              {products.find((p) => p.id === quickStockProductId)?.name ?? "—"}
            </p>
          )}
          <div>
            <Label>{t("inv.addPieces")}</Label>
            <Input
              type="number"
              min={1}
              className="mt-1 bg-[#0c1222] border-slate-700"
              value={quickStockPieces}
              onChange={(e) => setQuickStockPieces(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="border-slate-600"
              onClick={() => {
                setQuickStockOpen(false);
                setQuickStockProductId(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="button" className="bg-amber-600 hover:bg-amber-500" onClick={() => void applyQuickStock()}>
              {t("inv.applyStock")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProcessingBar
        active={exportProcessing.active}
        label={exportProcessing.label || t("common.processing")}
        progress={exportProcessing.progress}
      />
    </div>
  );
}
