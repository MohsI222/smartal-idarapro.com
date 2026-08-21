import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  LayoutDashboard, Car, Calculator, History, 
  Bell, Search, Plus, Edit, Trash2, Download, 
  Printer, CheckCircle, AlertTriangle, 
  FileCheck, X, Sparkles, Loader2, FileUp, ShieldCheck, 
  Image as ImageIcon, Map, Building, DollarSign, FileText, ExternalLink, Clock
} from "lucide-react";
import { GlobalAiAssistant } from "@/components/ai/GlobalAiAssistant";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import html2pdf from 'html2pdf.js';

type ItemType = "Car" | "Property" | "Land";
type ItemStatus = "Available" | "Rented" | "Sold" | "Maintenance";
type PropType = "Residential" | "Commercial";
type CommercialType = "Cafe" | "Shop" | "Office";

interface InventoryItem {
  id: string;
  type: ItemType;
  brandOrTitle: string;
  plateOrAddress: string;
  specs: string;
  price: number;
  status: ItemStatus;
  expiryDate?: string;
  createdAt: string;
  image?: string;
  
  // Car Specs
  color?: string;
  fuel?: string;
  mileage?: string;
  defects?: string;
  rentStart?: string;
  rentEnd?: string;

  // Property Specs
  propType?: PropType;
  floorNum?: number;
  totalFloors?: number;
  rooms?: number;
  bathrooms?: number;
  amenities?: string[];
  commercialType?: CommercialType;

  // Land Specs
  zoning?: string;
  sqm?: number;
}

