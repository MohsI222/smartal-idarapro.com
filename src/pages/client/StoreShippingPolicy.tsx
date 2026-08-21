/** صفحة سياسة الشحن والتوصيل - Store Shipping Policy Page */
import { useI18n } from "@/i18n/I18nProvider";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StoreShippingPolicy() {
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
            <CardTitle className="text-2xl">{t("store.shippingPolicy.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-300">
            <section>
              <h3 className="font-semibold text-white mb-2">{t("store.shippingPolicy.deliveryTime")}</h3>
              <p className="text-sm">
                يتم توصيل الطلبات خلال 2-5 أيام عمل في المناطق الحضرية، و3-7 أيام عمل في المناطق الريفية.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">{t("store.shippingPolicy.cod")}</h3>
              <p className="text-sm">
                نقبل الدفع عند الاستلام (COD) لجميع الطلبات. يمكنك الدفع نقداً عند استلام المنتج.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">{t("store.shippingPolicy.freeShipping")}</h3>
              <p className="text-sm">
                الشحن مجاني للطلبات التي تتجاوز 200 درهم. للطلبات الأقل من ذلك، تبلغ تكلفة الشحن 15 درهم.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-white mb-2">{t("store.shippingPolicy.shippingCost")}</h3>
              <p className="text-sm">
                تكلفة الشحن الثابتة: 15 درهم للطلبات أقل من 200 درهم. مجانية للطلبات 200 درهم فما فوق.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
