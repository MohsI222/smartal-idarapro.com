import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, CameraOff, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { playBarcodeScanBeep, resumeAudioIfNeeded } from "@/lib/barcodeBeep";

type ProductLite = { id: string; name: string; sku: string };

type Props = {
  products: ProductLite[];
  onMatchedProduct: (productId: string, code: string) => void;
  /** عند عدم وجود الصنف محلياً — للبحث العالمي ونافذة الإضافة */
  onUnknownBarcode?: (code: string) => void;
  /** ارتفاع أقصى لمنطقة الفيديو (البيع السريع) */
  compact?: boolean;
};

function buildDecodeHints(): Map<DecodeHintType, unknown> {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.AZTEC,
    BarcodeFormat.CODABAR,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.CODE_128,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.EAN_8,
    BarcodeFormat.EAN_13,
    BarcodeFormat.ITF,
    BarcodeFormat.MAXICODE,
    BarcodeFormat.PDF_417,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.RSS_14,
    BarcodeFormat.RSS_EXPANDED,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.UPC_EAN_EXTENSION,
  ]);
  return hints;
}

/**
 * قراءة الباركود محلياً عبر الكاميرا — لا يُرفع الفيديو إلى خوادم المنصة.
 */
export function BarcodeScannerHub({ products, onMatchedProduct, onUnknownBarcode, compact }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastFireRef = useRef(0);
  const [active, setActive] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    setActive(false);
    const v = videoRef.current;
    if (v?.srcObject) {
      const tracks = (v.srcObject as MediaStream).getTracks();
      tracks.forEach((tr) => tr.stop());
      v.srcObject = null;
    }
  }, []);

  const matchProduct = useCallback(
    (code: string) => {
      const c = code.trim();
      if (!c) return;
      const bySku = products.find((p) => p.sku && p.sku.trim() === c);
      if (bySku) {
        onMatchedProduct(bySku.id, c);
        setHint(t("barcode.matchedSku"));
        return;
      }
      const loose = products.find((p) => {
        const nameCompact = (p.name || "").replace(/\s/g, "");
        const codeCompact = c.replace(/\s/g, "");
        const skuTrim = (p.sku || "").trim();
        return (
          (nameCompact && (nameCompact.includes(codeCompact) || codeCompact.includes(nameCompact))) ||
          (skuTrim && c.includes(skuTrim))
        );
      });
      if (loose) {
        onMatchedProduct(loose.id, c);
        setHint(t("barcode.matchedLoose"));
        return;
      }
      setHint(t("barcode.noMatch"));
      onUnknownBarcode?.(c);
    },
    [products, onMatchedProduct, onUnknownBarcode, t]
  );

  const startCamera = useCallback(async () => {
    setHint(null);
    try {
      await resumeAudioIfNeeded();
      const reader = new BrowserMultiFormatReader(buildDecodeHints(), {
        delayBetweenScanSuccess: 55,
        delayBetweenScanAttempts: 16,
      });
      const video = videoRef.current;
      if (!video) return;
      setActive(true);
      const controls = await reader.decodeFromVideoDevice(undefined, video, (result, err) => {
        if (!result) return;
        const text = result.getText()?.trim();
        if (!text) return;
        const now = Date.now();
        if (now - lastFireRef.current < 110) return;
        lastFireRef.current = now;
        playBarcodeScanBeep();
        setLastCode(text);
        matchProduct(text);
        if (err && String(err).includes("NotFound")) return;
      });
      controlsRef.current = controls;
    } catch {
      setHint(t("barcode.cameraError"));
      setActive(false);
    }
  }, [matchProduct, t]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-black/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-white font-black">
        <ScanBarcode className="size-6 text-fuchsia-400" />
        {t("barcode.title")}
      </div>
      <p className="text-xs text-slate-400">{t("barcode.hint")}</p>
      <p className="text-[10px] text-slate-600 leading-relaxed">{t("barcode.privacy")}</p>
      <div
        className={`relative mx-auto rounded-xl overflow-hidden bg-black border border-white/10 ${
          compact ? "max-h-52 aspect-[4/3] max-w-lg" : "aspect-video max-w-md"
        }`}
      >
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
            {t("barcode.previewOff")}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!active ? (
          <Button type="button" className="gap-2 bg-cyan-600 hover:bg-cyan-500" onClick={() => void startCamera()}>
            <Camera className="size-4" />
            {t("barcode.start")}
          </Button>
        ) : (
          <Button type="button" variant="secondary" className="gap-2" onClick={stopCamera}>
            <CameraOff className="size-4" />
            {t("barcode.stop")}
          </Button>
        )}
      </div>
      {lastCode && (
        <p className="text-xs text-cyan-300 font-mono">
          {t("barcode.last")}: {lastCode}
        </p>
      )}
      {hint && <p className="text-xs text-amber-200/90">{hint}</p>}
    </div>
  );
}
