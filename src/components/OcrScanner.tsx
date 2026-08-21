import { useCallback, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import { Camera, CreditCard, FileUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { performGeminiOcr } from "@/lib/geminiClient";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

type OcrScannerProps = {
  title?: string;
  description?: string;
  onExtracted: (text: string) => void;
  onExtractedJson?: (data: any) => void;
  /** محاكاة استخراج بطاقة وطنية — بدون صورة */
  simulateLabel?: string;
  onSimulateNationalId?: () => void;
  variant?: "default" | "royal";
  useGemini?: boolean;
  documentType?: "id_card" | "document" | "general";
};

/** مسح بطاقة تعريف / رخصة / فاتورة باستخدام Tesseract.js أو Gemini AI */
export function OcrScanner({
  title = "مسح OCR — بطاقة تعريف، رخصة، فاتورة",
  description = "يعمل محلياً في المتصفح — يدعم العربية والفرنسية والإنجليزية لاستخراج النص وتعبئة النماذج تلقائياً.",
  onExtracted,
  onExtractedJson,
  simulateLabel,
  onSimulateNationalId,
  variant = "default",
  useGemini = true,
  documentType = "general",
}: OcrScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuth();
  const { locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [usingGemini, setUsingGemini] = useState(useGemini);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const runGeminiOcr = useCallback(
    async (file: File) => {
      setBusy(true);
      setProgress(0);
      setUsingGemini(true);
      const url = URL.createObjectURL(file);
      setPreview(url);
      
      try {
        setProgress(20);
        const imageData = await convertFileToBase64(file);
        setProgress(50);
        
        const result = await performGeminiOcr(token, imageData, locale, documentType);
        setProgress(90);
        
        if (documentType === "id_card" && onExtractedJson) {
          onExtractedJson(result);
        } else if (typeof result === "object" && result.text) {
          onExtracted(result.text);
        } else if (typeof result === "string") {
          onExtracted(result);
        } else {
          onExtracted(JSON.stringify(result));
        }
        
        setProgress(100);
        toast.success(locale === "ar-MA" || locale === "ar"
          ? "تم استخراج النص بنجاح"
          : "Text extracted successfully");
      } catch (error) {
        console.error("Gemini OCR error:", error);
        toast.error(locale === "ar-MA" || locale === "ar"
          ? "فشل في استخراج النص باستخدام Gemini"
          : "Failed to extract text with Gemini");
        // Fallback to Tesseract
        setUsingGemini(false);
        await runTesseractOcr(file);
      } finally {
        setBusy(false);
      }
    },
    [token, locale, documentType, onExtracted, onExtractedJson]
  );

  const runTesseractOcr = useCallback(
    async (file: File) => {
      setBusy(true);
      setProgress(0);
      setUsingGemini(false);
      const url = URL.createObjectURL(file);
      setPreview(url);
      try {
        const r = await Tesseract.recognize(file, "ara+eng+fra", {
          logger: (m) => {
            if (m.status === "recognizing text" && m.progress != null) {
              setProgress(Math.round(m.progress * 100));
            }
          },
        });
        onExtracted(r.data.text);
      } finally {
        setBusy(false);
      }
    },
    [onExtracted]
  );

  const runOcr = useCallback(
    async (file: File) => {
      if (useGemini && token) {
        await runGeminiOcr(file);
      } else {
        await runTesseractOcr(file);
      }
    },
    [useGemini, token, runGeminiOcr, runTesseractOcr]
  );

  const royal = variant === "royal";

  return (
    <Card
      className={
        royal
          ? "border-[#c9a227]/35 bg-gradient-to-br from-[#0c2340]/90 to-[#050a12] shadow-lg shadow-[#003876]/20 transition-all duration-300 hover:border-[#d4af37]/45"
          : "border-orange-500/20 bg-[#121214]"
      }
    >
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className={royal ? "size-5 text-[#d4af37]" : "size-5 text-orange-400"} />
          {title}
          {usingGemini && <Sparkles className="size-4 text-cyan-400" />}
        </CardTitle>
        <CardDescription className={royal ? "text-slate-300" : undefined}>
          {description}
          {useGemini && token && (
            <span className="text-cyan-400 ml-2">
              ({locale === "ar-MA" || locale === "ar" ? "مدعوم بـ Gemini AI" : "Powered by Gemini AI"})
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runOcr(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="secondary"
            type="button"
            className={
              royal
                ? "bg-[#003876] hover:bg-[#004a9c] text-white border border-[#c9a227]/40 transition-colors duration-200"
                : undefined
            }
            onClick={() => inputRef.current?.click()}
          >
            <FileUp className="size-4" />
            اختر صورة
          </Button>
          {simulateLabel && onSimulateNationalId && (
            <Button
              type="button"
              variant="outline"
              className={
                royal
                  ? "border-[#c9a227]/50 text-[#f5e6b8] hover:bg-[#c9a227]/10 transition-colors duration-200"
                  : undefined
              }
              onClick={onSimulateNationalId}
            >
              <CreditCard className="size-4" />
              {simulateLabel}
            </Button>
          )}
          {busy && (
            <span className="inline-flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              {usingGemini
                ? (locale === "ar-MA" || locale === "ar" ? "جاري المعالجة بـ Gemini… " : "Processing with Gemini… ")
                : (locale === "ar-MA" || locale === "ar" ? "جاري التعرف… " : "Recognizing… ")}
              {progress}%
            </span>
          )}
        </div>
        {preview && (
          <img
            src={preview}
            alt="معاينة"
            className="max-h-48 rounded-lg border border-slate-700 object-contain"
          />
        )}
      </CardContent>
    </Card>
  );
}

export { parseMoroccanIdHints } from "@/lib/moroccanIdOcrParse";
