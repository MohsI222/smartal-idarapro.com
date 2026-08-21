/**
 * Hook للتعامل مع مسدس الباركود السلكي واللاسلكي
 * مسدسات الباركود تعمل كـ USB HID keyboard - ترسل الأحرف بسرعة عالية متبوعة بـ Enter
 */
import { useCallback, useEffect, useRef } from "react";

type UseBarcodeScannerOptions = {
  /** الحد الأقصى للزمن بين الأحرف للتمييز بين مسدس الباركود والإدخال اليدوي */
  maxKeyInterval?: number;
  /** الحد الأدنى لطول الباركود */
  minBarcodeLength?: number;
  /** استدعاء عند قراءة باركود بنجاح */
  onBarcodeScanned: (barcode: string) => void;
  /** استدعاء عند بدء الإدخال (اختياري) */
  onScanStart?: () => void;
  /** استدعاء عند انتهاء الإدخال (اختياري) */
  onScanEnd?: () => void;
};

export function useBarcodeScanner({
  maxKeyInterval = 100, // 100ms بين الأحرف = مسدس باركود
  minBarcodeLength = 3,
  onBarcodeScanned,
  onScanStart,
  onScanEnd,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);

  const resetBuffer = useCallback(() => {
    bufferRef.current = "";
    lastKeyTimeRef.current = 0;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (isScanningRef.current) {
      isScanningRef.current = false;
      onScanEnd?.();
    }
  }, [onScanEnd]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // تجاهل الأحداث من عناصر الإدخال النشطة
      const target = e.target as HTMLElement;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) {
        return;
      }

      // تجاهل مفاتيح التعديل
      if (["Shift", "Control", "Alt", "Meta", "CapsLock", "NumLock", "ScrollLock"].includes(e.key)) {
        return;
      }

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;

      // إذا كان هذا أول مفتاح أو الزمن طويل جداً، ابدأ buffer جديد
      if (lastKeyTimeRef.current === 0 || timeSinceLastKey > maxKeyInterval) {
        resetBuffer();
        bufferRef.current = "";
      }

      lastKeyTimeRef.current = now;

      // إشارة بدء المسح
      if (!isScanningRef.current && bufferRef.current === "") {
        isScanningRef.current = true;
        onScanStart?.();
      }

      // معالجة المفتاح
      if (e.key === "Enter") {
        // Enter = إنهاء الباركود
        e.preventDefault();
        const barcode = bufferRef.current.trim();
        
        if (barcode.length >= minBarcodeLength) {
          onBarcodeScanned(barcode);
        }
        
        resetBuffer();
      } else if (e.key === "Escape") {
        // Escape = إلغاء المسح
        e.preventDefault();
        resetBuffer();
      } else if (e.key.length === 1) {
        // أحرف عادية
        e.preventDefault();
        bufferRef.current += e.key;
        
        // إعادة تعيين إذا لم يكن هناك Enter خلال فترة زمنية معينة
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => {
          resetBuffer();
        }, maxKeyInterval + 50);
      }
    },
    [maxKeyInterval, minBarcodeLength, onBarcodeScanned, onScanStart, onScanEnd, resetBuffer]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      resetBuffer();
    };
  }, [handleKeyDown, resetBuffer]);

  return {
    reset: resetBuffer,
    isScanning: isScanningRef.current,
  };
}
