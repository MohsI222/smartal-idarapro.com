import { useCallback, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import { Camera, CreditCard, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type OcrScannerProps = {
  title?: string;
  description?: string;
  onExtracted: (text: string) => void;
  /** محاكاة استخراج بطاقة وطنية — بدون صورة */
  simulateLabel?: string;
  onSimulateNationalId?: () => void;
  variant?: "default" | "royal";
};

/** مسح بطاقة تعريف / رخصة / فاتورة باستخدام Tesseract.js */
export function OcrScanner({
  title = "مسح OCR — بطاقة تعريف، رخصة، فاتورة",
  description = "يعمل محلياً في المتصفح — يدعم العربية والفرنسية والإنجليزية لاستخراج النص وتعبئة النماذج تلقائياً.",
  onExtracted,
  simulateLabel,
  onSimulateNationalId,
  variant = "default",
}: OcrScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const runOcr = useCallback(
    async (file: File) => {
      setBusy(true);
      setProgress(0);
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
        </CardTitle>
        <CardDescription className={royal ? "text-slate-300" : undefined}>{description}</CardDescription>
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
              جاري التعرف… {progress}%
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
