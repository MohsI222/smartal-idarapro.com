import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Store,
  MapPin,
  Phone,
  Search,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase as sharedSupabase } from "@/lib/supabaseClient";

interface Store {
  id: string;
  name: string;
  slug: string;
  category: string;
  logo_url: string | null;
  banner_url: string | null;
  phone: string | null;
  address: string | null;
  delivery_range_km: number;
  is_active: boolean;
}

const STORE_CATEGORIES = [
  'المطاعم',
  'الخضر والفواكه',
  'البقالة/السخرة',
  'الخدمات',
  'أخرى'
];

export function StoreDirectory() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      if (!sharedSupabase) {
        throw new Error("supabase_not_configured");
      }

      const { data, error } = await sharedSupabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast.error(error instanceof Error && error.message === 'supabase_not_configured'
        ? 'ربط Supabase غير مهيأ لهذا القسم'
        : 'حدث خطأ أثناء تحميل المتاجر');
    } finally {
      setLoading(false);
    }
  };

  const filteredStores = stores.filter(store => {
    const matchesSearch = store.name.toLowerCase().includes(search.toLowerCase()) ||
                        store.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || store.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#050a12] via-[#0a1628] to-[#050a12] flex items-center justify-center">
        <div className="text-white text-lg">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050a12] via-[#0a1628] to-[#050a12] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a1628]/95 backdrop-blur-xl border-b border-slate-800 px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-4 bg-gradient-to-r from-[#FF8C00] to-[#0052CC] bg-clip-text text-transparent">
            استكشف المتاجر
          </h1>
          
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 size-5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن متجر أو فئة..."
              className="w-full rounded-xl border border-slate-700 bg-[#050a12] pl-12 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/50"
            />
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-[#0052CC] text-white'
                  : 'bg-[#0a1628]/50 text-slate-400 hover:bg-white/5'
              }`}
            >
              الكل
            </button>
            {STORE_CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setCategoryFilter(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  categoryFilter === category
                    ? 'bg-[#0052CC] text-white'
                    : 'bg-[#0a1628]/50 text-slate-400 hover:bg-white/5'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Store Grid */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {filteredStores.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Store className="size-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد متاجر مطابقة لبحثك</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStores.map((store) => (
              <Link
                key={store.id}
                to={`/m/${store.slug}`}
                className="group block"
              >
                <div className="rounded-xl border border-slate-800 bg-[#0a1628]/50 overflow-hidden hover:border-[#0052CC]/50 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-[#0052CC]/10">
                  {/* Banner */}
                  {store.banner_url ? (
                    <img
                      src={store.banner_url}
                      alt={store.name}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-gradient-to-br from-[#0052CC]/20 to-[#FF8C00]/20" />
                  )}

                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      {store.logo_url ? (
                        <img
                          src={store.logo_url}
                          alt={store.name}
                          className="w-16 h-16 rounded-lg object-cover border border-slate-700"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#0052CC] to-[#FF8C00] flex items-center justify-center text-2xl font-bold">
                          {store.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white mb-1 truncate">{store.name}</h3>
                        <span className="inline-block px-2 py-1 rounded-full text-xs bg-[#0052CC]/20 text-[#0052CC]">
                          {store.category}
                        </span>
                      </div>
                    </div>

                    {store.address && (
                      <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                        <MapPin className="size-4 shrink-0" />
                        <span className="truncate">{store.address}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="size-4" />
                        <span>نطاق التوصيل: {store.delivery_range_km} كم</span>
                      </div>
                      {store.phone && (
                        <a
                          href={`tel:${store.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[#0052CC] hover:text-[#0052CC]/80"
                        >
                          <Phone className="size-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
