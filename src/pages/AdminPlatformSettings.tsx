import { useCallback, useEffect, useState } from "react";
import { Copy, Landmark, Link2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { Link } from "react-router-dom";

const KEYS = [
  "social_whatsapp",
  "social_facebook",
  "social_instagram",
  "social_tiktok",
  "social_youtube",
  "social_linkedin",
  "youtube_channel_id",
  "bank_name",
  "bank_rib",
  "bank_iban",
  "bank_holder",
] as const;

export function AdminPlatformSettings() {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/settings/public");
    const j = (await r.json()) as { settings: Record<string, string> };
    setSettings(j.settings ?? {});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!token) return;
    await api("/settings/platform", { method: "PUT", token, body: JSON.stringify(settings) });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const copy = (v: string) => {
    void navigator.clipboard.writeText(v);
  };

  if (user?.role !== "superadmin") {
    return (
      <div className="text-center py-16 text-slate-400">
        {t("admin.forbidden")}
        <Link to="/app" className="block mt-4 text-[#0052CC]">
          {t("admin.back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Link2 className="size-7 text-[#FF8C00]" />
          {t("adminPlatform.title")}
        </h1>
        <p className="text-slate-400 text-sm mt-1">{t("adminPlatform.subtitle")}</p>
      </div>

      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader className="border-b border-slate-800">
          <p className="font-black text-white flex items-center gap-2">
            <Link2 className="size-4" />
            {t("adminPlatform.social")}
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {KEYS.slice(0, 6).map((k) => (
            <div key={k}>
              <Label className="text-slate-400 text-xs uppercase">{k}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  className="bg-[#0c1222] border-slate-700 font-mono text-sm"
                  value={settings[k] ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))}
                />
                <Button type="button" variant="secondary" size="icon" onClick={() => copy(settings[k] ?? "")}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader className="border-b border-slate-800">
          <p className="font-black text-white flex items-center gap-2">
            <Landmark className="size-4" />
            {t("adminPlatform.bank")}
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {KEYS.slice(8).map((k) => (
            <div key={k}>
              <Label className="text-slate-400 text-xs uppercase">{k}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  className="bg-[#0c1222] border-slate-700 font-mono text-sm"
                  value={settings[k] ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))}
                />
                <Button type="button" variant="secondary" size="icon" onClick={() => copy(settings[k] ?? "")}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button type="button" className="w-full gap-2 bg-[#0052CC] font-black" onClick={() => void save()}>
        <Save className="size-4" />
        {saved ? t("common.saved") : t("common.save")}
      </Button>
    </div>
  );
}
