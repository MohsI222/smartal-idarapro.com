import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { User, ShoppingCart, Clock, LogOut, Settings, BarChart3, Package, Search, Scan, Filter, X, Check, Home, Download, FileText, Camera, CameraOff, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { BarcodeScannerHub } from "@/components/BarcodeScannerHub";
import { useBarcodeScanner } from "@/lib/useBarcodeScanner";
import { compressImageUnder100KB } from "@/lib/imageUtils";
import { uploadFile } from "@/lib/supabaseClient";
import * as XLSX from 'xlsx';

type Employee = {
  id: string;
  employee_id: string;
  name: string;
  role: string;
  department: string;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  unit_price: number;
  stock_pieces: number;
  unit_kind: string;
  pieces_per_carton: number;
  image_url?: string;
};

type SaleLine = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Sale = {
  id: string;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  credit_amount: number;
  payment_method: string;
  check_number?: string;
  check_holder_name?: string;
  check_holder_cin?: string;
  sale_date: string;
  lines: SaleLine[];
};

type Attendance = {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  work_duration_minutes: number | null;
};

type AgentView = "login" | "pos" | "dashboard" | "settings" | "returns";

export function PosAgentApp() {
  const [searchParams] = useSearchParams();
  const { locale: globalLocale, isRtl } = useI18n();
  const [locale, setLocale] = useState(() => localStorage.getItem('pos_locale') || globalLocale || "ar");
  const urlToken = searchParams.get("token"); // Changed from "sessionToken" to "token"
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('pos_session_sessionToken') || urlToken || null);

  const [currentView, setCurrentView] = useState<AgentView>("login");
  const [loading, setLoading] = useState(true);
  const [validatingToken, setValidatingToken] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [visibleProductIds, setVisibleProductIds] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<SaleLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "check">("cash");
  const [checkNumber, setCheckNumber] = useState("");
  const [checkHolderName, setCheckHolderName] = useState("");
  const [checkHolderCin, setCheckHolderCin] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalProductsSold, setTotalProductsSold] = useState(0);
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1); // -1 means no selection
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [agentLocale, setAgentLocale] = useState<"ar" | "en" | "fr" | "es">("ar");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [returnCart, setReturnCart] = useState<SaleLine[]>([]);
  const [showReturnScanner, setShowReturnScanner] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState({
    name: "",
    sku: "",
    unit_price: "",
    stock_pieces: "",
    unit_kind: "",
    pieces_per_carton: "",
    image_url: ""
  });
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [newProductBarcode, setNewProductBarcode] = useState("");
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("");
  const [storePhone, setStorePhone] = useState<string>("");
  const [storeAddress, setStoreAddress] = useState<string>("");
  const [storeQrCode, setStoreQrCode] = useState<string>("");
  const [appDownloadLink, setAppDownloadLink] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // Load company logo and store settings from localStorage on mount
  useEffect(() => {
    const savedLogo = localStorage.getItem('pos_company_logo');
    if (savedLogo) {
      setCompanyLogo(savedLogo);
    }
    const savedStoreName = localStorage.getItem('pos_store_name');
    if (savedStoreName) setStoreName(savedStoreName);
    const savedStorePhone = localStorage.getItem('pos_store_phone');
    if (savedStorePhone) setStorePhone(savedStorePhone);
    const savedStoreAddress = localStorage.getItem('pos_store_address');
    if (savedStoreAddress) setStoreAddress(savedStoreAddress);
    const savedStoreQrCode = localStorage.getItem('pos_store_qr_code');
    if (savedStoreQrCode) setStoreQrCode(savedStoreQrCode);
    const savedAppLink = localStorage.getItem('pos_app_download_link');
    if (savedAppLink) setAppDownloadLink(savedAppLink);
    const savedLocale = localStorage.getItem('pos_locale');
    if (savedLocale) setLocale(savedLocale);
  }, []);

  // Validate sessionToken on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!sessionToken) {
        console.error("[PosAgentApp] No sessionToken provided");
        setValidatingToken(false);
        setLoading(false);
        return;
      }

      // Try to restore session from localStorage
      const savedSession = localStorage.getItem(`pos_agent_${sessionToken}`);
      if (savedSession) {
        try {
          const sessionData = JSON.parse(savedSession);
          console.log("[PosAgentApp] Restored session from localStorage:", sessionData);
          console.log("[PosAgentApp] Employee data:", sessionData.employee);
          console.log("[PosAgentApp] Employee ID:", sessionData.employee?.employee_id || sessionData.employee_id);

          // Use employee_id from either the employee object or the session data
          const employeeId = sessionData.employee?.employee_id || sessionData.employee_id;
          if (sessionData.employee && employeeId) {
            setCurrentEmployee(sessionData.employee);
            setSelectedEmployeeId(employeeId);
            await loadProducts();
            await loadSales();
            await loadAttendance();
            setCurrentView("pos");
            setValidatingToken(false);
            setLoading(false);
            return;
          } else {
            console.error("[PosAgentApp] Invalid session data - missing employee_id");
            localStorage.removeItem(`pos_agent_${sessionToken}`);
          }
        } catch (error) {
          console.error("[PosAgentApp] Error restoring session:", error);
          localStorage.removeItem(`pos_agent_${sessionToken}`);
        }
      }

      try {
        const response = await api<{ success: boolean; valid: boolean; employee_id?: string; metadata?: Record<string, unknown> }>(`/pos-agent/validate/${sessionToken}`);
        if (response.success && response.valid) {
          // SECURITY FIX: Always show employee list - never auto-login
          // This prevents users from accessing other accounts' employees
          await loadEmployees();
        } else {
          console.error("[PosAgentApp] Invalid sessionToken response:", response);
          // Still load employees even if validation fails - user can still try to login
          await loadEmployees();
        }
      } catch (error) {
        console.error("[PosAgentApp] Error validating sessionToken:", error);
        // Still load employees even if validation fails - user can still try to login
        await loadEmployees();
      } finally {
        setValidatingToken(false);
        setLoading(false);
      }
    };

    validateToken();
  }, [sessionToken]);

  // Wireless barcode scanner support
  useBarcodeScanner({
    onBarcodeScanned: (barcode) => {
      console.log("[PosAgentApp] Barcode scanned:", barcode);
      console.log("[PosAgentApp] Available products:", products.map(p => ({ id: p.id, name: p.name, sku: p.sku })));

      if (currentView === "pos") {
        // Match exact SKU only - no loose name matching
        const matchedProduct = products.find(p =>
          p.sku === barcode.trim()
        );
        console.log("[PosAgentApp] Matched product for POS:", matchedProduct);
        if (matchedProduct) {
          addToCart(matchedProduct);
          toast.success(`${getText("addedToCart")}: ${matchedProduct.name}`);
        } else {
          toast.error(`${getText("productNotFound")}: ${barcode}`);
        }
      } else if (currentView === "returns") {
        // Match exact SKU only - no loose name matching
        const matchedProduct = products.find(p =>
          p.sku === barcode.trim()
        );
        console.log("[PosAgentApp] Matched product for Returns:", matchedProduct);
        if (matchedProduct) {
          addToReturnCart(matchedProduct);
          toast.success(`${getText("addedToReturn")}: ${matchedProduct.name}`);
        } else {
          toast.error(`${getText("productNotFound")}: ${barcode}`);
        }
      }
    }
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle print dialog with Enter key
      if (showPrintDialog) {
        if (e.key === "Enter") {
          e.preventDefault();
          handlePrintDialogChoice(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          handlePrintDialogChoice(false);
        }
        return;
      }

      if (currentView !== "pos" && currentView !== "returns") return;

      // Arrow keys for search suggestions (when focused on search input)
      if (showSearchSuggestions && filteredProducts.length > 0 && document.activeElement?.tagName === "INPUT") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedSuggestionIndex(prev => (prev + 1) % Math.min(filteredProducts.length, 10));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedSuggestionIndex(prev => (prev - 1 + Math.min(filteredProducts.length, 10)) % Math.min(filteredProducts.length, 10));
        } else if (e.key === "Enter") {
          e.preventDefault();
          const selectedProduct = filteredProducts[selectedSuggestionIndex];
          if (selectedProduct) {
            if (currentView === "pos") {
              addToCart(selectedProduct);
              toast.success(`${getText("addedToCart")}: ${selectedProduct.name}`);
            } else {
              addToReturnCart(selectedProduct);
              toast.success(`${getText("addedToReturn")}: ${selectedProduct.name}`);
            }
            setSearchQuery("");
            setShowSearchSuggestions(false);
            setSelectedSuggestionIndex(0);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          setShowSearchSuggestions(false);
          setSelectedSuggestionIndex(0);
        }
        return;
      }

      // Arrow keys for product navigation (works for both POS and Returns)
      if (filteredProducts.length > 0 && document.activeElement?.tagName !== "INPUT") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedProductIndex(prev => {
            if (prev === -1) return 0;
            return (prev + 1) % filteredProducts.length;
          });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedProductIndex(prev => {
            if (prev === -1) return filteredProducts.length - 1;
            return (prev - 1 + filteredProducts.length) % filteredProducts.length;
          });
        } else if (e.key === "ArrowRight" || e.key === "Enter") {
          e.preventDefault();
          if (selectedProductIndex >= 0 && filteredProducts[selectedProductIndex]) {
            if (currentView === "pos") {
              addToCart(filteredProducts[selectedProductIndex]);
            } else {
              addToReturnCart(filteredProducts[selectedProductIndex]);
            }
          }
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (currentView === "pos" && cart.length > 0) {
            removeFromCart(cart[cart.length - 1].product_id);
          } else if (currentView === "returns" && returnCart.length > 0) {
            removeFromReturnCart(returnCart[returnCart.length - 1].product_id);
          }
        }
      }

      // Enter key - checkout if cart has items (POS only)
      if (currentView === "pos" && e.key === "Enter" && cart.length > 0 && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        handleCheckout();
        return;
      }

      // Barcode scanner detection (rapid input ending with Enter)
      if (e.key === "Enter" && searchQuery.length > 3) {
        e.preventDefault();
        const matchedProduct = filteredProducts.find(p =>
          p.sku === searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (matchedProduct) {
          if (currentView === "pos") {
            addToCart(matchedProduct);
          } else {
            addToReturnCart(matchedProduct);
          }
          setSearchQuery("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentView, filteredProducts, selectedProductIndex, cart, returnCart, searchQuery, showPrintDialog, showSearchSuggestions, selectedSuggestionIndex]);

  // Reload data when switching to dashboard
  useEffect(() => {
    if (currentView === "dashboard" && currentEmployee) {
      loadSales();
      loadAttendance();
    }
  }, [currentView]);

  // Polling for inventory sync - using Neon as source of truth instead of Supabase Realtime
  // Reduced to 1 second for near real-time sync
  useEffect(() => {
    if (!sessionToken) return;

    const interval = setInterval(async () => {
      try {
        const response = await api<{ success: boolean; products: Product[] }>(`/inventory/standalone-products?token=${sessionToken}`);
        if (response.success) {
          console.log("[PosAgentApp] Polling - Loaded products:", response.products.length);
          setProducts(response.products);
          // Respect search query when updating filtered products
          if (searchQuery.trim()) {
            handleSearch(searchQuery);
          } else {
            setFilteredProducts(response.products);
          }
        }
      } catch (error) {
        console.error("[PosAgentApp] Error polling products:", error);
      }
    }, 1000); // Poll every 1 second for near real-time sync

    return () => clearInterval(interval);
  }, [sessionToken, searchQuery]);

  const loadEmployees = async () => {
    try {
      // Load employees from Transport & Logistics table
      const response = await api<{ success: boolean; employees: Employee[] }>(`/pos-agent/standalone-employees?token=${sessionToken}`);
      if (response.success) {
        setEmployees(response.employees);
      }
    } catch (error) {
      console.error("[PosAgentApp] Error loading employees:", error);
      toast.error("فشل تحميل قائمة الموظفين");
    }
  };

  const loadEmployeesAndProceed = async (employeeId: string) => {
    try {
      const response = await api<{ success: boolean; employees: Employee[] }>(`/pos-agent/standalone-employees?token=${sessionToken}`);
      if (response.success) {
        const emp = response.employees.find((e) => e.employee_id === employeeId);
        if (emp) {
          setCurrentEmployee(emp);
          await loadProducts();
          await loadSales();
          await loadAttendance();
          setCurrentView("pos");
        }
      }
    } catch (error) {
      console.error("[PosAgentApp] Error loading employee:", error);
      toast.error("فشل تحميل بيانات المندوب");
    }
  };

  const handleLogin = async () => {
    if (!selectedEmployeeId) {
      toast.error("يرجى اختيار اسمك");
      return;
    }

    console.log("[PosAgentApp] Attempting login with:", { sessionToken: sessionToken?.substring(0, 20), employee_id: selectedEmployeeId });
    setLoading(true);
    try {
      const response = await api<{ success: boolean; employee: Employee; message: string }>("/pos-agent/session", {
        method: "POST",
        body: JSON.stringify({ token: sessionToken, employee_id: selectedEmployeeId }),
      });

      console.log("[PosAgentApp] Login response:", response);

      if (response.success) {
        setCurrentEmployee(response.employee);
        // Save session sessionToken to localStorage
        setSessionToken(sessionToken);
        localStorage.setItem('pos_session_sessionToken', sessionToken || '');
        // Save employee data using sessionToken (not urlToken which might be undefined)
        localStorage.setItem(`pos_agent_${sessionToken}`, JSON.stringify({
          employee_id: selectedEmployeeId,
          employee: response.employee
        }));
        await loadProducts();
        await loadSales();
        await loadAttendance();
        setCurrentView("pos");
        toast.success(getText("loginSuccess"));
      } else {
        console.error("[PosAgentApp] Login failed:", response);
        toast.error(response.message || getText("loginFailed"));
      }
    } catch (error) {
      console.error("[PosAgentApp] Error logging in:", error);
      toast.error(getText("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      // Load products from inventory using standalone endpoint
      const response = await api<{ success: boolean; products: Product[] }>(`/inventory/standalone-products?token=${sessionToken}`);
      if (response.success) {
        console.log("[PosAgentApp] Loaded products:", response.products.map(p => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock_pieces })));
        console.log("[PosAgentApp] Total products loaded:", response.products.length);
        setProducts(response.products);
        // Re-apply search filter if there's an active search
        if (searchQuery.trim()) {
          handleSearch(searchQuery);
        }
      } else {
        console.error("[PosAgentApp] Failed to load products:", response);
      }
    } catch (error) {
      console.error("[PosAgentApp] Error loading products:", error);
      toast.error(getText("loadProductsFailed"));
    }
  };

  const handleSaveProduct = async () => {
    if (!productFormData.name || !productFormData.sku || !productFormData.unit_price) {
      toast.error("يرجى ملء الحقول المطلوبة");
      return;
    }

    setLoading(true);
    try {
      const productData = {
        name: productFormData.name,
        sku: productFormData.sku,
        unit_price: parseFloat(productFormData.unit_price),
        stock_pieces: parseInt(productFormData.stock_pieces) || 0,
        unit_kind: productFormData.unit_kind || "piece",
        pieces_per_carton: parseInt(productFormData.pieces_per_carton) || 1,
        image_url: productFormData.image_url || null
      };

      console.log("[PosAgentApp] Saving product:", {
        isEdit: !!editingProduct,
        productId: editingProduct?.id,
        hasImage: !!productData.image_url,
        imageLength: productData.image_url?.length,
        data: productData
      });

      let response;
      if (editingProduct) {
        // Update existing product using POS Agent endpoint
        response = await api<{ success: boolean; product: Product; message: string }>(`/pos-agent/standalone-products/${editingProduct.id}?token=${sessionToken}`, {
          method: "PUT",
          body: JSON.stringify(productData),
        });
      } else {
        // Create new product using POS Agent endpoint
        response = await api<{ success: boolean; product: Product; message: string }>(`/pos-agent/standalone-products?token=${sessionToken}`, {
          method: "POST",
          body: JSON.stringify(productData),
        });
      }

      console.log("[PosAgentApp] Save product response:", response);

      if (response.success) {
        toast.success(editingProduct ? "تم تحديث المنتج بنجاح" : "تم إضافة المنتج بنجاح");
        setShowProductDialog(false);
        setEditingProduct(null);
        setProductFormData({
          name: "",
          sku: "",
          unit_price: "",
          stock_pieces: "",
          unit_kind: "",
          pieces_per_carton: "",
          image_url: ""
        });
        await loadProducts();
      }
    } catch (error) {
      console.error("[PosAgentApp] Error saving product:", error);
      if (error instanceof Error) {
        console.error("[PosAgentApp] Error message:", error.message);
        console.error("[PosAgentApp] Error stack:", error.stack);
      }
      toast.error(editingProduct ? "فشل تحديث المنتج" : "فشل إضافة المنتج");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
      return;
    }

    setLoading(true);
    try {
      const response = await api<{ success: boolean; message: string }>(`/pos-agent/standalone-products/${productId}?token=${sessionToken}`, {
        method: "DELETE",
      });

      if (response.success) {
        toast.success("تم حذف المنتج بنجاح");
        await loadProducts();
      }
    } catch (error) {
      console.error("[PosAgentApp] Error deleting product:", error);
      toast.error("فشل حذف المنتج");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    const MAX_IMAGE_MB = 10;

    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`الملف كبير جداً — الحد الأقصى ${MAX_IMAGE_MB} ميجابايت`);
      return;
    }

    try {
      // Compress image to under 100KB automatically
      const compressedBlob = await compressImageUnder100KB(file, 0.8, 10);
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });

      console.log('[PosAgentApp] Image compressed:', {
        originalSize: file.size,
        compressedSize: compressedFile.size,
        reduction: Math.round((1 - compressedFile.size / file.size) * 100) + '%'
      });

      // Upload to Supabase Storage
      const fileName = `products/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const publicUrl = await uploadFile(compressedFile, fileName);

      setProductFormData(prev => ({ ...prev, image_url: publicUrl }));
      toast.success("تم رفع الصورة بنجاح");
    } catch (error) {
      console.error("[PosAgentApp] Error uploading image:", error);
      toast.error("فشل رفع الصورة");
    }
  };

  const openProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductFormData({
        name: product.name,
        sku: product.sku,
        unit_price: product.unit_price.toString(),
        stock_pieces: product.stock_pieces.toString(),
        unit_kind: product.unit_kind,
        pieces_per_carton: product.pieces_per_carton.toString(),
        image_url: product.image_url || ""
      });
    } else {
      setEditingProduct(null);
      setProductFormData({
        name: "",
        sku: "",
        unit_price: "",
        stock_pieces: "",
        unit_kind: "",
        pieces_per_carton: "",
        image_url: ""
      });
    }
    setShowProductDialog(true);
  };

  const loadSales = async () => {
    try {
      if (!currentEmployee?.employee_id) {
        console.log("[PosAgentApp] Skipping loadSales - no employee_id");
        return;
      }
      console.log("[PosAgentApp] Loading sales with:", { sessionToken: sessionToken?.substring(0, 20), employee_id: currentEmployee?.employee_id });
      const response = await api<{ success: boolean; sales: Sale[] }>(`/pos-agent/standalone-sales?token=${sessionToken}&employee_id=${currentEmployee.employee_id}`);
      console.log("[PosAgentApp] Sales response:", response);
      if (response.success) {
        const salesWithLines = response.sales.map(sale => ({
          ...sale,
          lines: sale.lines || []
        }));
        setSales(salesWithLines);
        // Calculate totals (exclude returns - negative amounts)
        const revenue = salesWithLines.filter(s => s.total_amount > 0).reduce((sum, sale) => sum + sale.total_amount, 0);
        const productsSold = salesWithLines.filter(s => s.total_amount > 0).reduce((sum, sale) => sum + sale.lines.reduce((lineSum, line) => lineSum + Math.abs(line.quantity), 0), 0);
        setTotalRevenue(revenue);
        setTotalProductsSold(productsSold);
        console.log("[PosAgentApp] Sales loaded:", { count: salesWithLines.length, revenue, productsSold });
      }
    } catch (error) {
      console.error("[PosAgentApp] Error loading sales:", error);
    }
  };

  const loadAttendance = async () => {
    try {
      const response = await api<{ success: boolean; attendance: Attendance | null }>(`/pos-agent/standalone-attendance?token=${sessionToken}&employee_id=${currentEmployee?.employee_id}`);
      if (response.success) {
        setAttendance(response.attendance);
      }
    } catch (error) {
      console.error("[PosAgentApp] Error loading attendance:", error);
    }
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      // Show only visible products if filter is active
      const productsToShow = visibleProductIds.size > 0 
        ? products.filter(p => visibleProductIds.has(p.id))
        : products;
      setFilteredProducts(productsToShow);
      setSelectedProductIndex(-1); // No auto-selection
      return;
    }

    const lowerQuery = query.toLowerCase();
    
    // Get the base products to search from (filtered by visibility if needed)
    const baseProducts = visibleProductIds.size > 0 
      ? products.filter(p => visibleProductIds.has(p.id))
      : products;
    
    // Filter and sort products - same logic as InventoryPosModule (Quick Sale)
    const filtered = baseProducts
      .filter(p => {
        const nameMatch = p.name && p.name.toLowerCase().includes(lowerQuery);
        const skuMatch = p.sku && p.sku.toLowerCase().includes(lowerQuery);
        return nameMatch || skuMatch;
      })
      .sort((a, b) => {
        const aName = (a.name || "").toLowerCase();
        const bName = (b.name || "").toLowerCase();
        
        // Priority 1: Name starts with query first
        const aStarts = aName.startsWith(lowerQuery);
        const bStarts = bName.startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Priority 2: Alphabetical by name (same as Quick Sale)
        return aName.localeCompare(bName);
      });

    setFilteredProducts(filtered);
    setSelectedProductIndex(-1); // No auto-selection
    setSelectedSuggestionIndex(0);
  }, [products, visibleProductIds]);

  const toggleProductVisibility = (productId: string) => {
    setVisibleProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      // Update filtered products - respect search query if exists
      if (searchQuery.trim()) {
        const lowerQuery = searchQuery.toLowerCase();
        const visible = products.filter(p => newSet.has(p.id));
        const filtered = visible.filter(p => {
          const nameMatch = p.name && p.name.toLowerCase().includes(lowerQuery);
          const skuMatch = p.sku && p.sku.toLowerCase().includes(lowerQuery);
          return nameMatch || skuMatch;
        }).sort((a, b) => {
          const aName = (a.name || "").toLowerCase();
          const bName = (b.name || "").toLowerCase();
          const aStarts = aName.startsWith(lowerQuery);
          const bStarts = bName.startsWith(lowerQuery);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return aName.localeCompare(bName);
        });
        setFilteredProducts(filtered);
      } else {
        setFilteredProducts(products.filter(p => newSet.has(p.id)));
      }
      return newSet;
    });
  };

  const addToCart = (product: Product) => {
    // Use functional state update to avoid race conditions with rapid scans
    setCart(prevCart => {
      // Check if product has sufficient stock
      const currentQuantityInCart = prevCart.find(line => line.product_id === product.id)?.quantity || 0;
      if (product.stock_pieces <= currentQuantityInCart) {
        toast.error(`${getText("insufficientStock")}: ${product.name} (${product.stock_pieces} ${getText("piece")})`);
        playWarningSound();
        return prevCart;
      }

      const existingLine = prevCart.find(line => line.product_id === product.id);
      if (existingLine) {
        return prevCart.map(line =>
          line.product_id === product.id
            ? { ...line, quantity: line.quantity + 1, line_total: (line.quantity + 1) * line.unit_price }
            : line
        );
      } else {
        return [...prevCart, {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.unit_price,
          line_total: product.unit_price
        }];
      }
    });
  };

  const addToCartWithDebounce = (product: Product, e?: React.MouseEvent) => {
    // Prevent double clicks
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    addToCart(product);
  };

  const uploadFileToServer = async (file: File, path: string): Promise<string> => {
    try {
      console.log("[PosAgentApp] Starting file upload:", { fileName: file.name, path, hasToken: !!sessionToken });

      // Compress image
      const compressedBlob = await compressImageUnder100KB(file);
      
      // Sanitize filename: remove Arabic characters and special chars, use only English letters, numbers, and underscores
      const sanitizedFileName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '') || 'upload.jpg';
      
      const compressedFile = new File([compressedBlob], sanitizedFileName, {
        type: "image/jpeg",
      });

      console.log("[PosAgentApp] File compressed, size:", compressedFile.size, "sanitized name:", sanitizedFileName);

      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(compressedFile);
      });
      const base64 = await base64Promise;
      const base64Data = base64.split(',')[1];

      console.log("[PosAgentApp] Base64 converted, length:", base64Data.length);

      // Update path with sanitized filename
      const sanitizedPath = path.replace(/[^a-zA-Z0-9._/-]/g, '_');

      // Upload to server - send token in both header and body for compatibility
      const response = await api<{ success: boolean; public_url: string }>("/pos-agent/upload-file", {
        method: "POST",
        token: sessionToken, // Send token in headers via Authorization header
        body: JSON.stringify({
          token: sessionToken, // Also send token in body as fallback
          file_data: base64Data,
          file_name: compressedFile.name,
          file_type: compressedFile.type,
          file_path: sanitizedPath
        }),
      });

      console.log("[PosAgentApp] Upload response:", response);

      if (response.success) {
        console.log("[PosAgentApp] Upload SUCCESS:", response.public_url);
        return response.public_url;
      } else {
        console.error("[PosAgentApp] Upload failed: response.success is false");
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("[PosAgentApp] Error uploading file:", error);
      throw error;
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(line => line.product_id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(line =>
      line.product_id === productId
        ? { ...line, quantity, line_total: quantity * line.unit_price }
        : line
    ));
  };

  const addToReturnCart = (product: Product) => {
    const existingLine = returnCart.find(line => line.product_id === product.id);
    if (existingLine) {
      setReturnCart(returnCart.map(line =>
        line.product_id === product.id
          ? { ...line, quantity: line.quantity + 1, line_total: (line.quantity + 1) * line.unit_price }
          : line
      ));
    } else {
      setReturnCart([...returnCart, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.unit_price,
        line_total: product.unit_price
      }]);
    }
  };

  const removeFromReturnCart = (productId: string) => {
    setReturnCart(returnCart.filter(line => line.product_id !== productId));
  };

  const updateReturnCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromReturnCart(productId);
      return;
    }
    setReturnCart(returnCart.map(line =>
      line.product_id === productId
        ? { ...line, quantity, line_total: quantity * line.unit_price }
        : line
    ));
  };

  const handleReturn = async () => {
    if (returnCart.length === 0) {
      toast.error(getText("returnCartEmpty"));
      return;
    }

    setLoading(true);
    try {
      const response = await api<{ success: boolean; message: string }>("/pos-agent/standalone-returns", {
        method: "POST",
        body: JSON.stringify({
          sessionToken,
          employee_id: currentEmployee?.employee_id,
          lines: returnCart,
          total_amount: returnCart.reduce((sum, line) => sum + line.line_total, 0)
        }),
      });

      if (response.success) {
        toast.success(getText("returnSuccess"));
        setReturnCart([]);
        // Reload products to update stock
        await loadProducts();
      }
    } catch (error) {
      console.error("[PosAgentApp] Error return:", error);
      toast.error(getText("returnFailed"));
    } finally {
      setLoading(false);
    }
  };

  const cartTotal = cart.reduce((sum, line) => sum + line.line_total, 0);
  const returnCartTotal = returnCart.reduce((sum, line) => sum + line.line_total, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error(getText("cartEmpty"));
      return;
    }

    console.log("[PosAgentApp] Checkout - currentEmployee:", currentEmployee);
    console.log("[PosAgentApp] Checkout - employee_id:", currentEmployee?.employee_id);

    if (!currentEmployee?.employee_id) {
      toast.error(getText("loginRequired"));
      return;
    }

    // Auto-fill paid amount from total if not provided
    const paid = paidAmount ? parseFloat(paidAmount) : cartTotal;
    const creditAmount = cartTotal - paid;

    // Validate check fields if payment method is check
    if (paymentMethod === "check") {
      if (!checkNumber.trim()) {
        toast.error("رقم الشيك مطلوب");
        setLoading(false);
        return;
      }
      if (!checkHolderName.trim()) {
        toast.error("اسم صاحب الشيك مطلوب");
        setLoading(false);
        return;
      }
      if (!checkHolderCin.trim()) {
        toast.error("رقم البطاقة الوطنية مطلوب");
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const response = await api<{ success: boolean; sale: Sale; message: string }>("/pos-agent/standalone-sales", {
        method: "POST",
        body: JSON.stringify({
          token: sessionToken,  // Changed from sessionToken to token
          employee_id: currentEmployee.employee_id,
          customer_name: customerName || getText("cashCustomer"),
          lines: cart,
          total_amount: cartTotal,
          paid_amount: paid,
          credit_amount: creditAmount,
          payment_method: paymentMethod,
          check_number: paymentMethod === "check" ? checkNumber : null,
          check_holder_name: paymentMethod === "check" ? checkHolderName : null,
          check_holder_cin: paymentMethod === "check" ? checkHolderCin : null
        }),
      });

      if (response.success) {
        // Include cart lines in the sale object for printing
        const saleWithLines = {
          ...response.sale,
          lines: cart.map(line => ({
            product_id: line.product_id,
            product_name: line.product_name,
            quantity: line.quantity,
            unit_price: line.unit_price,
            line_total: line.line_total
          }))
        };
        setLastSale(saleWithLines);
        setShowPrintDialog(true);
        setCart([]);
        setCustomerName("");
        setPaidAmount("");
        setPaymentMethod("cash");
        setCheckNumber("");
        setCheckHolderName("");
        setCheckHolderCin("");
        // Reload sales to ensure persistence
        await loadSales();
        // Refresh stock
        await loadProducts();
        // Update stats
        setTotalRevenue(prev => prev + cartTotal);
        setTotalProductsSold(prev => prev + cart.reduce((sum, line) => sum + line.quantity, 0));
      }
    } catch (error) {
      console.error("[PosAgentApp] Error checkout:", error);
      toast.error(getText("checkoutFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    setIsClockingIn(true);
    try {
      const response = await api<{ success: boolean; attendance: Attendance; message: string }>("/pos-agent/standalone-attendance/clock-in", {
        method: "POST",
        body: JSON.stringify({ token: sessionToken, employee_id: currentEmployee?.employee_id }),
      });

      if (response.success) {
        setAttendance(response.attendance);
        toast.success(getText("clockInSuccess"));
      }
    } catch (error: any) {
      console.error("[PosAgentApp] Error clocking in:", error);
      // If already clocked in, load attendance and show info message
      if (error.message && (error.message.includes("Already clocked in") || error.message.includes("clocked in today"))) {
        toast.info(getText("alreadyClockedIn"));
        // Load current attendance to update the UI
        await loadAttendance();
      } else {
        toast.error(getText("clockInFailed"));
      }
    } finally {
      setIsClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    try {
      const response = await api<{ success: boolean; attendance: Attendance; message: string }>("/pos-agent/standalone-attendance/clock-out", {
        method: "POST",
        body: JSON.stringify({ token: sessionToken, employee_id: currentEmployee?.employee_id }),
      });

      if (response.success) {
        setAttendance(response.attendance);
        toast.success(getText("clockOutSuccess"));
      }
    } catch (error) {
      console.error("[PosAgentApp] Error clocking out:", error);
      toast.error(getText("clockOutFailed"));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(`pos_agent_${sessionToken}`);
    setCurrentEmployee(null);
    setCurrentView("login");
    setCart([]);
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
      console.error("Error playing warning sound:", e);
    }
  };

  const printReceipt = (sale: Sale) => {
    console.log('printReceipt called with sale:', sale);
    const isArabic = locale.startsWith("ar");
    const saleDate = new Date(sale.sale_date);
    
    // Use cart if sale.lines is undefined
    const linesToPrint = sale.lines || cart;
    console.log('Lines to print:', linesToPrint);
    
    const itemsHtml = linesToPrint.map(line => `
      <tr>
        <td style="padding: 4px 8px; font-size: 12px;">${line.product_name}</td>
        <td style="padding: 4px 8px; font-size: 12px; text-align: center;">${line.quantity}</td>
        <td style="padding: 4px 8px; font-size: 12px; text-align: right;">${line.unit_price.toFixed(2)}</td>
        <td style="padding: 4px 8px; font-size: 12px; text-align: right; font-weight: bold;">${line.line_total.toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 5mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            direction: ${isArabic ? 'rtl' : 'ltr'};
            padding: 5mm;
            background: white;
            color: black;
            width: 80mm;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 5mm;
            margin-bottom: 5mm;
          }
          .header h1 {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 2mm;
          }
          .header p {
            font-size: 10px;
            margin-bottom: 1mm;
          }
          .info {
            margin-bottom: 5mm;
            font-size: 11px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2mm;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5mm;
          }
          th {
            text-align: ${isArabic ? 'right' : 'left'};
            padding: 2mm 3mm;
            font-size: 11px;
            border-bottom: 1px solid #000;
            font-weight: bold;
          }
          td {
            padding: 2mm 3mm;
            font-size: 12px;
          }
          .totals {
            border-top: 1px dashed #000;
            padding-top: 5mm;
            margin-top: 5mm;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2mm;
            font-size: 12px;
          }
          .total-row.grand-total {
            font-size: 14px;
            font-weight: bold;
            border-top: 1px solid #000;
            padding-top: 2mm;
            margin-top: 2mm;
          }
          .footer {
            text-align: center;
            margin-top: 5mm;
            padding-top: 5mm;
            border-top: 1px dashed #000;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${companyLogo ? `<img src="${companyLogo}" alt="Company Logo" style="max-width: 80px; max-height: 80px; margin-bottom: 10px;" />` : ''}
          <h1>${locale === 'ar' ? 'فاتورة بيع' : locale === 'fr' ? 'REÇU DE VENTE' : locale === 'es' ? 'RECIBO DE VENTA' : locale === 'en' ? 'SALES RECEIPT' : 'فاتورة بيع'}</h1>
          <p>${storeName || 'Smart Al-Idara Pro'}</p>
          ${storePhone ? `<p style="font-size: 11px; margin: 2px 0;">${locale === 'ar' ? 'الهاتف' : locale === 'fr' ? 'Téléphone' : locale === 'es' ? 'Teléfono' : locale === 'en' ? 'Phone' : 'الهاتف'}: ${storePhone}</p>` : ''}
          ${storeAddress ? `<p style="font-size: 11px; margin: 2px 0;">${storeAddress}</p>` : ''}
        </div>

        <div class="info">
          <div class="info-row">
            <span>${locale === 'ar' ? 'التاريخ' : locale === 'fr' ? 'Date' : locale === 'es' ? 'Fecha' : locale === 'en' ? 'Date' : 'التاريخ'}:</span>
            <span>${saleDate.toLocaleDateString(locale === 'ar' ? "ar-EG" : locale === 'fr' ? "fr-FR" : locale === 'es' ? "es-ES" : "en-US", { numberingSystem: 'latn' })}</span>
          </div>
          <div class="info-row">
            <span>${locale === 'ar' ? 'الوقت' : locale === 'fr' ? 'Heure' : locale === 'es' ? 'Hora' : locale === 'en' ? 'Time' : 'الوقت'}:</span>
            <span>${saleDate.toLocaleTimeString(locale === 'ar' ? "ar-EG" : locale === 'fr' ? "fr-FR" : locale === 'es' ? "es-ES" : "en-US", { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' })}</span>
          </div>
          <div class="info-row">
            <span>${locale === 'ar' ? 'العميل' : locale === 'fr' ? 'Client' : locale === 'es' ? 'Cliente' : locale === 'en' ? 'Customer' : 'العميل'}:</span>
            <span>${sale.customer_name}</span>
          </div>
          <div class="info-row">
            <span>${locale === 'ar' ? 'المندوب' : locale === 'fr' ? 'Agent' : locale === 'es' ? 'Agente' : locale === 'en' ? 'Agent' : 'المندوب'}:</span>
            <span>${currentEmployee?.name || '-'}</span>
          </div>
          ${sale.payment_method === 'check' ? `
          <div class="info-row" style="background: #fff3cd; padding: 8px; margin-top: 10px; border-radius: 4px;">
            <span style="color: #856404; font-weight: bold;">${locale === 'ar' ? 'طريقة الدفع: شيك' : locale === 'fr' ? 'Paiement: Chèque' : locale === 'es' ? 'Pago: Cheque' : locale === 'en' ? 'Payment: Check' : 'طريقة الدفع: شيك'}</span>
          </div>
          <div class="info-row">
            <span>${locale === 'ar' ? 'رقم الشيك' : locale === 'fr' ? 'N° Chèque' : locale === 'es' ? 'N° Cheque' : locale === 'en' ? 'Check No' : 'رقم الشيك'}:</span>
            <span>${sale.check_number || '-'}</span>
          </div>
          <div class="info-row">
            <span>${locale === 'ar' ? 'صاحب الشيك' : locale === 'fr' ? 'Titulaire' : locale === 'es' ? 'Titular' : locale === 'en' ? 'Check Holder' : 'صاحب الشيك'}:</span>
            <span>${sale.check_holder_name || '-'}</span>
          </div>
          <div class="info-row">
            <span>${locale === 'ar' ? 'رقم البطاقة الوطنية' : locale === 'fr' ? 'CIN' : locale === 'es' ? 'DNI' : locale === 'en' ? 'National ID' : 'رقم البطاقة الوطنية'}:</span>
            <span>${sale.check_holder_cin ? sale.check_holder_cin.substring(0, 3) + '***' + sale.check_holder_cin.substring(sale.check_holder_cin.length - 2) : '-'}</span>
          </div>
          ` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>${locale === 'ar' ? 'المنتج' : locale === 'fr' ? 'Produit' : locale === 'es' ? 'Producto' : locale === 'en' ? 'Item' : 'المنتج'}</th>
              <th style="text-align: center;">${locale === 'ar' ? 'الكمية' : locale === 'fr' ? 'Qté' : locale === 'es' ? 'Cant' : locale === 'en' ? 'Qty' : 'الكمية'}</th>
              <th style="text-align: right;">${locale === 'ar' ? 'السعر' : locale === 'fr' ? 'Prix' : locale === 'es' ? 'Precio' : locale === 'en' ? 'Price' : 'السعر'}</th>
              <th style="text-align: right;">${locale === 'ar' ? 'المجموع' : locale === 'fr' ? 'Total' : locale === 'es' ? 'Total' : locale === 'en' ? 'Total' : 'المجموع'}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>${locale === 'ar' ? 'الإجمالي' : locale === 'fr' ? 'Sous-total' : locale === 'es' ? 'Subtotal' : locale === 'en' ? 'Subtotal' : 'الإجمالي'}:</span>
            <span>${sale.total_amount.toFixed(2)} ${getText("currency")}</span>
          </div>
          <div class="total-row">
            <span>${locale === 'ar' ? 'المدفوع' : locale === 'fr' ? 'Payé' : locale === 'es' ? 'Pagado' : locale === 'en' ? 'Paid' : 'المدفوع'}:</span>
            <span>${sale.paid_amount.toFixed(2)} ${getText("currency")}</span>
          </div>
          <div class="total-row">
            <span>${locale === 'ar' ? 'الديون' : locale === 'fr' ? 'Crédit' : locale === 'es' ? 'Crédito' : locale === 'en' ? 'Credit' : 'الديون'}:</span>
            <span>${sale.credit_amount.toFixed(2)} ${getText("currency")}</span>
          </div>
          <div class="total-row grand-total">
            <span>${locale === 'ar' ? 'المجموع النهائي' : locale === 'fr' ? 'TOTAL GÉNÉRAL' : locale === 'es' ? 'TOTAL GENERAL' : locale === 'en' ? 'GRAND TOTAL' : 'المجموع النهائي'}:</span>
            <span>${sale.total_amount.toFixed(2)} ${getText("currency")}</span>
          </div>
        </div>

        ${storeQrCode ? `
        <div style="text-align: center; margin-top: 20px;">
          <img src="${storeQrCode}" alt="QR Code" style="width: 100px; height: 100px;" />
          <p style="font-size: 10px; margin-top: 5px;">${locale === 'ar' ? 'امسح للطلب عبر التطبيق' : locale === 'fr' ? 'Scannez pour commander via l\'app' : locale === 'es' ? 'Escanea para pedir por la app' : locale === 'en' ? 'Scan to order via app' : 'امسح للطلب عبر التطبيق'}</p>
        </div>
        ` : ''}

        ${appDownloadLink ? `
        <div style="text-align: center; margin-top: 15px; padding: 10px; background: #f0f7ff; border-radius: 8px;">
          <p style="font-size: 11px; margin: 0; color: #1e3a5f; font-weight: bold;">${locale === 'ar' ? '📱 حمل تطبيق الطلبات والتوصيل' : locale === 'fr' ? '📱 Téléchargez l\'app de livraison' : locale === 'es' ? '📱 Descarga la app de pedidos' : locale === 'en' ? '📱 Download our delivery app' : '📱 حمل تطبيق الطلبات والتوصيل'}</p>
          <a href="${appDownloadLink}" style="display: inline-block; margin-top: 5px; font-size: 10px; color: #2563eb; text-decoration: none;">${locale === 'ar' ? 'اضغط هنا' : locale === 'fr' ? 'Cliquez ici' : locale === 'es' ? 'Haz clic aquí' : locale === 'en' ? 'Click here' : 'اضغط هنا'}</a>
        </div>
        ` : ''}

        <div class="footer">
          <p>${locale === 'ar' ? 'شكراً لتسوقكم معنا' : locale === 'fr' ? 'Merci de votre visite' : locale === 'es' ? 'Gracias por su compra' : locale === 'en' ? 'Thank you for your purchase' : 'شكراً لتسوقكم معنا'}</p>
          <p>${locale === 'ar' ? 'فاتورة إرشادية - ليست وثيقة رسمية' : locale === 'fr' ? 'Reçu indicatif - Pas un document officiel' : locale === 'es' ? 'Recibo indicativo - No es un documento oficial' : locale === 'en' ? 'Indicative receipt - Not an official document' : 'فاتورة إرشادية - ليست وثيقة رسمية'}</p>
        </div>
      </body>
      </html>
    `;

    console.log('HTML content length:', htmlContent.length);
    
    const printWindow = window.open('', '_blank');
    console.log('Window opened:', printWindow);
    
    if (!printWindow) {
      console.error('Failed to open window');
      toast.error(getText("printWindowFailed"));
      return;
    }
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    console.log('Window opened successfully');
    toast.success(getText("printWindowOpened"));
  };

  const handlePrintDialogChoice = (print: boolean) => {
    setShowPrintDialog(false);
    if (print && lastSale) {
      printReceipt(lastSale);
    }
  };

  const exportSalesToExcel = () => {
    if (!sales || sales.length === 0) {
      toast.error(getText("noSalesToExport"));
      return;
    }

    const data = sales.map(sale => {
      const saleDate = new Date(sale.sale_date);
      const isArabic = locale.startsWith("ar");
      return {
        "التاريخ": saleDate.toLocaleDateString(isArabic ? "ar-EG" : "en-US", { numberingSystem: 'latn' }),
        "الوقت": saleDate.toLocaleTimeString(isArabic ? "ar-EG" : "en-US", { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' }),
        "اسم العميل": sale.customer_name,
        "طريقة الدفع": sale.payment_method === 'check' ? 'شيك' : 'نقدي',
        "رقم الشيك": sale.check_number || '-',
        "صاحب الشيك": sale.check_holder_name || '-',
        "رقم البطاقة الوطنية": sale.check_holder_cin || '-',
        "الإجمالي": sale.total_amount,
        "المدفوع": sale.paid_amount,
        "الديون": sale.credit_amount,
        "عدد الأصناف": sale.lines.length,
        "المنتجات": sale.lines?.map(l => l.product_name).join("; ") || ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Add header row with company info
    const headerData = [
      ["Smart Al-Idara Pro - تقرير المبيعات"],
      [`التاريخ: ${new Date().toLocaleDateString("ar-EG", { numberingSystem: 'latn' })}`],
      [`المندوب: ${currentEmployee?.name || '-'}`],
      [],
      Object.keys(data[0] || {}),
      ...data.map(row => Object.values(row))
    ];

    const newWorksheet = XLSX.utils.aoa_to_sheet(headerData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, newWorksheet, "المبيعات");
    XLSX.writeFile(workbook, `sales_${currentEmployee?.employee_id}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(getText("exportSuccess"));
  };

  const exportSalesToPDF = () => {
    if (!sales || sales.length === 0) {
      toast.error(getText("noSalesToExport"));
      return;
    }

    const isArabic = locale.startsWith("ar");

    // Create a printable HTML
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(getText("printWindowFailed"));
      return;
    }

    const tableRows = sales.map(sale => {
      const saleDate = new Date(sale.sale_date);
      return `
        <tr>
          <td>${saleDate.toLocaleDateString(isArabic ? "ar-EG" : locale === 'fr' ? "fr-FR" : locale === 'es' ? "es-ES" : "en-US", { numberingSystem: 'latn' })}</td>
          <td>${saleDate.toLocaleTimeString(isArabic ? "ar-EG" : locale === 'fr' ? "fr-FR" : locale === 'es' ? "es-ES" : "en-US", { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' })}</td>
          <td>${sale.customer_name}</td>
          <td>${sale.payment_method === 'check' ? `<span style="color: #d97706; font-weight: bold;">${isArabic ? 'شيك' : locale === 'fr' ? 'Chèque' : locale === 'es' ? 'Cheque' : locale === 'en' ? 'Check' : 'شيك'}</span>` : isArabic ? 'نقدي' : locale === 'fr' ? 'Espèces' : locale === 'es' ? 'Efectivo' : locale === 'en' ? 'Cash' : 'نقدي'}</td>
          ${sale.payment_method === 'check' ? `<td>${sale.check_number || '-'}</td><td>${sale.check_holder_name || '-'}</td>` : ''}
          <td>${sale.total_amount.toFixed(2)} ${getText("currency")}</td>
          <td>${sale.paid_amount.toFixed(2)} ${getText("currency")}</td>
          <td>${sale.credit_amount.toFixed(2)} ${getText("currency")}</td>
          <td>${sale.lines?.length || 0}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="${isArabic ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>${isArabic ? 'تقرير المبيعات' : 'Sales Report'}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            direction: ${isArabic ? 'rtl' : 'ltr'};
          }
          h1 {
            text-align: center;
            color: #1e3a5f;
            margin-bottom: 10px;
          }
          .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: ${isArabic ? 'right' : 'left'};
          }
          th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          tr:hover {
            background-color: #f0f7ff;
          }
          .total-row {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        ${companyLogo ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${companyLogo}" alt="Company Logo" style="max-width: 100px; max-height: 100px;" /></div>` : ''}
        <h1>${isArabic ? 'تقرير المبيعات' : locale === 'fr' ? 'Rapport des ventes' : locale === 'es' ? 'Reporte de ventas' : locale === 'en' ? 'Sales Report' : 'تقرير المبيعات'}</h1>
        <p class="subtitle">${storeName || 'Smart Al-Idara Pro'} - ${new Date().toLocaleDateString(isArabic ? "ar-EG" : locale === 'fr' ? "fr-FR" : locale === 'es' ? "es-ES" : "en-US", { numberingSystem: 'latn' })}</p>
        ${storePhone ? `<p style="text-align: center; font-size: 12px; margin: 5px 0;">${isArabic ? 'الهاتف' : locale === 'fr' ? 'Téléphone' : locale === 'es' ? 'Teléfono' : locale === 'en' ? 'Phone' : 'الهاتف'}: ${storePhone}</p>` : ''}
        <table>
          <thead>
            <tr>
              <th>${isArabic ? 'التاريخ' : locale === 'fr' ? 'Date' : locale === 'es' ? 'Fecha' : locale === 'en' ? 'Date' : 'التاريخ'}</th>
              <th>${isArabic ? 'الوقت' : locale === 'fr' ? 'Heure' : locale === 'es' ? 'Hora' : locale === 'en' ? 'Time' : 'الوقت'}</th>
              <th>${isArabic ? 'العميل' : locale === 'fr' ? 'Client' : locale === 'es' ? 'Cliente' : locale === 'en' ? 'Customer' : 'العميل'}</th>
              <th>${isArabic ? 'طريقة الدفع' : locale === 'fr' ? 'Paiement' : locale === 'es' ? 'Pago' : locale === 'en' ? 'Payment' : 'طريقة الدفع'}</th>
              ${sales.some(s => s.payment_method === 'check') ? `<th>${isArabic ? 'رقم الشيك' : locale === 'fr' ? 'N° Chèque' : locale === 'es' ? 'N° Cheque' : locale === 'en' ? 'Check No' : 'رقم الشيك'}</th><th>${isArabic ? 'صاحب الشيك' : locale === 'fr' ? 'Titulaire' : locale === 'es' ? 'Titular' : locale === 'en' ? 'Holder' : 'صاحب الشيك'}</th>` : ''}
              <th>${isArabic ? 'الإجمالي' : locale === 'fr' ? 'Total' : locale === 'es' ? 'Total' : locale === 'en' ? 'Total' : 'الإجمالي'}</th>
              <th>${isArabic ? 'المدفوع' : locale === 'fr' ? 'Payé' : locale === 'es' ? 'Pagado' : locale === 'en' ? 'Paid' : 'المدفوع'}</th>
              <th>${isArabic ? 'الديون' : locale === 'fr' ? 'Crédit' : locale === 'es' ? 'Crédito' : locale === 'en' ? 'Credit' : 'الديون'}</th>
              <th>${isArabic ? 'الأصناف' : locale === 'fr' ? 'Articles' : locale === 'es' ? 'Artículos' : locale === 'en' ? 'Items' : 'الأصناف'}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="${sales.some(s => s.payment_method === 'check') ? 9 : 7}">${isArabic ? 'المجموع' : 'Total'}</td>
              <td>${sales.reduce((sum, s) => sum + s.total_amount, 0).toFixed(2)} ${getText("currency")}</td>
            </tr>
          </tfoot>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
    toast.success(getText("exportSuccess"));
  };

  const exportSalesToCSV = () => {
    if (!sales || sales.length === 0) {
      toast.error(getText("noSalesToExport"));
      return;
    }

    const isArabic = locale.startsWith("ar");
    const hasCheckSales = sales.some(s => s.payment_method === 'check');
    const headers = [
      getText("date"),
      getText("time"),
      getText("customer"),
      "طريقة الدفع",
      ...(hasCheckSales ? ["رقم الشيك", "صاحب الشيك", "رقم البطاقة الوطنية"] : []),
      getText("total"),
      getText("paid"),
      getText("credit"),
      getText("items"),
      getText("products")
    ];
    const rows = sales.map(sale => {
      const saleDate = new Date(sale.sale_date);
      return [
        saleDate.toLocaleDateString(isArabic ? "ar-EG" : "en-US", { numberingSystem: 'latn' }),
        saleDate.toLocaleTimeString(isArabic ? "ar-EG" : "en-US", { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' }),
        sale.customer_name,
        sale.payment_method === 'check' ? 'شيك' : 'نقدي',
        ...(hasCheckSales ? [sale.check_number || '', sale.check_holder_name || '', sale.check_holder_cin || ''] : []),
        sale.total_amount.toFixed(2),
        sale.paid_amount.toFixed(2),
        sale.credit_amount.toFixed(2),
        sale.lines.length.toString(),
        sale.lines?.map(l => l.product_name).join("; ") || ""
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `sales_${currentEmployee?.employee_id}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(getText("exportSuccess"));
  };

  const toggleSaleSelection = (saleId: string) => {
    setSelectedSales(prev => {
      const newSet = new Set(prev);
      if (newSet.has(saleId)) {
        newSet.delete(saleId);
      } else {
        newSet.add(saleId);
      }
      return newSet;
    });
  };

  const deleteSale = async (saleId: string) => {
    try {
      const response = await api<{ success: boolean; message: string }>(`/pos-agent/standalone-sales/${saleId}`, {
        method: "DELETE",
        body: JSON.stringify({ sessionToken, employee_id: currentEmployee?.employee_id }),
      });

      if (response.success) {
        setSales(prev => prev.filter(s => s.id !== saleId));
        toast.success(getText("deleteSaleSuccess"));
      }
    } catch (error) {
      console.error("[PosAgentApp] Error deleting sale:", error);
      toast.error("فشل حذف البيع");
    }
  };

  const deleteSelectedSales = async () => {
    if (selectedSales.size === 0) {
      toast.error("يرجى اختيار عمليات بيع للحذف");
      return;
    }

    try {
      const response = await api<{ success: boolean; message: string }>("/pos-agent/standalone-sales/bulk-delete", {
        method: "POST",
        body: JSON.stringify({
          sessionToken,
          employee_id: currentEmployee?.employee_id,
          sale_ids: Array.from(selectedSales)
        }),
      });

      if (response.success) {
        setSales(prev => prev.filter(s => !selectedSales.has(s.id)));
        setSelectedSales(new Set());
        toast.success(getText("deleteSelectedSuccess"));
      }
    } catch (error) {
      console.error("[PosAgentApp] Error bulk deleting sales:", error);
      toast.error("فشل حذف العمليات المحددة");
    }
  };

  const getText = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      "app.title": {
        "ar": "تطبيق البيع السريع",
        "en": "Quick Sales App",
        "fr": "Application de Vente Rapide",
        "es": "Aplicación de Ventas Rápidas"
      },
      "language": {
        "ar": "اللغة",
        "en": "Language",
        "fr": "Langue",
        "es": "Idioma"
      },
      "login.selectName": {
        "ar": "اختر اسمك للبدء",
        "en": "Select your name to start",
        "fr": "Sélectionnez votre nom pour commencer",
        "es": "Selecciona tu nombre para comenzar"
      },
      "login.agentName": {
        "ar": "اسم المندوب",
        "en": "Agent Name",
        "fr": "Nom de l'Agent",
        "es": "Nombre del Agente"
      },
      "login.selectYourName": {
        "ar": "اختر اسمك",
        "en": "Select your name",
        "fr": "Sélectionnez votre nom",
        "es": "Selecciona tu nombre"
      },
      "login.enter": {
        "ar": "دخول",
        "en": "Enter",
        "fr": "Entrer",
        "es": "Entrar"
      },
      "login.loading": {
        "ar": "جاري التحميل...",
        "en": "Loading...",
        "fr": "Chargement...",
        "es": "Cargando..."
      },
      "validating": {
        "ar": "جاري التحقق من الرابط...",
        "en": "Verifying link...",
        "fr": "Vérification du lien...",
        "es": "Verificando enlace..."
      },
      "products": {
        "ar": "المنتجات",
        "en": "Products",
        "fr": "Produits",
        "es": "Productos"
      },
      "filter": {
        "ar": "تصفية",
        "en": "Filter",
        "fr": "Filtrer",
        "es": "Filtrar"
      },
      "search": {
        "ar": "بحث عن منتج...",
        "en": "Search products...",
        "fr": "Rechercher des produits...",
        "es": "Buscar productos..."
      },
      "cart": {
        "ar": "السلة",
        "en": "Cart",
        "fr": "Panier",
        "es": "Carrito"
      },
      "cartEmpty": {
        "ar": "السلة فارغة",
        "en": "Cart is empty",
        "fr": "Le panier est vide",
        "es": "El carrito está vacío"
      },
      "total": {
        "ar": "الإجمالي",
        "en": "Total",
        "fr": "Total",
        "es": "Total"
      },
      "customerName": {
        "ar": "اسم العميل (اختياري)",
        "en": "Customer name (optional)",
        "fr": "Nom du client (optionnel)",
        "es": "Nombre del cliente (opcional)"
      },
      "paidAmount": {
        "ar": "المبلغ المدفوع",
        "en": "Amount paid",
        "fr": "Montant payé",
        "es": "Cantidad pagada"
      },
      "checkout": {
        "ar": "إتمام البيع",
        "en": "Complete Sale",
        "fr": "Terminer la vente",
        "es": "Completar venta"
      },
      "processing": {
        "ar": "جاري المعالجة...",
        "en": "Processing...",
        "fr": "Traitement en cours...",
        "es": "Procesando..."
      },
      "clockIn": {
        "ar": "تسجيل بداية الدوام",
        "en": "Clock In",
        "fr": "Pointer l'entrée",
        "es": "Registrar entrada"
      },
      "clockOut": {
        "ar": "تسجيل نهاية الدوام",
        "en": "Clock Out",
        "fr": "Pointer la sortie",
        "es": "Registrar salida"
      },
      "dashboard": {
        "ar": "لوحة التحكم",
        "en": "Dashboard",
        "fr": "Tableau de bord",
        "es": "Panel de control"
      },
      "sales": {
        "ar": "المبيعات",
        "en": "Sales",
        "fr": "Ventes",
        "es": "Ventas"
      },
      "revenue": {
        "ar": "إجمالي المبيعات",
        "en": "Total Revenue",
        "fr": "Chiffre d'affaires",
        "es": "Ingresos totales"
      },
      "productsSold": {
        "ar": "المنتجات المباعة",
        "en": "Products Sold",
        "fr": "Produits vendus",
        "es": "Productos vendidos"
      },
      "exportExcel": {
        "ar": "تصدير Excel",
        "en": "Export Excel",
        "fr": "Exporter Excel",
        "es": "Exportar Excel"
      },
      "exportPDF": {
        "ar": "تصدير PDF",
        "en": "Export PDF",
        "fr": "Exporter PDF",
        "es": "Exportar PDF"
      },
      "delete": {
        "ar": "حذف",
        "en": "Delete",
        "fr": "Supprimer",
        "es": "Eliminar"
      },
      "deleteSelected": {
        "ar": "حذف المحدد",
        "en": "Delete Selected",
        "fr": "Supprimer la sélection",
        "es": "Eliminar seleccionados"
      },
      "logout": {
        "ar": "تسجيل الخروج",
        "en": "Logout",
        "fr": "Déconnexion",
        "es": "Cerrar sesión"
      },
      "addedToCart": {
        "ar": "تم إضافة",
        "en": "Added",
        "fr": "Ajouté",
        "es": "Agregado"
      },
      "productNotFound": {
        "ar": "المنتج غير موجود",
        "en": "Product not found",
        "fr": "Produit non trouvé",
        "es": "Producto no encontrado"
      },
      "addedToReturn": {
        "ar": "تم إضافة للاسترجاع",
        "en": "Added to return",
        "fr": "Ajouté au retour",
        "es": "Agregado para devolución"
      },
      "loginSuccess": {
        "ar": "تم تسجيل الدخول بنجاح",
        "en": "Login successful",
        "fr": "Connexion réussie",
        "es": "Inicio de sesión exitoso"
      },
      "loginFailed": {
        "ar": "فشل تسجيل الدخول",
        "en": "Login failed",
        "fr": "Échec de la connexion",
        "es": "Error de inicio de sesión"
      },
      "loadProductsFailed": {
        "ar": "فشل تحميل المنتجات",
        "en": "Failed to load products",
        "fr": "Échec du chargement des produits",
        "es": "Error al cargar productos"
      },
      "returnSuccess": {
        "ar": "تم الاسترجاع بنجاح",
        "en": "Return successful",
        "fr": "Retour réussi",
        "es": "Devolución exitosa"
      },
      "returnFailed": {
        "ar": "فشل الاسترجاع",
        "en": "Return failed",
        "fr": "Échec du retour",
        "es": "Error en la devolución"
      },
      "checkoutSuccess": {
        "ar": "تم إتمام البيع بنجاح",
        "en": "Sale completed successfully",
        "fr": "Vente terminée avec succès",
        "es": "Venta completada con éxito"
      },
      "printReceiptPrompt": {
        "ar": "تم البيع بنجاح، هل تريد طباعة الفاتورة؟",
        "en": "Sale completed successfully. Do you want to print the receipt?",
        "fr": "Vente terminée avec succès. Voulez-vous imprimer le reçu?",
        "es": "Venta completada con éxito. ¿Desea imprimir el recibo?"
      },
      "printReceiptYes": {
        "ar": "نعم - طباعة",
        "en": "Yes - Print",
        "fr": "Oui - Imprimer",
        "es": "Sí - Imprimir"
      },
      "printReceiptNo": {
        "ar": "لا - تخطي",
        "en": "No - Skip",
        "fr": "Non - Passer",
        "es": "No - Omitir"
      },
      "reprintLastReceipt": {
        "ar": "طباعة تيكي آخر بيع 🖨️",
        "en": "Print Last Receipt 🖨️",
        "fr": "Imprimer le dernier reçu 🖨️",
        "es": "Imprimir último recibo 🖨️"
      },
      "noLastSale": {
        "ar": "لا يوجد بيع سابق للطباعة",
        "en": "No previous sale to print",
        "fr": "Aucune vente précédente à imprimer",
        "es": "No hay venta anterior para imprimir"
      },
      "checkoutFailed": {
        "ar": "فشل إتمام البيع",
        "en": "Failed to complete sale",
        "fr": "Échec de la vente",
        "es": "Error al completar la venta"
      },
      "clockInSuccess": {
        "ar": "تم تسجيل بداية الدوام",
        "en": "Clock in successful",
        "fr": "Entrée enregistrée",
        "es": "Entrada registrada"
      },
      "clockOutSuccess": {
        "ar": "تم تسجيل نهاية الدوام",
        "en": "Clock out successful",
        "fr": "Sortie enregistrée",
        "es": "Salida registrada"
      },
      "noSalesToExport": {
        "ar": "لا توجد مبيعات للتصدير",
        "en": "No sales to export",
        "fr": "Aucune vente à exporter",
        "es": "No hay ventas para exportar"
      },
      "exportSuccess": {
        "ar": "تم تصدير المبيعات بنجاح",
        "en": "Sales exported successfully",
        "fr": "Ventes exportées avec succès",
        "es": "Ventas exportadas con éxito"
      },
      "printWindowOpened": {
        "ar": "تم فتح نافذة الطباعة - اختر حفظ كـ PDF",
        "en": "Print window opened - choose Save as PDF",
        "fr": "Fenêtre d'impression ouverte - choisir Enregistrer en PDF",
        "es": "Ventana de impresión abierta - elegir Guardar como PDF"
      },
      "deleteSaleSuccess": {
        "ar": "تم حذف البيع بنجاح",
        "en": "Sale deleted successfully",
        "fr": "Vente supprimée avec succès",
        "es": "Venta eliminada con éxito"
      },
      "deleteSelectedSuccess": {
        "ar": "تم حذف العمليات المحددة بنجاح",
        "en": "Selected operations deleted successfully",
        "fr": "Opérations sélectionnées supprimées avec succès",
        "es": "Operaciones seleccionadas eliminadas con éxito"
      },
      "returns": {
        "ar": "الاسترجاع",
        "en": "Returns",
        "fr": "Retours",
        "es": "Devoluciones"
      },
      "scanBarcode": {
        "ar": "مسح الباركود",
        "en": "Scan Barcode",
        "fr": "Scanner le code-barres",
        "es": "Escanear código de barras"
      },
      "searchReturn": {
        "ar": "بحث عن منتج للاسترجاع...",
        "en": "Search product for return...",
        "fr": "Rechercher un produit pour retour...",
        "es": "Buscar producto para devolución..."
      },
      "returnCart": {
        "ar": "سلة الاسترجاع",
        "en": "Return Cart",
        "fr": "Panier de retour",
        "es": "Carrito de devolución"
      },
      "returnCartEmpty": {
        "ar": "سلة الاسترجاع فارغة",
        "en": "Return cart is empty",
        "fr": "Le panier de retour est vide",
        "es": "El carrito de devolución está vacío"
      },
      "sku": {
        "ar": "SKU",
        "en": "SKU",
        "fr": "SKU",
        "es": "SKU"
      },
      "stock": {
        "ar": "Stock",
        "en": "Stock",
        "fr": "Stock",
        "es": "Stock"
      },
      "items": {
        "ar": "عناصر",
        "en": "items",
        "fr": "articles",
        "es": "artículos"
      },
      "noItems": {
        "ar": "لا توجد عناصر",
        "en": "No items",
        "fr": "Aucun article",
        "es": "Sin artículos"
      },
      "recentSales": {
        "ar": "المبيعات الأخيرة",
        "en": "Recent Sales",
        "fr": "Ventes récentes",
        "es": "Ventas recientes"
      },
      "selectSales": {
        "ar": "حدد المبيعات للحذف",
        "en": "Select sales to delete",
        "fr": "Sélectionnez les ventes à supprimer",
        "es": "Seleccione las ventas para eliminar"
      },
      "clockInFailed": {
        "ar": "فشل تسجيل بداية الدوام",
        "en": "Failed to clock in",
        "fr": "Échec de l'enregistrement d'entrée",
        "es": "Error al registrar entrada"
      },
      "clockOutFailed": {
        "ar": "فشل تسجيل نهاية الدوام",
        "en": "Failed to clock out",
        "fr": "Échec de l'enregistrement de sortie",
        "es": "Error al registrar salida"
      },
      "loginRequired": {
        "ar": "خطأ: بيانات الموظف غير متوفرة. يرجى تسجيل الدخول مرة أخرى.",
        "en": "Error: Employee data not available. Please login again.",
        "fr": "Erreur: Données employé non disponibles. Veuillez vous reconnecter.",
        "es": "Error: Datos del empleado no disponibles. Por favor inicie sesión nuevamente."
      },
      "alreadyClockedIn": {
        "ar": "أنت مسجل بالفعل في الدوام",
        "en": "You are already clocked in",
        "fr": "Vous êtes déjà enregistré",
        "es": "Ya estás registrado"
      },
      "printWindowFailed": {
        "ar": "فشل فتح نافذة الطباعة",
        "en": "Failed to open print window",
        "fr": "Échec de l'ouverture de la fenêtre d'impression",
        "es": "Error al abrir ventana de impresión"
      },
      "salesReport": {
        "ar": "تقرير المبيعات",
        "en": "Sales Report",
        "fr": "Rapport des ventes",
        "es": "Reporte de ventas"
      },
      "agent": {
        "ar": "المندوب",
        "en": "Agent",
        "fr": "Agent",
        "es": "Agente"
      },
      "date": {
        "ar": "التاريخ",
        "en": "Date",
        "fr": "Date",
        "es": "Fecha"
      },
      "time": {
        "ar": "الوقت",
        "en": "Time",
        "fr": "Heure",
        "es": "Hora"
      },
      "customer": {
        "ar": "العميل",
        "en": "Customer",
        "fr": "Client",
        "es": "Cliente"
      },
      "paid": {
        "ar": "المدفوع",
        "en": "Paid",
        "fr": "Payé",
        "es": "Pagado"
      },
      "credit": {
        "ar": "الديون",
        "en": "Credit",
        "fr": "Crédit",
        "es": "Crédito"
      },
      "deleteSaleFailed": {
        "ar": "فشل حذف البيع",
        "en": "Failed to delete sale",
        "fr": "Échec de la suppression de la vente",
        "es": "Error al eliminar venta"
      },
      "selectSalesToDelete": {
        "ar": "يرجى اختيار عمليات بيع للحذف",
        "en": "Please select sales to delete",
        "fr": "Veuillez sélectionner les ventes à supprimer",
        "es": "Por favor seleccione ventas para eliminar"
      },
      "employeeDataNotAvailable": {
        "ar": "خطأ: بيانات الموظف غير متوفرة. يرجى تسجيل الدخول مرة أخرى.",
        "en": "Error: Employee data not available. Please login again.",
        "fr": "Erreur: Données employé non disponibles. Veuillez vous reconnecter.",
        "es": "Error: Datos del empleado no disponibles. Por favor inicie sesión nuevamente."
      },
      "closeCamera": {
        "ar": "إغلاق الكاميرا",
        "en": "Close Camera",
        "fr": "Fermer la caméra",
        "es": "Cerrar cámara"
      },
      "settings": {
        "ar": "الإعدادات",
        "en": "Settings",
        "fr": "Paramètres",
        "es": "Configuración"
      },
      "companyLogo": {
        "ar": "شعار الشركة للفاتورة",
        "en": "Company Logo for Receipt",
        "fr": "Logo de l'entreprise pour le reçu",
        "es": "Logo de la empresa para el recibo"
      },
      "companyLogoDesc": {
        "ar": "رفع شعار يظهر في فاتورة البيع",
        "en": "Upload a logo to display on sales receipt",
        "fr": "Télécharger un logo pour afficher sur le reçu de vente",
        "es": "Subir un logo para mostrar en el recibo de venta"
      },
      "uploadLogo": {
        "ar": "رفع شعار",
        "en": "Upload Logo",
        "fr": "Télécharger Logo",
        "es": "Subir Logo"
      },
      "changeLogo": {
        "ar": "تغيير الشعار",
        "en": "Change Logo",
        "fr": "Changer Logo",
        "es": "Cambiar Logo"
      },
      "storeInfo": {
        "ar": "معلومات المتجر للفاتورة",
        "en": "Store Information for Receipt",
        "fr": "Informations du magasin pour le reçu",
        "es": "Información de la tienda para el recibo"
      },
      "storeName": {
        "ar": "اسم المتجر",
        "en": "Store Name",
        "fr": "Nom du magasin",
        "es": "Nombre de la tienda"
      },
      "storePhone": {
        "ar": "رقم الهاتف",
        "en": "Phone Number",
        "fr": "Numéro de téléphone",
        "es": "Número de teléfono"
      },
      "storeAddress": {
        "ar": "العنوان",
        "en": "Address",
        "fr": "Adresse",
        "es": "Dirección"
      },
      "storeAddressPlaceholder": {
        "ar": "العنوان",
        "en": "Address",
        "fr": "Adresse",
        "es": "Dirección"
      },
      "qrCode": {
        "ar": "QR Code للمتجر",
        "en": "Store QR Code",
        "fr": "QR Code du magasin",
        "es": "Código QR de la tienda"
      },
      "qrCodeDesc": {
        "ar": "رفع QR Code يظهر في الفاتورة للطلب عبر التطبيق",
        "en": "Upload QR Code to display on receipt for app ordering",
        "fr": "Télécharger un QR Code pour afficher sur le reçu pour commander via l'app",
        "es": "Subir código QR para mostrar en el recibo para pedir por la app"
      },
      "uploadQr": {
        "ar": "رفع QR",
        "en": "Upload QR",
        "fr": "Télécharger QR",
        "es": "Subir QR"
      },
      "changeQr": {
        "ar": "تغيير QR",
        "en": "Change QR",
        "fr": "Changer QR",
        "es": "Cambiar QR"
      },
      "appDownloadLink": {
        "ar": "رابط تحميل التطبيق",
        "en": "App Download Link",
        "fr": "Lien de téléchargement de l'app",
        "es": "Enlace de descarga de la app"
      },
      "appDownloadLinkPlaceholder": {
        "ar": "https://play.google.com/store/apps/details?id=...",
        "en": "https://play.google.com/store/apps/details?id=...",
        "fr": "https://play.google.com/store/apps/details?id=...",
        "es": "https://play.google.com/store/apps/details?id=..."
      },
      "appDownloadLinkDesc": {
        "ar": "سيظهر هذا الرابط في الفاتورة مع رسالة 'حمل تطبيق الطلبات والتوصيل'",
        "en": "This link will appear on the receipt with 'Download delivery app' message",
        "fr": "Ce lien apparaîtra sur le reçu avec le message 'Télécharger l'app de livraison'",
        "es": "Este enlace aparecerá en el recibo con el mensaje 'Descargar la app de pedidos'"
      },
      "deleteLogo": {
        "ar": "تم حذف الشعار",
        "en": "Logo deleted",
        "fr": "Logo supprimé",
        "es": "Logo eliminado"
      },
      "deleteQr": {
        "ar": "تم حذف QR Code",
        "en": "QR Code deleted",
        "fr": "QR Code supprimé",
        "es": "Código QR eliminado"
      },
      "uploading": {
        "ar": "جاري الرفع...",
        "en": "Uploading...",
        "fr": "Téléchargement...",
        "es": "Subiendo..."
      },
      "currency": {
        "ar": "د.م.",
        "en": "MAD",
        "fr": "MAD",
        "es": "MAD"
      },
      "cashCustomer": {
        "ar": "عميل نقدي",
        "en": "Cash Customer",
        "fr": "Client au comptant",
        "es": "Cliente al contado"
      },
      "customizeProducts": {
        "ar": "تخصيص المنتجات",
        "en": "Customize Products",
        "fr": "Personnaliser les produits",
        "es": "Personalizar productos"
      },
      "customizeDesc": {
        "ar": "اختر المنتجات التي تريد عرضها",
        "en": "Select the products you want to display",
        "fr": "Sélectionnez les produits que vous souhaitez afficher",
        "es": "Seleccione los productos que desea mostrar"
      },
      "showAll": {
        "ar": "عرض الكل",
        "en": "Show All",
        "fr": "Tout afficher",
        "es": "Mostrar todo"
      },
      "save": {
        "ar": "حفظ",
        "en": "Save",
        "fr": "Enregistrer",
        "es": "Guardar"
      },
      "totalSales": {
        "ar": "إجمالي المبيعات",
        "en": "Total Sales",
        "fr": "Ventes totales",
        "es": "Ventas totales"
      },
      "transactions": {
        "ar": "المعاملات",
        "en": "Transactions",
        "fr": "Transactions",
        "es": "Transacciones"
      },
      "status": {
        "ar": "الحالة",
        "en": "Status",
        "fr": "Statut",
        "es": "Estado"
      },
      "present": {
        "ar": "حاضر",
        "en": "Present",
        "fr": "Présent",
        "es": "Presente"
      },
      "notPresent": {
        "ar": "غير حاضر",
        "en": "Not Present",
        "fr": "Absent",
        "es": "No presente"
      },
      "insufficientStock": {
        "ar": "مخزون غير كافي",
        "en": "Insufficient stock",
        "fr": "Stock insuffisant",
        "es": "Stock insuficiente"
      },
      "piece": {
        "ar": "حبة",
        "en": "piece",
        "fr": "pièce",
        "es": "pieza"
      }
    };

    return translations[key]?.[agentLocale] || translations[key]?.["ar"] || key;
  };

  if (validatingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">{getText("validating")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentView === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">{getText("app.title")}</CardTitle>
            <CardDescription className="text-white/70">
              {getText("login.selectName")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white">{getText("login.agentName")}</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder={getText("login.selectYourName")} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.employee_id}>
                      {emp.name} ({emp.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleLogin} 
              disabled={!selectedEmployeeId || loading}
              className="w-full bg-white text-purple-900 hover:bg-white/90"
            >
              {loading ? getText("login.loading") : getText("login.enter")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold">{currentEmployee?.name}</p>
              <p className="text-white/70 text-sm">{currentEmployee?.employee_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={agentLocale} onValueChange={(value: any) => setAgentLocale(value)}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("pos")}
              className={`text-white ${currentView === "pos" ? "bg-white/20" : ""}`}
              title={getText("products")}
            >
              <Home className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("returns")}
              className={`text-white ${currentView === "returns" ? "bg-white/20" : ""}`}
              title={getText("returns")}
            >
              <Scan className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("dashboard")}
              className={`text-white ${currentView === "dashboard" ? "bg-white/20" : ""}`}
              title={getText("dashboard")}
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("settings")}
              className={`text-white ${currentView === "settings" ? "bg-white/20" : ""}`}
              title={getText("settings")}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:text-red-300"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {currentView === "pos" && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Products Section */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-white">{getText("products")}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openProductDialog()}
                        className="bg-green-600 border-green-500 text-white hover:bg-green-700"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        إضافة منتج
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBarcodeScanner(!showBarcodeScanner)}
                        className={`${showBarcodeScanner ? "bg-cyan-600 border-cyan-500" : "bg-white/10 border-white/20"} text-white hover:bg-white/20`}
                      >
                        {showBarcodeScanner ? <CameraOff className="w-4 h-4 mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                        {showBarcodeScanner ? getText("closeCamera") : getText("scanBarcode")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilterDialog(true)}
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        <Filter className="w-4 h-4 mr-2" />
                        {getText("filter")}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {showBarcodeScanner && (
                    <div className="mb-4">
                      <BarcodeScannerHub
                        compact
                        products={products.map((product) => ({ id: product.id, name: product.name, sku: product.sku }))}
                        autoAddToCart={true}
                        onMatchedProduct={(productId) => {
                          const product = products.find(p => p.id === productId);
                          if (product) {
                            addToCart(product);
                            toast.success(`${getText("addedToCart")}: ${product.name}`);
                            // Don't close scanner - allow continuous scanning
                          }
                        }}
                        onUnknownBarcode={(code) => {
                          // Show dialog to add new product
                          setNewProductBarcode(code);
                          setShowAddProductDialog(true);
                        }}
                      />
                    </div>
                  )}
                  <div className="relative mb-4">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 ${isRtl ? "right-3" : "left-3"}`} />
                    <Input
                      placeholder={getText("search")}
                      value={searchQuery}
                      onChange={(e) => {
                        handleSearch(e.target.value);
                        setShowSearchSuggestions(e.target.value.length > 0);
                      }}
                      onFocus={() => setShowSearchSuggestions(searchQuery.length > 0)}
                      onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                      className={`bg-white/10 border-white/20 text-white placeholder:text-white/50 ${isRtl ? "pr-10" : "pl-10"}`}
                    />
                    {showSearchSuggestions && filteredProducts.length > 0 && (
                      <div className={`absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto ${isRtl ? "rtl" : "ltr"}`}>
                        {filteredProducts.slice(0, 10).map((product, index) => (
                          <div
                            key={product.id}
                            className={`px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors flex items-center justify-between ${
                              index === selectedSuggestionIndex ? 'bg-cyan-600/20 border-l-4 border-cyan-500' : ''
                            }`}
                            onClick={() => {
                              addToCart(product);
                              setSearchQuery("");
                              setShowSearchSuggestions(false);
                              toast.success(`${getText("addedToCart")}: ${product.name}`);
                            }}
                            onMouseEnter={() => setSelectedSuggestionIndex(index)}
                          >
                            <div className="flex-1">
                              <div className="text-white font-medium">{product.name}</div>
                              <div className="text-gray-400 text-sm">{product.sku}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-cyan-400 font-bold">{product.unit_price.toFixed(2)}</div>
                              <div className="text-gray-400 text-sm">{product.stock_pieces} {getText("pieces")}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                    {filteredProducts.map((product, index) => (
                      <Card
                        key={product.id}
                        className={`bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer transition-colors active:scale-95 ${index === selectedProductIndex ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}`}
                        onClick={() => {
                          setSelectedProductIndex(index);
                          addToCart(product);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex gap-3">
                            {product.image_url ? (
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center">
                                <Package className="w-8 h-8 text-white/30" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex justify-between items-start mb-1">
                                  <h3 className="font-semibold text-white text-sm line-clamp-2">{product.name}</h3>
                                  <span className="text-green-400 font-bold whitespace-nowrap text-sm">{product.unit_price} {getText("currency")}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-white/70 mb-2">
                                  <span>{getText("sku")}: {product.sku}</span>
                                  <span className={product.stock_pieces < 10 ? "text-red-400" : ""}>
                                    {getText("stock")}: {product.stock_pieces}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  onClick={(e) => addToCartWithDebounce(product, e)}
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1"
                                >
                                  <ShoppingCart className="w-3 h-3 mr-1" />
                                  إضافة
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openProductDialog(product);
                                  }}
                                  className="bg-blue-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30 px-2"
                                >
                                  <Settings className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProduct(product.id);
                                  }}
                                  className="bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30 px-2"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cart Section */}
            <div className="space-y-4">
              <Card className="bg-white/10 backdrop-blur-md border-white/20 sticky top-24">
                <CardHeader>
                  <CardTitle className="text-white">{getText("cart")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-white/50">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{getText("cartEmpty")}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {cart.map((line) => (
                          <div
                            key={line.product_id}
                            className="flex items-center justify-between bg-white/5 rounded-lg p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{line.product_name}</p>
                              <p className="text-white/70 text-xs">{line.unit_price} {getText("currency")} × {line.quantity}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateCartQuantity(line.product_id, line.quantity - 1)}
                                className="bg-white/10 border-white/20 text-white h-8 w-8 p-0"
                              >
                                -
                              </Button>
                              <span className="text-white w-8 text-center">{line.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateCartQuantity(line.product_id, line.quantity + 1)}
                                className="bg-white/10 border-white/20 text-white h-8 w-8 p-0"
                              >
                                +
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeFromCart(line.product_id)}
                                className="bg-red-500/20 border-red-500/30 text-red-300 h-8 w-8 p-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-white/20 pt-4 space-y-2">
                        <div className="flex justify-between text-white">
                          <span>{getText("total")}</span>
                          <span className="font-bold text-green-400">{cartTotal.toFixed(2)} {getText("currency")}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <select
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value as "cash" | "check")}
                              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                            >
                              <option value="cash">نقدي</option>
                              <option value="check">شيك</option>
                            </select>
                          </div>
                          {paymentMethod === "check" && (
                            <div className="space-y-2">
                              <Input
                                placeholder="رقم الشيك"
                                value={checkNumber}
                                onChange={(e) => setCheckNumber(e.target.value)}
                                className="bg-white/10 border border-white/20 text-white placeholder-white/50"
                              />
                              <Input
                                placeholder="اسم صاحب الشيك"
                                value={checkHolderName}
                                onChange={(e) => setCheckHolderName(e.target.value)}
                                className="bg-white/10 border border-white/20 text-white placeholder-white/50"
                              />
                              <Input
                                placeholder="رقم البطاقة الوطنية"
                                value={checkHolderCin}
                                onChange={(e) => setCheckHolderCin(e.target.value)}
                                className="bg-white/10 border border-white/20 text-white placeholder-white/50"
                              />
                            </div>
                          )}
                          <Input
                            placeholder={getText("customerName")}
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                          />
                          <Input
                            type="number"
                            placeholder={getText("paidAmount")}
                            value={paidAmount}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                          />
                        </div>
                        <Button
                          onClick={handleCheckout}
                          disabled={loading}
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                          {loading ? getText("processing") : getText("checkout")}
                        </Button>
                        {lastSale && (
                          <Button
                            onClick={() => printReceipt(lastSale)}
                            variant="outline"
                            className="w-full bg-blue-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30"
                          >
                            {getText("reprintLastReceipt")}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Clock In/Out */}
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-4">
                  {attendance && !attendance.clock_out_time ? (
                    <Button
                      onClick={handleClockOut}
                      disabled={isClockingIn}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      {isClockingIn ? getText("processing") : getText("clockOut")}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleClockIn}
                      disabled={isClockingIn}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      {isClockingIn ? getText("processing") : getText("clockIn")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {currentView === "returns" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-white">{getText("returns")}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowReturnScanner(!showReturnScanner)}
                        className={`${showReturnScanner ? "bg-cyan-600 border-cyan-500" : "bg-white/10 border-white/20"} text-white hover:bg-white/20`}
                      >
                        {showReturnScanner ? <CameraOff className="w-4 h-4 mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                        {showReturnScanner ? getText("closeCamera") : getText("scanBarcode")}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {showReturnScanner && (
                    <div className="mb-4">
                      <BarcodeScannerHub
                        compact
                        products={products.map((product) => ({ id: product.id, name: product.name, sku: product.sku }))}
                        onMatchedProduct={(productId) => {
                          const product = products.find(p => p.id === productId);
                          if (product) {
                            addToReturnCart(product);
                            toast.success(`${getText("addedToReturn")}: ${product.name}`);
                          }
                        }}
                      />
                    </div>
                  )}
                  <div className="relative mb-4">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 ${isRtl ? "right-3" : "left-3"}`} />
                    <Input
                      placeholder={getText("searchReturn")}
                      value={searchQuery}
                      onChange={(e) => {
                        handleSearch(e.target.value);
                        setShowSearchSuggestions(e.target.value.length > 0);
                      }}
                      onFocus={() => setShowSearchSuggestions(searchQuery.length > 0)}
                      onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                      className={`bg-white/10 border-white/20 text-white placeholder:text-white/50 ${isRtl ? "pr-10" : "pl-10"}`}
                    />
                    {showSearchSuggestions && filteredProducts.length > 0 && (
                      <div className={`absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto ${isRtl ? "rtl" : "ltr"}`}>
                        {filteredProducts.slice(0, 10).map((product, index) => (
                          <div
                            key={product.id}
                            className={`px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors flex items-center justify-between ${
                              index === selectedSuggestionIndex ? 'bg-cyan-600/20 border-l-4 border-cyan-500' : ''
                            }`}
                            onClick={() => {
                              addToReturnCart(product);
                              setSearchQuery("");
                              setShowSearchSuggestions(false);
                              toast.success(`${getText("addedToReturn")}: ${product.name}`);
                            }}
                            onMouseEnter={() => setSelectedSuggestionIndex(index)}
                          >
                            <div className="flex-1">
                              <div className="text-white font-medium">{product.name}</div>
                              <div className="text-gray-400 text-sm">{product.sku}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-cyan-400 font-bold">{product.unit_price.toFixed(2)}</div>
                              <div className="text-gray-400 text-sm">{product.stock_pieces} {getText("pieces")}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                    {filteredProducts.map((product, index) => (
                      <Card
                        key={product.id}
                        className={`bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer transition-colors active:scale-95 ${index === selectedProductIndex ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}`}
                        onClick={() => addToReturnCart(product)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-white text-sm line-clamp-2">{product.name}</h3>
                            <span className="text-red-400 font-bold whitespace-nowrap">{product.unit_price} {getText("currency")}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-white/70">
                            <span>{getText("sku")}: {product.sku}</span>
                            <span className={product.stock_pieces < 10 ? "text-red-400" : ""}>
                              {getText("stock")}: {product.stock_pieces}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="bg-white/10 backdrop-blur-md border-white/20 sticky top-24">
                <CardHeader>
                  <CardTitle className="text-white">{getText("returnCart")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {returnCart.length === 0 ? (
                    <div className="text-center py-8 text-white/50">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{getText("returnCartEmpty")}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {returnCart.map((line) => (
                          <div
                            key={line.product_id}
                            className="flex items-center justify-between bg-white/5 rounded-lg p-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{line.product_name}</p>
                              <p className="text-white/70 text-xs">{line.unit_price} {getText("currency")} × {line.quantity}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateReturnCartQuantity(line.product_id, line.quantity - 1)}
                                className="bg-white/10 border-white/20 text-white h-8 w-8 p-0"
                              >
                                -
                              </Button>
                              <span className="text-white w-8 text-center">{line.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateReturnCartQuantity(line.product_id, line.quantity + 1)}
                                className="bg-white/10 border-white/20 text-white h-8 w-8 p-0"
                              >
                                +
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeFromReturnCart(line.product_id)}
                                className="bg-red-500/20 border-red-500/30 text-red-300 h-8 w-8 p-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-white/20 pt-4 space-y-2">
                        <div className="flex justify-between text-white">
                          <span>إجمالي الاسترجاع</span>
                          <span className="font-bold text-red-400">{returnCartTotal.toFixed(2)} {getText("currency")}</span>
                        </div>
                        <Button
                          onClick={handleReturn}
                          disabled={loading}
                          className="w-full bg-red-600 hover:bg-red-700 text-white"
                        >
                          {loading ? getText("processing") : "تأكيد الاسترجاع"}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {currentView === "dashboard" && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm">{getText("totalSales")}</p>
                      <p className="text-2xl font-bold text-white">{totalRevenue.toFixed(2)} {getText("currency")}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm">{getText("productsSold")}</p>
                      <p className="text-2xl font-bold text-white">{totalProductsSold}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm">{getText("transactions")}</p>
                      <p className="text-2xl font-bold text-white">{sales?.length || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm">{getText("status")}</p>
                      <p className="text-2xl font-bold text-white">
                        {attendance && !attendance.clock_out_time ? getText("present") : getText("notPresent")}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                      <Clock className="w-6 h-6 text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-white">{getText("recentSales")}</CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedSales.size > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deleteSelectedSales}
                        className="bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {getText("deleteSelected")} ({selectedSales.size})
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportSalesToExcel}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      title="Excel"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportSalesToPDF}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      title="PDF"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportSalesToCSV}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      title="CSV"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {!sales || sales.length === 0 ? (
                    <div className="text-center py-8 text-white/50">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No sales yet</p>
                    </div>
                  ) : (
                    sales.slice(0, 10).map((sale) => (
                      <div
                        key={sale.id}
                        className={`flex items-center justify-between bg-white/5 rounded-lg p-4 ${selectedSales.has(sale.id) ? "ring-2 ring-green-500" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedSales.has(sale.id)}
                            onChange={() => toggleSaleSelection(sale.id)}
                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-green-500 focus:ring-green-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-medium">{sale.customer_name}</p>
                              {sale.payment_method === 'check' && (
                                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30">
                                  شيك
                                </span>
                              )}
                            </div>
                            <p className="text-white/70 text-sm">
                              {new Date(sale.sale_date).toLocaleString(locale.startsWith("ar") ? "ar-EG" : "en-US", { numberingSystem: 'latn',
                                year: 'numeric',
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              })}
                            </p>
                            {sale.payment_method === 'check' && (
                              <p className="text-yellow-300/80 text-xs mt-1">
                                شيك #{sale.check_number} - {sale.check_holder_name}
                              </p>
                            )}
                            <p className="text-white/60 text-xs mt-1 truncate">
                              {sale.lines?.map(l => l.product_name).join(", ") || getText("noItems")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-green-400 font-bold">{sale.total_amount.toFixed(2)} {getText("currency")}</p>
                            <p className="text-white/70 text-sm">{sale.lines?.length || 0} {getText("items")}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSale(sale.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {currentView === "settings" && (
          <Card className="bg-white/10 backdrop-blur-md border-white/20 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-white">{getText("settings")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 rounded-lg gap-3">
                <div>
                  <p className="text-white font-medium">{getText("customizeProducts")}</p>
                  <p className="text-white/70 text-sm">{getText("customizeDesc")}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowFilterDialog(true)}
                  className="bg-white/10 border-white/20 text-white"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  {getText("filter")}
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 rounded-lg gap-3">
                <div>
                  <p className="text-white font-medium">اللغة / Language</p>
                  <p className="text-white/70 text-sm">اختر لغة الواجهة</p>
                </div>
                <select
                  value={locale}
                  onChange={(e) => {
                    setLocale(e.target.value);
                    localStorage.setItem('pos_locale', e.target.value);
                  }}
                  className="bg-white/10 border-white/20 text-white px-3 py-2 rounded"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                </select>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 rounded-lg gap-3">
                <div>
                  <p className="text-white font-medium">{getText("companyLogo")}</p>
                  <p className="text-white/70 text-sm">{getText("companyLogoDesc")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {companyLogo && (
                    <img src={companyLogo} alt="Logo" className="w-12 h-12 object-contain rounded" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploading(true);
                        try {
                          // Sanitize filename to remove Arabic characters
                          const sanitizedFileName = file.name
                            .replace(/[^a-zA-Z0-9._-]/g, '_')
                            .replace(/_{2,}/g, '_')
                            .replace(/^_+|_+$/g, '') || 'logo.jpg';
                          const fileName = `pos-logos/${Date.now()}-${sanitizedFileName}`;
                          const publicUrl = await uploadFileToServer(file, fileName);
                          setCompanyLogo(publicUrl);
                          localStorage.setItem('pos_company_logo', publicUrl);
                          toast.success("تم رفع الشعار بنجاح");
                        } catch (error) {
                          console.error("Error uploading logo:", error);
                          toast.error("فشل رفع الشعار");
                        } finally {
                          setUploading(false);
                        }
                      }
                    }}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    disabled={uploading}
                    className="bg-white/10 border-white/20 text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? getText("uploading") : companyLogo ? getText("changeLogo") : getText("uploadLogo")}
                  </Button>
                  {companyLogo && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCompanyLogo("");
                        localStorage.removeItem('pos_company_logo');
                        toast.success(getText("deleteLogo"));
                      }}
                      className="bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-3 p-4 bg-white/5 rounded-lg">
                <p className="text-white font-medium">{getText("storeInfo")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white text-sm">{getText("storeName")}</Label>
                    <Input
                      value={storeName}
                      onChange={(e) => {
                        setStoreName(e.target.value);
                        localStorage.setItem('pos_store_name', e.target.value);
                      }}
                      placeholder={getText("storeName")}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white text-sm">{getText("storePhone")}</Label>
                    <Input
                      value={storePhone}
                      onChange={(e) => {
                        setStorePhone(e.target.value);
                        localStorage.setItem('pos_store_phone', e.target.value);
                      }}
                      placeholder={getText("storePhone")}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-white text-sm">{getText("storeAddress")}</Label>
                    <Input
                      value={storeAddress}
                      onChange={(e) => {
                        setStoreAddress(e.target.value);
                        localStorage.setItem('pos_store_address', e.target.value);
                      }}
                      placeholder={getText("storeAddressPlaceholder")}
                      className="bg-white/10 border-white/20 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 rounded-lg gap-3">
                <div>
                  <p className="text-white font-medium">{getText("qrCode")}</p>
                  <p className="text-white/70 text-sm">{getText("qrCodeDesc")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {storeQrCode && (
                    <img src={storeQrCode} alt="QR Code" className="w-12 h-12 object-contain rounded" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploading(true);
                        try {
                          // Sanitize filename to remove Arabic characters
                          const sanitizedFileName = file.name
                            .replace(/[^a-zA-Z0-9._-]/g, '_')
                            .replace(/_{2,}/g, '_')
                            .replace(/^_+|_+$/g, '') || 'qr.jpg';
                          const fileName = `pos-qr/${Date.now()}-${sanitizedFileName}`;
                          const publicUrl = await uploadFileToServer(file, fileName);
                          setStoreQrCode(publicUrl);
                          localStorage.setItem('pos_store_qr_code', publicUrl);
                          toast.success("تم رفع QR Code بنجاح");
                        } catch (error) {
                          console.error("Error uploading QR code:", error);
                          toast.error("فشل رفع QR Code");
                        } finally {
                          setUploading(false);
                        }
                      }
                    }}
                    className="hidden"
                    id="qr-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('qr-upload')?.click()}
                    disabled={uploading}
                    className="bg-white/10 border-white/20 text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? getText("uploading") : storeQrCode ? getText("changeQr") : getText("uploadQr")}
                  </Button>
                  {storeQrCode && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStoreQrCode("");
                        localStorage.removeItem('pos_store_qr_code');
                        toast.success(getText("deleteQr"));
                      }}
                      className="bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-3 p-4 bg-white/5 rounded-lg">
                <p className="text-white font-medium">{getText("appDownloadLink")}</p>
                <Input
                  value={appDownloadLink}
                  onChange={(e) => {
                    setAppDownloadLink(e.target.value);
                    localStorage.setItem('pos_app_download_link', e.target.value);
                  }}
                  placeholder={getText("appDownloadLinkPlaceholder")}
                  className="bg-white/10 border-white/20 text-white"
                />
                <p className="text-white/60 text-xs">{getText("appDownloadLinkDesc")}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filter Dialog */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-2xl max-h-[600px]">
          <DialogHeader>
            <DialogTitle>{getText("customizeProducts")}</DialogTitle>
            <DialogDescription className="text-white/70">
              {getText("customizeDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer active:scale-98"
                onClick={() => toggleProductVisibility(product.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    visibleProductIds.has(product.id)
                      ? "bg-green-500 border-green-500"
                      : "border-white/30"
                  }`}>
                    {visibleProductIds.has(product.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-white/70">{product.sku}</p>
                  </div>
                </div>
                <span className="text-green-400">{product.unit_price} {getText("currency")}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setVisibleProductIds(new Set(products.map(p => p.id)))}
              className="bg-white/10 border-white/20 text-white"
            >
              {getText("showAll")}
            </Button>
            <Button
              onClick={() => setShowFilterDialog(false)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {getText("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Edit/Add Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-2xl max-h-[600px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
            <DialogDescription className="text-white/70">
              {editingProduct ? "قم بتعديل بيانات المنتج" : "أدخل بيانات المنتج الجديد"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-white">صورة المنتج</Label>
              <div className="flex items-center gap-4">
                {productFormData.image_url && (
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-white/10">
                    <img
                      src={productFormData.image_url}
                      alt="Product preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImageUpload(file);
                      }
                    }}
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>
              </div>
              {productFormData.image_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProductFormData(prev => ({ ...prev, image_url: "" }))}
                  className="bg-red-500/20 border-red-500/30 text-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  حذف الصورة
                </Button>
              )}
            </div>

            {/* Product Name */}
           <div className="space-y-2">
              <Label className="text-white">اسم المنتج *</Label>
              <Input
                value={productFormData.name}
                onChange={(e) => setProductFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-white/10 border-white/20 text-white"
                placeholder="أدخل اسم المنتج"
              />
            </div>

            {/* SKU */}
            <div className="space-y-2">
              <Label className="text-white">SKU *</Label>
              <Input
                value={productFormData.sku}
                onChange={(e) => setProductFormData(prev => ({ ...prev, sku: e.target.value }))}
                className="bg-white/10 border-white/20 text-white"
                placeholder="أدخل الكود"
              />
            </div>

            {/* Unit Price */}
            <div className="space-y-2">
              <Label className="text-white">السعر *</Label>
              <Input
                type="number"
                value={productFormData.unit_price}
                onChange={(e) => setProductFormData(prev => ({ ...prev, unit_price: e.target.value }))}
                className="bg-white/10 border-white/20 text-white"
                placeholder="أدخل السعر"
              />
            </div>

            {/* Stock */}
            <div className="space-y-2">
              <Label className="text-white">الكمية في المخزون</Label>
              <Input
                type="number"
                value={productFormData.stock_pieces}
                onChange={(e) => setProductFormData(prev => ({ ...prev, stock_pieces: e.target.value }))}
                className="bg-white/10 border-white/20 text-white"
                placeholder="أدخل الكمية"
              />
            </div>

            {/* Unit Kind */}
            <div className="space-y-2">
              <Label className="text-white">نوع الوحدة</Label>
              <Input
                value={productFormData.unit_kind}
                onChange={(e) => setProductFormData(prev => ({ ...prev, unit_kind: e.target.value }))}
                className="bg-white/10 border-white/20 text-white"
                placeholder="مثال: قطعة، كيلو، لتر"
              />
            </div>

            {/* Pieces per Carton */}
            <div className="space-y-2">
              <Label className="text-white">عدد القطع في الكرتونة</Label>
              <Input
                type="number"
                value={productFormData.pieces_per_carton}
                onChange={(e) => setProductFormData(prev => ({ ...prev, pieces_per_carton: e.target.value }))}
                className="bg-white/10 border-white/20 text-white"
                placeholder="أدخل عدد القطع"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowProductDialog(false);
                setEditingProduct(null);
                setProductFormData({
                  name: "",
                  sku: "",
                  unit_price: "",
                  stock_pieces: "",
                  unit_kind: "",
                  pieces_per_carton: "",
                  image_url: ""
                });
              }}
              className="bg-white/10 border-white/20 text-white"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSaveProduct}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? getText("processing") : "حفظ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Receipt Confirmation Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="bg-[#0a1628] border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{getText("printReceiptPrompt")}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => handlePrintDialogChoice(true)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {getText("printReceiptYes")}
            </Button>
            <Button
              onClick={() => handlePrintDialogChoice(false)}
              variant="outline"
              className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              {getText("printReceiptNo")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Product Dialog */}
      <Dialog open={showAddProductDialog} onOpenChange={setShowAddProductDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة منتج جديد</DialogTitle>
            <DialogDescription className="text-white/70">
              الباركود {newProductBarcode} غير موجود. أدخل بيانات المنتج.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white">الباركود</Label>
              <Input
                value={newProductBarcode}
                disabled
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-white">اسم المنتج</Label>
              <Input
                placeholder="أدخل اسم المنتج"
                value={productFormData.name}
                onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-white">السعر</Label>
              <Input
                type="number"
                placeholder="السعر"
                value={productFormData.unit_price}
                onChange={(e) => setProductFormData({ ...productFormData, unit_price: e.target.value })}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-white">الكمية</Label>
              <Input
                type="number"
                placeholder="الكمية"
                value={productFormData.stock_pieces}
                onChange={(e) => setProductFormData({ ...productFormData, stock_pieces: e.target.value })}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={async () => {
                  if (!productFormData.name || !productFormData.unit_price || !productFormData.stock_pieces) {
                    toast.error("يرجى ملء جميع الحقول");
                    return;
                  }
                  try {
                    // Use standalone endpoint with sessionToken query parameter for POS Agent
                    const response = await api<{ success: boolean; product?: any; error?: string }>(`/pos-agent/standalone-products?token=${sessionToken}`, {
                      method: "POST",
                      body: JSON.stringify({
                        name: productFormData.name,
                        sku: newProductBarcode,
                        unit_price: Number(productFormData.unit_price),
                        stock_pieces: Number(productFormData.stock_pieces),
                        unit_kind: "piece",
                        pieces_per_carton: 1
                      })
                    });
                    if (response && response.success) {
                      toast.success("تم إضافة المنتج بنجاح");
                      setShowAddProductDialog(false);
                      // Immediately reload products using the same endpoint
                      const freshProductsResponse = await api<{ success: boolean; products: Product[] }>(`/inventory/standalone-products?token=${sessionToken}`);
                      if (freshProductsResponse && freshProductsResponse.success) {
                        setProducts(freshProductsResponse.products);
                        setFilteredProducts(freshProductsResponse.products);
                        console.log("[PosAgentApp] Products reloaded after creation:", freshProductsResponse.products.length);
                      }
                      setProductFormData({
                        name: "",
                        sku: "",
                        unit_price: "",
                        stock_pieces: "",
                        unit_kind: "",
                        pieces_per_carton: "",
                        image_url: ""
                      });
                      setNewProductBarcode("");
                    } else {
                      const errorMsg = response?.error || "فشل إضافة المنتج";
                      if (errorMsg.includes("expired") || errorMsg.includes("session")) {
                        toast.error("الجلسة منتهية - يرجى تسجيل الدخول مجدداً");
                      } else {
                        toast.error(errorMsg);
                      }
                    }
                  } catch (error) {
                    console.error("[PosAgentApp] Error adding product:", error);
                    const errorMessage = error instanceof Error ? error.message : "فشل إضافة المنتج";
                    if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("expired")) {
                      toast.error("الجلسة منتهية - يرجى تسجيل الدخول مجدداً");
                    } else {
                      toast.error(errorMessage);
                    }
                  }
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="w-4 h-4 mr-2" />
                إضافة
              </Button>
              <Button
                onClick={() => {
                  setShowAddProductDialog(false);
                  setNewProductBarcode("");
                  setProductFormData({
                    name: "",
                    sku: "",
                    unit_price: "",
                    stock_pieces: "",
                    unit_kind: "",
                    pieces_per_carton: "",
                    image_url: ""
                  });
                }}
                variant="outline"
                className="flex-1 bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                <X className="w-4 h-4 mr-2" />
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
