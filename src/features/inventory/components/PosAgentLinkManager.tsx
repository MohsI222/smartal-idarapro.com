import { useState } from "react";
import { Copy, ShoppingCart, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

export function PosAgentLinkManager() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [isCreating, setIsCreating] = useState(false);

  const generateAndCopyLink = async () => {
    if (!token) {
      toast.error(t("inv.agent.loginRequired") || "يجب تسجيل الدخول أولاً");
      return;
    }
    setIsCreating(true);
    try {
      console.log("[PosAgentLinkManager] Calling /pos-agent/generate-token");
      console.log("[PosAgentLinkManager] Auth token:", token ? `${token.substring(0, 20)}...` : "null");
      const response = await api<{ success: boolean; token: string }>("/pos-agent/generate-token", {
        method: "POST",
        token,
      });
      console.log("[PosAgentLinkManager] Response:", response);
      if (response.success) {
        const fullLink = `${window.location.origin}/agent-pos?token=${response.token}`;
        await navigator.clipboard.writeText(fullLink);
        toast.success(t("inv.agent.linkCopied") || "تم نسخ رابط تطبيق المندوبين للحافظة");
      } else {
        console.error("[PosAgentLinkManager] Response success is false");
        toast.error(t("inv.agent.createFailed") || "فشل إنشاء الرابط");
      }
    } catch (error) {
      console.error("[PosAgentLinkManager] Error generating token:", error);
      if (error instanceof Error) {
        console.error("[PosAgentLinkManager] Error message:", error.message);
        console.error("[PosAgentLinkManager] Error stack:", error.stack);
      }
      toast.error((t("inv.agent.createFailedError") || "فشل إنشاء الرابط: {reason}").replace("{reason}", error instanceof Error ? error.message : 'خطأ غير معروف'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          {t("inv.agent.title") || "تطبيق المندوبين المستقل"}
        </CardTitle>
        <CardDescription>
          {t("inv.agent.description") || "انسخ رابط تطبيق البيع السريع المستقل للمندوبين"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <LinkIcon className="w-4 h-4" />
              <span>{t("inv.agent.linkInfo") || "رابط تطبيق المندوبين يعمل بدون تسجيل دخول"}</span>
            </div>
          </div>
          <Button
            onClick={generateAndCopyLink}
            disabled={isCreating}
            className="gap-2 w-full sm:w-auto"
          >
            <Copy className="w-4 h-4" />
            {isCreating ? (t("inv.agent.creating") || "جاري الإنشاء...") : (t("inv.agent.copyButton") || "نسخ رابط تطبيق المندوبين")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
