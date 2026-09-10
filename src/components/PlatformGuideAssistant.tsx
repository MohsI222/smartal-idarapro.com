import { useState, useEffect, useRef } from "react";
import { Bot, Send, Sparkles, BookOpen, HelpCircle, Mic, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/I18nProvider";

type PlatformGuideAssistantProps = {
  isPreSubscription?: boolean;
};

export function PlatformGuideAssistant({ isPreSubscription = false }: PlatformGuideAssistantProps) {
  const { t, locale } = useI18n();
  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [guideResponse, setGuideResponse] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  const generateGuideResponse = (userMessage: string): string => {
    const lowerMsg = userMessage.toLowerCase();

    // Subscription process
    if (lowerMsg.includes("اشتراك") || lowerMsg.includes("subscription") || lowerMsg.includes("كيف اشترك") || lowerMsg.includes("subscribe") || lowerMsg.includes("suscribir") || lowerMsg.includes("s'abonner")) {
      return isPreSubscription
        ? t("guide.subscriptionInfo")
        : t("guide.alreadySubscribed");
    }

    // HR section
    if (lowerMsg.includes("hr") || lowerMsg.includes("الموارد البشرية") || lowerMsg.includes("عمال") || lowerMsg.includes("موظفين") || lowerMsg.includes("human resources") || lowerMsg.includes("recursos humanos") || lowerMsg.includes("ressources humaines")) {
      return t("guide.hrSection");
    }

    // Inventory/POS section
    if (lowerMsg.includes("مخزون") || lowerMsg.includes("inventory") || lowerMsg.includes("بيع") || lowerMsg.includes("pos") || lowerMsg.includes("منتجات") || lowerMsg.includes("inventario") || lowerMsg.includes("stock") || lowerMsg.includes("produits")) {
      return t("guide.inventorySection");
    }

    // Visa Radar section
    if (lowerMsg.includes("فيزا") || lowerMsg.includes("visa") || lowerMsg.includes("تأشيرة") || lowerMsg.includes("رادار") || lowerMsg.includes("visas") || lowerMsg.includes("visa radar")) {
      return t("guide.visaSection");
    }

    // Law section
    if (lowerMsg.includes("قانون") || lowerMsg.includes("محاماة") || lowerMsg.includes("law") || lowerMsg.includes("قضايا") || lowerMsg.includes("derecho") || lowerMsg.includes("legal") || lowerMsg.includes("droit")) {
      return t("guide.lawSection");
    }

    // Education section
    if (lowerMsg.includes("تعليم") || lowerMsg.includes("education") || lowerMsg.includes("edu") || lowerMsg.includes("طلاب") || lowerMsg.includes("estudiantes") || lowerMsg.includes("students") || lowerMsg.includes("élèves")) {
      return t("guide.eduSection");
    }

    // Real Estate section
    if (lowerMsg.includes("عقارات") || lowerMsg.includes("real estate") || lowerMsg.includes("عقار") || lowerMsg.includes("properties") || lowerMsg.includes("bienes raíces") || lowerMsg.includes("immobilier")) {
      return t("guide.realEstateSection");
    }

    // Business Tools section
    if (lowerMsg.includes("أدوات") || lowerMsg.includes("business") || lowerMsg.includes("tools") || lowerMsg.includes("أعمال") || lowerMsg.includes("herramientas") || lowerMsg.includes("outils")) {
      return t("guide.businessToolsSection");
    }

    // General platform questions
    if (lowerMsg.includes("كيف") || lowerMsg.includes("how") || lowerMsg.includes("استخدام") || lowerMsg.includes("استعمل") || lowerMsg.includes("cómo") || lowerMsg.includes("comment") || lowerMsg.includes("use")) {
      return t("guide.generalQuestion");
    }

    // Default response
    return t("guide.defaultResponse");
  };

  // Speech-to-Text setup
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = locale === 'ar-MA' || locale === 'ar-SA' ? 'ar-SA' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-US';
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setMessage(transcript);
          setIsListening(false);
        };
        
        recognition.onerror = () => {
          setIsListening(false);
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current = recognition;
      }
    }
  }, [locale]);

  const startListening = () => {
    if (recognitionRef.current) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Text-to-Speech
  const speakResponse = () => {
    if (!guideResponse || isSpeaking) return;
    
    if ('speechSynthesis' in window) {
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(guideResponse);
      utterance.lang = locale === 'ar-MA' || locale === 'ar-SA' ? 'ar-SA' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      synthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    setIsProcessing(true);

    setTimeout(() => {
      const response = generateGuideResponse(message);
      setGuideResponse(response);
      setIsProcessing(false);
      setMessage("");
    }, 500);
  };

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return (
    <Card className="border-gradient-to-r from-cyan-500/20 to-purple-500/20 bg-gradient-to-br from-[#0a1628]/95 to-[#1a0a28]/95 backdrop-blur-xl">
      <CardHeader className="border-b border-slate-700/50 bg-gradient-to-r from-cyan-500/10 to-purple-500/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bot className="size-8 text-cyan-400" />
            <BookOpen className="absolute -top-1 -right-1 size-4 text-purple-400" />
          </div>
          <div>
            <h3 className="font-black text-white text-lg">
              {isPreSubscription ? t("guide.title") : t("guide.learningTitle")}
            </h3>
            <p className="text-xs text-slate-400">
              {isPreSubscription ? t("guide.subtitle") : t("guide.learningSubtitle")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {isPreSubscription && (
          <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <HelpCircle className="size-5 text-orange-400 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-200">
                <p className="font-semibold text-orange-300 mb-1">{t("guide.askBeforeSub")}</p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• {t("guide.askBeforeSubItem1")}</li>
                  <li>• {t("guide.askBeforeSubItem2")}</li>
                  <li>• {t("guide.askBeforeSubItem3")}</li>
                  <li>• {t("guide.askBeforeSubItem4")}</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {guideResponse && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Bot className="size-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                {guideResponse}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 h-8 w-8 text-slate-400 hover:text-cyan-400"
                onClick={isSpeaking ? stopSpeaking : speakResponse}
                title={isSpeaking ? t("guide.stopSpeaking") : t("guide.speak")}
              >
                {isSpeaking ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={
                isPreSubscription
                  ? t("guide.placeholder")
                  : t("guide.placeholderLearning")
              }
              className="bg-[#0c1222] border-slate-700 pr-20"
            />
            {typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 ${
                  isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-slate-400 hover:text-cyan-400'
                }`}
                onClick={isListening ? stopListening : startListening}
                title={isListening ? t("guide.listening") : t("guide.microphone")}
              >
                <Mic className="size-4" />
              </Button>
            )}
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || isProcessing}
            size="icon"
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:opacity-90"
          >
            {isProcessing ? (
              <Sparkles className="size-4 animate-pulse" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
