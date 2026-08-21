import { useRef, useEffect, useState } from "react";

export interface SpeechSettings {
  pitch: number;
  rate: number;
  volume: number;
  lang: string;
}

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);
      
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };

      loadVoices();
      
      // Some browsers load voices asynchronously
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }

      return () => {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);

  const getVoiceForLanguage = (lang: string): SpeechSynthesisVoice | null => {
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
    };

    const targetLang = langMap[lang] || lang;
    
    // Try to find exact match first
    let voice = availableVoices.find(v => v.lang === targetLang);
    
    // If not found, try to find voice that starts with the language code
    if (!voice) {
      const langCode = targetLang.split("-")[0];
      voice = availableVoices.find(v => v.lang.startsWith(langCode));
    }
    
    // Default to first available voice if still not found
    if (!voice && availableVoices.length > 0) {
      voice = availableVoices[0];
    }
    
    return voice || null;
  };

  const speak = (text: string, settings: Partial<SpeechSettings> = {}) => {
    if (!isSupported || !text.trim()) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Apply settings
    utterance.pitch = settings.pitch ?? 1;
    utterance.rate = settings.rate ?? 1;
    utterance.volume = settings.volume ?? 1;
    utterance.lang = settings.lang ?? "en-US";

    // Select appropriate voice
    const voice = getVoiceForLanguage(settings.lang || "en-US");
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utterance.onpause = () => setIsSpeaking(false);
    utterance.onresume = () => setIsSpeaking(true);

    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const pause = () => {
    if (isSupported && isSpeaking) {
      window.speechSynthesis.pause();
      setIsSpeaking(false);
    }
  };

  const resume = () => {
    if (isSupported) {
      window.speechSynthesis.resume();
      setIsSpeaking(true);
    }
  };

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isSupported,
    availableVoices,
    getVoiceForLanguage,
  };
}
