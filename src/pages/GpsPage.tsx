import { useState, useEffect } from "react";
import { MapPin, RefreshCw, ExternalLink, Truck, User, Package, FileSignature, Users, UserCheck, UserX, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { GpsDashboard } from "@/components/GpsDashboard";

interface ActivePerson {
  id: string;
  name: string;
  context: string;
  phone?: string;
  employeeId?: string;
  lastLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
  isOnline: boolean;
}

export function GpsPage() {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activePersons, setActivePersons] = useState<ActivePerson[]>([]);
  const [loadingPersons, setLoadingPersons] = useState(true);

  const fetchActivePersons = async () => {
    if (!token) return;
    try {
      setLoadingPersons(true);
      const response = await fetch('/api/gps/active-persons', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setActivePersons(data.persons || []);
      }
    } catch (err) {
      console.error('Failed to fetch active persons:', err);
    } finally {
      setLoadingPersons(false);
    }
  };

  useEffect(() => {
    fetchActivePersons();
    const interval = setInterval(fetchActivePersons, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [token]);

  const openPersonLocation = (person: ActivePerson) => {
    if (person.lastLocation) {
      window.open(`https://www.google.com/maps?q=${person.lastLocation.latitude},${person.lastLocation.longitude}`, "_blank");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="space-y-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#0a1628] to-[#050a12] p-6">
        <div className="flex items-center gap-2">
          <MapPin className="size-6 text-emerald-400" />
          <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-l from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
            {t("nav.gpsTracking")}
          </h1>
        </div>
        <p className="text-slate-400 text-sm max-w-2xl">
          {t("gps.pageDescription") || "Real-time GPS tracking for all active contexts: Transport & Logistics, POS Agent, Delivery Hub, and Contracts"}
        </p>
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="gap-2 border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/20"
          >
            <RefreshCw className="size-4" />
            {t("common.refresh")}
          </Button>
        </div>
      </header>

      <Card className="border-emerald-500/25 bg-[#0a1628]/90">
        <CardHeader className="border-b border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="size-5 text-emerald-400" />
              <p className="font-black text-white">{t("gps.yourLocation") || "Your Location"}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <GpsDashboard
            key={refreshKey}
            context="all"
            token={token}
            enableDelete={true}
            isCurrentUser={true}
            refreshKey={refreshKey}
          />
        </CardContent>
      </Card>

      {/* Active Persons List - Temporarily disabled due to database issue */}
      {false && (
      <Card className="border-purple-500/25 bg-[#0a1628]/90">
        <CardHeader className="border-b border-purple-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-purple-400" />
              <p className="font-black text-white">{t("gps.activePersons") || "الأشخاص النشطين للتتبع"}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchActivePersons}
              className="gap-2 border-purple-500/30 text-purple-300 hover:bg-purple-950/20"
            >
              <RefreshCw className="size-4" />
              {t("common.refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loadingPersons ? (
            <div className="text-center text-slate-400 py-8">
              {t("common.loading") || "جاري التحميل..."}
            </div>
          ) : activePersons.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              {t("gps.noActivePersons") || "لا يوجد أشخاص نشطين حالياً"}
            </div>
          ) : (
            <div className="space-y-3">
              {activePersons.map((person) => (
                <div
                  key={person.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all hover:scale-[1.02] ${
                    person.isOnline
                      ? 'bg-emerald-950/30 border-emerald-500/50 hover:bg-emerald-950/50'
                      : 'bg-red-950/30 border-red-500/50 hover:bg-red-950/50'
                  }`}
                  onClick={() => openPersonLocation(person)}
                >
                  <div className={`size-10 rounded-full flex items-center justify-center ${
                    person.isOnline ? 'bg-emerald-500' : 'bg-red-500'
                  }`}>
                    {person.isOnline ? <UserCheck className="size-5 text-white" /> : <UserX className="size-5 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white">{person.name}</p>
                      {person.phone && <span className="text-xs text-slate-400">{person.phone}</span>}
                    </div>
                    <p className="text-xs text-slate-400">
                      {person.context === 'magic-link-tl' ? '🚚 النقل واللوجستيات' :
                       person.context === 'pos-agent' ? '📱 وكيل نقطة البيع' :
                       person.context === 'delivery-hub' ? '📦 رادار الطلبات' :
                       person.context === 'contract-signing' ? '✍️ التوقيع الإلكتروني' :
                       person.context}
                    </p>
                    {person.lastLocation && (
                      <p className="text-xs text-slate-400 mt-1">
                        {person.isOnline ? '🟢 متصل - ' : '🔴 غير متصل - '}
                        آخر تحديث: {new Date(person.lastLocation.timestamp / 1000).toLocaleString('ar-MA')}
                      </p>
                    )}
                  </div>
                  {person.lastLocation && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-emerald-400 hover:text-emerald-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPersonLocation(person);
                      }}
                    >
                      <Navigation className="size-5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader className="border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MapPin className="size-5 text-slate-400" />
            <p className="font-black text-white">{t("gps.activeContexts") || "السياقات النشطة - روابط التتبع المباشر"}</p>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <a href="/app/tl" className="rounded-xl border border-blue-500/25 bg-blue-950/20 p-4 hover:bg-blue-950/40 transition-colors block">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-blue-200 text-sm flex items-center gap-2">
                  <Truck className="size-4" />
                  {t("tl.dept.transport")}
                </h3>
                <ExternalLink className="size-4 text-blue-400" />
              </div>
              <p className="text-xs text-slate-400">{t("gps.transportDesc") || "تتبع المركبات والموظفين عبر الروابط السحرية"}</p>
            </a>
            <a href="/app/pos-agent" className="rounded-xl border border-purple-500/25 bg-purple-950/20 p-4 hover:bg-purple-950/40 transition-colors block">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-purple-200 text-sm flex items-center gap-2">
                  <User className="size-4" />
                  {t("gps.posAgent") || "وكيل نقطة البيع"}
                </h3>
                <ExternalLink className="size-4 text-purple-400" />
              </div>
              <p className="text-xs text-slate-400">{t("gps.posDesc") || "تتبع الممثلين الميدانيين في زيارات المبيعات"}</p>
            </a>
            <a href="/app/delivery-hub" className="rounded-xl border border-orange-500/25 bg-orange-950/20 p-4 hover:bg-orange-950/40 transition-colors block">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-orange-200 text-sm flex items-center gap-2">
                  <Package className="size-4" />
                  {t("nav.deliveryHub")}
                </h3>
                <ExternalLink className="size-4 text-orange-400" />
              </div>
              <p className="text-xs text-slate-400">{t("gps.deliveryDesc") || "تتبع طلبات التوصيل ومواقع العملاء"}</p>
            </a>
            <a href="/app/contracts" className="rounded-xl border border-green-500/25 bg-green-950/20 p-4 hover:bg-green-950/40 transition-colors block">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-green-200 text-sm flex items-center gap-2">
                  <FileSignature className="size-4" />
                  {t("nav.contracts")}
                </h3>
                <ExternalLink className="size-4 text-green-400" />
              </div>
              <p className="text-xs text-slate-400">{t("gps.contractDesc") || "تتبع الموقعين أثناء توقيع العقود"}</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
