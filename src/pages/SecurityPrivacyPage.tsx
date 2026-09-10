import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";

/** Page publique — mesures de sécurité et confidentialité (HTTPS, Supabase, rate limiting). */
export function SecurityPrivacyPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[#060d18] text-slate-200 p-4 pb-20">
      <div className="max-w-3xl mx-auto space-y-6 pt-6">
        <Button type="button" variant="ghost" size="sm" className="gap-2 text-slate-300" asChild>
          <Link to="/">
            <ArrowLeft className="size-4" />
            {t("common.back")}
          </Link>
        </Button>

        <Card className="border-emerald-500/25 bg-[#0a1628]/90 backdrop-blur-xl">
          <CardHeader className="border-b border-white/10">
            <div className="flex items-center gap-3">
              <Shield className="size-8 text-emerald-400" />
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white">{t("securityPage.title")}</h1>
                <p className="text-sm text-slate-400 mt-1">{t("securityPage.updated")}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-5 text-slate-300 leading-relaxed text-sm md:text-base">
            <p>{t("securityPage.intro")}</p>
            <section>
              <p>{t("securityPage.encryption")}</p>
            </section>
            <section className="space-y-2">
              <p className="font-semibold text-white">Supabase Auth</p>
              <p>{t("securityPage.supabase")}</p>
            </section>
            <section className="space-y-2">
              <p className="font-semibold text-white">Rate limiting</p>
              <p>{t("securityPage.rateLimit")}</p>
            </section>
            <section className="space-y-2">
              <p className="font-semibold text-white">SQL / XSS</p>
              <p>{t("securityPage.injection")}</p>
            </section>
            <p className="text-xs text-slate-500 pt-4 border-t border-white/10">{t("securityPage.footer")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
