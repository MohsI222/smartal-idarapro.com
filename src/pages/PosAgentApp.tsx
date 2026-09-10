import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { User, ShoppingCart, Clock, LogOut, Settings, BarChart3, Package, Search, Scan, Filter, X, Check, Home, Download, FileText, Camera, CameraOff, Trash2 } from "lucide-react";
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
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
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
  const { locale, isRtl } = useI18n();
  const token = searchParams.get("token");

  const [currentView, setCurrentView] = useState<AgentView>("login");
  const [loading, setLoading] = useState(true);
  const [validatingToken, setValidatingToken] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [visibleProductIds, setVisibleProductIds] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<SaleLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalProductsSold, setTotalProductsSold] = useState(0);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
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

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        console.error("[PosAgentApp] No token provided");
        setValidatingToken(false);
        setLoading(false);
        return;
      }

      // Try to restore session from localStorage
      const savedSession = localStorage.getItem(`pos_agent_${token}`);
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
            localStorage.removeItem(`pos_agent_${token}`);
          }
        } catch (error) {
          console.error("[PosAgentApp] Error restoring session:", error);
          localStorage.removeItem(`pos_agent_${token}`);
        }
      }

      try {
        const response = await api<{ success: boolean; valid: boolean; employee_id?: string; metadata?: Record<string, unknown> }>(`/pos-agent/validate/${token}`);
        if (response.success && response.valid) {
          // If token has a pre-assigned employee, skip login
          if (response.employee_id) {
            setSelectedEmployeeId(response.employee_id);
            await loadEmployeesAndProceed(response.employee_id);
          } else {
            await loadEmployees();
          }
        } else {
          console.error("[PosAgentApp] Invalid token response:", response);
          // Still load employees even if validation fails - user can still try to login
          await loadEmployees();
        }
      } catch (error) {
        console.error("[PosAgentApp] Error validating token:", error);
        // Still load employees even if validation fails - user can still try to login
        await loadEmployees();
      } finally {
        setValidatingToken(false);
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

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

      // Arrow keys for product navigation (works for both POS and Returns)
      if (filteredProducts.length > 0 && document.activeElement?.tagName !== "INPUT") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedProductIndex(prev => (prev + 1) % filteredProducts.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedProductIndex(prev => (prev - 1 + filteredProducts.length) % filteredProducts.length);
        } else if (e.key === "ArrowRight" || e.key === "Enter") {
          e.preventDefault();
          if (filteredProducts[selectedProductIndex]) {
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
  }, [currentView, filteredProducts, selectedProductIndex, cart, returnCart, searchQuery, showPrintDialog]);

  // Reload data when switching to dashboard
  useEffect(() => {
    if (currentView === "dashboard" && currentEmployee) {
      loadSales();
      loadAttendance();
    }
  }, [currentView]);

  // Realtime sync for inventory_products - sync changes from inventory module
  useSupabaseRealtime(
    {
      table: "inventory_products",
      events: ["INSERT", "UPDATE", "DELETE"],
      onInsert: (item) => {
        console.log("[PosAgentApp] Realtime INSERT - new product:", item);
        setProducts(prev => [...prev, item]);
        setFilteredProducts(prev => [...prev, item]);
      },
      onUpdate: (item) => {
        console.log("[PosAgentApp] Realtime UPDATE - product updated:", item);
        setProducts(prev => prev.map(p => p.id === item.id ? item : p));
        setFilteredProducts(prev => prev.map(p => p.id === item.id ? item : p));
      },
      onDelete: (item) => {
        console.log("[PosAgentApp] Realtime DELETE - product removed:", item);
        setProducts(prev => prev.filter(p => p.id !== item.id));
        setFilteredProducts(prev => prev.filter(p => p.id !== item.id));
      },
    },
    !!token // Enable when token is available
  );

  const loadEmployees = async () => {
    try {
      // Load employees from Transport & Logistics table
      const response = await api<{ success: boolean; employees: Employee[] }>(`/pos-agent/standalone-employees?token=${token}`);
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
      const response = await api<{ success: boolean; employees: Employee[] }>(`/pos-agent/standalone-employees?token=${token}`);
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

    console.log("[PosAgentApp] Attempting login with:", { token: token?.substring(0, 20), employee_id: selectedEmployeeId });
    setLoading(true);
    try {
      const response = await api<{ success: boolean; employee: Employee; message: string }>("/pos-agent/session", {
        method: "POST",
        body: JSON.stringify({ token, employee_id: selectedEmployeeId }),
      });

      console.log("[PosAgentApp] Login response:", response);

      if (response.success) {
        setCurrentEmployee(response.employee);
        // Save to localStorage
        localStorage.setItem(`pos_agent_${token}`, JSON.stringify({
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
      const response = await api<{ success: boolean; products: Product[] }>(`/inventory/standalone-products?token=${token}`);
      if (response.success) {
        console.log("[PosAgentApp] Loaded products:", response.products.map(p => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock_pieces })));
        console.log("[PosAgentApp] Total products loaded:", response.products.length);
        setProducts(response.products);
        setFilteredProducts(response.products);
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
        response = await api<{ success: boolean; product: Product; message: string }>(`/pos-agent/standalone-products/${editingProduct.id}?token=${token}`, {
          method: "PUT",
          body: JSON.stringify(productData),
        });
      } else {
        // Create new product using POS Agent endpoint
        response = await api<{ success: boolean; product: Product; message: string }>(`/pos-agent/standalone-products?token=${token}`, {
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
      const response = await api<{ success: boolean; message: string }>(`/pos-agent/standalone-products/${productId}?token=${token}`, {
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
    const MAX_IMAGE_MB = 4;
    const TARGET_IMAGE_SIZE_KB = 500;
    const MAX_IMAGE_WIDTH = 1200;

    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`الملف كبير جداً — الحد الأقصى ${MAX_IMAGE_MB} ميجابايت`);
      return;
    }

    try {
      // Compress image
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Resize if too large
            if (width > MAX_IMAGE_WIDTH) {
              height = (height * MAX_IMAGE_WIDTH) / width;
              width = MAX_IMAGE_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Try different quality levels to achieve target size
            let quality = 0.9;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);

            // Reduce quality if still too large
            while (dataUrl.length > TARGET_IMAGE_SIZE_KB * 1024 && quality > 0.1) {
              quality -= 0.1;
              dataUrl = canvas.toDataURL('image/jpeg', quality);
            }

            resolve(dataUrl);
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      setProductFormData(prev => ({ ...prev, image_url: dataUrl }));
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
      console.log("[PosAgentApp] Loading sales with:", { token: token?.substring(0, 20), employee_id: currentEmployee?.employee_id });
      const response = await api<{ success: boolean; sales: Sale[] }>(`/pos-agent/standalone-sales?token=${token}&employee_id=${currentEmployee.employee_id}`);
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
      const response = await api<{ success: boolean; attendance: Attendance | null }>(`/pos-agent/standalone-attendance?token=${token}&employee_id=${currentEmployee?.employee_id}`);
      if (response.success) {
        setAttendance(response.attendance);
      }
    } catch (error) {
      console.error("[PosAgentApp] Error loading attendance:", error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log("[PosAgentApp] Search query:", query);
    console.log("[PosAgentApp] Total products:", products.length);
    
    if (!query.trim()) {
      setFilteredProducts(products);
      console.log("[PosAgentApp] Query empty, showing all products");
      return;
    }

    const filtered = products.filter(p =>
      (p.name && p.name.toLowerCase().includes(query.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(query.toLowerCase()))
    );
    console.log("[PosAgentApp] Filtered products:", filtered.length);
    setFilteredProducts(filtered);
  };

  const toggleProductVisibility = (productId: string) => {
    setVisibleProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      // Update filtered products
      setFilteredProducts(products.filter(p => newSet.has(p.id)));
      return newSet;
    });
  };

  const addToCart = (product: Product) => {
    // Check if product has sufficient stock
    const currentQuantityInCart = cart.find(line => line.product_id === product.id)?.quantity || 0;
    if (product.stock_pieces <= currentQuantityInCart) {
      toast.error(`${getText("insufficientStock")}: ${product.name} (${product.stock_pieces} ${getText("piece")})`);
      playWarningSound();
      return;
    }

    const existingLine = cart.find(line => line.product_id === product.id);
    if (existingLine) {
      setCart(cart.map(line => 
        line.product_id === product.id 
          ? { ...line, quantity: line.quantity + 1, line_total: (line.quantity + 1) * line.unit_price }
          : line
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.unit_price,
        line_total: product.unit_price
      }]);
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
          token,
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

    setLoading(true);
    try {
      const response = await api<{ success: boolean; sale: Sale; message: string }>("/pos-agent/standalone-sales", {
        method: "POST",
        body: JSON.stringify({
          token,
          employee_id: currentEmployee.employee_id,
          customer_name: customerName || getText("cashCustomer"),
          lines: cart,
          total_amount: cartTotal,
          paid_amount: paid,
          credit_amount: creditAmount,
          payment_method: "cash"
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
        body: JSON.stringify({ token, employee_id: currentEmployee?.employee_id }),
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
        body: JSON.stringify({ token, employee_id: currentEmployee?.employee_id }),
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
    localStorage.removeItem(`pos_agent_${token}`);
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

  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
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
          <h1>${isArabic ? 'فاتورة بيع' : 'SALES RECEIPT'}</h1>
          <p>Smart Al-Idara Pro</p>
        </div>
        
        <div class="info">
          <div class="info-row">
            <span>${isArabic ? 'التاريخ' : 'Date'}:</span>
            <span>${saleDate.toLocaleDateString(isArabic ? "ar-EG" : "en-US", { numberingSystem: 'latn' })}</span>
          </div>
          <div class="info-row">
            <span>${isArabic ? 'الوقت' : 'Time'}:</span>
            <span>${saleDate.toLocaleTimeString(isArabic ? "ar-EG" : "en-US", { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' })}</span>
          </div>
          <div class="info-row">
            <span>${isArabic ? 'العميل' : 'Customer'}:</span>
            <span>${sale.customer_name}</span>
          </div>
          <div class="info-row">
            <span>${isArabic ? 'المندوب' : 'Agent'}:</span>
            <span>${currentEmployee?.name || '-'}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${isArabic ? 'المنتج' : 'Item'}</th>
              <th style="text-align: center;">${isArabic ? 'الكمية' : 'Qty'}</th>
              <th style="text-align: right;">${isArabic ? 'السعر' : 'Price'}</th>
              <th style="text-align: right;">${isArabic ? 'المجموع' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>${isArabic ? 'الإجمالي' : 'Subtotal'}:</span>
            <span>${sale.total_amount.toFixed(2)} ${getText("currency")}</span>
          </div>
          <div class="total-row">
            <span>${isArabic ? 'المدفوع' : 'Paid'}:</span>
            <span>${sale.paid_amount.toFixed(2)} ${getText("currency")}</span>
          </div>
          <div class="total-row">
            <span>${isArabic ? 'الديون' : 'Credit'}:</span>
            <span>${sale.credit_amount.toFixed(2)} ${getText("currency")}</span>
          </div>
          <div class="total-row grand-total">
            <span>${isArabic ? 'المجموع النهائي' : 'GRAND TOTAL'}:</span>
            <span>${sale.total_amount.toFixed(2)} ${getText("currency")}</span>
          </div>
        </div>

        <div class="footer">
          <p>${isArabic ? 'شكراً لتسوقكم معنا' : 'Thank you for your purchase'}</p>
          <p>${isArabic ? 'فاتورة إرشادية - ليست وثيقة رسمية' : 'Indicative receipt - Not an official document'}</p>
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
        "الإجمالي": sale.total_amount,
        "المدفوع": sale.paid_amount,
        "الديون": sale.credit_amount,
        "عدد الأصناف": sale.lines.length,
        "المنتجات": sale.lines?.map(l => l.product_name).join("; ") || ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "المبيعات");
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
      <tr style="background-color: ${sale.total_amount < 0 ? '#fff5f5' : 'white'};">
        <td style="border: 1px solid #ddd; padding: 8px;">${saleDate.toLocaleDateString(isArabic ? "ar-EG" : "en-US", { numberingSystem: 'latn' })}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${saleDate.toLocaleTimeString(isArabic ? "ar-EG" : "en-US", { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' })}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${sale.customer_name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${sale.total_amount.toFixed(2)}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${sale.paid_amount.toFixed(2)}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${sale.credit_amount.toFixed(2)}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${sale.lines.length}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${sale.lines?.map(l => l.product_name).join(", ") || ""}</td>
      </tr>
    `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${isArabic ? getText("salesReport") : "Sales Report"}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            direction: ${isArabic ? 'rtl' : 'ltr'};
            padding: 20px;
            margin: 0;
          }
          h2 {
            text-align: center;
            margin-bottom: 10px;
            color: #333;
          }
          .subtitle {
            text-align: center;
            margin-bottom: 20px;
            font-size: 12px;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            border: 1px solid #ddd;
          }
          th {
            background-color: #428BCA;
            color: white;
            border: 1px solid #ddd;
            padding: 8px;
          }
          td {
            border: 1px solid #ddd;
            padding: 8px;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <h2>${isArabic ? getText("salesReport") : "Sales Report"}</h2>
        <p class="subtitle">
          ${isArabic
            ? `${getText("agent")}: ${currentEmployee?.name} | ${getText("date")}: ${new Date().toLocaleDateString("ar-EG", { numberingSystem: 'latn' })}`
            : `${getText("agent")}: ${currentEmployee?.name} | ${getText("date")}: ${new Date().toLocaleDateString("en-US")}`}
        </p>
        <table>
          <thead>
            <tr>
              <th>${isArabic ? getText("date") : "Date"}</th>
              <th>${isArabic ? getText("time") : "Time"}</th>
              <th>${isArabic ? getText("customer") : "Customer"}</th>
              <th>${isArabic ? getText("total") : "Total"}</th>
              <th>${isArabic ? getText("paid") : "Paid"}</th>
              <th>${isArabic ? getText("credit") : "Credit"}</th>
              <th>${isArabic ? getText("items") : "Items"}</th>
              <th>${isArabic ? getText("products") : "Products"}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
    toast.success(getText("printWindowOpened"));
  };

  const exportSalesToCSV = () => {
    if (!sales || sales.length === 0) {
      toast.error(getText("noSalesToExport"));
      return;
    }

    const isArabic = locale.startsWith("ar");
    const headers = [getText("date"), getText("time"), getText("customer"), getText("total"), getText("paid"), getText("credit"), getText("items"), getText("products")];
    const rows = sales.map(sale => {
      const saleDate = new Date(sale.sale_date);
      return [
        saleDate.toLocaleDateString(isArabic ? "ar-EG" : "en-US", { numberingSystem: 'latn' }),
        saleDate.toLocaleTimeString(isArabic ? "ar-EG" : "en-US", { hour: '2-digit', minute: '2-digit', hour12: false, numberingSystem: 'latn' }),
        sale.customer_name,
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
        body: JSON.stringify({ token, employee_id: currentEmployee?.employee_id }),
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
          token,
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
      "currency": {
        "ar": "عملة",
        "en": "currency",
        "fr": "devise",
        "es": "moneda"
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
                        onMatchedProduct={(productId) => {
                          const product = products.find(p => p.id === productId);
                          if (product) {
                            addToCart(product);
                            toast.success(`${getText("addedToCart")}: ${product.name}`);
                          }
                        }}
                      />
                    </div>
                  )}
                  <div className="relative mb-4">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 ${isRtl ? "right-3" : "left-3"}`} />
                    <Input
                      placeholder={getText("search")}
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className={`bg-white/10 border-white/20 text-white placeholder:text-white/50 ${isRtl ? "pr-10" : "pl-10"}`}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                    {filteredProducts.map((product, index) => (
                      <Card
                        key={product.id}
                        className={`bg-white/5 border-white/10 hover:bg-white/10 transition-colors active:scale-95 ${index === selectedProductIndex ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}`}
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
                                  onClick={() => addToCart(product)}
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
                      onChange={(e) => handleSearch(e.target.value)}
                      className={`bg-white/10 border-white/20 text-white placeholder:text-white/50 ${isRtl ? "pr-10" : "pl-10"}`}
                    />
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
                            <p className="text-white font-medium">{sale.customer_name}</p>
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
    </div>
  );
}
