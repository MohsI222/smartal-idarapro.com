import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, Bot, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sendAiChatMessage } from "@/lib/geminiClient";
import { ApiError } from "@/lib/api";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function AdminChatbot() {
  const { token } = useAuth();
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: locale.startsWith("ar")
        ? "مرحباً بك! أنا مساعدك الإداري الخبير في المساطر الإدارية المغربية. كيف يمكنني مساعدتك اليوم؟"
        : "Hello! I am your expert administrative assistant for Moroccan administrative procedures. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    start: startListening,
    stop: stopListening,
    listening,
    error: speechError,
    isSupported: speechIsSupported,
  } = useSpeechToText(locale);

  const { isSpeaking, currentMessageId, toggleSpeech } = useTextToSpeech();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const reply = await sendAiChatMessage(token, message, locale);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const apiErrorMessage = error instanceof ApiError ? error.message : null;
      const finalErrorMessage = apiErrorMessage || t("ai.error");
      toast.error(finalErrorMessage);

      const errorContent = (locale.startsWith("ar"))
        ? `عذراً، حدث خطأ في معالجة طلبك. ${apiErrorMessage ? `(${apiErrorMessage})` : 'يرجى المحاولة مرة أخرى.'}`
        : `Sorry, an error occurred. ${apiErrorMessage ? `(${apiErrorMessage})` : 'Please try again.'}`;

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorContent,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleMicClick = () => {
    if (!speechIsSupported) {
      toast.error(t("legalAi.speechPrivacy")); // Using a generic privacy/unsupported message
      return;
    }
    if (listening) {
      stopListening();
    } else {
      startListening((transcript) => {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      });
    }
  };

  useEffect(() => {
    if (speechError) {
      toast.error(t("ai.error"));
    }
  }, [speechError, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="border-slate-800 bg-[#0a1628]/90 w-full max-w-4xl mx-auto">
      <CardHeader className="border-b border-slate-800">
        <CardTitle className="flex items-center gap-2 text-cyan-400">
          <Sparkles className="size-5" />
          {locale.startsWith("ar")
            ? "المساعد الإداري الذكي"
            : "AI Administrative Assistant"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="h-[500px] flex flex-col gap-4">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex gap-3 max-w-[80%] ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.role === "user"
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-purple-500/20 text-purple-300"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="size-4" />
                    ) : (
                      <Bot className="size-4" />
                    )}
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-cyan-500/20 text-cyan-50"
                        : "bg-slate-800/50 text-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed flex-1">{msg.content}</p>
                      {msg.role === "assistant" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`flex-shrink-0 h-6 w-6 ${isSpeaking && currentMessageId === msg.id ? 'animate-pulse text-cyan-400' : 'text-slate-400 hover:text-cyan-400'}`}
                          onClick={() => toggleSpeech(msg.content, msg.id)}
                        >
                          {isSpeaking && currentMessageId === msg.id ? (
                            <VolumeX className="size-3" />
                          ) : (
                            <Volume2 className="size-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-500/20 text-purple-300">
                    <Bot className="size-4 animate-pulse" />
                  </div>
                  <div className="rounded-2xl px-4 py-3 bg-slate-800/50 text-slate-400">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-800">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                locale.startsWith("ar")
                  ? "اكتب سؤالك أو استخدم الميكروفون..."
                  : "Type your question or use the microphone..."
              }
              className="flex-1 bg-slate-900/50 border-slate-700 text-slate-100 placeholder:text-slate-500"
              disabled={loading}
            />
            {speechIsSupported && (
              <Button
                onClick={handleMicClick}
                variant={listening ? "destructive" : "outline"}
                size="icon"
                className="border-slate-700"
                disabled={loading}
                aria-label={listening ? t("legalAi.speechStop") : t("legalAi.speechMic")}
              >
                {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </Button>
            )}
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
              aria-label={t("support.send")}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
