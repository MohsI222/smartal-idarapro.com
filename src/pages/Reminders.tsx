import { useCallback, useEffect, useState } from "react";
import { Bell, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { tlDefaultExpectedEntryLocal } from "@/lib/tlDateTimeLocal";

type Row = {
  id: string;
  channel: string;
  target: string;
  message: string;
  due_at: string;
};

export function Reminders() {
  const { token, isApproved, approvedModules } = useAuth();
  const { t } = useI18n();
  const allowed = isApproved && approvedModules.includes("reminders");
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({
    channel: "email",
    target: "",
    message: "",
    due_at: tlDefaultExpectedEntryLocal(),
  });

  const load = useCallback(async () => {
    if (!token) return;
    const r = await api<{ reminders: Row[] }>("/reminders", { token });
    setRows(r.reminders);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!token) return;
    await api("/reminders", {
      method: "POST",
      token,
      body: JSON.stringify(form),
    });
    setForm({ channel: "email", target: "", message: "", due_at: tlDefaultExpectedEntryLocal() });
    await load();
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4 max-w-lg mx-auto">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("reminders.lockedTitle")}</h2>
        <p className="text-slate-400 text-sm">{t("reminders.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-3">
        <Bell className="size-8 text-orange-400" />
        <div>
          <h1 className="text-2xl font-bold">{t("reminders.title")}</h1>
          <p className="text-slate-400 text-sm">{t("reminders.subtitle")}</p>
        </div>
      </div>

      <Card className="border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">{t("reminders.new")}</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>{t("reminders.channel")}</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 text-sm"
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
            >
              <option value="email">{t("reminders.channelEmail")}</option>
              <option value="whatsapp">{t("reminders.channelWhatsapp")}</option>
            </select>
          </div>
          <div>
            <Label>{t("reminders.target")}</Label>
            <Input
              className="mt-1"
              value={form.target}
              onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
              placeholder="+2126..."
            />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("reminders.message")}</Label>
            <Input
              className="mt-1"
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("reminders.dueAt")}</Label>
            <Input
              className="mt-1"
              type="datetime-local"
              lang="en"
              dir="ltr"
              value={form.due_at}
              onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={() => void add()}>{t("reminders.save")}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80">
            <tr>
              <th className="p-3 text-right">{t("reminders.tableChannel")}</th>
              <th className="p-3 text-right">{t("reminders.tableTarget")}</th>
              <th className="p-3 text-right">{t("reminders.tableMessage")}</th>
              <th className="p-3 text-right">{t("reminders.tableWhen")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="p-3">{r.channel}</td>
                <td className="p-3">{r.target}</td>
                <td className="p-3">{r.message}</td>
                <td className="p-3">{r.due_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
