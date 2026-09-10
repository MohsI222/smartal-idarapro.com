import { useRef, useEffect, useState, useCallback } from "react";

export interface RecognitionSettings {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        setIsSupported(true);
        recognitionRef.current = new SpeechRecognition();
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const getLanguageCode = (lang: string): string => {
    const langMap: Record<string, string> = {
      "ar-MA": "ar-MA",
      "ar": "ar-SA",
      "fr": "fr-FR",
      "en": "en-US",
      "es": "es-ES",
      "de": "de-DE",
      "it": "it-IT",
      "pt": "pt-PT",
      "ru": "ru-RU",
      "zh": "zh-CN",
      "ja": "ja-JP",
      "ko": "ko-KR",
      "nl": "nl-NL",
      "pl": "pl-PL",
      "tr": "tr-TR",
      "hi": "hi-IN",
      "bn": "bn-IN",
      "th": "th-TH",
      "vi": "vi-VN",
      "id": "id-ID",
      "ms": "ms-MY",
      "sv": "sv-SE",
      "no": "no-NO",
      "da": "da-DK",
      "fi": "fi-FI",
      "el": "el-GR",
      "he": "he-IL",
      "uk": "uk-UA",
      "cs": "cs-CZ",
      "ro": "ro-RO",
      "hu": "hu-HU",
    };
    return langMap[lang] || "en-US";
  };

  const startListening = useCallback((settings: Partial<RecognitionSettings> = {}) => {
    if (!recognitionRef.current) {
      setError("Speech recognition not supported");
      return;
    }

    // Stop any existing recognition
    try {
      recognitionRef.current.stop();
    } catch (e) {
      // Ignore if not running
    }

    const recognition = recognitionRef.current;
    
    recognition.continuous = settings.continuous ?? false;
    recognition.interimResults = settings.interimResults ?? true;
    recognition.lang = getLanguageCode(settings.lang ?? "en-US");
    recognition.maxAlternatives = settings.maxAlternatives ?? 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTrans = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTrans += transcript;
        }
      }

      setTranscript(finalTranscript);
      setInterimTranscript(interimTrans);
    };

    recognition.onerror = (event: any) => {
      const errorMessages: Record<string, string> = {
        "no-speech": "No speech detected",
        "audio-capture": "No microphone found",
        "not-allowed": "Microphone permission denied",
        "network": "Network error",
        "aborted": "Recognition aborted",
        "language-not-supported": "Language not supported",
      };

      setError(errorMessages[event.error] || `Recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setError("Failed to start recognition");
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
