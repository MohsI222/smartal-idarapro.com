import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ALL_SAAS_MODULE_IDS, TRIAL_MODULE_IDS } from "@/constants/plans";
import { PUBLIC_SUPER_ADMIN_EMAIL } from "@/constants/publicSuperAdmin";
import { isPrimaryAdminClient } from "@/lib/adminClient";
import { api, ApiError, getDeviceFingerprint } from "@/lib/api";
import { setTrialWatermarkExport } from "@/lib/exportPolicy";


function mapApiError(err: unknown): string {
  if (!(err instanceof Error)) return "خطأ غير معروف";
  /** أخطاء واضحة من الخادم (كلمة مرور، صيغة…) — لا نستبدلها برسالة عامة */
  if (err instanceof ApiError) {
    const st = err.status;
    const msg = err.message;
    if (st === 401 || st === 400 || st === 403 || st === 422 || st === 429) {
      return msg;
    }
    if (st === 500 || st === 502 || st === 504) {
      const lower = (msg || "").toLowerCase();
      if (lower.includes("internal server error") || msg === "") {
        return "خطأ في الخادم — تحقق من اتصال قاعدة البيانات والمتغيرات على الخادم.";
      }
      return msg;
    }
    if (st === 503) {
      return msg.includes("قاعدة البيانات") ? msg : "الخادم مشغول أو قاعدة البيانات غير متاحة — حاول لاحقاً.";
    }
    if (msg.includes("Received HTML") || msg.includes("VITE_API_URL")) {
      return "خادم التطبيق غير متاح حالياً — تحقق من إعدادات النشر أو تواصل مع الدعم.";
    }
    return msg;
  }
  const m = err.message;
  if (
    m.includes("Received HTML") ||
    m.includes("VITE_API_URL") ||
    m.includes("Failed to fetch") ||
    m.includes("NetworkError") ||
    m.includes("Load failed") ||
    m.includes("Network request failed") ||
    m.toLowerCase().includes("cors")
  ) {
    if (import.meta.env.DEV) {
      return "الخادم الخلفي غير يعمل أو البروكسي لا يصل — نفّذ من الجذر: npm run dev (يجب أن يعمل Express على المنفذ 4000 وليس vite وحده).";
    }
    return "خادم التطبيق غير متاح حالياً — تحقق من إعدادات النشر أو تواصل مع الدعم.";
  }
  return m;
}

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  whatsapp?: string | null;
  referral_code?: string | null;
  trial_ends_at?: string | null;
  visa_unlock_approved?: number | boolean;
  visa_unlock_requested_at?: string | null;
  account_locked?: boolean;
  /** رصيد تجريبي للاختبار والذكاء الاصطناعي (افتراضي الخادم 1000) */
  trial_balance?: number;
};

export type SubscriptionRow = {
  id: string;
  plan_id: string;
  modules: string;
  payment_method: string;
  status: string;
  created_at: string;
  ends_at?: string | null;
};

type MeResponse = {
  user: User;
  subscription: SubscriptionRow | null;
  devices: { id: string; fingerprint: string; label: string | null; last_seen: string }[];
  maxDevices: number;
};

