import { useRef, useState, useCallback, useEffect } from "react";

export interface EdgeTTSSettings {
  voice: string;
  rate: number;
  volume: number;
  pitch: number;
}

export function useEdgeTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string, settings: Partial<EdgeTTSSettings> = {}) => {
    if (!text.trim()) return;

    // Stop any ongoing speech
    stop();

    setIsLoading(true);
    setIsSpeaking(true);

    try {
      const rate = settings.rate ?? 1.0;
      const volume = settings.volume ?? 1.0;
      const pitch = settings.pitch ?? 1.0;

      console.log("Starting TTS with Web Speech API for:", text.substring(0, 50) + "...");

      // Check if browser supports speech synthesis
      if (!('speechSynthesis' in window)) {
        throw new Error("Browser does not support speech synthesis");
      }

      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // Set utterance properties
      utterance.rate = rate;
      utterance.volume = volume;
      utterance.pitch = pitch;

      // Try to find an Arabic voice
      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find(voice => voice.lang.startsWith('ar'));
      if (arabicVoice) {
        utterance.voice = arabicVoice;
        utterance.lang = arabicVoice.lang;
      } else {
        // Fallback to default
        utterance.lang = 'ar-SA';
      }

      // Event handlers
      utterance.onstart = () => {
        console.log("Speech started");
        setIsLoading(false);
      };

      utterance.onend = () => {
        console.log("Speech ended");
        setIsSpeaking(false);
        setIsLoading(false);
        utteranceRef.current = null;
      };

      utterance.onerror = (error) => {
        console.error("Speech synthesis error:", error);
        setIsSpeaking(false);
        setIsLoading(false);
        utteranceRef.current = null;
      };

      // Start speaking
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("TTS Error:", error);
      setIsSpeaking(false);
      setIsLoading(false);
      utteranceRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  const pause = useCallback(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsSpeaking(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsSpeaking(true);
    }
  }, []);

  // Load voices when they become available
  useEffect(() => {
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isLoading,
  };
}
