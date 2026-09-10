import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * Legal disclaimer & terms — limits third-party liability; not legal advice.
 */
export function LegalTermsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6 max-w-3xl pb-16">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" className="gap-2 text-slate-300" asChild>
          <Link to="/app">
            <ArrowLeft className="size-4" />
            {t("common.back")}
          </Link>
        </Button>
      </div>
      <Card className="border-cyan-500/20 bg-[#0a1628]/90 backdrop-blur-xl">
        <CardHeader className="border-b border-white/10">
          <div className="flex items-center gap-3">
            <Shield className="size-8 text-cyan-400" />
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white">{t("legal.termsTitle")}</h1>
              <p className="text-sm text-slate-400 mt-1">{t("legal.termsUpdated")}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 max-w-none text-slate-300 space-y-4 leading-relaxed">
          <p>{t("legal.termsIntro")}</p>
          <h3 className="text-white font-bold text-base">{t("legal.termsSection1")}</h3>
          <p>{t("legal.termsSection1Body")}</p>
          <h3 className="text-white font-bold text-base">{t("legal.termsSection2")}</h3>
          <p>{t("legal.termsSection2Body")}</p>
          <h3 className="text-white font-bold text-base">{t("legal.termsSection3")}</h3>
          <p>{t("legal.termsSection3Body")}</p>
          <h3 className="text-white font-bold text-base">{t("legal.termsSection4")}</h3>
          <p>{t("legal.termsSection4Body")}</p>
          <p className="text-xs text-slate-500 pt-4 border-t border-white/10">{t("legal.termsFooter")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