type AuthContextValue = {
  token: string | null;
  user: User | null;
  subscription: SubscriptionRow | null;
  devices: MeResponse["devices"];
  maxDevices: number;
  loading: boolean;
  refresh: () => Promise<void>;
  /** يحدّث الرمز من تدفقات مثل `/auth/callback` بعد تخزين JWT في localStorage */
  adoptToken: (jwt: string) => void;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    opts?: { referralCode?: string; startTrial?: boolean }
  ) => Promise<{ whatsappNotifyUrl?: string; needsEmailConfirmation?: boolean } | void>;
  logout: () => void;
  isApproved: boolean;
  subscriptionExpired: boolean;
  approvedModules: string[];
  /** True when the user is superadmin or matches the primary admin client identity */
  isAdmin: boolean;
  subscriptionDaysRemaining: number | null;
  subscriptionExpiryUrgent: boolean;
  /** 7 / 3 / 1 day notices for paid subs (null if N/A) */
  subscriptionExpiryNotice: "7" | "3" | "1" | null;
  /** Live countdown for trial or paid subscription end */
  subscriptionCountdown: { days: number; hours: number; minutes: number } | null;
  accountLocked: boolean;
  trialActive: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "idara_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [devices, setDevices] = useState<MeResponse["devices"]>([]);
  const [maxDevices, setMaxDevices] = useState(3);
  const [loading, setLoading] = useState(true);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Check localStorage on mount only once for session isolation
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      try {
        // Validate token format before using it
        const parts = stored.split('.');
        if (parts.length === 3) {
          setToken(stored);
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    const effectiveToken = token ?? localStorage.getItem(TOKEN_KEY);
    if (!effectiveToken) {
      setUser(null);
      setSubscription(null);
      setDevices([]);
      setLoading(false);
      return;
    }
    try {
      const me = await api<MeResponse>("/me", { token: effectiveToken });
      setUser(me.user);
      setSubscription(me.subscription);
      setDevices(me.devices);
      setMaxDevices(me.maxDevices);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setSubscription(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  const adoptToken = useCallback((jwt: string) => {
    localStorage.setItem(TOKEN_KEY, jwt);
    setToken(jwt);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    const fp = getDeviceFingerprint();
    const deviceLabel = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "";

    const persistSession = async (res: { token: string; user: User }) => {
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
      await refresh();
    };

    try {
      const res = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          rememberMe: Boolean(rememberMe),
          deviceFingerprint: fp,
          deviceLabel,
        }),
      });
      await persistSession(res);
    } catch (apiErr) {
      throw new Error(mapApiError(apiErr));
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    opts?: { referralCode?: string; startTrial?: boolean }
  ) => {
    const fp = getDeviceFingerprint();
    try {
      const res = await api<{ token: string; user: User; whatsappNotifyUrl?: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          name,
          referralCode: opts?.referralCode,
          ref: opts?.referralCode,
          startTrial: opts?.startTrial,
          deviceFingerprint: fp,
          deviceLabel:
            typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "",
        }),
      });
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
      await refresh();
      return { whatsappNotifyUrl: res.whatsappNotifyUrl };
    } catch (apiErr) {
      throw new Error(mapApiError(apiErr));
    }
  };

  const logout = () => {
    // Clear all local storage data
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('idara_token');
    
    // Clear all React state
    setToken(null);
    setUser(null);
    setSubscription(null);
    setDevices([]);
    
    // Clear any other cached data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('cache_') || key.startsWith('query_') || key.startsWith('supabase_')) {
        localStorage.removeItem(key);
      }
    });
  };

  const trialActive = useMemo(() => {
    const raw = user?.trial_ends_at?.trim();
    if (!raw) return false;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) && t > Date.now();
  }, [user?.trial_ends_at]);

  useEffect(() => {
    setTrialWatermarkExport(Boolean(trialActive));
  }, [trialActive]);

  const isAdmin = useMemo(() => {
    return (
      Boolean(user && user.role === "superadmin") ||
      Boolean(isPrimaryAdminClient(user?.email, user?.name)) ||
      (user?.email?.toLowerCase() === PUBLIC_SUPER_ADMIN_EMAIL)
    );
  }, [user]);

  const subscriptionDaysRemaining = useMemo(() => {
    if (isAdmin) {
      return null;
    }
    if (trialActive) return null;
    const end = subscription?.ends_at?.trim();
    if (!end || subscription?.status !== "approved") return null;
    const ms = new Date(end).getTime() - Date.now();
    if (!Number.isFinite(ms)) return null;
    return Math.ceil(ms / 86400000);
  }, [isAdmin, subscription?.ends_at, subscription?.status, trialActive]);

  const subscriptionExpiryUrgent = useMemo(() => {
    if (subscriptionDaysRemaining === null) return false;
    return subscriptionDaysRemaining <= 5 && subscriptionDaysRemaining >= 0;
  }, [subscriptionDaysRemaining]);

  const subscriptionExpiryNotice = useMemo((): "7" | "3" | "1" | null => {
    if (isAdmin) return null;
    if (trialActive) return null;
    const d = subscriptionDaysRemaining;
    if (d === null || d < 0) return null;
    if (d <= 1) return "1";
    if (d <= 3) return "3";
    if (d <= 7) return "7";
    return null;
  }, [isAdmin, subscriptionDaysRemaining, trialActive]);

  const subscriptionCountdown = useMemo(() => {
    if (isAdmin) return null;
    let endIso: string | null | undefined;
    if (trialActive && user?.trial_ends_at) endIso = user.trial_ends_at;
    else if (subscription?.status === "approved" && subscription.ends_at) endIso = subscription.ends_at;
    else return null;
    const end = new Date(endIso).getTime();
    if (!Number.isFinite(end)) return null;
    let ms = end - nowTick;
    if (ms <= 0) return { days: 0, hours: 0, minutes: 0 };
    const days = Math.floor(ms / 86400000);
    ms -= days * 86400000;
    const hours = Math.floor(ms / 3600000);
    ms -= hours * 3600000;
    const minutes = Math.floor(ms / 60000);
    return { days, hours, minutes };
  }, [isAdmin, nowTick, subscription, trialActive, user?.trial_ends_at]);

  const accountLocked = Boolean(user?.account_locked);
  const subscriptionExpired = useMemo(() => {
    if (isAdmin) {
      return false;
    }
    if (trialActive) return false;
    if (!subscription || subscription.status !== "approved") return false;
    const end = subscription.ends_at?.trim();
    if (!end) return false;
    const t = new Date(end).getTime();
    if (!Number.isFinite(t)) return false;
    return t <= Date.now();
  }, [isAdmin, subscription, trialActive]);

  const isApproved = useMemo(() => {
    if (isAdmin) {
      return true;
    }
    if (trialActive) return true;
    if (!subscription || subscription.status !== "approved") return false;
    if (subscriptionExpired) return false;
    return true;
  }, [subscription, subscriptionExpired, user, trialActive]);

  const approvedModules: string[] = useMemo(() => {
    // Super Admin Override: lahcenm534@gmail.com gets all modules regardless of subscription
    if (isAdmin) {
      console.log('[AuthContext] Super Admin override - granting all modules to:', user?.email);
      return [...ALL_SAAS_MODULE_IDS];
    }
    const visaAdminOk = Boolean(user?.visa_unlock_approved);
    if (trialActive) {
      const base = [...TRIAL_MODULE_IDS];
      return visaAdminOk ? [...base, "visa"] : base;
    }
    // Regular users get all modules except visa (no subscription required)
    if (!isApproved || !subscription?.modules) {
      return visaAdminOk ? [...ALL_SAAS_MODULE_IDS.filter(m => m !== "visa"), "visa"] : ALL_SAAS_MODULE_IDS.filter(m => m !== "visa");
    }
    try {
      const m = JSON.parse(subscription.modules) as string[];
      const list = Array.isArray(m) ? [...m] : [];
      const paid = subscription.status === "approved" && !subscriptionExpired;
      if (paid && !list.includes("chat")) list.push("chat");
      return list;
    } catch {
      return visaAdminOk ? ["visa"] : [];
    }
  }, [isApproved, subscription, subscriptionExpired, user, trialActive, isAdmin]);

  const value: AuthContextValue = {
    token,
    user,
    subscription,
    devices,
    maxDevices,
    loading,
    refresh,
    adoptToken,
    login,
    register,
    logout,
    isApproved,
    subscriptionExpired,
    approvedModules,
    isAdmin,
    subscriptionDaysRemaining,
    subscriptionExpiryUrgent,
    subscriptionExpiryNotice,
    subscriptionCountdown,
    accountLocked,
    trialActive,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