interface ActionLog {
  id: string;
  action: string;
  timestamp: string;
  user: string;
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UploadedFile {
  name: string;
  size: number;
  url: string;
  type: string;
}

type Lang = "ar" | "fr" | "en";

// ----------------------------------------------------------------------
// i18n DICTIONARY
// ----------------------------------------------------------------------
const TRANSLATIONS = {
  ar: {
    dashboard: "لوحة التحكم", inventory: "المخزون", contracts: "العقود الذكية", accounting: "المحاسبة",
    totalProducts: "السيارات والعقارات المتاحة", capitalInvested: "قيمة الممتلكات المتواجدة", itemsSold: "المبيعات", activeRentals: "الكراء النشط",
    search: "بحث عن سيارة، عقار، أرض...", addProduct: "إضافة منتج", editProduct: "تعديل المنتج",
    brand: "العلامة / العنوان", plate: "اللوحة / المعرف", specs: "المواصفات", status: "الحالة", price: "السعر", actions: "إجراءات",
    available: "متاح", rented: "مكترى", sold: "مباع", maintenance: "صيانة",
    generateContract: "توليد العقد قانونياً", printStock: "طباعة المخزون (PDF)", export: "تصدير المخزون (CSV)",
    contractTitle: "عقد بيع / كراء", contractGenDesc: "مولد العقود الذكي: املأ البيانات لتوليد عقد مفصل وجاهز.",
    party1: "الطرف الأول", party2: "الطرف الثاني", inOut: "المدخول والمصروف",
    addSuccess: "تم حفظ المنتج بنجاح!", deleteSuccess: "تم حذف المنتج!",
    dropzoneText: "اسحب وأفلت الفواتير هنا", uploadSuccess: "تم رفع الملف بنجاح!",
    save: "حفظ", cancel: "إلغاء", generating: "جاري الصياغة القانونية...",
    aiHeader: "الصياغة القانونية للعقود", aiSub: "عقود صارمة مبنية على القوانين والمساطر",
    carRent: "عقد كراء سيارة", carSale: "عقد بيع سيارة", propRent: "عقد كراء عقار", propSale: "عقد بيع عقار",
    exportBilan: "تصدير القوائم المالية (Bilan)", revenue: "المدخول اليومي", expenses: "المصاريف اليومية", cashflow: "المالية الحالية (Cashflow)",
    all: "الكل"
  },
  fr: {
    dashboard: "Tableau", inventory: "Inventaire", contracts: "Contrats", accounting: "Comptabilité",
    totalProducts: "Stock Disponible", capitalInvested: "Valeur des Actifs", itemsSold: "Vendus", activeRentals: "Locations Actives",
    search: "Rechercher...", addProduct: "Ajouter Produit", editProduct: "Modifier Produit",
    brand: "Marque/Titre", plate: "Matricule/ID", specs: "Détails", status: "Statut", price: "Prix", actions: "Actions",
    available: "Disponible", rented: "Loué", sold: "Vendu", maintenance: "Maintenance",
    generateContract: "Générer Juridiquement", printStock: "Imprimer Stock (PDF)", export: "Exporter (CSV)",
    contractTitle: "Contrat de Vente / Location", contractGenDesc: "Générateur intelligent : remplissez les détails.",
    party1: "Première Partie", party2: "Deuxième Partie", inOut: "Entrées / Sorties",
    addSuccess: "Produit enregistré avec succès!", deleteSuccess: "Produit supprimé!",
    dropzoneText: "Glissez et déposez les factures", uploadSuccess: "Fichier téléchargé!",
    save: "Enregistrer", cancel: "Annuler", generating: "Rédaction en cours...",
    aiHeader: "Générateur Juridique", aiSub: "Rédaction juridique précise et rigoureuse",
    carRent: "Contrat Location Voiture", carSale: "Contrat Vente Voiture", propRent: "Contrat Location Immo", propSale: "Contrat Vente Immo",
    exportBilan: "Exporter Bilan Financier", revenue: "Revenus du Jour", expenses: "Dépenses du Jour", cashflow: "Flux de Trésorerie",
    all: "Tout"
  },
  en: {
    dashboard: "Dashboard", inventory: "Inventory", contracts: "Smart Contracts", accounting: "Accounting",
    totalProducts: "Available Stock", capitalInvested: "Physical Asset Value", itemsSold: "Sold", activeRentals: "Active Rentals",
    search: "Search...", addProduct: "Add Product", editProduct: "Edit Product",
    brand: "Brand/Title", plate: "Plate/ID", specs: "Specs", status: "Status", price: "Price", actions: "Actions",
    available: "Available", rented: "Rented", sold: "Sold", maintenance: "Maintenance",
    generateContract: "Draft Legal Contract", printStock: "Print Stock (PDF)", export: "Export (CSV)",
    contractTitle: "Sale / Lease Contract", contractGenDesc: "Smart Generator: fill details to generate.",
    party1: "First Party", party2: "Second Party", inOut: "Cash Flow",
    addSuccess: "Product saved successfully!", deleteSuccess: "Product deleted!",
    dropzoneText: "Drag and drop invoices here", uploadSuccess: "File uploaded!",
    save: "Save", cancel: "Cancel", generating: "Drafting document...",
    aiHeader: "Legal Contract Generator", aiSub: "Rigorous legally binding document drafting",
    carRent: "Car Rental Contract", carSale: "Car Sale Contract", propRent: "Property Rental Contract", propSale: "Property Sale Contract",
    exportBilan: "Export Financial Bilan", revenue: "Today's Income", expenses: "Today's Expenses", cashflow: "Current Cashflow",
    all: "All"
  }
};

// ----------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------
export default function AutoRealEstateModule() {
  const { user, supabaseSession, isAdmin } = useAuth();
  const [lang, setLang] = useState<Lang>("ar");
  const [activeTab, setActiveTab] = useState<"dashboard" | "inventory" | "contracts" | "accounting">("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<ItemStatus | "All">("All");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Inventory Data
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerItem, setDrawerItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({ type: "Car", status: "Available", price: 0 });

  // AI Contract Dynamic State (Updated to 4 languages)
  const [aiLang, setAiLang] = useState<"ar" | "fr" | "en" | "es">("ar");
  const [contractType, setContractType] = useState("car_rent");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [contractLogo, setContractLogo] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGeneratedContract, setShowGeneratedContract] = useState(false);
  
  // DYNAMIC CONTRACT FORM FIELDS
  const [cForm, setCForm] = useState({
    p1Name: "", p1Id: "", p2Name: "", p2Id: "", price: "", deposit: "", 
    // Rentals
    startDate: "", startTime: "", endDate: "", endTime: "", duration: "",
    // Cars
    brandModel: "", year: "", color: "", fuel: "كازوال (Diesel)", mileage: "",
    // Real Estate
    propType: "", floorNum: "", rooms: "", area: "", balconies: "", kitchen: "1", bathrooms: "", garage: ""
  });

  // Accounting State
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const t = TRANSLATIONS[lang];
  const isRTL = lang === "ar";

  // LOAD DATA FROM SUPABASE - Use useCallback to make it accessible by handleSaveProduct
  const fetchInventory = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // If super admin, use backend API endpoint instead of direct Supabase
      if (isAdmin) {
        console.warn('[AutoRealEstate] Super admin - using backend API endpoint');
        const token = localStorage.getItem('idara_token');
        const response = await fetch('/api/supabase/auto-real-estate', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          console.error('Error fetching inventory for super admin:', response.status);
          setInventory([]);
          setLoading(false);
          return;
        }
        
        const { data: inventoryData } = await response.json();
        
        if (inventoryData) {
          const transformedInventory = inventoryData.map((item: any) => ({
            id: item.id,
            type: item.type,
            brandOrTitle: item.brand_or_title,
            plateOrAddress: item.plate_or_address,
            specs: item.specs || '',
            price: Number(item.price),
            status: item.status,
            expiryDate: item.expiry_date,
            createdAt: item.created_at,
            image: item.image,
            color: item.color,
            fuel: item.fuel,
            mileage: item.mileage,
            defects: item.defects,
            rentStart: item.rent_start,
            rentEnd: item.rent_end,
            propType: item.prop_type,
            commercialType: item.commercial_type,
            floorNum: item.floor_num,
            totalFloors: item.total_floors,
            rooms: item.rooms,
            bathrooms: item.bathrooms,
            amenities: item.amenities,
            zoning: item.zoning,
            sqm: item.sqm,
          }));
          setInventory(transformedInventory);
        } else {
          setInventory([]);
        }
        setLoading(false);
        return;
      }
      
      // Use Supabase session from AuthContext if available, otherwise try to get it
      let session = supabaseSession;
      if (!session) {
        const { data: { session: fetchedSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Supabase session error:', sessionError);
          setInventory([]);
          setLoading(false);
          return;
        }
        session = fetchedSession;
      }
      
      // If no Supabase session exists and user is NOT super admin, skip fetch
      if (!session || !session.user) {
        console.warn('[AutoRealEstate] No Supabase session found - user may be authenticated via backend. Skipping RLS-protected fetch.');
        setInventory([]);
        setLoading(false);
        return;
      }

      const authUserId = session.user.id;
      
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('auto_real_estate')
        .select('*')
        .eq('user_id', authUserId)
        .order('created_at', { ascending: false });

      if (inventoryError) {
        console.error('Error fetching inventory:', inventoryError);
        setInventory([]);
      } else if (inventoryData) {
        // Transform database data to match InventoryItem interface
          const transformedInventory = inventoryData.map((item: any) => ({
            id: item.id,
            type: item.type,
            brandOrTitle: item.brand_or_title,
            plateOrAddress: item.plate_or_address,
            specs: item.specs || '',
            price: Number(item.price),
            status: item.status,
            expiryDate: item.expiry_date,
            createdAt: item.created_at,
            image: item.image,
            color: item.color,
            fuel: item.fuel,
            mileage: item.mileage,
            defects: item.defects,
            rentStart: item.rent_start,
            rentEnd: item.rent_end,
            propType: item.prop_type,
            commercialType: item.commercial_type,
            floorNum: item.floor_num,
            totalFloors: item.total_floors,
            rooms: item.rooms,
            bathrooms: item.bathrooms,
            amenities: item.amenities,
            zoning: item.zoning,
            sqm: item.sqm,
          }));
          setInventory(transformedInventory);
        } else {
          // No data yet, but no error - this is normal for new users
          setInventory([]);
        }

        setLogs([{ id: `${Date.now()}-init`, action: "System Initialized", timestamp: new Date().toISOString(), user: user.email || "Admin" }]);
      } catch (error) {
        console.error('Error in fetchInventory:', error);
        setInventory([]);
      } finally {
        setLoading(false);
      }
  }, [user, supabase, supabaseSession, isAdmin]);

  // Call fetchInventory on mount and when dependencies change
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Real-time subscription for inventory changes
  useEffect(() => {
    if (!user || !supabase) return;

    const setupSubscription = async () => {
      // Use Supabase session from AuthContext if available, otherwise try to get it
      let session = supabaseSession;
      if (!session) {
        const { data: { session: fetchedSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Supabase session error:', sessionError);
          return;
        }
        session = fetchedSession;
      }
      
      // If no Supabase session, skip real-time subscription
      if (!session || !session.user) {
        console.warn('[AutoRealEstate] No Supabase session found - skipping real-time subscription');
        return null;
      }

      const authUserId = session.user.id;

      // Create unique channel name with random suffix to prevent conflicts
      const randomSuffix = Math.random().toString(36).substring(2, 9);
      const channelName = `auto_real_estate_${authUserId}_${randomSuffix}`;
      
      // Create channel first, then add callbacks, then subscribe
      if (!supabase) return;
      const channel = supabase.channel(channelName);
      
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_real_estate',
          filter: `user_id=eq.${authUserId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as any;
            const transformedItem = {
              id: newItem.id,
              type: newItem.type,
              brandOrTitle: newItem.brand_or_title,
              plateOrAddress: newItem.plate_or_address,
              specs: newItem.specs || '',
              price: Number(newItem.price),
              status: newItem.status,
              expiryDate: newItem.expiry_date,
              createdAt: newItem.created_at,
              image: newItem.image,
              color: newItem.color,
              fuel: newItem.fuel,
              mileage: newItem.mileage,
              defects: newItem.defects,
              rentStart: newItem.rent_start,
              rentEnd: newItem.rent_end,
              propType: newItem.prop_type,
              commercialType: newItem.commercial_type,
              floorNum: newItem.floor_num,
              totalFloors: newItem.total_floors,
              rooms: newItem.rooms,
              bathrooms: newItem.bathrooms,
              amenities: newItem.amenities,
              zoning: newItem.zoning,
              sqm: newItem.sqm,
            };
            setInventory(prev => [transformedItem, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = payload.new as any;
            setInventory(prev => prev.map(item => 
              item.id === updatedItem.id ? {
                ...item,
                type: updatedItem.type,
                brandOrTitle: updatedItem.brand_or_title,
                plateOrAddress: updatedItem.plate_or_address,
                specs: updatedItem.specs || '',
                price: Number(updatedItem.price),
                status: updatedItem.status,
                expiryDate: updatedItem.expiry_date,
                image: updatedItem.image,
                color: updatedItem.color,
                fuel: updatedItem.fuel,
                mileage: updatedItem.mileage,
                defects: updatedItem.defects,
                rentStart: updatedItem.rent_start,
                rentEnd: updatedItem.rent_end,
                propType: updatedItem.prop_type,
                commercialType: updatedItem.commercial_type,
                floorNum: updatedItem.floor_num,
                totalFloors: updatedItem.total_floors,
                rooms: updatedItem.rooms,
                bathrooms: updatedItem.bathrooms,
                amenities: updatedItem.amenities,
                zoning: updatedItem.zoning,
                sqm: updatedItem.sqm,
              } : item
            ));
          } else if (payload.eventType === 'DELETE') {
            setInventory(prev => prev.filter(item => item.id !== payload.old.id));
          }
        }
      );

      const subscription = channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[AutoRealEstate] Real-time subscription established');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[AutoRealEstate] Real-time subscription error');
        }
      });
      return subscription;
    };

    let subscriptionPromise = setupSubscription();

    return () => {
      subscriptionPromise.then(subscription => {
        if (subscription && supabase) {
          supabase.removeChannel(subscription);
        }
      });
    };
  }, [user, supabaseSession]);

  // Pre-fill fields when selecting an asset for the contract
  useEffect(() => {
    const item = inventory.find(i => i.id === selectedItemId);
    if (item) {
      setCForm(prev => ({
        ...prev,
        price: item.price.toString(),
        brandModel: item.brandOrTitle,
        color: item.color || "",
        fuel: item.fuel || "كازوال (Diesel)",
        mileage: item.mileage || "",
        area: item.sqm?.toString() || "",
        rooms: item.rooms?.toString() || "",
        bathrooms: item.bathrooms?.toString() || "",
        propType: item.propType || (item.type === 'Land' ? 'أرض' : 'شقة')
      }));
    }
  }, [selectedItemId, inventory]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 3000);
  }, []);

  // INVENTORY HANDLERS
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isLogo: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (isLogo) setContractLogo(ev.target?.result as string);
        else setNewItem({ ...newItem, image: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = async () => {
    // Trim values to handle whitespace
    const brandOrTitleTrimmed = newItem.brandOrTitle?.trim();
    const plateOrAddressTrimmed = newItem.plateOrAddress?.trim();
    
    if (!brandOrTitleTrimmed || !plateOrAddressTrimmed) {
      showToast("Please fill required fields", "error"); 
      return;
    }

    try {
      // If super admin, use backend API endpoint instead of direct Supabase
      if (isAdmin) {
        console.warn('[AutoRealEstate] Super admin - using backend API endpoint for save');
        const token = localStorage.getItem('idara_token');
        
        const dbItem = {
          type: newItem.type,
          brandOrTitle: brandOrTitleTrimmed,
          plateOrAddress: plateOrAddressTrimmed,
          specs: newItem.specs || '',
          price: newItem.price || 0,
          status: newItem.status || 'Available',
          expiryDate: newItem.expiryDate || null,
          image: newItem.image || null,
          color: newItem.color || null,
          fuel: newItem.fuel || null,
          mileage: newItem.mileage || null,
          defects: newItem.defects || null,
          rentStart: newItem.rentStart || null,
          rentEnd: newItem.rentEnd || null,
          propType: newItem.propType || null,
          commercialType: newItem.commercialType || null,
          floorNum: newItem.floorNum || null,
          totalFloors: newItem.totalFloors || null,
          rooms: newItem.rooms || null,
          bathrooms: newItem.bathrooms || null,
          amenities: newItem.amenities || null,
          zoning: newItem.zoning || null,
          sqm: newItem.sqm || null,
          // Don't send user_id - server will handle it
        };

        let response;
        if (editingId) {
          response = await fetch(`/api/supabase/auto-real-estate/${editingId}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(dbItem),
          });
        } else {
          response = await fetch('/api/supabase/auto-real-estate', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(dbItem),
          });
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error saving product:', response.status, errorText);
          showToast("Failed to save product", "error");
          return;
        }
        
        await response.json();
        
        // Refresh inventory after save
        await fetchInventory();
        
        setIsModalOpen(false);
        setEditingId(null);
        setNewItem({ type: "Car", status: "Available", price: 0 });
        showToast(editingId ? "تم التعديل بنجاح" : "تمت الإضافة بنجاح", "success");
        return;
      }
      
      // Regular users use Supabase directly
      if (!supabase) {
        showToast("Supabase not configured", "error");
        return;
      }
      
      // Use Supabase session from AuthContext if available, otherwise try to get it
      let session = supabaseSession;
      if (!session) {
        const { data: { session: fetchedSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Supabase session error:', sessionError);
          showToast("Authentication error. Please log in again.", "error");
          return;
        }
        session = fetchedSession;
      }
      
      if (!session || !session.user) {
        console.warn('[AutoRealEstate] No Supabase session found - user may be authenticated via backend. Cannot perform RLS-protected operation.');
        showToast("Supabase authentication required for this operation. Please log in via Supabase.", "error");
        return;
      }

      const authUserId = session.user.id;

      const dbItem = {
        user_id: authUserId,
        type: newItem.type,
        brand_or_title: brandOrTitleTrimmed,
        plate_or_address: plateOrAddressTrimmed,
        specs: newItem.specs || '',
        price: newItem.price || 0,
        status: newItem.status || 'Available',
        expiry_date: newItem.expiryDate || null,
        image: newItem.image || null,
        color: newItem.color || null,
        fuel: newItem.fuel || null,
        mileage: newItem.mileage || null,
        defects: newItem.defects || null,
        rent_start: newItem.rentStart || null,
        rent_end: newItem.rentEnd || null,
        prop_type: newItem.propType || null,
        commercial_type: newItem.commercialType || null,
        floor_num: newItem.floorNum || null,
        total_floors: newItem.totalFloors || null,
        rooms: newItem.rooms || null,
        bathrooms: newItem.bathrooms || null,
        amenities: newItem.amenities || null,
        zoning: newItem.zoning || null,
        sqm: newItem.sqm || null,
      };

      if (editingId) {
        const { data: updateData, error: updateError } = await supabase
          .from('auto_real_estate')
          .update(dbItem)
          .eq('id', editingId)
          .eq('user_id', authUserId)
          .select()
          .maybeSingle();

        if (updateError) {
          console.error('Update error details:', updateError.message, updateError.code, updateError.hint, updateError.details);
          throw updateError;
        }
        
        // Manually update the item in local state for immediate feedback
        if (updateData) {
          setInventory(prev => prev.map(item => 
            item.id === editingId ? {
              ...item,
              type: updateData.type,
              brandOrTitle: updateData.brand_or_title,
              plateOrAddress: updateData.plate_or_address,
              specs: updateData.specs || '',
              price: Number(updateData.price),
              status: updateData.status,
              expiryDate: updateData.expiry_date,
              image: updateData.image,
              color: updateData.color,
              fuel: updateData.fuel,
              mileage: updateData.mileage,
              defects: updateData.defects,
              rentStart: updateData.rent_start,
              rentEnd: updateData.rent_end,
              propType: updateData.prop_type,
              commercialType: updateData.commercial_type,
              floorNum: updateData.floor_num,
              totalFloors: updateData.total_floors,
              rooms: updateData.rooms,
              bathrooms: updateData.bathrooms,
              amenities: updateData.amenities,
              zoning: updateData.zoning,
              sqm: updateData.sqm,
            } : item
          ));
        }
        
        setLogs([{ id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, action: `Edited ${newItem.brandOrTitle}`, timestamp: new Date().toISOString(), user: user.email || "Admin" }, ...logs]);
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('auto_real_estate')
          .insert(dbItem)
          .select()
          .single();

        if (insertError) {
          console.error('Insert error details:', insertError.message, insertError.code, insertError.hint, insertError.details);
          throw insertError;
        }
        
        // Manually add the new item to local state for immediate feedback
        if (insertData) {
          const transformedItem = {
            id: insertData.id,
            type: insertData.type,
            brandOrTitle: insertData.brand_or_title,
            plateOrAddress: insertData.plate_or_address,
            specs: insertData.specs || '',
            price: Number(insertData.price),
            status: insertData.status,
            expiryDate: insertData.expiry_date,
            createdAt: insertData.created_at,
            image: insertData.image,
            color: insertData.color,
            fuel: insertData.fuel,
            mileage: insertData.mileage,
            defects: insertData.defects,
            rentStart: insertData.rent_start,
            rentEnd: insertData.rent_end,
            propType: insertData.prop_type,
            commercialType: insertData.commercial_type,
            floorNum: insertData.floor_num,
            totalFloors: insertData.total_floors,
            rooms: insertData.rooms,
            bathrooms: insertData.bathrooms,
            amenities: insertData.amenities,
            zoning: insertData.zoning,
            sqm: insertData.sqm,
          };
          setInventory(prev => [transformedItem, ...prev]);
        }
        
        setLogs([{ id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, action: `Added ${newItem.brandOrTitle}`, timestamp: new Date().toISOString(), user: user?.email || "Admin" }, ...logs]);
      }

      setIsModalOpen(false);
      setEditingId(null);
      setNewItem({ type: "Car", status: "Available", price: 0 });
      showToast(t.addSuccess, "success");
    } catch (error) {
      console.error('Error saving product:', error);
      showToast("Failed to save product", "error");
    }
  };

  const handleEdit = (e: React.MouseEvent, idToEdit: string) => {
    e.stopPropagation();
    const itemToEdit = inventory.find(i => i.id === idToEdit);
    if (itemToEdit) { setNewItem(itemToEdit); setEditingId(idToEdit); setIsModalOpen(true); }
  };

  const handleDelete = async (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation();
    
    try {
      // If super admin, use backend API endpoint instead of direct Supabase
      if (isAdmin) {
        console.warn('[AutoRealEstate] Super admin - using backend API endpoint for delete');
        const token = localStorage.getItem('idara_token');
        
        const response = await fetch(`/api/supabase/auto-real-estate/${idToDelete}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error deleting product:', response.status, errorText);
          showToast("Failed to delete product", "error");
          return;
        }
        
        // Refresh inventory after delete
        await fetchInventory();
        
        showToast(t.deleteSuccess, "info");
        return;
      }
      
      // Regular users use Supabase directly
      if (!supabase) {
        showToast("Supabase not configured", "error");
        return;
      }

      // Use Supabase session from AuthContext if available, otherwise try to get it
      let session = supabaseSession;
      if (!session) {
        const { data: { session: fetchedSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Supabase session error:', sessionError);
          showToast("Authentication error. Please log in again.", "error");
          return;
        }
        session = fetchedSession;
      }
      
      if (!session || !session.user) {
        console.warn('[AutoRealEstate] No Supabase session found - user may be authenticated via backend. Cannot perform RLS-protected operation.');
        showToast("Supabase authentication required for this operation. Please log in via Supabase.", "error");
        return;
      }

      const authUserId = session.user.id;

      const { error: deleteError } = await supabase
        .from('auto_real_estate')
        .delete()
        .eq('id', idToDelete)
        .eq('user_id', authUserId);

      if (deleteError) throw deleteError;
      
      // Manually update local state for immediate UI refresh
      setInventory(prev => prev.filter(item => item.id !== idToDelete));
      
      showToast(t.deleteSuccess, "info");
    } catch (error) {
      console.error('Error deleting product:', error);
      showToast("Failed to delete product", "error");
    }
  };

  const handleExportCSV = useCallback(() => {
    const headers = ["ID", "Type", "Title", "Identifier", "Price", "Status"];
    const rows = inventory.map(i => `${i.id},${i.type},"${i.brandOrTitle}","${i.plateOrAddress}",${i.price},${i.status}`);
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'inventory_stock.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("Exported successfully!", "success");
  }, [inventory, showToast]);

  const handleGenerateContract = () => {
    setIsGenerating(true); setShowGeneratedContract(false);
    setTimeout(() => { 
      setIsGenerating(false); setShowGeneratedContract(true); 
      if (contractType.includes('rent') && selectedItemId) {
        setInventory(prev => prev.map(item => {
          if (item.id === selectedItemId) {
            return { ...item, status: 'Rented', rentStart: cForm.startDate, rentEnd: cForm.endDate };
          }
          return item;
        }));
        setLogs(prev => [{ id: Math.random().toString(), action: `Contract Registered: Rental Schedule Synced for ${cForm.brandModel}`, timestamp: new Date().toISOString(), user: "System" }, ...prev]);
      }
      showToast("Legal Document Ready & Tracked!", "success"); 
    }, 1500);
  };

  const handleDownloadPDF = () => {
    try {
      const element = document.querySelector('.contract-print-zone') as HTMLElement;
      if (!element) {
        showToast("Contract element not found", "error");
        return;
      }

      const opt = {
        margin: [5, 5, 5, 5] as [number, number, number, number],
        filename: `contract-${contractType}-${Date.now()}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false
        },
        jsPDF: {
          unit: 'mm' as const,
          format: 'a4' as const,
          orientation: 'portrait' as const
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as const }
      };

      html2pdf().set(opt).from(element).save();
      showToast("PDF downloaded successfully!", "success");
    } catch (error) {
      console.error("Error generating PDF:", error);
      showToast("Failed to generate PDF", "error");
    }
  };

  const navigateToFilteredStock = (status: ItemStatus | "All") => {
    setInventoryFilter(status);
    setActiveTab("inventory");
  };

  const processUploadedFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const newFile: UploadedFile = { name: file.name, size: file.size, url, type: file.type };
    setUploadedFiles(prev => [...prev, newFile]);
    showToast(t.uploadSuccess, "success");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const stats = useMemo(() => {
    const activeAssets = inventory.filter(i => i.status === "Available" || i.status === "Rented");
    const totalPhysicalValue = activeAssets.reduce((acc, i) => acc + i.price, 0);
    const soldItems = inventory.filter(i => i.status === "Sold");
    
    const incomeToday = soldItems.reduce((acc, i) => acc + i.price, 0); 
    const expensesToday = inventory.filter(i => i.status === "Maintenance").reduce((acc, i) => acc + (i.price * 0.05), 0);
    const cashflow = incomeToday - expensesToday;

    return {
      totalAvailable: inventory.filter(i => i.status === "Available").length,
      capital: totalPhysicalValue,
      sold: soldItems.length,
      rented: inventory.filter(i => i.status === "Rented").length,
      incomeToday, expensesToday, cashflow
    };
  }, [inventory]);

  const activeAlerts = useMemo(() => {
    const alerts: { id: string, title: string, daysLeft: number, urgency: 'warning'|'danger' }[] = [];
    const today = new Date();
    
    inventory.forEach(item => {
      if (item.status === 'Rented' && item.rentEnd) {
        const endDate = new Date(item.rentEnd);
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 7 && diffDays >= 0) {
          alerts.push({ id: item.id, title: `${item.brandOrTitle} - ${item.plateOrAddress}`, daysLeft: diffDays, urgency: 'warning' });
        } else if (diffDays < 0) {
          alerts.push({ id: item.id, title: `${item.brandOrTitle} - ${item.plateOrAddress}`, daysLeft: diffDays, urgency: 'danger' });
        }
      }
    });
    return alerts;
  }, [inventory]);

  const filteredInventory = useMemo(() => inventory.filter(item => {
    const matchesSearch = item.brandOrTitle.toLowerCase().includes(searchQuery.toLowerCase()) || item.plateOrAddress.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = inventoryFilter === "All" || item.status === inventoryFilter;
    return matchesSearch && matchesFilter;
  }), [inventory, searchQuery, inventoryFilter]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(amount);
  const selectedItem = inventory.find(i => i.id === selectedItemId);

  // ----------------------------------------------------------------------
  // DEEP LEGAL TEXT GENERATOR (Multilingual AR/EN/FR/ES Complete Strict Translation)
  // ----------------------------------------------------------------------
  const renderLegalText = () => {
    const p1 = cForm.p1Name || (aiLang === 'ar' ? '[اسم الطرف الأول]' : aiLang === 'fr' ? '[Nom de la Première Partie]' : aiLang === 'es' ? '[Nombre de la Primera Parte]' : '[First Party Name]');
    const id1 = cForm.p1Id || (aiLang === 'ar' ? '[رقم الهوية]' : aiLang === 'fr' ? '[ID/CIN]' : aiLang === 'es' ? '[ID/DNI]' : '[ID Number]');
    const p2 = cForm.p2Name || (aiLang === 'ar' ? '[اسم الطرف الثاني]' : aiLang === 'fr' ? '[Nom de la Deuxième Partie]' : aiLang === 'es' ? '[Nombre de la Segunda Parte]' : '[Second Party Name]');
    const id2 = cForm.p2Id || (aiLang === 'ar' ? '[رقم الهوية]' : aiLang === 'fr' ? '[ID/CIN]' : aiLang === 'es' ? '[ID/DNI]' : '[ID Number]');
    
    const price = cForm.price ? formatCurrency(Number(cForm.price)) : (aiLang === 'ar' ? '[المبلغ المتفق عليه]' : aiLang === 'fr' ? '[Montant Convenu]' : aiLang === 'es' ? '[Monto Acordado]' : '[Agreed Amount]');
    const deposit = cForm.deposit ? formatCurrency(Number(cForm.deposit)) : (aiLang === 'ar' ? '0.00 درهم' : '0.00 MAD');
    const identifier = selectedItem?.plateOrAddress || (aiLang === 'ar' ? '[المعرف/اللوحة]' : aiLang === 'fr' ? '[Plaque/Identifiant]' : aiLang === 'es' ? '[Placa/Identificador]' : '[Identifier/Plate]');

    const articleBreakStyle = { pageBreakInside: 'avoid' as const, pageBreakAfter: 'auto' as const };

    const getFallbackResType = (l: string) => {
      if (l==='ar') return 'شقة/فيلا';
      if (l==='fr') return 'Appartement/Villa';
      if (l==='es') return 'Apartamento/Villa';
      return 'Apartment/Villa';
    };

    // Centralized Deep Spec Asset Component Map for 4 languages
    const AssetDetails = selectedItem ? (
      <div className="p-3 compact-box rounded text-sm my-3 shadow-sm" style={{
        backgroundColor: aiLang === 'ar' ? '#f8fafc' : '#f1f5f9',
        border: '1px solid #cbd5e1',
        color: '#0f172a'
      }}>
        {selectedItem.type === 'Car' && (
          <>
            {aiLang === 'ar' && (
              <>
                <p><strong>العلامة التجارية:</strong> {selectedItem.brandOrTitle}</p>
                <p><strong>رقم اللوحة:</strong> {selectedItem.plateOrAddress}</p>
                <p><strong>المواصفات:</strong> {selectedItem.specs}</p>
                <p><strong>السعر:</strong> {selectedItem.price}</p>
              </>
            )}
            {aiLang === 'en' && (
              <>
                <p><strong>Brand:</strong> {selectedItem.brandOrTitle}</p>
                <p><strong>Plate Number:</strong> {selectedItem.plateOrAddress}</p>
                <p><strong>Specifications:</strong> {selectedItem.specs}</p>
                <p><strong>Price:</strong> {selectedItem.price}</p>
              </>
            )}
            {aiLang === 'fr' && (
              <>
                <p><strong>Marque:</strong> {selectedItem.brandOrTitle}</p>
                <p><strong>Numéro d'immatriculation:</strong> {selectedItem.plateOrAddress}</p>
                <p><strong>Spécifications:</strong> {selectedItem.specs}</p>
                <p><strong>Prix:</strong> {selectedItem.price}</p>
              </>
            )}
            {aiLang === 'es' && (
              <>
                <p><strong>Marca:</strong> {selectedItem.brandOrTitle}</p>
                <p><strong>Número de placa:</strong> {selectedItem.plateOrAddress}</p>
                <p><strong>Especificaciones:</strong> {selectedItem.specs}</p>
                <p><strong>Precio:</strong> {selectedItem.price}</p>
              </>
            )}
          </>
        )}
        {selectedItem.type === 'Property' && (
          <>
            {aiLang === 'ar' && (
              <>
                <p><strong>عنوان العقار:</strong> {selectedItem.plateOrAddress}</p>
                <p><strong>المواصفات:</strong> {selectedItem.specs}</p>
                <p><strong>السعر:</strong> {selectedItem.price}</p>
              </>
            )}
            {aiLang === 'en' && (
              <>
                <p><strong>Property Address:</strong> {selectedItem.plateOrAddress}</p>
                <p><strong>Specifications:</strong> {selectedItem.specs}</p>
                <p><strong>Price:</strong> {selectedItem.price}</p>
              </>
            )}
            {aiLang === 'fr' && (
              <>
                <p><strong>Adresse du bien:</strong> {selectedItem.plateOrAddress}</p>
                <p><strong>Spécifications:</strong> {selectedItem.specs}</p>
                <p><strong>Prix:</strong> {selectedItem.price}</p>
              </>
            )}
            {aiLang === 'es' && (
              <>
                <p><strong>Dirección de la propiedad:</strong> {selectedItem.plateOrAddress}</p>
                <p><strong>Especificaciones:</strong> {selectedItem.specs}</p>
                <p><strong>Precio:</strong> {selectedItem.price}</p>
              </>
            )}
          </>
        )}
        {selectedItem.type === 'Land' && (
          <>
            {aiLang === 'ar' && (
              <>
                <p><strong>موقع الأرض:</strong> {selectedItem.plateOrAddress}</p>
                <p><strong>المساحة:</strong> {selectedItem.specs}</p>
                <p><strong>السعر:</strong> {selectedItem.price}</p>
              </>
            )}
            {aiLang === 'en' && (
              <>
                <p><strong>Land Location:</strong> {selectedItem.plateOrAddress}</p>
                <p><strong>Area:</strong> {selectedItem.specs}</p>
                <p><strong>Price:</strong> {selectedItem.price}</p>
              </>
            )}
            {aiLang === 'fr' && (
              <>
                <p><strong>Emplacement du terrain:</strong> {selectedItem.plateOrAddress}</p>
                <p><strong>Superficie:</strong> {selectedItem.specs}</p>
                <p><strong>Prix:</strong> {selectedItem.price}</p>
              </>
            )}
            {aiLang === 'es' && (
              <>
                <p>Tipo: <strong>{cForm.propType || getFallbackResType('es')}</strong> | Dirección: <strong>{identifier}</strong> | Piso: {cForm.floorNum || '-'}</p>
                <p>Área Total: {cForm.area || '-'} | Habitaciones: {cForm.rooms || '-'} | Baños: {cForm.bathrooms || '-'}</p>
                <p>Cocina: {cForm.kitchen || '-'} | Balcones: {cForm.balconies || '-'} | Garaje: {cForm.garage || '-'}</p>
              </>
            )}
          </>
        )}
      </div>
    ) : null;

    const ScheduleBlock = (
      <div className="mt-3 compact-box p-3 rounded text-sm shadow-sm" style={{
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
        color: '#0f172a'
      }}>
        {aiLang === 'ar' && (
          <>
            <p><strong>تاريخ وساعة الدخول:</strong> {cForm.startDate || '[غير محدد]'} - {cForm.startTime}</p>
            <p><strong>تاريخ وساعة الإرجاع:</strong> {cForm.endDate || '[غير محدد]'} - {cForm.endTime}</p>
            <p><strong>المدة الإجمالية:</strong> {cForm.duration || '[غير محدد]'}</p>
          </>
        )}
        {aiLang === 'en' && (
          <>
            <p><strong>Entry Date & Time:</strong> {cForm.startDate || '[Not specified]'} - {cForm.startTime}</p>
            <p><strong>Return Date & Time:</strong> {cForm.endDate || '[Not specified]'} - {cForm.endTime}</p>
            <p><strong>Total Duration:</strong> {cForm.duration || '[Not specified]'}</p>
          </>
        )}
        {aiLang === 'fr' && (
          <>
            <p><strong>Date et heure d'entrée:</strong> {cForm.startDate || '[Non spécifié]'} - {cForm.startTime}</p>
            <p><strong>Date et heure de retour:</strong> {cForm.endDate || '[Non spécifié]'} - {cForm.endTime}</p>
            <p><strong>Durée totale:</strong> {cForm.duration || '[Non spécifié]'}</p>
          </>
        )}
        {aiLang === 'es' && (
          <>
            <p><strong>Fecha y hora de entrada:</strong> {cForm.startDate || '[No especificado]'} - {cForm.startTime}</p>
            <p><strong>Fecha y hora de retorno:</strong> {cForm.endDate || '[No especificado]'} - {cForm.endTime}</p>
            <p><strong>Duración total:</strong> {cForm.duration || '[No especificado]'}</p>
          </>
        )}
      </div>
    );

    // CONTRACT TEMPLATES (Fully Extrapolated)
    return (
      <div className="space-y-1 text-justify leading-6 text-sm">
        
        {/* SALE CONTRACTS */}
        {contractType.includes('sale') && (
          <>
            <div style={articleBreakStyle}>
              <h3 className="font-bold text-lg mb-3 pb-2" style={{ borderBottom: '2px solid #1e293b' }}>
                {aiLang === 'ar' ? 'تمهيد العقد' : aiLang === 'fr' ? 'Préambule du Contrat' : aiLang === 'es' ? 'Preámbulo del Contrato' : 'Contract Preamble'}
              </h3>
              {aiLang === 'ar' && (
                <>
                  <p>أبرم هذا العقد وتم التراضي التام بين كل من:</p>
                  <p><strong>الطرف الأول (البائع):</strong> السيد/ة {p1}، الحامل للبطاقة الوطنية رقم {id1}.</p>
                  <p><strong>الطرف الثاني (المشتري):</strong> السيد/ة {p2}، الحامل للبطاقة الوطنية رقم {id2}.</p>
                </>
              )}
              {aiLang === 'en' && (
                <>
                  <p>This Contract is entered into and mutually agreed upon by:</p>
                  <p><strong>First Party (Seller):</strong> Mr./Ms. {p1}, ID number: {id1}.</p>
                  <p><strong>Second Party (Buyer):</strong> Mr./Ms. {p2}, ID number: {id2}.</p>
                </>
              )}
              {aiLang === 'fr' && (
                <>
                  <p>Ce contrat est conclu et mutuellement convenu entre :</p>
                  <p><strong>Première Partie (Vendeur) :</strong> M./Mme {p1}, titulaire de la pièce d'identité N° {id1}.</p>
                  <p><strong>Deuxième Partie (Acheteur) :</strong> M./Mme {p2}, titulaire de la pièce d'identité N° {id2}.</p>
                </>
              )}
              {aiLang === 'es' && (
                <>
                  <p>Este Contrato se celebra y se acuerda mutuamente entre:</p>
                  <p><strong>Primera Parte (Vendedor):</strong> Sr./Sra. {p1}, con documento de identidad N° {id1}.</p>
                  <p><strong>Segunda Parte (Comprador):</strong> Sr./Sra. {p2}, con documento de identidad N° {id2}.</p>
                </>
              )}
            </div>
            
            <div style={articleBreakStyle} className="mt-4">
              <h4 className="font-bold text-base" style={{ color: '#1e293b' }}>
                {aiLang === 'ar' ? 'المادة الأولى: موضوع العقد' : aiLang === 'fr' ? 'Article 1 : Objet du Contrat' : aiLang === 'es' ? 'Artículo 1: Objeto del Contrato' : 'Article 1: Subject Matter of the Contract'}
              </h4>
              {aiLang === 'ar' && <p>بموجب هذا العقد وبكافة الضمانات الفعلية والقانونية، يقر الطرف الأول بأنه باع وأسقط ونقل ملكية الموصوف أدناه إلى الطرف الثاني:</p>}
              {aiLang === 'en' && <p>By virtue of this contract and with all factual and legal guarantees, the First Party acknowledges having sold, dropped, and transferred the ownership of the asset described below to the Second Party:</p>}
              {aiLang === 'fr' && <p>En vertu de ce contrat et avec toutes les garanties de fait et de droit, la Première Partie reconnaît avoir vendu, cédé et transféré la propriété du bien décrit ci-dessous à la Deuxième Partie :</p>}
              {aiLang === 'es' && <p>En virtud de este contrato y con todas las garantías fácticas y legales, la Primera Parte reconoce haber vendido, cedido y transferido la propiedad del activo descrito a continuación a la Segunda Parte:</p>}
              {AssetDetails}
            </div>

            <div style={articleBreakStyle} className="mt-4">
              <h4 className="font-bold text-base" style={{ color: '#1e293b' }}>
                {aiLang === 'ar' ? 'المادة الثانية: الشروط المالية' : aiLang === 'fr' ? 'Article 2 : Conditions Financières' : aiLang === 'es' ? 'Artículo 2: Términos Financieros' : 'Article 2: Financial Terms'}
              </h4>
              {aiLang === 'ar' && <p>تم هذا البيع بثمن إجمالي ومكشوف قدره <strong>{price}</strong>، يعترف البائع بقبضه كاملاً عند توقيع هذا العقد، وبهذا يبرئ ذمة المشتري إبراءً تاماً لا رجعة فيه.</p>}
              {aiLang === 'en' && <p>This sale is concluded for a total and disclosed price of <strong>{price}</strong>, which the Seller acknowledges having received in full upon signing this contract, thereby granting the Buyer a full and irrevocable discharge.</p>}
              {aiLang === 'fr' && <p>Cette vente est conclue pour un prix total et déclaré de <strong>{price}</strong>, que le Vendeur reconnaît avoir reçu intégralement lors de la signature de ce contrat, accordant ainsi à l'Acheteur une décharge totale et irrévocable.</p>}
              {aiLang === 'es' && <p>Esta venta se concluye por un precio total y declarado de <strong>{price}</strong>, que el Vendedor reconoce haber recibido en su totalidad al firmar este contrato, otorgando así al Comprador un descargo total e irrevocable.</p>}
            </div>

            <div style={articleBreakStyle} className="mt-4">
              <h4 className="font-bold text-base" style={{ color: '#1e293b' }}>
                {aiLang === 'ar' ? 'المادة الثالثة: المسؤوليات والالتزامات' : aiLang === 'fr' ? 'Article 3 : Responsabilités et Obligations' : aiLang === 'es' ? 'Artículo 3: Responsabilidades y Obligaciones' : 'Article 3: Responsibilities and Obligations'}
              </h4>
              {aiLang === 'ar' && <p>يقر المشتري بأنه عاين المبيع معاينة تامة نافية للجهالة وقبله بحالته الراهنة. يتحمل الطرف الثاني كافة الرسوم والضرائب المترتبة عن هذا البيع ابتداءً من تاريخ التوقيع، وتنتقل إليه الحيازة الفعلية فور المصادقة على هذا العقد.</p>}
              {aiLang === 'en' && <p>The Buyer acknowledges having thoroughly inspected the sold asset, negating any ignorance, and accepts it in its current condition. The Second Party bears all fees and taxes arising from this sale starting from the date of signing, and actual possession is transferred immediately upon the ratification of this contract.</p>}
              {aiLang === 'fr' && <p>L'Acheteur reconnaît avoir inspecté minutieusement le bien vendu, renonçant à toute ignorance, et l'accepte dans son état actuel. La Deuxième Partie supporte tous les frais et impôts découlant de cette vente à compter de la date de signature, et la possession effective est transférée dès la ratification de ce contrat.</p>}
              {aiLang === 'es' && <p>El Comprador reconoce haber inspeccionado exhaustivamente el activo vendido, renunciando a cualquier ignorancia, y lo acepta en su estado actual. La Segunda Parte asume todos los honorarios e impuestos derivados de esta venta a partir de la fecha de firma, y la posesión real se transfiere inmediatamente tras la ratificación de este contrato.</p>}
            </div>

            <div style={articleBreakStyle} className="mt-4">
              <h4 className="font-bold text-base" style={{ color: '#1e293b' }}>
                {aiLang === 'ar' ? 'المادة الرابعة: شروط الفسخ والغرامات' : aiLang === 'fr' ? 'Article 4 : Clauses de Résiliation et Pénalités' : aiLang === 'es' ? 'Artículo 4: Cláusulas de Rescisión y Penalizaciones' : 'Article 4: Termination Clauses and Penalties'}
              </h4>
              {aiLang === 'ar' && <p>في حالة إخلال أي من الطرفين ببنود هذا العقد، يحق للطرف المتضرر المطالبة بفسخ العقد مع التعويض الشامل عن الضرر وفقاً لما ينص عليه قانون الالتزامات والعقود.</p>}
              {aiLang === 'en' && <p>In the event of a breach of the clauses of this contract by either party, the aggrieved party has the right to demand the termination of the contract along with comprehensive compensation for the damage in accordance with the Law of Obligations and Contracts.</p>}
              {aiLang === 'fr' && <p>En cas de violation des clauses de ce contrat par l'une ou l'autre des parties, la partie lésée a le droit d'exiger la résiliation du contrat avec une indemnisation complète pour le préjudice subi, conformément au Code des Obligations et des Contrats.</p>}
              {aiLang === 'es' && <p>En caso de incumplimiento de las cláusulas de este contrato por cualquiera de las partes, la parte perjudicada tiene derecho a exigir la rescisión del contrato junto con una compensación integral por el daño sufrido, de acuerdo con la Ley de Obligaciones y Contratos.</p>}
            </div>
          </>
        )}

        {/* RENT CONTRACTS */}
        {!contractType.includes('sale') && (
          <>
            <div style={articleBreakStyle}>
              <h3 className="font-bold text-xl mb-4 pb-2" style={{ borderBottom: '2px solid #1e293b' }}>
                {aiLang === 'ar' ? 'تمهيد العقد' : aiLang === 'fr' ? 'Préambule du Contrat' : aiLang === 'es' ? 'Preámbulo del Contrato' : 'Contract Preamble'}
              </h3>
              {aiLang === 'ar' && (
                <>
                  <p>أبرم هذا العقد بين كل من <strong>الطرف الأول (المكري):</strong> السيد/ة {p1}، الحامل للبطاقة الوطنية رقم {id1}.</p>
                  <p><strong>والطرف الثاني (المكتري):</strong> السيد/ة {p2}، الحامل للبطاقة الوطنية رقم {id2}.</p>
                </>
              )}
              {aiLang === 'en' && (
                <>
                  <p>This Contract is entered into by the <strong>First Party (Lessor):</strong> Mr./Ms. {p1}, ID number: {id1}.</p>
                  <p><strong>And the Second Party (Lessee):</strong> Mr./Ms. {p2}, ID number: {id2}.</p>
                </>
              )}
              {aiLang === 'fr' && (
                <>
                  <p>Ce contrat est conclu par la <strong>Première Partie (Bailleur) :</strong> M./Mme {p1}, CIN N° {id1}.</p>
                  <p><strong>Et la Deuxième Partie (Locataire) :</strong> M./Mme {p2}, CIN N° {id2}.</p>
                </>
              )}
              {aiLang === 'es' && (
                <>
                  <p>Este Contrato se celebra por la <strong>Primera Parte (Arrendador):</strong> Sr./Sra. {p1}, ID N° {id1}.</p>
                  <p><strong>Y la Segunda Parte (Arrendatario):</strong> Sr./Sra. {p2}, ID N° {id2}.</p>
                </>
              )}
            </div>
            
            <div style={articleBreakStyle} className="mt-4">
              <h4 className="font-bold text-sm" style={{ color: '#1e293b' }}>
                {aiLang === 'ar' ? 'المادة الأولى: موضوع الكراء' : aiLang === 'fr' ? 'Article 1 : Objet de la Location' : aiLang === 'es' ? 'Artículo 1: Objeto del Arrendamiento' : 'Article 1: Subject of Lease'}
              </h4>
              {aiLang === 'ar' && <p>أكرى الطرف الأول للطرف الثاني الممتلكات التالية، وتخلى له عن منفعتها طيلة مدة العقد:</p>}
              {aiLang === 'en' && <p>The First Party leases to the Second Party the following property/asset, relinquishing its utility for the duration of the contract:</p>}
              {aiLang === 'fr' && <p>La Première Partie loue à la Deuxième Partie le bien/véhicule suivant, en lui cédant l'usufruit pour la durée du contrat :</p>}
              {aiLang === 'es' && <p>La Primera Parte arrienda a la Segunda Parte el siguiente bien/activo, cediendo su utilidad por la duración del contrato:</p>}
              {AssetDetails}
            </div>

            <div style={articleBreakStyle} className="mt-4">
              <h4 className="font-bold text-sm" style={{ color: '#1e293b' }}>
                {aiLang === 'ar' ? 'المادة الثانية: السومة الكرائية والضمانة' : aiLang === 'fr' ? 'Article 2 : Loyer et Dépôt de Garantie' : aiLang === 'es' ? 'Artículo 2: Tarifa de Alquiler y Depósito de Garantía' : 'Article 2: Rental Rate and Security Deposit'}
              </h4>
              {aiLang === 'ar' && <p>اتفق الطرفان على سومة كرائية قدرها <strong>{price}</strong> تُدفع في وقتها المحدد، مع أداء ضمانة مالية قدرها <strong>{deposit}</strong> تسترد عند الإخلاء بعد التأكد من سلامة العين المكتراة.</p>}
              {aiLang === 'en' && <p>The parties have agreed upon a rental rate of <strong>{price}</strong> to be paid on its due date, along with a financial security deposit of <strong>{deposit}</strong>, which is refundable upon evacuation after verifying the integrity of the leased asset.</p>}
              {aiLang === 'fr' && <p>Les parties ont convenu d'un loyer de <strong>{price}</strong> à payer à l'échéance, avec un dépôt de garantie financier de <strong>{deposit}</strong>, restituable lors du départ après vérification de l'intégrité du bien loué.</p>}
              {aiLang === 'es' && <p>Las partes han acordado una tarifa de alquiler de <strong>{price}</strong> a pagar en su fecha de vencimiento, junto con un depósito de garantía financiero de <strong>{deposit}</strong>, que es reembolsable al momento del desalojo después de verificar la integridad del activo arrendado.</p>}
            </div>

            <div style={articleBreakStyle} className="mt-4">
              <h4 className="font-bold text-sm" style={{ color: '#1e293b' }}>
                {aiLang === 'ar' ? 'المادة الثالثة: مدة العقد والجدولة' : aiLang === 'fr' ? 'Article 3 : Durée du Contrat et Calendrier' : aiLang === 'es' ? 'Artículo 3: Duración del Contrato y Calendario' : 'Article 3: Contract Duration and Scheduling'}
              </h4>
              {ScheduleBlock}
              {aiLang === 'ar' && <p className="mt-3">في حال التأخر عن الأداء أو الإرجاع في الوقت المحدد، يُفسخ العقد بقوة القانون وتُصادر الضمانة كغرامة أولية مع الاحتفاظ بحق المتابعة القضائية.</p>}
              {aiLang === 'en' && <p className="mt-3">In the event of delayed payment or delayed return at the specified time, the contract is automatically rescinded by force of law, and the deposit is confiscated as an initial penalty, reserving the right to legal prosecution.</p>}
              {aiLang === 'fr' && <p className="mt-3">En cas de retard de paiement ou de retard de restitution à l'heure spécifiée, le contrat est résilié de plein droit, et le dépôt est confisqué à titre de pénalité initiale, sous réserve du droit de poursuites judiciaires.</p>}
              {aiLang === 'es' && <p className="mt-3">En caso de retraso en el pago o retraso en la devolución a la hora especificada, el contrato se rescinde automáticamente por fuerza de ley, y el depósito se confisca como penalización inicial, reservando el derecho a un proceso judicial.</p>}
            </div>

            <div style={articleBreakStyle} className="mt-4">
              <h4 className="font-bold text-sm" style={{ color: '#1e293b' }}>
                {aiLang === 'ar' ? 'المادة الرابعة: التأمين والصيانة' : aiLang === 'fr' ? 'Article 4 : Assurance et Entretien' : aiLang === 'es' ? 'Artículo 4: Seguro y Mantenimiento' : 'Article 4: Insurance and Maintenance'}
              </h4>
              {aiLang === 'ar' && <p>يتحمل المكتري المسؤولية المدنية والجنائية الكاملة طيلة مدة استغلاله، ويلتزم بإجراء الصيانة الدورية وعدم إدخال أي تعديلات جوهرية دون إذن كتابي من المكري.</p>}
              {aiLang === 'en' && <p>The Lessee assumes full civil and criminal liability throughout the period of utilization, and commits to performing periodic maintenance and refraining from making any substantial modifications without written permission from the Lessor.</p>}
              {aiLang === 'fr' && <p>Le Locataire assume l'entière responsabilité civile et pénale pendant toute la durée de l'exploitation, et s'engage à effectuer l'entretien périodique et à ne procéder à aucune modification substantielle sans l'autorisation écrite du Bailleur.</p>}
              {aiLang === 'es' && <p>El Arrendatario asume toda la responsabilidad civil y penal durante todo el período de utilización, y se compromete a realizar el mantenimiento periódico y a no realizar ninguna modificación sustancial sin el permiso por escrito del Arrendador.</p>}
            </div>
          </>
        )}
      </div>
    );
  };

  // ----------------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------------
  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 print:bg-white print:text-black">
      
      {/* TOAST NOTIFICATIONS */}
      <div className={`fixed top-4 z-50 flex flex-col gap-2 pointer-events-none ${isRTL ? 'left-4' : 'right-4'} print:hidden`}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg backdrop-blur-md border animate-in slide-in-from-top-2 fade-in duration-300
            ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-rose-500/10 border-rose-500/50 text-rose-400'}`}>
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* HEADER */}
      <header className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              <Building size={24} />
            </div>
            <div>
              <h1 className="font-bold text-xl text-white tracking-wide">Auto & Real Estate <span className="text-blue-400">Pro</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar bg-slate-950/50 p-1.5 rounded-full border border-slate-800">
            {[
              { id: "dashboard", icon: LayoutDashboard, label: t.dashboard },
              { id: "inventory", icon: Car, label: t.inventory },
              { id: "contracts", icon: Sparkles, label: t.contracts },
              { id: "accounting", icon: Calculator, label: t.accounting },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300
                  ${activeTab === tab.id ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]" : "text-slate-400 hover:text-white hover:bg-slate-800/50"}`}>
                <tab.icon size={16} className={activeTab === tab.id ? "animate-pulse" : ""} /> {tab.label}
              </button>
            ))}
          </div>
          <div className="flex bg-slate-950/50 border border-slate-800 rounded-lg p-1">
            {(["ar", "en", "fr"] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-3 py-1 text-xs font-bold rounded-md uppercase transition-all duration-300 ${lang === l ? "bg-slate-800 text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 py-8 relative">
        {loading ? (
          <div className="flex justify-center items-center h-64 print:hidden">
            <Loader2 className="animate-spin text-blue-500" size={48} />
          </div>
        ) : (
          <>
            {/* DASHBOARD */}
            <div className={`${activeTab === 'dashboard' ? 'block' : 'hidden'} space-y-6 animate-in fade-in duration-500 print:hidden`}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: t.totalProducts, value: stats.totalAvailable, icon: Car, color: "text-blue-400", glow: "shadow-[0_0_15px_rgba(96,165,250,0.15)]", filter: "Available" as ItemStatus },
                  { label: t.capitalInvested, value: formatCurrency(stats.capital), icon: DollarSign, color: "text-emerald-400", glow: "shadow-[0_0_15px_rgba(52,211,153,0.15)]", filter: "All" as const },
                  { label: t.itemsSold, value: stats.sold, icon: CheckCircle, color: "text-purple-400", glow: "shadow-[0_0_15px_rgba(192,132,252,0.15)]", filter: "Sold" as ItemStatus },
                  { label: t.activeRentals, value: stats.rented, icon: History, color: "text-amber-400", glow: "shadow-[0_0_15px_rgba(251,191,36,0.15)]", filter: "Rented" as ItemStatus },
                ].map((stat) => (
                  <div key={stat.filter} onClick={() => navigateToFilteredStock(stat.filter)} className={`cursor-pointer bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800 flex items-center justify-between hover:border-slate-700 hover:scale-105 transition-all duration-300 ${stat.glow}`}>
                    <div><p className="text-slate-400 text-sm font-medium mb-1">{stat.label}</p><h3 className="text-2xl font-bold text-white">{stat.value}</h3></div>
                    <div className={`p-3 rounded-xl bg-slate-950/50 border border-slate-800 ${stat.color}`}><stat.icon size={24} /></div>
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 flex flex-col h-full overflow-hidden">
                  <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-white"><Bell size={20} className="text-rose-400" /> تنبيهات انتهاء الكراء</h3>
                  {activeAlerts.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-6">No pending alerts</p>
                  ) : (
                    <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
                      {activeAlerts.map(alert => (
                        <div key={alert.id} className={`p-3 rounded-xl border ${alert.urgency === 'danger' ? 'bg-rose-950/30 border-rose-900/50' : 'bg-amber-950/30 border-amber-900/50'}`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-sm font-bold ${alert.urgency === 'danger' ? 'text-rose-400' : 'text-amber-400'}`}>{alert.title}</span>
                            <Clock size={16} className={alert.urgency === 'danger' ? 'text-rose-500 animate-pulse' : 'text-amber-500'} />
                          </div>
                          <p className="text-xs text-slate-400">
                            {alert.daysLeft < 0 ? `انتهى منذ ${Math.abs(alert.daysLeft)} أيام!` : alert.daysLeft === 0 ? 'ينتهي اليوم!' : `ينتهي بعد ${alert.daysLeft} أيام`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6">
                  <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-white"><History size={20} className="text-blue-400" /> Action Logs</h3>
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div key={log.id} className="flex justify-between items-center p-3 bg-slate-950/50 rounded-lg border border-slate-800/50">
                        <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div><span className="font-medium text-slate-300">{log.action}</span></div>
                        <div className="text-xs text-slate-500 flex flex-col items-end font-mono"><span>{new Date(log.timestamp).toLocaleDateString()}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* INVENTORY LIST */}
            <div className={`${activeTab === 'inventory' ? 'block' : 'hidden'} bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 overflow-hidden animate-in fade-in duration-500 print:border-none print:shadow-none print:bg-transparent`}>
              
              <div className="p-5 border-b border-slate-800 flex flex-wrap gap-4 justify-between items-center bg-slate-950/30 print:hidden">
                <div className="flex flex-1 gap-4 items-center">
                  <div className="relative w-full max-w-md">
                    <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-500 ${isRTL ? 'right-4' : 'left-4'}`} size={18} />
                    <input type="text" placeholder={t.search} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full bg-slate-950 border border-slate-700 rounded-full py-2.5 ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all`} />
                  </div>
                  {inventoryFilter !== "All" && (
                    <span className="bg-blue-900/40 text-blue-300 px-4 py-1.5 rounded-full text-sm font-semibold border border-blue-700 flex items-center gap-2">
                      Filter: {t[inventoryFilter.toLowerCase() as keyof typeof t] || inventoryFilter}
                      <button onClick={() => setInventoryFilter("All")} className="hover:text-white"><X size={14}/></button>
                    </span>
                  )}
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                  <button onClick={() => window.print()} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-700 bg-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-300 transition-colors">
                    <Printer size={16} /> {t.printStock}
                  </button>
                  <button onClick={handleExportCSV} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-700 bg-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-300 transition-colors">
                    <Download size={16} /> {t.export}
                  </button>
                  <button onClick={() => { setEditingId(null); setNewItem({ type: "Car", status: "Available", price: 0 }); setIsModalOpen(true); }}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-semibold hover:from-blue-500 hover:to-purple-500 transition-all shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                    <Plus size={16} /> {t.addProduct}
                  </button>
                </div>
              </div>

              {/* Web Table View */}
              <div className="overflow-x-auto print:hidden">
                <table className="w-full text-left text-sm whitespace-nowrap" dir={isRTL ? "rtl" : "ltr"}>
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Image</th><th className="px-6 py-4">{t.brand}</th><th className="px-6 py-4">{t.plate}</th><th className="px-6 py-4">{t.price}</th><th className="px-6 py-4">{t.status}</th><th className="px-6 py-4 text-center">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredInventory.map((item) => (
                      <tr key={item.id} onClick={() => setDrawerItem(item)} className="hover:bg-slate-800/50 transition-colors group cursor-pointer">
                        <td className="px-6 py-4">
                          {item.image ? (
                            <img src={item.image} alt="Thumb" className="w-12 h-12 object-cover rounded-md border border-slate-700 shadow-sm" />
                          ) : (
                            <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-md flex items-center justify-center text-slate-600">
                              <ImageIcon size={20} />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-slate-800/50 p-2 rounded-lg text-blue-400 border border-slate-700/50 group-hover:border-blue-500/30 transition-colors">
                              {item.type === "Car" ? <Car size={18} /> : item.type === "Property" ? <Building size={18} /> : <Map size={18} />}
                            </div>
                            <span className="font-bold text-slate-200">{item.brandOrTitle}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-mono">{item.plateOrAddress}</td>
                        <td className="px-6 py-4 font-semibold text-emerald-400">{formatCurrency(item.price)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border flex w-fit items-center gap-1.5
                            ${item.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                              item.status === 'Rented' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                              item.status === 'Sold' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span> {t[item.status.toLowerCase() as keyof typeof t] || item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 flex justify-center gap-2">
                          <button onClick={(e) => handleEdit(e, item.id)} className="p-2 text-slate-400 hover:text-blue-400 bg-slate-900 border border-slate-700 rounded-md hover:border-blue-500/50 transition-all"><Edit size={16} /></button>
                          <button onClick={(e) => handleDelete(e, item.id)} className="p-2 text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-700 rounded-md hover:border-rose-500/50 transition-all"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PRINT-ONLY INVENTORY PDF TABLE */}
              <div className="hidden print:block bg-white text-black p-8 border border-slate-300 shadow-none m-0 w-full" dir={isRTL ? "rtl" : "ltr"}>
                <div className="text-center border-b-2 border-slate-800 pb-6 mb-6">
                  <h2 className="text-3xl font-black mb-2 text-slate-950 uppercase">{t.inventory} Report</h2>
                  <p className="text-sm font-semibold text-slate-600">Generated on: {new Date().toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'en-GB')}</p>
                </div>
                <table className="w-full text-left text-sm border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="border border-slate-300 p-3">Type</th>
                      <th className="border border-slate-300 p-3">Product Name</th>
                      <th className="border border-slate-300 p-3">License / Specs</th>
                      <th className="border border-slate-300 p-3">Price</th>
                      <th className="border border-slate-300 p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map(item => (
                      <tr key={item.id} className="border-b border-slate-200">
                        <td className="border border-slate-300 p-3 font-medium text-slate-600">{item.type}</td>
                        <td className="border border-slate-300 p-3 font-bold text-slate-900">{item.brandOrTitle}</td>
                        <td className="border border-slate-300 p-3 text-slate-700">{item.plateOrAddress}</td>
                        <td className="border border-slate-300 p-3 font-semibold text-slate-800">{formatCurrency(item.price)}</td>
                        <td className="border border-slate-300 p-3 text-center font-bold uppercase text-xs">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SIDE DRAWER FOR ITEM SPECS & HISTORY */}
            {drawerItem && (
              <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm print:hidden" onClick={() => setDrawerItem(null)}>
                <div className={`w-full max-w-md bg-slate-900 border-l border-slate-700 h-full overflow-y-auto shadow-2xl animate-in ${isRTL ? 'slide-in-from-left left-0 border-r border-l-0' : 'slide-in-from-right right-0'}`} onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900/90 backdrop-blur-md z-10">
                    <h2 className="text-xl font-bold flex items-center gap-2"><LayoutDashboard className="text-blue-500"/> Details & History</h2>
                    <button onClick={() => setDrawerItem(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-6">
                    {drawerItem.image && <img src={drawerItem.image} alt="Item" className="w-full h-48 object-cover rounded-xl border border-slate-700 shadow-md" />}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><p className="text-xs text-slate-500 mb-1">Status</p><p className="font-bold text-blue-400">{drawerItem.status}</p></div>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800"><p className="text-xs text-slate-500 mb-1">Price</p><p className="font-bold text-emerald-400">{formatCurrency(drawerItem.price)}</p></div>
                    </div>
                    
                    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                      <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 font-semibold text-sm">Parameters</div>
                      <div className="p-4 space-y-3 text-sm">
                        <p className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-medium">{drawerItem.type}</span></p>
                        <p className="flex justify-between"><span className="text-slate-500">Title</span><span className="font-medium">{drawerItem.brandOrTitle}</span></p>
                        <p className="flex justify-between"><span className="text-slate-500">Identifier</span><span className="font-medium">{drawerItem.plateOrAddress}</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL (ADD / EDIT) */}
            {isModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm print:hidden">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">{editingId ? t.editProduct : t.addProduct}</h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center hover:border-blue-500 transition-colors cursor-pointer relative overflow-hidden group">
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      {newItem.image ? (
                        <img src={newItem.image} alt="Preview" className="w-full h-32 object-contain rounded-md" />
                      ) : (
                        <div className="text-slate-500 flex flex-col items-center">
                          <FileUp size={28} className="mb-2 group-hover:text-blue-400 transition-colors" />
                          <p className="text-sm font-medium">Upload Image (Optional)</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Type</label>
                        <select value={newItem.type} onChange={e => setNewItem({...newItem, type: e.target.value as ItemType})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none">
                          <option value="Car">Car</option><option value="Property">Property</option><option value="Land">Land</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t.status}</label>
                        <select value={newItem.status} onChange={e => setNewItem({...newItem, status: e.target.value as ItemStatus})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none">
                          <option value="Available">Available</option><option value="Rented">Rented</option><option value="Sold">Sold</option><option value="Maintenance">Maintenance</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t.brand}</label>
                        <input type="text" placeholder="Title/Brand" value={newItem.brandOrTitle || ''} onChange={e => setNewItem({...newItem, brandOrTitle: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t.plate}</label>
                        <input type="text" placeholder="ID/Address" value={newItem.plateOrAddress || ''} onChange={e => setNewItem({...newItem, plateOrAddress: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t.price} (MAD)</label>
                      <input type="number" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>

                  </div>
                  <div className="mt-8 flex gap-3">
                    <button onClick={handleSaveProduct} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-semibold transition-colors shadow-[0_0_10px_rgba(37,99,235,0.4)]">{t.save}</button>
                    <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg font-semibold transition-colors">{t.cancel}</button>
                  </div>
                </div>
              </div>
            )}

            {/* SMART CONTRACTS & LEGAL DRAFTING (MODIFIED FOR FULL AR/EN/FR/ES SUPPORT) */}
            <div className={`${activeTab === 'contracts' ? 'block' : 'hidden'}`}>
              <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-800 shadow-2xl print:hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl border border-purple-500/30 text-purple-400"><Sparkles size={28} /></div>
                    <div><h2 className="text-2xl font-bold text-white">{t.aiHeader}</h2><p className="text-slate-400 text-sm mt-1">{t.aiSub}</p></div>
                  </div>
                  <div className="flex gap-4 items-center">
                    <label className="flex items-center gap-2 bg-slate-950 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors text-sm">
                      <ImageIcon size={16} /> 
                      {aiLang === 'ar' ? 'رفع الشعار' : aiLang === 'fr' ? 'Télécharger Logo' : aiLang === 'es' ? 'Subir Logo' : 'Upload Logo'}
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, true)} className="hidden" />
                    </label>
                    <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1">
                      {(["ar", "fr", "en", "es"] as const).map(l => (
                        <button key={l} onClick={() => setAiLang(l)} className={`px-4 py-1.5 text-xs font-bold rounded-md uppercase transition-all duration-300 ${aiLang === l ? "bg-slate-800 text-purple-400 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}>
                          {l === 'ar' ? 'العربية' : l === 'fr' ? 'Français' : l === 'en' ? 'English' : 'Español'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800/80 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">Contract Type</label>
                      <select value={contractType} onChange={e => setContractType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 outline-none">
                        <option value="car_rent">{t.carRent}</option><option value="car_sale">{t.carSale}</option>
                        <option value="prop_rent">{t.propRent}</option><option value="prop_sale">{t.propSale}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">Linked Asset</label>
                      <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 outline-none">
                        <option value="">-- Select Inventory Item --</option>
                        {inventory.map(i => <option key={i.id} value={i.id}>[{i.type}] {i.brandOrTitle} - {i.plateOrAddress}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input type="text" placeholder="First Party Name" value={cForm.p1Name} onChange={e => setCForm({...cForm, p1Name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 outline-none" />
                    <input type="text" placeholder="First Party ID" value={cForm.p1Id} onChange={e => setCForm({...cForm, p1Id: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 outline-none" />
                    <input type="text" placeholder="Second Party Name" value={cForm.p2Name} onChange={e => setCForm({...cForm, p2Name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 outline-none" />
                    <input type="text" placeholder="Second Party ID" value={cForm.p2Id} onChange={e => setCForm({...cForm, p2Id: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 outline-none" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">Price / المتفق عليه</label>
                      <input type="number" placeholder="الثمن / Price" value={cForm.price} onChange={e => setCForm({...cForm, price: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 outline-none" />
                    </div>
                    {contractType.includes('rent') && (
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2">Deposit / الضمانة (Caution)</label>
                        <input type="number" placeholder="مبلغ الضمانة" value={cForm.deposit} onChange={e => setCForm({...cForm, deposit: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 focus:ring-2 focus:ring-purple-500/50 outline-none" />
                      </div>
                    )}
                  </div>

                  {/* 1. VEHICLE FIELDS */}
                  {selectedItem?.type === 'Car' && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-slate-800/80 mt-4 animate-in fade-in duration-300">
                      <div className="col-span-2 md:col-span-1"><label className="block text-xs text-slate-400 mb-1">الماركة والموديل</label><input type="text" value={cForm.brandModel} onChange={e => setCForm({...cForm, brandModel: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">الموديل (سنة)</label><input type="text" value={cForm.year} onChange={e => setCForm({...cForm, year: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">اللون</label><input type="text" value={cForm.color} onChange={e => setCForm({...cForm, color: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">الوقود</label><select value={cForm.fuel} onChange={e => setCForm({...cForm, fuel: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200"><option>كازوال (Diesel)</option><option>بنزين (Essence)</option><option>كهربائي (Electric)</option></select></div>
                      <div><label className="block text-xs text-slate-400 mb-1">الكيلومترات</label><input type="text" value={cForm.mileage} onChange={e => setCForm({...cForm, mileage: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                    </div>
                  )}

                  {/* 3 & 4. REAL ESTATE FIELDS */}
                  {selectedItem?.type === 'Land' || (selectedItem?.type === 'Property' && selectedItem?.propType === 'Commercial') ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80 mt-4 animate-in fade-in duration-300">
                      <div><label className="block text-xs text-slate-400 mb-1">المساحة (متر مربع/هكتار)</label><input type="text" value={cForm.area} onChange={e => setCForm({...cForm, area: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                    </div>
                  ) : selectedItem?.type === 'Property' && selectedItem?.propType === 'Residential' ? (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 pt-4 border-t border-slate-800/80 mt-4 animate-in fade-in duration-300">
                      <div className="col-span-2"><label className="block text-xs text-slate-400 mb-1">المساحة الإجمالية</label><input type="text" placeholder="مثال: 120 م²" value={cForm.area} onChange={e => setCForm({...cForm, area: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">الطابق</label><input type="text" value={cForm.floorNum} onChange={e => setCForm({...cForm, floorNum: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">عدد الغرف</label><input type="number" value={cForm.rooms} onChange={e => setCForm({...cForm, rooms: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">حمامات</label><input type="number" value={cForm.bathrooms} onChange={e => setCForm({...cForm, bathrooms: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">بالكون</label><input type="number" value={cForm.balconies} onChange={e => setCForm({...cForm, balconies: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">مطبخ</label><input type="number" value={cForm.kitchen} onChange={e => setCForm({...cForm, kitchen: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                      <div><label className="block text-xs text-slate-400 mb-1">كاراج</label><input type="number" value={cForm.garage} onChange={e => setCForm({...cForm, garage: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-sm text-slate-200" /></div>
                    </div>
                  ) : null}

                  {/* 2. SCHEDULING RENTAL FIELDS */}
                  {contractType.includes('rent') && (
                    <div className="bg-blue-950/20 border border-blue-900/50 p-4 rounded-xl mt-4 animate-in fade-in duration-300">
                      <h4 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2"><Clock size={16}/> تواريخ وجدولة الكراء</h4>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-400 mb-1">تاريخ وساعة الدخول</label>
                          <div className="flex gap-2">
                            <input type="date" value={cForm.startDate} onChange={e => setCForm({...cForm, startDate: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200" />
                            <input type="time" value={cForm.startTime} onChange={e => setCForm({...cForm, startTime: e.target.value})} className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200" />
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-slate-400 mb-1">تاريخ وساعة الخروج</label>
                          <div className="flex gap-2">
                            <input type="date" value={cForm.endDate} onChange={e => setCForm({...cForm, endDate: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200" />
                            <input type="time" value={cForm.endTime} onChange={e => setCForm({...cForm, endTime: e.target.value})} className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200" />
                          </div>
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-xs font-semibold text-slate-400 mb-1">المدة الإجمالية</label>
                          <input type="text" placeholder="مثال: 3 أيام" value={cForm.duration} onChange={e => setCForm({...cForm, duration: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 flex justify-end gap-4">
                    {showGeneratedContract && (
                        <button onClick={handleDownloadPDF} className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3 rounded-xl font-medium transition-colors border border-emerald-500 shadow-lg">
                          <Download size={18} /> Download PDF
                        </button>
                    )}
                    <button onClick={handleGenerateContract} disabled={isGenerating || !selectedItemId}
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(147,51,234,0.4)] disabled:opacity-50 disabled:cursor-not-allowed">
                      {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <FileCheck size={20} />}
                      {isGenerating ? t.generating : t.generateContract}
                    </button>
                  </div>
                </div>
              </div>

              {/* VISUAL CONTRACT DOCUMENT ( PDF Generation) */}
              {showGeneratedContract && (
                <div className="mt-2 animate-in slide-in-from-bottom-8 fade-in duration-700 pb-2">
                  <div dir={aiLang === 'ar' ? 'rtl' : 'ltr'}
                    className="contract-print-zone mx-auto max-w-4xl"
                    style={{
                      fontFamily: aiLang === 'ar' ? "'Cairo', 'Segoe UI', serif" : "'Inter', 'Segoe UI', sans-serif",
                      backgroundColor: '#ffffff',
                      padding: '0.5rem',
                      borderRadius: '0.25rem',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                      border: '1px solid #e2e8f0',
                      color: '#0f172a',
                      background: 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
                      height: 'auto',
                      minHeight: 'auto'
                    }}>
                    
                    {/* Vibrant Header */}
                    <div className="print-header-spacing contract-header mb-2" style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          {contractLogo ? (
                            <img src={contractLogo} alt="Company Logo" style={{ 
                              height: '4rem', 
                              width: 'auto', 
                              objectFit: 'contain',
                              backgroundColor: '#ffffff',
                              borderRadius: '0.5rem',
                              padding: '0.5rem',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }} />
                          ) : (
                            <div style={{ 
                              height: '4rem', 
                              width: '4rem', 
                              backgroundColor: '#ffffff',
                              borderRadius: '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}>
                              <ShieldCheck size={32} style={{ color: '#2563eb' }} />
                            </div>
                          )}
                          <div>
                            <h2 className="text-2xl font-black mb-1" style={{ color: '#ffffff' }}>
                              {aiLang === 'ar' ? 'عقد رسمي' : aiLang === 'fr' ? 'Contrat Officiel' : aiLang === 'es' ? 'Contrato Oficial' : 'Official Contract'}
                            </h2>
                            <p className="contract-ref text-sm font-semibold" style={{ color: '#dbeafe' }}>
                              Ref: {Math.random().toString(36).substring(2, 9).toUpperCase()} | {new Date().toLocaleDateString(aiLang === 'ar' ? 'ar-MA' : 'en-GB')}
                            </p>
                          </div>
                        </div>
                        {selectedItem?.image && (
                          <img src={selectedItem.image} alt="Asset Thumbnail" className="h-20 w-28 object-cover rounded-lg shadow-md" style={{ 
                            height: '5rem',
                            width: '7rem',
                            objectFit: 'cover',
                            borderRadius: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            border: '2px solid rgba(255, 255, 255, 0.3)'
                          }} />
                        )}
                      </div>
                    </div>
                    
                    {/* Contract Title with Gradient */}
                    <div className="print-header-spacing text-center mb-2">
                      <h2 className="text-xl font-black mb-1 uppercase" style={{
                        background: 'linear-gradient(to right, #2563eb, #9333ea)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }}>
                        {t[contractType as keyof typeof t]}
                      </h2>
                      <div className="w-20 h-0.5 mx-auto rounded-full" style={{ background: 'linear-gradient(to right, #3b82f6, #a855f7)' }}></div>
                    </div>

                    {/* Contract Content */}
                    <div className="text-base leading-7">
                      {renderLegalText()}
                      
                      {/* Signature Block */}
                      <div className="sig-block mt-6 pt-4 flex justify-between gap-6 px-4 rounded-lg" style={{
                        borderTop: '2px solid #cbd5e1',
                        backgroundColor: '#f8fafc'
                      }}>
                        <div className="text-center flex-1">
                          <div className="h-20 mb-4" style={{ borderBottom: '2px dashed #94a3b8' }}></div>
                          <h4 className="sig-space font-bold text-base" style={{ color: '#334155' }}>
                            {aiLang === 'ar' ? 'توقيع الطرف الأول' : aiLang === 'fr' ? 'Signature (Première Partie)' : aiLang === 'es' ? 'Firma (Primera Parte)' : 'Signature (First Party)'}
                          </h4>
                          <p className="text-sm mt-1" style={{ color: '#64748b' }}>{cForm.p1Name}</p>
                        </div>
                        <div className="text-center flex-1">
                          <div className="h-20 mb-4" style={{ borderBottom: '2px dashed #94a3b8' }}></div>
                          <h4 className="sig-space font-bold text-base" style={{ color: '#334155' }}>
                            {aiLang === 'ar' ? 'توقيع الطرف الثاني' : aiLang === 'fr' ? 'Signature (Deuxième Partie)' : aiLang === 'es' ? 'Firma (Segunda Parte)' : 'Signature (Second Party)'}
                          </h4>
                          <p className="text-sm mt-1" style={{ color: '#64748b' }}>{cForm.p2Name}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACCOUNTING & FINANCIAL MATRICES */}
            <div className={`${activeTab === 'accounting' ? 'block' : 'hidden'} space-y-6 animate-in fade-in duration-500`}>
              <div className="flex justify-between items-center print:hidden">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><Calculator size={24} /></div>
                  <h2 className="text-2xl font-bold text-white">{t.accounting} <span className="text-slate-500 text-lg font-medium">| {t.inOut}</span></h2>
                </div>
                <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors border border-slate-700 shadow-sm">
                  <Printer size={18} /> {t.exportBilan}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
                <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-8 flex flex-col justify-center items-center text-center shadow-[0_0_20px_rgba(16,185,129,0.05)] relative overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
                  <div className="absolute top-0 w-full h-1 bg-emerald-500 print:hidden"></div>
                  <span className="text-emerald-400/80 font-bold mb-2 uppercase tracking-wider text-sm print:text-slate-500">{t.revenue}</span>
                  <span className="text-3xl lg:text-4xl font-black text-emerald-400 print:text-emerald-700">{formatCurrency(stats.incomeToday)}</span>
                </div>
                <div className="bg-rose-950/30 border border-rose-900/50 rounded-2xl p-8 flex flex-col justify-center items-center text-center shadow-[0_0_20px_rgba(244,63,94,0.05)] relative overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
                  <div className="absolute top-0 w-full h-1 bg-rose-500 print:hidden"></div>
                  <span className="text-rose-400/80 font-bold mb-2 uppercase tracking-wider text-sm print:text-slate-500">{t.expenses}</span>
                  <span className="text-3xl lg:text-4xl font-black text-rose-400 print:text-rose-700">{formatCurrency(stats.expensesToday)}</span>
                </div>
                <div className="bg-blue-950/30 border border-blue-900/50 rounded-2xl p-8 flex flex-col justify-center items-center text-center shadow-[0_0_20px_rgba(59,130,246,0.05)] relative overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
                  <div className="absolute top-0 w-full h-1 bg-blue-500 print:hidden"></div>
                  <span className="text-blue-400/80 font-bold mb-2 uppercase tracking-wider text-sm print:text-slate-500">{t.cashflow}</span>
                  <span className="text-3xl lg:text-4xl font-black text-blue-400 print:text-blue-700">{formatCurrency(stats.cashflow)}</span>
                </div>
              </div>

              {/* Printable Bilan Detailed View */}
              <div className="hidden print:block mt-12 bg-white text-black p-8 border border-slate-200">
                <h2 className="text-2xl font-bold mb-6 text-center border-b pb-4">Bilan Financier / Financial Statement ({new Date().toLocaleDateString()})</h2>
                <table className="w-full text-left text-sm border-collapse">
                  <thead><tr className="bg-slate-100"><th className="border p-3">Date</th><th className="border p-3">Description</th><th className="border p-3">Type</th><th className="border p-3 text-right">Amount</th></tr></thead>
                  <tbody>
                    <tr><td className="border p-3">{new Date().toLocaleDateString()}</td><td className="border p-3">Total Income (Sales/Rentals)</td><td className="border p-3 text-emerald-600 font-bold">Income</td><td className="border p-3 text-right">{formatCurrency(stats.incomeToday)}</td></tr>
                    <tr><td className="border p-3">{new Date().toLocaleDateString()}</td><td className="border p-3">Estimated Expenses (Maintenance/etc)</td><td className="border p-3 text-rose-600 font-bold">Expense</td><td className="border p-3 text-right">{formatCurrency(stats.expensesToday)}</td></tr>
                    <tr className="font-bold bg-slate-50"><td colSpan={3} className="border p-3 text-right">Net Cashflow / Trésorerie Nette :</td><td className="border p-3 text-right text-blue-600">{formatCurrency(stats.cashflow)}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* INVOICE DRAG-AND-DROP */}
              <div 
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }} 
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }} 
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} 
                onDrop={handleDrop}
                className={`print:hidden mt-8 bg-slate-900/40 rounded-2xl p-8 lg:p-12 text-center border-2 border-dashed transition-all duration-300 relative
                  ${dragActive ? "border-blue-500 bg-blue-950/20" : "border-slate-700 hover:border-slate-600"}`}>
                
                <input type="file" id="dropzone-file" className="hidden" accept=".pdf,.xls,.xlsx,.jpg,.png" onChange={(e) => { handleFileInput(e); e.target.value = ""; }} />
                
                <div className="pointer-events-none mb-6">
                  <FileUp className={`mx-auto mb-4 transition-colors ${dragActive ? "text-blue-400" : "text-slate-500"}`} size={48} />
                  <h3 className="text-xl font-bold text-white mb-2">{t.dropzoneText}</h3>
                  <p className="text-sm text-slate-400">Support for Invoices: PDF, Excel, JPG, PNG files.</p>
                </div>
                
                <label htmlFor="dropzone-file" className="cursor-pointer inline-flex items-center gap-2 bg-slate-800 border border-slate-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm hover:bg-slate-700 transition-colors">
                  Browse Files
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="mt-8 space-y-3 text-left">
                    {uploadedFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-sm hover:border-slate-700 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="bg-blue-500/10 p-3 rounded-lg text-blue-400">
                            <FileText size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white line-clamp-1">{f.name}</p>
                            <p className="text-xs font-mono text-slate-400 mt-0.5">{(f.size / 1024 / 1024).toFixed(2)} MB • {f.type || 'Document'}</p>
                          </div>
                        </div>
                        <button onClick={() => window.open(f.url, '_blank')} className="flex shrink-0 items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm transition-colors border border-slate-600 font-semibold">
                          <ExternalLink size={16} /> Review File / معاينة الملف
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <GlobalAiAssistant
          section="real_estate"
          context="Real Estate & Auto Management - Property listings, vehicle inventory, contracts, and sales"
          availableFields={["property_title", "address", "price", "status", "contract_type"]}
        />
      </main>
    </div>
  );
}