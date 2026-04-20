import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { api, getDeviceFingerprint } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth, type User } from "@/context/AuthContext";

export function AuthCallback() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { adoptToken, refresh } = useAuth();
  const [msg, setMsg] = useState(t("common.loading"));

  useEffect(() => {
    if (!supabase) {
      toast.error("Supabase غير مضبوط");
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const access_token = data.session?.access_token;
        if (!access_token) {
          throw new Error("لم يُستلم رمز الجلسة — أعد المحاولة من صفحة تسجيل الدخول");
        }
        const fp = getDeviceFingerprint();
        const res = await api<{ token: string; user: User }>("/auth/supabase-oauth", {
          method: "POST",
          body: JSON.stringify({
            access_token,
            deviceFingerprint: fp,
            deviceLabel: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "",
          }),
        });
        if (cancelled) return;
        adoptToken(res.token);
        await supabase.auth.signOut();
        await refresh();
        navigate("/app", { replace: true });
      } catch (e) {
        const m = e instanceof Error ? e.message : "فشل تسجيل الدخول";
        if (!cancelled) {
          setMsg(m);
          toast.error(m);
          navigate("/login", { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, t, adoptToken, refresh]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#060d18] text-slate-300 px-6">
      <p className="text-sm text-center">{msg}</p>
    </div>
  );
}
