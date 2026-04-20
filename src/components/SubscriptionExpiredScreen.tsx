import { Link } from "react-router-dom";
import { CalendarClock, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

export function SubscriptionExpiredScreen() {
  const { logout, subscription } = useAuth();
  const { t } = useI18n();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-[#050a12] via-[#0a1628] to-[#050a12] text-white"
      dir="rtl"
    >
      <div className="max-w-lg w-full rounded-3xl border border-orange-500/40 bg-[#0a1628]/90 backdrop-blur-xl p-8 md:p-10 text-center space-y-6 shadow-2xl shadow-orange-500/10">
        <div className="inline-flex items-center justify-center rounded-2xl bg-orange-500/15 border border-orange-500/30 p-4">
          <CalendarClock className="size-12 text-orange-400" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-l from-[#FF8C00] to-[#0052CC] bg-clip-text text-transparent">
            {t("sub.expiredTitle")}
          </h1>
          <p className="text-slate-400 mt-3 text-sm leading-relaxed">{t("sub.expiredDesc")}</p>
          {subscription?.ends_at && (
            <p className="text-xs text-slate-600 mt-2 font-mono">{subscription.ends_at}</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" className="gap-2 font-bold" asChild>
            <Link to="/app/pay">
              <Wallet className="size-5" />
              {t("sub.renewCta")}
            </Link>
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
