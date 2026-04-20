import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Headphones, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

type Msg = {
  id: string;
  from_admin: number;
  body: string;
  created_at: string;
};

export function SupportPage() {
  const { token, user } = useAuth();
  const { t, isRtl, formatNumber } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await api<{ messages: Msg[] }>("/support/messages", { token });
      setMessages(r.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    const text = draft.trim();
    if (!token || !text || sending) return;
    setSending(true);
    try {
      await api("/support/messages", {
        method: "POST",
        token,
        body: JSON.stringify({ body: text }),
      });
      setDraft("");
      await load();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Headphones className="size-9 text-[#0052CC] shrink-0" />
          <div>
            <h1 className="text-2xl font-black text-white">{t("support.title")}</h1>
            <p className="text-sm text-slate-400">{t("support.subtitle")}</p>
          </div>
        </div>
        {user?.role === "superadmin" && (
          <Button variant="outline" className="border-[#0052CC]/50 shrink-0" asChild>
            <Link to="/app/admin">{t("nav.admin")}</Link>
          </Button>
        )}
      </div>

      <Card className="border-white/10 bg-white/5 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-base">{t("support.thread")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">{t("common.loading")}</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-slate-500">{t("support.empty")}</p>
          ) : (
            <ul className="max-h-[420px] space-y-3 overflow-y-auto pe-1">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    m.from_admin
                      ? "border-emerald-500/35 bg-emerald-950/25 text-emerald-50"
                      : "border-slate-600/50 bg-[#050a12]/80 text-slate-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-2 text-[10px] text-slate-500 font-mono tabular-nums">
                    {m.from_admin ? t("support.fromTeam") : t("support.fromYou")} · {m.created_at}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={8000}
              placeholder={t("support.placeholder")}
              className="min-h-[88px] flex-1 rounded-xl border border-slate-700/80 bg-[#050a12]/80 px-3 py-2 text-sm text-white placeholder:text-slate-600"
            />
            <Button
              type="button"
              className="shrink-0 gap-2 sm:h-[88px] sm:px-6"
              disabled={sending || !draft.trim()}
              onClick={() => void send()}
            >
              <Send className="size-4" />
              {t("support.send")}
            </Button>
          </div>
          <p className="text-[10px] text-slate-600">
            {formatNumber(draft.length)} / {formatNumber(8000)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
