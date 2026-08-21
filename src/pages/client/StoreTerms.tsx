/** صفحة الشروط والأحكام - Store Terms of Service Page */
import { useI18n } from "@/i18n/I18nProvider";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StoreTerms() {
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
            <CardTitle className="text-2xl">{t("store.terms.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-300">
            <section>
              <h3 className="font-semibold text-white mb-2">{t("store.terms.general")}</h3>
              <p className="text-sm">
                باستخدام هذا المتجر، أنت توافق على الالتزام بالشروط والأحكام التالية. إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام المتجر.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">المعلومات الشخصية</h3>
              <p className="text-sm">
                نحن نحترم خصوصيتك ولا نشارك معلوماتك الشخصية مع أي طرف ثالث. جميع المعلومات المقدمة تُستخدم لغرض معالجة الطلبات فقط.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">دقة المعلومات</h3>
              <p className="text-sm">
                أنت مسؤول عن دقة المعلومات المقدمة عند الطلب. أي معلومات غير صحيحة قد تؤدي إلى تأخير أو إلغاء الطلب.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">{t("store.terms.orders")}</h3>
              <p className="text-sm">
                جميع الطلبات خاضعة للتوافر. نحتفظ بالحق في إلغاء أي طلب في أي وقت لأي سبب، بما في ذلك عدم توفر المنتج أو خطأ في تسعير المنتج.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">الأسعار والدفع</h3>
              <p className="text-sm">
                جميع الأسعار معروضة بالدرهم المغربي وتشمل الضريبة على القيمة المضافة. الدفع عند الاستلام متاح لجميع الطلبات.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">التعديلات</h3>
              <p className="text-sm">
                نحتفظ بالحق في تعديل هذه الشروط والأحكام في أي وقت. التعديلات سارية المفعول فور نشرها على المتجر.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
