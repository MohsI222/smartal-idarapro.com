import { useState } from "react";
import { Bot, Send, Sparkles, AlertTriangle, TrendingUp, Package, DollarSign, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Product } from "../types";
import { useEdgeTTS } from "@/hooks/useEdgeTTS";
import { useI18n } from "@/i18n/I18nProvider";

type TranslateFn = (key: string) => string;

type InventoryAiAssistantProps = {
  t: TranslateFn;
  products: Product[];
  onSuggestionApply?: (suggestion: string) => void;
};

export function InventoryAiAssistant({ t, products, onSuggestionApply }: InventoryAiAssistantProps) {
  const { locale } = useI18n();
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const { speak, stop, isSpeaking, isLoading: ttsLoading } = useEdgeTTS();

  const safeProducts = products || [];
  const totalStock = safeProducts.reduce((sum, p) => sum + p.stock_pieces, 0);
  const totalValue = safeProducts.reduce((sum, p) => sum + (p.stock_pieces * p.unit_price), 0);
  const lowStockItems = safeProducts.filter(p => p.stock_pieces <= (p.low_stock_alert || 10));
  const highValueItems = safeProducts.filter(p => (p.stock_pieces * p.unit_price) > 10000);

  const generateAiResponse = (userMessage: string) => {
    const lowerMsg = userMessage.toLowerCase();
    
    if (lowerMsg.includes("stock") || lowerMsg.includes("مخزون")) {
      return `📊 **تحليل المخزون الحالي:**

• إجمالي القطع في المخزون: ${totalStock.toLocaleString()}
• إجمالي قيمة المخزون: ${totalValue.toLocaleString()} ${t("inv.currency")}
• عدد المنتجات: ${safeProducts.length}
• منتجات منخفضة المخزون: ${lowStockItems.length}
• منتجات عالية القيمة: ${highValueItems.length}

${lowStockItems.length > 0 ? `⚠️ **تنبيه:** المنتجات التالية تحتاج إعادة تعبئة:
${lowStockItems.slice(0, 5).map(p => `• ${p.name} (${p.stock_pieces} قطعة)`).join('\n')}` : '✅ جميع المنتجات بمستويات مخزون جيدة.'}`;
    }

    if (lowerMsg.includes("قيمة") || lowerMsg.includes("value")) {
      return `💰 **تحليل القيمة:**

• إجمالي قيمة المخزون: ${totalValue.toLocaleString()} ${t("inv.currency")}
• متوسط قيمة المنتج: ${(totalValue / Math.max(1, safeProducts.length)).toFixed(2)} ${t("inv.currency")}
• أعلى 5 منتجات قيمة:
${safeProducts
  .sort((a, b) => (b.stock_pieces * b.unit_price) - (a.stock_pieces * a.unit_price))
  .slice(0, 5)
  .map(p => `• ${p.name}: ${(p.stock_pieces * p.unit_price).toLocaleString()} ${t("inv.currency")}`)
  .join('\n')}`;
    }
    
    if (lowerMsg.includes("تنبيه") || lowerMsg.includes("alert")) {
      return `🚨 **تنبيهات المخزون:**
      
${lowStockItems.length > 0 ? `⚠️ منتجات منخفضة المخزون (${lowStockItems.length}):
${lowStockItems.map(p => `• ${p.name}: ${p.stock_pieces} قطعة (الحد الأدنى: ${p.low_stock_alert || 10})`).join('\n')}` : '✅ لا توجد منتجات منخفضة المخزون'}

${products.filter(p => p.expiry_date && new Date(p.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length > 0 ? `⏰ منتجات قريبة الانتهاء:
${products
  .filter(p => p.expiry_date && new Date(p.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  .map(p => `• ${p.name}: ${p.expiry_date}`)
  .join('\n')}` : '✅ لا توجد منتجات قريبة الانتهاء'}`;
    }
    
    return `🤖 **مساعد المخزون الذكي**

يمكنني مساعدتك في:
• تحليل المخزون الحالي
• حساب القيمة الإجمالية
• تنبيهات المخزون المنخفض
• تقارير المنتجات قريبة الانتهاء
• اقتراحات لإدارة المخزون

جرب الأسئلة التالية:
• "ما هو وضع المخزون الحالي؟"
• "ما هي القيمة الإجمالية للمخزون؟"
• "هل هناك تنبيهات؟"`;
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    setIsProcessing(true);

    setTimeout(() => {
      const response = generateAiResponse(message);
      setAiResponse(response);
      setIsProcessing(false);
      setMessage("");

      // Speak the response if auto-speak is enabled
      if (autoSpeak) {
        speak(response, {
          voice: locale.startsWith("ar") ? "ar-MA-MounaNeural" : "en-US-JennyNeural",
          rate: 1.0,
          volume: 1.0,
          pitch: 1.0,
        });
      }
    }, 800);
  };

  const handleSpeakResponse = () => {
    if (aiResponse) {
      speak(aiResponse, {
        voice: locale.startsWith("ar") ? "ar-MA-MounaNeural" : "en-US-JennyNeural",
        rate: 1.0,
        volume: 1.0,
        pitch: 1.0,
      });
    }
  };

  const handleStopSpeaking = () => {
    stop();
  };

  return (
    <Card className="border-gradient-to-r from-cyan-500/20 to-purple-500/20 bg-gradient-to-br from-[#0a1628]/95 to-[#1a0a28]/95 backdrop-blur-xl">
      <CardHeader className="border-b border-slate-700/50 bg-gradient-to-r from-cyan-500/10 to-purple-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bot className="size-8 text-cyan-400" />
              <Sparkles className="absolute -top-1 -right-1 size-4 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-white text-lg">{t("inv.aiAssistantTitle")}</h3>
              <p className="text-xs text-slate-400">{t("inv.aiAssistantDesc")}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAutoSpeak(!autoSpeak)}
            className="text-slate-400 hover:text-slate-200"
            title={autoSpeak ? "Disable auto-speak" : "Enable auto-speak"}
          >
            {autoSpeak ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-lg p-3">
            <Package className="size-5 text-emerald-400 mb-2" />
            <p className="text-2xl font-black text-emerald-400">{totalStock.toLocaleString()}</p>
            <p className="text-xs text-slate-400">{t("inv.totalStock")}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-lg p-3">
            <DollarSign className="size-5 text-amber-400 mb-2" />
            <p className="text-2xl font-black text-amber-400">{totalValue.toLocaleString()}</p>
            <p className="text-xs text-slate-400">{t("inv.totalValue")}</p>
          </div>
          <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-lg p-3">
            <AlertTriangle className="size-5 text-red-400 mb-2" />
            <p className="text-2xl font-black text-red-400">{lowStockItems.length}</p>
            <p className="text-xs text-slate-400">{t("inv.lowStockAlerts")}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-lg p-3">
            <TrendingUp className="size-5 text-purple-400 mb-2" />
            <p className="text-2xl font-black text-purple-400">{products.length}</p>
            <p className="text-xs text-slate-400">{t("inv.totalProducts")}</p>
          </div>
        </div>

        {aiResponse && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Bot className="size-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                {aiResponse}
              </div>
              <div className="flex gap-1 shrink-0">
                {isSpeaking ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-200"
                    onClick={handleStopSpeaking}
                    disabled={ttsLoading}
                  >
                    <VolumeX className="size-3" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-200"
                    onClick={handleSpeakResponse}
                    disabled={ttsLoading}
                  >
                    <Volume2 className="size-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={t("inv.aiAssistantPlaceholder")}
            className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
            disabled={isProcessing}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isProcessing || !message.trim()}
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
          >
            {isProcessing ? (
              <Sparkles className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: t("inv.aiQuickStock"), msg: t("inv.aiStockQuestion") },
            { label: t("inv.aiQuickValue"), msg: t("inv.aiValueQuestion") },
            { label: t("inv.aiQuickAlerts"), msg: t("inv.aiAlertQuestion") },
          ].map((quick) => (
            <Button
              key={quick.label}
              type="button"
              variant="outline"
              size="sm"
              className="text-xs border-slate-700 hover:bg-slate-800"
              onClick={() => {
                setMessage(quick.msg);
                handleSendMessage();
              }}
            >
              {quick.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
