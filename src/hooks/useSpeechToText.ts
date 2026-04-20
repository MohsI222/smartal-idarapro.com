import { useCallback, useRef, useState } from "react";

type RecognitionCtor = new () => SpeechRecognition;

function getRecognition(): { Recognition: RecognitionCtor | null; isSupported: boolean } {
  if (typeof window === "undefined") return { Recognition: null, isSupported: false };
  const W = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  const Recognition = W.SpeechRecognition ?? W.webkitSpeechRecognition ?? null;
  return { Recognition, isSupported: Boolean(Recognition) };
}

/**
 * تحويل الكلام إلى نص عبر Web Speech API — يعمل في المتصفحات المدعومة (Chrome/Edge/Safari محدود).
 * لا يُرسل الصوت إلى خوادم المنصة؛ المعالجة عبر محرك المتصفح أو مزود النظام.
 */
export function useSpeechToText(localeHint: string) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);

  const start = useCallback(
    (onResult: (text: string) => void) => {
      const { Recognition, isSupported } = getRecognition();
      if (!isSupported || !Recognition) {
        setError("speech_unsupported");
        return;
      }
      setError(null);
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
      const rec = new Recognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = localeHint.startsWith("ar")
        ? "ar-MA"
        : localeHint.startsWith("fr")
          ? "fr-FR"
          : localeHint.startsWith("es")
            ? "es-ES"
            : "en-US";
      rec.onresult = (ev: SpeechRecognitionEvent) => {
        const text = Array.from(ev.results)
          .map((r) => r[0]?.transcript ?? "")
          .join(" ")
          .trim();
        if (text) onResult(text);
        setListening(false);
      };
      rec.onerror = () => {
        setListening(false);
        setError("speech_error");
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      try {
        rec.start();
      } catch {
        setListening(false);
        setError("speech_error");
      }
    },
    [localeHint]
  );

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  return { start, stop, listening, error, isSupported: getRecognition().isSupported };
}
