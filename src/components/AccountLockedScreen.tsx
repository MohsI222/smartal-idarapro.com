import { Link } from "react-router-dom";
import { LogOut, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

export function AccountLockedScreen() {
  const { logout } = useAuth();
  const { t, isRtl } = useI18n();

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#050a12] via-[#1a0a12] to-[#050a12] px-4 text-white"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="w-full max-w-lg space-y-6 rounded-3xl border border-red-500/35 bg-[#0a1628]/90 p-8 text-center shadow-2xl shadow-red-500/10 backdrop-blur-xl md:p-10">
        <div className="inline-flex items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <ShieldOff className="size-12 text-red-400" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white md:text-3xl">{t("account.lockedTitle")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{t("account.lockedDesc")}</p>
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" className="gap-2 font-bold" asChild>
            <Link to="/app/support">{t("account.lockedSupport")}</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 border-slate-600"
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/login";
            }}
          >
            <LogOut className="size-4" />
            {t("shell.logout")}
          </Button>
        </div>
      </div>
    </div>
  );
}
