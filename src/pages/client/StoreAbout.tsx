/** صفحة من نحن - Store About Us Page */
import { useI18n } from "@/i18n/I18nProvider";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StoreAbout() {
  const { t, isRtl } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8" dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-3xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-white"
        >
          <ArrowRight className={`h-4 w-4 ${isRtl ? "ml-2" : "mr-2"}`} />
          {t("common.back")}
        </Button>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-2xl">{t("store.about.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-300">
            <section>
              <h3 className="font-semibold text-white mb-2">عن المتجر</h3>
              <p className="text-sm">
                متجرنا يقدم أفضل المنتجات عالية الجودة بأسعار تنافسية. نحن نسعى دائماً لتقديم تجربة تسوق ممتازة لعملائنا الكرام.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">الجودة</h3>
              <p className="text-sm">
                نختار منتجاتنا بعناية فائقة من موردين موثوقين لضمان الجودة العالية. جميع المنتجات تخضع لفحص صارم قبل الشحن.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">الخدمة</h3>
              <p className="text-sm">
                فريق خدمة العملاء لدينا متاح على مدار الساعة للإجابة على استفساراتكم ومساعدتكم في أي وقت. يمكنكم التواصل معنا عبر الواتساب على الرقم +212780290270.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">الرؤية</h3>
              <p className="text-sm">
                نسعى لأن نكون الخيار الأول للعملاء الباحثين عن الجودة والموثوقية. نؤمن بأن رضا العملاء هو سر نجاحنا المستمر.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">تواصل معنا</h3>
              <p className="text-sm">
                للأسئلة والاستفسارات، يرجى التواصل معنا عبر الواتساب على الرقم +212780290270 أو عبر البريد الإلكتروني.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
