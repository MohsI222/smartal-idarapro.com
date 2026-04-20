import { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

type Msg = { id: string; from: "me" | "team"; text: string; time: string };

const SEED: Msg[] = [
  {
    id: "1",
    from: "team",
    text: "مرحباً، فريق الدعم هنا — كيف يمكننا مساعدتك اليوم؟",
    time: "09:12",
  },
];

export function InternalChatModule() {
  const { t } = useI18n();
  const { user, isApproved, approvedModules } = useAuth();
  const allowed = isApproved && approvedModules.includes("chat");
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState("");

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        from: "me",
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setDraft("");
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4 max-w-lg mx-auto">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("chat.lockedTitle")}</h2>
        <p className="text-slate-400 text-sm">{t("chat.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[min(720px,calc(100vh-12rem))] max-w-3xl border border-slate-800/80 rounded-2xl bg-[#0a1628]/80 overflow-hidden">
      <header className="shrink-0 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between bg-[#050a12]/50">
        <div>
          <h1 className="font-bold text-white">{t("chat.title")}</h1>
          <p className="text-xs text-slate-500">{t("chat.subtitle")}</p>
        </div>
        <span className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(52,211,153,0.6)]" title="online" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"} idara-animate-in`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.from === "me"
                  ? "bg-[#0052CC] text-white rounded-br-md"
                  : "bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-bl-md"
              }`}
            >
              {msg.from === "team" && (
                <p className="text-[10px] text-[#FF8C00] mb-1 font-semibold">{t("chat.teamLabel")}</p>
              )}
              {msg.from === "me" && (
                <p className="text-[10px] text-slate-300/90 mb-1">{user?.name ?? "—"}</p>
              )}
              <p>{msg.text}</p>
              <p className="text-[10px] mt-1 opacity-70">{msg.time}</p>
            </div>
          </div>
        ))}
      </div>

      <footer className="shrink-0 border-t border-slate-800/80 p-3 flex gap-2 bg-[#050a12]/40">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("chat.placeholder")}
          className="bg-[#050a12] border-slate-700"
        />
        <Button type="button" onClick={send} className="shrink-0 bg-[#FF8C00] text-[#050a12] hover:bg-[#e67e00]">
          <Send className="size-4" />
        </Button>
      </footer>
    </div>
  );
}
