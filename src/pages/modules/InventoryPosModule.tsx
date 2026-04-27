import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  Download,
  Lock,
  FileSpreadsheet,
  FileText,
  Plus,
  Receipt,
  ScanBarcode,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { postBackendReportDocx } from "@/lib/backendExportClient";
import {
  buildOfficialPdfTableHtml,
  exportSmartAlIdaraPdfPreferBackend,
  escapeHtmlPdf,
} from "@/lib/pdfExport";
import { downloadTableAsWordDocx } from "@/lib/wordExport";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import * as XLSX from "xlsx";
import { downloadXlsxWorkbook } from "@/lib/excelDownload";
import { BarcodeScannerHub } from "@/components/BarcodeScannerHub";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProcessingBar } from "@/components/ProcessingBar";
import { lookupBarcodeOpenFoodFacts } from "@/lib/barcodeGlobalLookup";
import { MiniCalculatorDialog } from "@/components/MiniCalculatorDialog";
import { InventoryAiDocScannerButton } from "@/components/InventoryAiDocScannerButton";
import type { VisionReceiptItem } from "@/lib/inventoryVisionTypes";
import { todayIsoLocal } from "@/lib/todayIso";
import {
  parseDraftLinesFromPlainText,
  parseStockRowsFromPlainText,
  bestCatalogMatch,
  heuristicReceiptItemsFromPlainText,
  type ProductLite,
} from "@/lib/inventoryReceiptParse";

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
  "retail",
] as const;

const UNIT_KINDS = ["piece", "box", "bag", "kg"] as const;

const INV_TABS = ["dash", "pos", "barcode", "credit"] as const;

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

function piecesPerQuickUnit(p: Product, u: QuickUnit): number {
  const ppc = Math.max(1, Math.floor(Number(p.pieces_per_carton) || 1));
  if (u === "piece") return 1;
  return ppc;
}

