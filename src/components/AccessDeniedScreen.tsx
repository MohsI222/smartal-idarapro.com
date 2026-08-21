import { Lock, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n/I18nProvider";

export function AccessDeniedScreen() {
  const navigate = useNavigate();
  const { t, isRtl, locale } = useI18n();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050a12] via-[#0a1628] to-[#050a12] text-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-slate-800 bg-[#0a1628]/50 backdrop-blur-xl">
        <CardContent className="p-8 text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full" />
              <div className="relative bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full p-6 border border-red-500/30">
                <Lock className="size-12 text-red-400" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">
              {locale.startsWith("ar") ? "غير مصرح بالدخول" : "Access Denied"}
            </h1>
            <p className="text-slate-400 text-sm">
              {locale.startsWith("ar")
                ? "ليس لديك الصلاحية الكافية للوصول إلى هذا القسم"
                : "You don't have sufficient permissions to access this section"}
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-start gap-3">
              <Shield className="size-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm text-slate-300">
                  {locale.startsWith("ar")
                    ? "يرجى التواصل مع مدير النظام للحصول على الصلاحيات المطلوبة"
                    : "Please contact your system administrator to request the necessary permissions"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={() => navigate(-1)}
            className="w-full"
            variant="outline"
          >
            <ArrowLeft className={`size-4 ${isRtl ? "rotate-180" : ""} mr-2`} />
            {locale.startsWith("ar") ? "العودة" : "Go Back"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
