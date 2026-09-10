import { Link } from "react-router-dom";
import { ArrowLeft, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";

/** Garantie de confiance — emploi, administration, apprentissage pour la jeunesse marocaine. */
export function TrustCharterPage() {
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

        <Card className="border-[#C1272D]/30 bg-[#0a1628]/90 backdrop-blur-xl ring-1 ring-[#006233]/20">
          <CardHeader className="border-b border-white/10">
            <div className="flex items-center gap-3">
              <HeartHandshake className="size-8 text-[#C1272D]" />
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white">{t("trustPage.title")}</h1>
                <p className="text-sm text-slate-400 mt-1">{t("trustPage.subtitle")}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 text-slate-300 leading-relaxed text-sm md:text-base">
            <p>{t("trustPage.p1")}</p>
            <p>{t("trustPage.p2")}</p>
            <p className="text-slate-400 text-sm">{t("trustPage.p3")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