export function InventoryPosModule() {
  const { token, isApproved, approvedModules } = useAuth();
  const { t, isRtl, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
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
  });
  const [sale, setSale] = useState({
    customer: "",
    paid: "",
    due_at: todayIsoLocal(),
  });
  const [quickListIndex, setQuickListIndex] = useState(0);
  const [quickUnit, setQuickUnit] = useState<QuickUnit>("piece");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
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
  const [manualTotalOverride, setManualTotalOverride] = useState("");
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [quickStockOpen, setQuickStockOpen] = useState(false);
  const [quickStockProductId, setQuickStockProductId] = useState<string | null>(null);
  const [quickStockPieces, setQuickStockPieces] = useState("1");

  const runExport = useCallback(async (label: string, fn: () => Promise<void>) => {
    setExportProcessing({ active: true, label, progress: 0.06 });
    try {
      await fn();
      setExportProcessing((s) => ({ ...s, progress: 1 }));
    } finally {
      window.setTimeout(() => setExportProcessing({ active: false, label: "" }), 420);
    }
  }, []);

  const ghostBarcodeBusyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [p, inv, br] = await Promise.all([
        api<{ products: Product[] }>("/inventory/products", { token }),
        api<{ invoices: Invoice[] }>("/inventory/invoices", { token }),
        api<{
          branding: { activityType?: string; companyName?: string; logoDataUrl?: string };
        }>("/user/branding", { token }),
      ]);
      setProducts(p.products);
      setInvoices(inv.invoices);
      if (br.branding) {
        const act = br.branding.activityType || "retail";
        setBrandingPrefs({
          activityType: act,
          companyName: br.branding.companyName || "",
          logoDataUrl: br.branding.logoDataUrl || "",
        });
        setNewProduct((n) => ({ ...n, retail_type: act }));
      }
    } catch {
      setProducts([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const saveBrandingActivity = async () => {
    if (!token) return;
    await api("/user/branding", {
      method: "PUT",
      token,
      body: JSON.stringify({
        companyName: brandingPrefs.companyName,
        activityType: brandingPrefs.activityType,
        logoDataUrl: brandingPrefs.logoDataUrl,
      }),
    });
  };

  useEffect(() => {
    void load();
  }, [load]);

  const addProduct = async () => {
    if (!token || !newProduct.name.trim()) return;
    await api("/inventory/products", {
      method: "POST",
      token,
      body: JSON.stringify({
        name: newProduct.name,
        sku: newProduct.sku,
        retail_type: newProduct.retail_type,
        pieces_per_carton: Number(newProduct.pieces_per_carton) || 1,
        unit_price: Number(newProduct.unit_price) || 0,
        stock_pieces: Number(newProduct.stock_pieces) || 0,
        unit_kind: newProduct.unit_kind,
        cost_price: Number(newProduct.cost_price) || 0,
        expiry_date: newProduct.expiry_date.trim() || null,
        low_stock_alert: Math.max(0, Math.floor(Number(newProduct.low_stock_alert) || 10)),
      }),
    });
    setNewProduct((n) => ({ ...n, name: "", sku: "" }));
    await load();
  };

  const addStock = async () => {
    if (!token || !stockAdd.product_id) return;
    await api("/inventory/stock-add", {
      method: "POST",
      token,
      body: JSON.stringify({
        product_id: stockAdd.product_id,
        add_pieces: Number(stockAdd.add) || 0,
      }),
    });
    setStockAdd({ product_id: "", add: "0" });
    await load();
  };

  const submitQuickDraft = async () => {
    if (!token || draftLines.length === 0) return;
    const ovRaw = manualTotalOverride.trim().replace(",", ".");
    let override_total: number | undefined;
    if (ovRaw !== "") {
      const n = parseFloat(ovRaw);
      if (Number.isFinite(n) && n >= 0) override_total = n;
    }
    await api("/inventory/sale-batch", {
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
    setDraftLines([]);
    setManualTotalOverride("");
    await load();
  };

  const overdueCredits = useMemo(
    () =>
      invoices.filter(
        (i) => (i.credit ?? 0) > 0 && i.due_at && new Date(i.due_at) < new Date()
      ),
    [invoices]
  );

  const currentLinePreview = useMemo(() => {
    const p = products[quickListIndex];
    if (!p) return { line: 0, profit: 0, pp: 1 };
    const pp = piecesPerQuickUnit(p, quickUnit);
    const line = pp * p.unit_price;
    const cost = Math.max(0, Number(p.cost_price) || 0);
    const profit = pp * (p.unit_price - cost);
    return { line, profit, pp };
  }, [products, quickListIndex, quickUnit]);

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
      if (!token || items.length === 0) return;
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
      if (!token || items.length === 0) return;
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
      await load();
    },
    [token, productsLite, brandingPrefs.activityType, load]
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
    async (text: string) => {
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
          await api("/inventory/stock-add", {
            method: "POST",
            token,
            body: JSON.stringify({
              product_id: row.product_id,
              add_pieces: row.add_pieces,
            }),
          });
        }
        await load();
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

  const applyQuickStock = async () => {
    if (!token || !quickStockProductId) return;
    const add = Math.max(0, Math.floor(Number(quickStockPieces) || 0));
    if (add <= 0) {
      setQuickStockOpen(false);
      setQuickStockProductId(null);
      return;
    }
    await api("/inventory/stock-add", {
      method: "POST",
      token,
      body: JSON.stringify({
        product_id: quickStockProductId,
        add_pieces: add,
      }),
    });
    setQuickStockOpen(false);
    setQuickStockProductId(null);
    await load();
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
      if (available < pp) return false;
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
          const idx = products.findIndex((p) => p.id === existing.id);
          if (idx >= 0) {
            setQuickListIndex(idx);
            setQuickUnit("piece");
          }
          const ok = tryAddQuickLineForProductId(existing.id, "piece");
          if (!ok) {
            setQuickStockProductId(existing.id);
            setQuickStockPieces("1");
            setQuickStockOpen(true);
          }
          return;
        }
        const r = await api<{ id: string }>("/inventory/products", {
          method: "POST",
          token,
          body: JSON.stringify({
            name: `${t("inv.ghostBarcodeName")} ${c}`,
            sku: c,
            retail_type: brandingPrefs.activityType || "retail",
            pieces_per_carton: 1,
            unit_price: 0,
            stock_pieces: 99999,
            unit_kind: "piece",
            cost_price: 0,
            low_stock_alert: 10,
          }),
        });
        try {
          const info = await lookupBarcodeOpenFoodFacts(c);
          if (info) {
            await api(`/inventory/products/${r.id}`, {
              method: "PATCH",
              token,
              body: JSON.stringify({
                name: info.name,
                retail_type: info.suggestedRetailType,
              }),
            });
          }
        } catch {
          /* optional */
        }
        const fresh = await api<{ products: Product[] }>("/inventory/products", { token });
        setProducts(fresh.products);
        const p = fresh.products.find((x) => x.id === r.id);
        if (p) {
          const qtyP = 1;
          const lineTotal = Math.round(qtyP * p.unit_price * 100) / 100;
          setDraftLines((d) => [
            ...d,
            {
              id: crypto.randomUUID(),
              product_id: p.id,
              product_name: p.name,
              qty_pieces: qtyP,
              sale_unit: "piece",
              line_total: lineTotal,
            },
          ]);
          const pi = fresh.products.findIndex((x) => x.id === p.id);
          if (pi >= 0) setQuickListIndex(pi);
        }
      } finally {
        window.setTimeout(() => {
          if (ghostBarcodeBusyRef.current === c) ghostBarcodeBusyRef.current = null;
        }, 400);
      }
    },
    [token, products, brandingPrefs.activityType, t, tryAddQuickLineForProductId]
  );

  const onBarcodeMatchedInPos = useCallback(
    (productId: string) => {
      const ok = tryAddQuickLineForProductId(productId);
      if (!ok) {
        setQuickStockProductId(productId);
        setQuickStockPieces("1");
        setQuickStockOpen(true);
      }
    },
    [tryAddQuickLineForProductId]
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

  useEffect(() => {
    if (invTab !== "pos") return;
    const t = window.setTimeout(() => quickKbRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [invTab, products.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { invTab: tab, products: prods, quickListIndex: idx, quickUnit: qUnit, draftLines: draft } =
        quickStateRef.current;
      if (tab !== "pos") return;

      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "Enter" && target?.closest("button")) return;

      const n = prods.length;
      if (n === 0) return;

      const cycleUnit = (delta: number) => {
        const cur = QUICK_UNITS.indexOf(qUnit);
        const next = (cur + delta + QUICK_UNITS.length) % QUICK_UNITS.length;
        setQuickUnit(QUICK_UNITS[next]);
      };

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setQuickListIndex((i) => Math.min(i + 1, n - 1));
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setQuickListIndex((i) => Math.max(i - 1, 0));
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          cycleUnit(1);
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          cycleUnit(-1);
          break;
        }
        case "Enter": {
          e.preventDefault();
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

  const inventoryAllowed = isApproved && approvedModules.includes("inventory");
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
    });
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
          <Button type="button" variant="secondary" className="gap-2" onClick={() => void saveBrandingActivity()}>
            {t("common.save")}
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
        </TabsList>

        <TabsContent value="dash" className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/25 bg-[#0a1628]/90 px-4 py-4">
            <div className="min-w-0">
              <p className="text-sm font-black text-white">{t("inv.stockAiSectionTitle")}</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">{t("inv.stockAiSectionHint")}</p>
            </div>
            <InventoryAiDocScannerButton
              token={token}
              label={t("inv.aiDocScanner")}
              onTextExtracted={(txt) => void applyStockOcrText(txt)}
              onVisionItems={(items) => void applyStockVisionItems(items)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="gap-2" onClick={() => void exportPdf()}>
              <Download className="size-4" />
              {t("inv.exportPdfStock")}
            </Button>
            <Button type="button" variant="secondary" className="gap-2" onClick={() => void exportStockWord()}>
              <FileText className="size-4" />
              {t("inv.exportWordStock")}
            </Button>
            <Button type="button" variant="secondary" className="gap-2" onClick={exportExcel}>
              <FileSpreadsheet className="size-4" />
              Excel
            </Button>
            <Button type="button" variant="outline" className="gap-2 border-slate-600" onClick={exportInvoicesExcel}>
              <Receipt className="size-4" />
              {t("inv.exportSales")}
            </Button>
            <Button type="button" variant="outline" className="gap-2 border-slate-600" onClick={() => void exportInvoicesPdf()}>
              <Download className="size-4" />
              {t("inv.exportPdfInvoices")}
            </Button>
            <Button type="button" variant="outline" className="gap-2 border-slate-600" onClick={() => void exportInvoicesWord()}>
              <FileText className="size-4" />
              {t("inv.exportWordInvoices")}
            </Button>
          </div>

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
                  onChange={(e) => setNewProduct((n) => ({ ...n, name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-slate-300">{t("inv.col.sku")}</Label>
                <Input
                  className="mt-1 bg-[#0c1222] border-slate-700"
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct((n) => ({ ...n, sku: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-slate-300">{t("inv.col.sector")}</Label>
                <select
                  className="w-full mt-1 h-10 rounded-md border border-slate-700 bg-[#0c1222] px-2 text-sm text-white"
                  value={newProduct.retail_type}
                  onChange={(e) => setNewProduct((n) => ({ ...n, retail_type: e.target.value }))}
                >
                  {RETAIL_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {t(`inv.retail.${rt}`)}
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
                  onChange={(e) => setNewProduct((n) => ({ ...n, pieces_per_carton: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-slate-300">{t("inv.col.price")}</Label>
                <Input
                  type="number"
                  className="mt-1 bg-[#0c1222] border-slate-700"
                  value={newProduct.unit_price}
                  onChange={(e) => setNewProduct((n) => ({ ...n, unit_price: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-slate-300">{t("inv.col.stockP")}</Label>
                <Input
                  type="number"
                  className="mt-1 bg-[#0c1222] border-slate-700"
                  value={newProduct.stock_pieces}
                  onChange={(e) => setNewProduct((n) => ({ ...n, stock_pieces: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-slate-300">{t("inv.col.unitKind")}</Label>
                <select
                  className="w-full mt-1 h-10 rounded-md border border-slate-700 bg-[#0c1222] px-2 text-sm text-white"
                  value={newProduct.unit_kind}
                  onChange={(e) => setNewProduct((n) => ({ ...n, unit_kind: e.target.value }))}
                >
                  {UNIT_KINDS.map((uk) => (
                    <option key={uk} value={uk}>
                      {t(`inv.unit.${uk}`)}
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
                  onChange={(e) => setNewProduct((n) => ({ ...n, cost_price: e.target.value }))}
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
                  onChange={(e) => setNewProduct((n) => ({ ...n, expiry_date: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-slate-300">{t("inv.lowStockAlert")}</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1 bg-[#0c1222] border-slate-700"
                  value={newProduct.low_stock_alert}
                  onChange={(e) => setNewProduct((n) => ({ ...n, low_stock_alert: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Button type="button" className="bg-[#0052CC]" onClick={() => void addProduct()}>
                  <Plus className="size-4 me-1" />
                  {t("inv.addProduct")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0a1628]/90">
            <CardHeader className="border-b border-slate-800">
              <p className="font-black text-white">{t("inv.stockTable")}</p>
            </CardHeader>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-sm text-slate-200">
                <thead>
                  <tr className="text-left border-b border-slate-700 text-slate-400">
                    <th className="py-2 pe-4">{t("inv.col.name")}</th>
                    <th className="py-2 pe-4">{t("inv.col.unitKind")}</th>
                    <th className="py-2 pe-4">{t("inv.col.ppc")}</th>
                    <th className="py-2 pe-4">{t("inv.col.price")}</th>
                    <th className="py-2 pe-4">{t("inv.costPrice")}</th>
                    <th className="py-2 pe-4">{t("inv.piece")}</th>
                    <th className="py-2">{t("inv.carton")}</th>
                    <th className="py-2 pe-4 text-xs">{t("inv.expiryDate")}</th>
                    <th className="py-2 text-xs">{t("inv.lowStockAlert")}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-800/80">
                      <td className="py-2 font-semibold">{p.name}</td>
                      <td className="py-2 text-xs text-slate-400">
                        {UNIT_KINDS.includes((p.unit_kind || "piece") as (typeof UNIT_KINDS)[number])
                          ? t(`inv.unit.${p.unit_kind || "piece"}`)
                          : p.unit_kind || "—"}
                      </td>
                      <td className="py-2">{p.pieces_per_carton}</td>
                      <td className="py-2">{p.unit_price}</td>
                      <td className="py-2 text-slate-400">{p.cost_price ?? 0}</td>
                      <td className="py-2 text-emerald-400 font-bold">{p.stock_pieces}</td>
                      <td className="py-2 text-[#FF8C00] font-bold">
                        {Math.floor(p.stock_pieces / Math.max(1, p.pieces_per_carton))}
                      </td>
                      <td className="py-2 text-xs text-slate-400">{p.expiry_date ?? "—"}</td>
                      <td className="py-2 text-xs">{p.low_stock_alert ?? 10}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

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
                  onChange={(e) => setStockAdd((s) => ({ ...s, product_id: e.target.value }))}
                >
                  <option value="">—</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
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
                  onChange={(e) => setStockAdd((s) => ({ ...s, add: e.target.value }))}
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => void addStock()}>
                {t("inv.applyStock")}
              </Button>
            </CardContent>
          </Card>
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
                  onMatchedProduct={(productId) => {
                    onBarcodeMatchedInPos(productId);
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
                  <div
                    ref={quickListRef}
                    className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain border-b border-slate-800"
                  >
                    {products.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">{t("inv.quickEmptyProducts")}</p>
                    ) : (
                      products.map((p, i) => {
                        const active = i === quickListIndex;
                        return (
                          <div
                            key={p.id}
                            data-quick-idx={i}
                            className={`flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-800/80 text-sm transition-colors ${
                              active ? "bg-[#0052CC]/25 border-s-4 border-[#FF8C00]" : "hover:bg-white/5"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">{p.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {t("inv.col.stockP")}: {p.stock_pieces} · {t("inv.col.price")}{" "}
                                {p.unit_price}
                              </p>
                            </div>
                            {active && (
                              <span className="shrink-0 text-[10px] font-bold uppercase text-[#FF8C00]">
                                ●
                              </span>
                            )}
                          </div>
                        );
                      })
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
                    {products[quickListIndex] && (
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
                    {products[quickListIndex] &&
                      (() => {
                        const p = products[quickListIndex];
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
                    <Button
                      type="button"
                      className="w-full bg-[#0052CC]"
                      disabled={draftLines.length === 0}
                      onClick={() => void submitQuickDraft()}
                    >
                      {t("inv.quickConfirmBatch")}
                    </Button>
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
              <div>
                <p className="font-black">{t("inv.overdueAlert")}</p>
                <ul className="text-sm mt-1 list-disc ms-4">
                  {overdueCredits.map((i) => (
                    <li key={i.id}>
                      {i.customer_name || "—"} — {i.credit} MAD — {i.due_at}
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
                    </tr>
                  ))}
                </tbody>
              </table>
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

