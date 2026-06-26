import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { formatLatinTime } from "@/lib/latinNumeralFormat";
import { api, getApiUrlPrefix } from "@/lib/api";

type Msg = {
  id: string;
  from: "me" | "team";
  text: string;
  time: string;
  attachmentName?: string;
  attachmentUrl?: string;
};

export function InternalChatModule() {
  const { t } = useI18n();
  const { user, token, isApproved, approvedModules } = useAuth();
  const allowed = isApproved && approvedModules.includes("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const loadMessages = async () => {
    if (!token) return;
    try {
      const data = await api<{
        messages: Array<{
          id: string;
          from_admin: number;
          body: string | null;
          created_at: string;
          attachment_name?: string | null;
          attachment_url?: string | null;
        }>;
      }>("/internal/messages", { token });
      setMessages(
        data.messages.map((message) => ({
          id: message.id,
          from: message.from_admin ? "team" : "me",
          text: message.body || "",
          time: formatLatinTime(new Date(message.created_at)),
          attachmentName: message.attachment_name ?? undefined,
          attachmentUrl: message.attachment_url ?? undefined,
        }))
      );
    } catch (error) {
      console.error("[chat] loadMessages failed", error);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void loadMessages();
  }, [allowed, token]);

  const send = async () => {
    if (!token) return;
    const text = draft.trim();
    if (!text && !attachment) return;
    setSending(true);
    try {
      const form = new FormData();
      if (text) form.append("body", text);
      if (attachment) form.append("attachment", attachment, attachment.name);
      const res = await fetch(`${getApiUrlPrefix()}/internal/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }
      setDraft("");
      setAttachment(null);
      await loadMessages();
    } catch (error) {
      console.error("[chat] send failed", error);
    } finally {
      setSending(false);
    }
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
        {messages.length === 0 ? (
          <div className="text-slate-400 text-sm">{t("chat.noMessages")}</div>
        ) : (
          messages.map((msg) => (
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
                <p>{msg.text || t("chat.emptyMessage")}</p>
                {msg.attachmentName && msg.attachmentUrl && (
                  <div className="mt-2">
                    <a
                      href={msg.attachmentUrl}
                      className="text-xs font-semibold text-cyan-200 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("chat.downloadAttachment")} · {msg.attachmentName}
                    </a>
                  </div>
                )}
                <p className="text-[10px] mt-1 opacity-70">{msg.time}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <footer className="shrink-0 border-t border-slate-800/80 p-3 bg-[#050a12]/40">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={t("chat.placeholder")}
              className="bg-[#050a12] border-slate-700"
            />
            <label className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.txt,.zip,image/*"
                className="hidden"
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="secondary" className="gap-2 text-xs px-3 py-2">
                <Paperclip className="size-4" />
                {t("chat.attachFile")}
              </Button>
            </label>
          </div>
          <Button
            type="button"
            onClick={send}
            disabled={sending || (!draft.trim() && !attachment)}
            className="shrink-0 bg-[#FF8C00] text-[#050a12] hover:bg-[#e67e00]"
          >
            <Send className="size-4" />
          </Button>
        </div>
        {attachment ? (
          <div className="mt-2 text-xs text-slate-300">
            {t("chat.selectedAttachment")} {attachment.name}
          </div>
        ) : null}
      </footer>
    </div>
  );
}
