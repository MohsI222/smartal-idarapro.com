import { Link } from "react-router-dom";
import { ArrowLeft, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";

/** CGU — références Loi 09-08 (cadre indicatif, non substitut d’un conseil juridique). */
export function CguPage() {
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

        <Card className="border-amber-500/25 bg-[#0a1628]/90 backdrop-blur-xl">
          <CardHeader className="border-b border-white/10">
            <div className="flex items-center gap-3">
              <Scale className="size-8 text-amber-400" />
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white">{t("cguPage.title")}</h1>
                <p className="text-sm text-slate-400 mt-1">{t("cguPage.updated")}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-5 text-slate-300 leading-relaxed text-sm md:text-base">
            <section>
              <h2 className="text-white font-bold">{t("cguPage.s1")}</h2>
              <p className="mt-2">{t("cguPage.s1b")}</p>
            </section>
            <section>
              <h2 className="text-white font-bold">{t("cguPage.s2")}</h2>
              <p className="mt-2">{t("cguPage.s2b")}</p>
            </section>
            <section>
              <h2 className="text-white font-bold">{t("cguPage.s3")}</h2>
              <p className="mt-2">{t("cguPage.s3b")}</p>
            </section>
            <section>
              <h2 className="text-white font-bold">{t("cguPage.s4")}</h2>
              <p className="mt-2">{t("cguPage.s4b")}</p>
            </section>
            <p className="text-xs text-slate-500 pt-4 border-t border-white/10">{t("cguPage.footer")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
