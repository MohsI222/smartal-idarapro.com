import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import Quagga from "quagga";
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
  /** استخدام Quagga بدلاً من ZXing (أفضل للباركودات 1D) */
  useQuagga?: boolean;
};

function buildDecodeHints(): Map<DecodeHintType, unknown> {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.TRY_READ_INVERTED, true); // Read inverted barcodes
  hints.set(DecodeHintType.ASSUME_GS1, true); // Better for retail products
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_8,    // Most common for small products
    BarcodeFormat.EAN_13,   // Standard retail
    BarcodeFormat.UPC_A,    // US retail
    BarcodeFormat.UPC_E,    // Compressed UPC
    BarcodeFormat.CODE_128, // Logistics
    BarcodeFormat.CODE_39,  // Industrial
    BarcodeFormat.CODE_93,
    BarcodeFormat.CODABAR,
    BarcodeFormat.ITF,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.QR_CODE,
  ]);
  return hints;
}

/**
 * قراءة الباركود محلياً عبر الكاميرا — لا يُرفع الفيديو إلى خوادم المنصة.
 */
export function BarcodeScannerHub({ products, onMatchedProduct, onUnknownBarcode, compact, useQuagga = true }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastFireRef = useRef(0);
  const [active, setActive] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const quaggaRef = useRef<boolean>(false);
  const quaggaContainerRef = useRef<HTMLDivElement>(null);

  // Cleanup Quagga on unmount
  useEffect(() => {
    return () => {
      if (quaggaRef.current) {
        try {
          Quagga.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const stopCamera = useCallback(() => {
    try {
      if (quaggaRef.current) {
        Quagga.stop();
        quaggaRef.current = false;
      } else {
        controlsRef.current?.stop();
      }
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
      // Match exact SKU only - no loose name matching
      const bySku = products.find((p) => p.sku && p.sku.trim() === c);
      if (bySku) {
        onMatchedProduct(bySku.id, c);
        setHint(t("barcode.matchedSku"));
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
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHint(t("barcode.cameraNotSupported"));
        return;
      }

      await resumeAudioIfNeeded();
      const video = videoRef.current;
      if (!video) return;
      setActive(true);

      if (useQuagga) {
        // Use Quagga for better 1D barcode support (EAN-13, EAN-8, UPC)
        const container = quaggaContainerRef.current;
        if (!container) return;

        Quagga.init({
          inputStream: {
            name: "Live",
            type: "LiveStream",
            target: container,
            constraints: {
              facingMode: "environment",
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 },
            },
          },
          locator: {
            patchSize: "medium",
            halfSample: true,
          },
          numOfWorkers: 2,
          decoder: {
            readers: [
              "ean_reader",       // EAN-13
              "ean_8_reader",     // EAN-8 (small products)
              "upc_reader",       // UPC-A
              "upc_e_reader",     // UPC-E (compressed)
              "code_128_reader",  // Code 128
              "code_39_reader",   // Code 39
            ],
          },
          locate: true,
        }, (err) => {
          if (err) {
            console.error("Quagga init error:", err);
            setHint(`${t("barcode.cameraError")}: ${err.message}`);
            setActive(false);
            return;
          }
          Quagga.start();
          quaggaRef.current = true;
        });

        Quagga.onDetected((result) => {
          const code = result.codeResult.code;
          if (!code) return;
          const now = Date.now();
          if (now - lastFireRef.current < 200) return; // Longer cooldown for Quagga
          lastFireRef.current = now;
          playBarcodeScanBeep();
          setLastCode(code);
          matchProduct(code);
        });
      } else {
        // Use ZXing as fallback
        // Request camera permissions explicitly with better settings for small barcodes
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },  // Higher resolution for small barcodes
            height: { ideal: 1080 },
            focusMode: "continuous",  // Continuous autofocus
          },
        });

        // Stop the test stream immediately after permission check
        stream.getTracks().forEach(track => track.stop());

        const reader = new BrowserMultiFormatReader(buildDecodeHints(), {
          delayBetweenScanSuccess: 50,  // Slower cooldown to avoid duplicate scans
          delayBetweenScanAttempts: 5,   // Faster attempts for small barcodes
        });
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result, err) => {
          if (!result) return;
          const text = result.getText()?.trim();
          if (!text) return;
          const now = Date.now();
          if (now - lastFireRef.current < 50) return;
          lastFireRef.current = now;
          playBarcodeScanBeep();
          setLastCode(text);
          matchProduct(text);
          if (err && String(err).includes("NotFound")) return;
        });
        controlsRef.current = controls;
      }
    } catch (err) {
      console.error("Camera error:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.message.includes("Permission denied")) {
          setHint(t("barcode.cameraPermissionDenied"));
        } else if (err.name === "NotFoundError" || err.message.includes("not found")) {
          setHint(t("barcode.cameraNotFound"));
        } else if (err.name === "NotReadableError" || err.message.includes("readable")) {
          setHint(t("barcode.cameraNotReadable"));
        } else {
          setHint(`${t("barcode.cameraError")}: ${err.message}`);
        }
      } else {
        setHint(t("barcode.cameraError"));
      }
      setActive(false);
    }
  }, [matchProduct, t, useQuagga]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-black/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-white font-black">
        <ScanBarcode className="size-6 text-fuchsia-400" />
        {t("barcode.title")}
      </div>
      <p className="text-xs text-slate-400">{t("barcode.hint")}</p>
      <p className="text-[10px] text-cyan-300 leading-relaxed">✓ دعم مسدس الباركود السلكي واللاسلكي - يعمل تلقائياً عند توجيهه نحو الباركود</p>
      <p className="text-[10px] text-slate-600 leading-relaxed">{t("barcode.privacy")}</p>
      <div
        id="interactive"
        ref={quaggaContainerRef}
        className={`relative mx-auto rounded-xl overflow-hidden bg-black border border-white/10 ${
          compact ? "max-h-52 aspect-[4/3] max-w-lg" : "aspect-video max-w-md"
        }`}
      >
        {useQuagga ? (
          <div className="viewport" />
        ) : (
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        )}
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
