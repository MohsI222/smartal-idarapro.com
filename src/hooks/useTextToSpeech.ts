import { useState, useCallback, useRef, useEffect } from 'react';
import { useEdgeTTS } from './useEdgeTTS';

interface UseTextToSpeechOptions {
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}) {
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const { onSpeakStart, onSpeakEnd } = options;
  const { speak: edgeSpeak, stop: edgeStop, isSpeaking, isLoading } = useEdgeTTS();

  // Clean Markdown characters from text
  const cleanMarkdown = (text: string): string => {
    return text
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '') // Remove inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/__([^_]+)__/g, '$1') // Remove bold underscore
      .replace(/_([^_]+)_/g, '$1') // Remove italic underscore
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();
  };

  // Detect language from text
  const detectLanguage = (text: string): string => {
    const arabicRegex = /[\u0600-\u06FF]/;
    const frenchRegex = /[àâäéèêëïîôùûüÿœæç]/;
    
    if (arabicRegex.test(text)) {
      return 'ar-MA-MounaNeural';
    } else if (frenchRegex.test(text)) {
      return 'fr-FR-DeniseNeural';
    }
    return 'en-US-JennyNeural';
  };

  const stopSpeaking = useCallback(() => {
    edgeStop();
    setCurrentMessageId(null);
    if (onSpeakEnd) {
      onSpeakEnd();
    }
  }, [edgeStop, onSpeakEnd]);

  const speak = useCallback((text: string, messageId: string) => {
    const cleanedText = cleanMarkdown(text);
    if (!cleanedText) return;

    const voice = detectLanguage(text);
    
    setCurrentMessageId(messageId);
    if (onSpeakStart) {
      onSpeakStart();
    }

    edgeSpeak(cleanedText, {
      voice,
      rate: 1.0,
      volume: 1.0,
      pitch: 1.0,
    }).then(() => {
      setCurrentMessageId(null);
      if (onSpeakEnd) {
        onSpeakEnd();
      }
    }).catch(() => {
      setCurrentMessageId(null);
      if (onSpeakEnd) {
        onSpeakEnd();
      }
    });
  }, [edgeSpeak, onSpeakStart, onSpeakEnd]);

  const toggleSpeech = useCallback((text: string, messageId: string) => {
    if (isSpeaking && currentMessageId === messageId) {
      stopSpeaking();
    } else {
      speak(text, messageId);
    }
  }, [isSpeaking, currentMessageId, stopSpeaking, speak]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  return {
    isSpeaking,
    isLoading,
    currentMessageId,
    speak,
    stopSpeaking,
    toggleSpeech,
  };
}
