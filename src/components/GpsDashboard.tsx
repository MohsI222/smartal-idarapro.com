/** GPS Dashboard with Interactive Map and Movement History */
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from "react-leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Clock, Navigation, RefreshCw, AlertTriangle, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface GpsPoint {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  context: string;
  accuracy?: number;
}

interface GpsDashboardProps {
  publicLinkId?: string;
  workerId?: string;
  phoneNumber?: string;
  context: string;
  token?: string;
  enableDelete?: boolean; // Enable delete functionality
  isCurrentUser?: boolean; // If true, fetch current user's GPS data
  refreshKey?: number; // Force refresh when this changes
}

export function GpsDashboard({ publicLinkId, workerId, phoneNumber, context, token, enableDelete = false, isCurrentUser = false, refreshKey = 0 }: GpsDashboardProps) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<GpsPoint[]>([]);
  const [latest, setLatest] = useState<GpsPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([33.5731, -7.5898]); // Default: Casablanca
  const [deleting, setDeleting] = useState<string | null>(null);

  // Delete single GPS point
  const deletePoint = async (pointId: string) => {
    if (!token) return;
    setDeleting(pointId);
    try {
      const response = await fetch('/api/gps/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id: pointId }),
      });
      if (response.ok) {
        setHistory(history.filter(p => p.id !== pointId));
        if (latest?.id === pointId) {
          setLatest(history.length > 1 ? history[history.length - 2] : null);
        }
        toast.success("تم حذف النقطة بنجاح");
      }
    } catch (err) {
      console.error('Failed to delete GPS point:', err);
      toast.error("فشل حذف النقطة");
    } finally {
      setDeleting(null);
    }
  };

  // Delete all GPS points
  const deleteAll = async () => {
    if (!token) return;
    if (!confirm("هل أنت متأكد من حذف جميع نقاط GPS؟")) return;
    setDeleting('all');
    try {
      const response = await fetch('/api/gps/delete-all', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          worker_id: workerId,
          public_link_id: publicLinkId,
        }),
      });
      if (response.ok) {
        setHistory([]);
        setLatest(null);
        toast.success("تم حذف جميع النقاط بنجاح");
      }
    } catch (err) {
      console.error('Failed to delete all GPS points:', err);
      toast.error("فشل حذف جميع النقاط");
    } finally {
      setDeleting(null);
    }
  };

  // Determine which ID to use
  const id = phoneNumber || workerId || publicLinkId || '';
  const usePhoneEndpoint = !!phoneNumber;
  const useWorkerEndpoint = !!workerId;

  // Load from localStorage first (fast display)
  useEffect(() => {
    let cacheKey: string;
    if (isCurrentUser) {
      cacheKey = `gps_user_current`;
    } else if (phoneNumber) {
      cacheKey = `gps_phone_${phoneNumber}`;
    } else if (workerId) {
      cacheKey = `gps_worker_${workerId}`;
    } else {
      cacheKey = `gps_history_${publicLinkId}`;
    }

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setHistory(data.history || []);
        setLatest(data.latest || null);
        if (data.latest) {
          setMapCenter([data.latest.latitude, data.latest.longitude]);
        }
      } catch (err) {
        console.error('[GPS Dashboard] Failed to load from localStorage:', err);
      }
    }
  }, [publicLinkId, workerId, phoneNumber, isCurrentUser]);

  // Fetch from server
  const fetchGpsData = async () => {
    try {
      setLoading(true);
      let response;

      if (isCurrentUser) {
        // Use user endpoint for current authenticated user
        response = await fetch('/api/gps/user', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
      } else if (usePhoneEndpoint) {
        // Use phone endpoint for delivery hub orders
        response = await fetch(`/api/gps/phone/${id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
      } else if (useWorkerEndpoint) {
        // Use worker endpoint for Transport & Logistics workers
        response = await fetch(`/api/gps/worker/${id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
      } else {
        // Use public link endpoint for public links
        response = await fetch(`/api/gps/public/${id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
      }

      const data = await response.json();

      if (isCurrentUser) {
        // User endpoint returns { history, latest }
        setLatest(data.latest);
        setHistory(data.history || []);
        if (data.latest) {
          setMapCenter([data.latest.latitude, data.latest.longitude]);
        }

        // Save to localStorage
        localStorage.setItem('gps_user_current', JSON.stringify({
          latest: data.latest,
          history: data.history || [],
          cachedAt: Date.now(),
        }));

        setError(null);
      } else if (data.location) {
        setLatest(data.location);
        setMapCenter([data.location.latitude, data.location.longitude]);

        // Fetch history (only for public links, not workers or phones for now)
        if (!useWorkerEndpoint && !usePhoneEndpoint) {
          const historyResponse = await fetch(`/api/gps/history/${id}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          });
          const historyData = await historyResponse.json();
          setHistory(historyData.history || []);
        } else {
          // For workers or phones, just show the latest point as history
          setHistory([data.location]);
        }

        // Save to localStorage
        let cacheKey: string;
        if (phoneNumber) {
          cacheKey = `gps_phone_${phoneNumber}`;
        } else if (workerId) {
          cacheKey = `gps_worker_${workerId}`;
        } else {
          cacheKey = `gps_history_${publicLinkId}`;
        }

        localStorage.setItem(cacheKey, JSON.stringify({
          latest: data.location,
          history: (useWorkerEndpoint || usePhoneEndpoint) ? [data.location] : (data.history || []),
          cachedAt: Date.now(),
        }));

        setError(null);
      } else if (isCurrentUser) {
        // User endpoint case
        setLatest(null);
        setHistory([]);
        setError(t("gps.noData") || "No GPS data available yet");
      } else {
        setError(t("gps.noData") || "No GPS data available yet");
      }
    } catch (err) {
      console.error('[GPS Dashboard] Error fetching GPS:', err);
      setError("Failed to fetch GPS data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGpsData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchGpsData, 30000);
    return () => clearInterval(interval);
  }, [publicLinkId, workerId, phoneNumber, isCurrentUser, refreshKey]);

  const formatTime = (timestamp: number) => {
    try {
      // Handle different timestamp formats
      let normalizedTimestamp = timestamp;

      // If timestamp is in microseconds (very large number > 10000000000000), convert to milliseconds
      if (timestamp > 10000000000000) {
        normalizedTimestamp = timestamp / 1000;
      }
      // If timestamp is in seconds (smaller than 10000000000), convert to milliseconds
      else if (timestamp < 10000000000) {
        normalizedTimestamp = timestamp * 1000;
      }
      // Otherwise, assume it's already in milliseconds

      const date = new Date(normalizedTimestamp);
      if (isNaN(date.getTime())) {
        return "—";
      }
      return date.toLocaleString(locale || 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return "—";
    }
  };

  const formatDate = (timestamp: number) => {
    try {
      // Handle different timestamp formats
      let normalizedTimestamp = timestamp;

      // If timestamp is in microseconds (very large number > 10000000000000), convert to milliseconds
      if (timestamp > 10000000000000) {
        normalizedTimestamp = timestamp / 1000;
      }
      // If timestamp is in seconds (smaller than 10000000000), convert to milliseconds
      else if (timestamp < 10000000000) {
        normalizedTimestamp = timestamp * 1000;
      }
      // Otherwise, assume it's already in milliseconds

      const date = new Date(normalizedTimestamp);
      if (isNaN(date.getTime())) {
        return "—";
      }
      return date.toLocaleDateString(locale || 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return "—";
    }
  };

  const getAgeInMinutes = (timestamp: number) => {
    let normalizedTimestamp = timestamp;
    // If timestamp is in microseconds (very large number > 10000000000000), convert to milliseconds
    if (timestamp > 10000000000000) {
      normalizedTimestamp = timestamp / 1000;
    }
    // If timestamp is in seconds (smaller than 10000000000), convert to milliseconds
    else if (timestamp < 10000000000) {
      normalizedTimestamp = timestamp * 1000;
    }
    const diff = Date.now() - normalizedTimestamp;
    return Math.floor(diff / 60000);
  };

  const translateContext = (ctx: string) => {
    const contextMap: Record<string, string> = {
      'magic-link-tl': t("gps.context.magicLinkTl") || ctx,
      'pos-agent': t("gps.context.posAgent") || ctx,
      'delivery-hub': t("gps.context.deliveryHub") || ctx,
      'contract-signing': t("gps.context.contractSigning") || ctx,
      'public-store': t("gps.context.publicStore") || ctx,
    };
    return contextMap[ctx] || ctx;
  };

  if (loading && !latest) {
    return (
      <Card className="border-gradient-blue-purple bg-gradient-to-br from-slate-900 to-slate-800">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-blue-400" />
          <span className="ml-3 text-slate-300">{t("common.loading") || "Loading GPS data..."}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Latest Location Card */}
      <Card className="border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-950/30 to-slate-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-emerald-300 flex items-center gap-2">
              <MapPin className="size-5" />
              {t("gps.lastLocation") || "آخر موقع"}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchGpsData}
              className="border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20"
            >
              <RefreshCw className="size-4 mr-2" />
              {t("common.refresh") || "تحديث"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {latest ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">{t("gps.latitude") || "خط العرض"}</p>
                  <p className="text-lg font-bold text-white font-mono">{latest.latitude.toFixed(6)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">{t("gps.longitude") || "خط الطول"}</p>
                  <p className="text-lg font-bold text-white font-mono">{latest.longitude.toFixed(6)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-500/20 rounded-lg p-3">
                  <p className="text-xs text-blue-300 mb-1">{t("gps.accuracy") || "الدقة"}</p>
                  <p className="text-sm font-bold text-white">{latest.accuracy ? `${latest.accuracy.toFixed(0)}m` : 'N/A'}</p>
                </div>
                <div className="bg-purple-500/20 rounded-lg p-3">
                  <p className="text-xs text-purple-300 mb-1">{t("gps.context") || "السياق"}</p>
                  <p className="text-sm font-bold text-white">{translateContext(latest.context)}</p>
                </div>
                <div className="bg-amber-500/20 rounded-lg p-3">
                  <p className="text-xs text-amber-300 mb-1">{t("gps.ago") || "منذ"}</p>
                  <p className="text-sm font-bold text-white">{getAgeInMinutes(latest.timestamp)} {t("gps.minutes") || "دقيقة"}</p>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">{t("gps.lastUpdate") || "آخر تحديث"}</p>
                <p className="text-sm text-white">{formatDate(latest.timestamp)} - {formatTime(latest.timestamp)}</p>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                onClick={() => window.open(`https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`, "_blank")}
              >
                <Navigation className="size-4 mr-2" />
                {t("gps.openGoogleMaps") || "فتح في خرائط جوجل"}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="size-12 text-amber-400 mx-auto mb-3" />
              <p className="text-slate-300">{error || (t("gps.noData") || "لا توجد بيانات GPS بعد")}</p>
              <p className="text-xs text-slate-500 mt-2">{t("gps.waitingForUser") || "انتظر حتى يفتح المستخدم الرابط"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interactive Map */}
      {latest && (
        <Card className="border-2 border-blue-500/50 bg-gradient-to-br from-blue-950/30 to-slate-900">
          <CardHeader>
            <CardTitle className="text-blue-300 flex items-center gap-2">
              <Navigation className="size-5" />
              {t("gps.interactiveMap") || "الخريطة التفاعلية"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] rounded-xl overflow-hidden border border-slate-700">
              <MapContainer
                center={mapCenter}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                className="bg-slate-900"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {latest && (
                  <Marker position={[latest.latitude, latest.longitude]}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold">{t("gps.lastLocation") || "آخر موقع"}</p>
                        <p>Lat: {latest.latitude.toFixed(6)}</p>
                        <p>Lng: {latest.longitude.toFixed(6)}</p>
                        <p>{formatTime(latest.timestamp)}</p>
                      </div>
                    </Popup>
                  </Marker>
                )}
                {history.length > 1 && (
                  <Polyline
                    positions={history.map(p => [p.latitude, p.longitude])}
                    color="#10b981"
                    weight={3}
                    opacity={0.7}
                  />
                )}
                {history.map((point, idx) => (
                  <CircleMarker
                    key={point.id}
                    center={[point.latitude, point.longitude]}
                    radius={5}
                    color={idx === history.length - 1 ? "#10b981" : "#3b82f6"}
                    fillColor={idx === history.length - 1 ? "#10b981" : "#3b82f6"}
                    fillOpacity={0.5}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold">{t("gps.point") || "نقطة"} {idx + 1}</p>
                        <p>{formatTime(point.timestamp)}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movement History */}
      {history.length > 0 && (
        <Card className="border-2 border-purple-500/50 bg-gradient-to-br from-purple-950/30 to-slate-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-purple-300 flex items-center gap-2">
                <Clock className="size-5" />
                {t("gps.movementHistory") || "تاريخ الحركة"} ({history.length} {t("gps.points") || "نقطة"})
              </CardTitle>
              {enableDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={deleteAll}
                  disabled={deleting === 'all'}
                >
                  {deleting === 'all' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  حذف الكل
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {history.slice().reverse().map((point, idx) => (
                <div
                  key={point.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    idx === 0 ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-slate-800/50'
                  }`}
                >
                  <div className={`size-3 rounded-full ${
                    idx === 0 ? 'bg-emerald-400' : 'bg-purple-400'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">
                      {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(point.timestamp)} - {formatTime(point.timestamp)}
                    </p>
                  </div>
                  {point.accuracy && (
                    <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
                      {point.accuracy.toFixed(0)}m
                    </span>
                  )}
                  {enableDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deletePoint(point.id)}
                      disabled={deleting === point.id}
                    >
                      {deleting === point.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
