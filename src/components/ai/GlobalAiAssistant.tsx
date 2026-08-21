import { useState, useEffect } from "react";
import { Mic, MicOff, Send, Sparkles, X, MessageSquare, Bot, Volume2, VolumeX, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sendAiChatMessage } from "@/lib/geminiClient";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useEdgeTTS } from "@/hooks/useEdgeTTS";
import { getPersona, getPersonaBySection, type AiPersonaType } from "@/lib/aiPersonas";

interface GlobalAiAssistantProps {
  onFieldFill?: (fieldName: string, value: string) => void;
  availableFields?: string[];
  context?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  personaType?: AiPersonaType;
  section?: string;
}

export function GlobalAiAssistant({
  onFieldFill,
  availableFields = [],
  context = "",
  position = "bottom-right",
  personaType,
  section,
}: GlobalAiAssistantProps) {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  // Get persona based on section or personaType
  const persona = getPersona(personaType || (section ? getPersonaBySection(section) : "general"));
  
  // Speech hooks
  const { 
    isListening, 
    isSupported: speechRecognitionSupported, 
    transcript, 
    startListening: startSpeechRecognition, 
    stopListening: stopSpeechRecognition,
    resetTranscript 
  } = useSpeechRecognition();
  
  const { 
    speak, 
    stop: stopSpeaking, 
    isSpeaking,
    isLoading: ttsLoading 
  } = useEdgeTTS();

  // Initialize welcome message with persona
  useEffect(() => {
    const welcomeMessage = persona.name[locale as keyof typeof persona.name] || persona.name.en;
    setMessages([
      {
        role: "assistant",
        content: welcomeMessage + ". " + (locale.startsWith("ar") 
          ? "كيف يمكنني مساعدتك؟" 
          : "How can I help you?"),
      },
    ]);
  }, [persona, locale]);

  // Handle transcript from speech recognition
  useEffect(() => {
    if (transcript && !isListening) {
      setInput(transcript);
      resetTranscript();
    }
  }, [transcript, isListening, resetTranscript]);

  const handleStartListening = () => {
    if (!speechRecognitionSupported) {
      toast.error(locale.startsWith("ar")
        ? "المتصفح لا يدعم التعرف على الصوت"
        : "Browser does not support speech recognition");
      return;
    }
    startSpeechRecognition({ lang: locale });
  };

  const handleStopListening = () => {
    stopSpeechRecognition();
  };

  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage || loading) return;

    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);

    try {
      let enhancedPrompt = `You are ${persona.systemPrompt[locale as keyof typeof persona.systemPrompt] || persona.systemPrompt.en}\n\n`;
      if (context) {
        enhancedPrompt += `Context: ${context}\n\n`;
      }
      enhancedPrompt += `User: ${userMessage}`;
      
      if (availableFields.length > 0) {
        enhancedPrompt += `\n\nAvailable fields to fill: ${availableFields.join(", ")}`;
      }

      const reply = await sendAiChatMessage(token, enhancedPrompt, locale);
      const assistantMessage = { id: (Date.now() + 1).toString(), role: "assistant", content: reply };
      setMessages((prev) => [...prev, assistantMessage]);

      // Speak the response if auto-speak is enabled
      if (autoSpeak) {
        speak(reply, {
          voice: locale.startsWith("ar") ? "ar-MA-MounaNeural" : "en-US-JennyNeural",
          rate: persona.voiceSettings.rate,
          volume: persona.voiceSettings.volume,
          pitch: persona.voiceSettings.pitch,
        });
      }

      // Try to extract field values from the response
      if (onFieldFill && availableFields.length > 0) {
        parseAndFillFields(reply, availableFields, onFieldFill);
      }
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : t("ai.error");
      toast.error(msg);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: locale.startsWith("ar")
          ? "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى."
          : "Sorry, an error occurred. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const parseAndFillFields = (response: string, fields: string[], onFill: (name: string, value: string) => void) => {
    fields.forEach((field) => {
      const patterns = [
        new RegExp(`${field}\\s*[:=]\\s*([^\\n]+)`, "i"),
        new RegExp(`${field}\\s*is\\s+([^\\n]+)`, "i"),
      ];

      for (const pattern of patterns) {
        const match = response.match(pattern);
        if (match && match[1]) {
          onFill(field, match[1].trim());
          break;
        }
      }
    });
  };

  const positionClasses = {
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed ${positionClasses[position]} z-50 hover:scale-110 transition-transform`}
        style={{ backgroundColor: persona.color }}
        size="icon"
      >
        <span className="text-2xl">{persona.avatar}</span>
      </Button>
    );
  }

  return (
    <Card className={`fixed ${positionClasses[position]} z-50 w-96 max-h-[600px] flex flex-col border-slate-800 bg-[#0a1628]/95 shadow-2xl`}>
      <CardHeader className="border-b border-slate-800 p-3" style={{ background: `linear-gradient(to right, ${persona.color}20, transparent)` }}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm" style={{ color: persona.color }}>
            <span className="text-xl">{persona.avatar}</span>
            <span>{persona.name[locale as keyof typeof persona.name] || persona.name.en}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAutoSpeak(!autoSpeak)}
              className="text-slate-400 hover:text-slate-200"
              title={autoSpeak ? "Disable auto-speak" : "Enable auto-speak"}
            >
              {autoSpeak ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {persona.title[locale as keyof typeof persona.title] || persona.title.en}
        </p>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, index) => (
          <div
            key={`${msg.id}-${index}`}
            className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`flex gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  msg.role === "user"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "bg-purple-500/20 text-purple-300"
                }`}
              >
                {msg.role === "user" ? (
                  <MessageSquare className="size-3" />
                ) : (
                  <Bot className="size-3" />
                )}
              </div>
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-cyan-500/20 text-cyan-50"
                    : "bg-slate-800/50 text-slate-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="flex-1">{msg.content}</span>
                  {msg.role === "assistant" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-5 w-5 text-slate-400 hover:text-slate-200"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("Play button clicked for message:", msg.content.substring(0, 50));
                        // Stop any current audio first
                        stop();
                        // Small delay to ensure cleanup
                        setTimeout(() => {
                          void speak(msg.content, {
                            voice: locale.startsWith("ar") ? "ar-MA-MounaNeural" : "en-US-JennyNeural",
                            rate: persona.voiceSettings.rate,
                            volume: persona.voiceSettings.volume,
                            pitch: persona.voiceSettings.pitch,
                          });
                        }, 100);
                      }}
                      disabled={ttsLoading}
                    >
                      {isSpeaking ? <VolumeX className="size-3" /> : <Play className="size-3" />}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="flex gap-2">
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-purple-500/20 text-purple-300">
                <Bot className="size-3 animate-pulse" />
              </div>
              <div className="rounded-lg px-3 py-2 bg-slate-800/50 text-slate-400 text-sm">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <div className="p-3 border-t border-slate-800">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              locale.startsWith("ar")
                ? "اكتب أو استخدم الميكروفون..."
                : "Type or use microphone..."
            }
            className="flex-1 bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          {speechRecognitionSupported && (
            <Button
              onClick={isListening ? handleStopListening : handleStartListening}
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              className="border-slate-700"
              disabled={loading}
            >
              {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>
          )}
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="hover:opacity-90"
            style={{ backgroundColor: persona.color }}
            size="icon"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
