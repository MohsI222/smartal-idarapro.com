import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";

export function AuthCallback() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [msg, setMsg] = useState(t("common.loading"));

  useEffect(() => {
    // OAuth callback no longer supported - Supabase removed
    toast.error("OAuth login is no longer available. Please use email/password login.");
    navigate("/login", { replace: true });
  }, [navigate, t]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#060d18] text-slate-300 px-6">
      <p className="text-sm text-center">{msg}</p>
    </div>
  );
}
