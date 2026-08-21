/** صفحة سياسة الإرجاع والاستبدال - Store Return & Refund Policy Page */
import { useI18n } from "@/i18n/I18nProvider";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StoreReturnPolicy() {
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
            <CardTitle className="text-2xl">{t("store.returnPolicy.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-300">
            <section>
              <h3 className="font-semibold text-white mb-2">{t("store.returnPolicy.conditions")}</h3>
              <ul className="text-sm space-y-2 list-disc list-inside">
                <li>يجب أن يكون المنتج في حالته الأصلية غير المستخدمة</li>
                <li>يجب أن تكون العبوة الأصلية سليمة ومغلقة</li>
                <li>يجب تقديم إيصال الشراء الأصلي</li>
                <li>المنتجات القابلة للتلف (الأطعمة، المشروبات) لا تقبل الإرجاع</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">{t("store.returnPolicy.period")}</h3>
              <p className="text-sm">
                يمكنك طلب الإرجاع أو الاستبدال خلال 7 أيام من تاريخ الاستلام. بعد هذه المدة، لا نقبل أي طلبات إرجاع.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">عملية الإرجاع</h3>
              <p className="text-sm">
                للإرجاع، يرجى التواصل معنا عبر الواتساب على الرقم +212780290270 مع إرفاق صورة المنتج والإيصال. سيتم مراجعة طلبك خلال 24-48 ساعة.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">الاستبدال</h3>
              <p className="text-sm">
                في حالة وجود عيب في المنتج، يمكنك استبداله بنفس المنتج أو بمنتج آخر بنفس القيمة أو أعلى مع دفع الفرق.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
