import { useCallback, useEffect, useState } from "react";
import { Copy, Landmark, Link2, Loader2, Save, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, getApiUrlPrefix } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { MediaLibraryManager } from "@/components/MediaLibraryManager";

const KEYS = [
  "social_whatsapp",
  "social_facebook",
  "social_instagram",
  "social_tiktok",
  "social_youtube",
  "social_linkedin",
  "youtube_channel_id",
  "how_it_works_media_url",
  "how_it_works_media_type",
  "bank_name",
  "bank_rib",
  "bank_iban",
  "bank_holder",
] as const;

const SOCIAL_KEYS = KEYS.slice(0, 7);
const HOW_IT_WORKS_KEYS = KEYS.slice(7, 9);
const BANK_KEYS = KEYS.slice(9);

function buildSettingsRecord(raw: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(KEYS.map((k) => [k, String(raw?.[k] ?? "")])) as Record<string, string>;
}

export function AdminPlatformSettings() {
  const { token, isAdmin } = useAuth();
  const { t } = useI18n();
  const [settings, setSettings] = useState<Record<string, string>>(() => buildSettingsRecord({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const canEdit = Boolean(isAdmin);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prefix = getApiUrlPrefix().replace(/\/$/, "");
      const r = await fetch(`${prefix}/settings/public`);
      const text = await r.text();
      let j: { settings?: Record<string, string> } = {};
      try {
        j = JSON.parse(text) as { settings?: Record<string, string> };
      } catch {
        throw new Error("invalid_json");
      }
      setSettings(buildSettingsRecord(j.settings));
    } catch {
      toast.error(t("adminPlatform.loadError"));
      setSettings(buildSettingsRecord({}));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!token || !canEdit) return;
    setSaving(true);
    try {
      const payload = buildSettingsRecord(settings);
      await api("/settings/platform", { method: "PUT", token, body: JSON.stringify(payload) });
      toast.success(t("common.saved"));
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t("adminPlatform.saveError");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const copy = (v: string) => {
    void navigator.clipboard.writeText(v);
    toast.success(t("adminPlatform.copied"));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("حجم الملف كبير جداً. الحد الأقصى 10MB");
      return;
    }

    setUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setSettings((s) => ({ ...s, how_it_works_media_url: dataUrl }));
        
        // Auto-detect media type
        if (file.type.startsWith("video/")) {
          setSettings((s) => ({ ...s, how_it_works_media_type: "video" }));
        } else if (file.type.startsWith("image/")) {
          setSettings((s) => ({ ...s, how_it_works_media_type: "image" }));
        }
        
        toast.success("تم رفع الملف بنجاح - اضغط حفظ للحفظ الدائم");
        setUploadingFile(false);
      };
      reader.onerror = () => {
        toast.error("فشل رفع الملف");
        setUploadingFile(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("فشل رفع الملف");
      setUploadingFile(false);
    }
  };

  const handleDeleteMedia = () => {
    setSettings((s) => ({ 
      ...s, 
      how_it_works_media_url: "", 
      how_it_works_media_type: "" 
    }));
    toast.success("تم مسح الوسائط - اضغط حفظ للتأكيد");
  };

  const fieldLabel = (k: string): string => {
    if (k === "youtube_channel_id") return t("adminPlatform.youtubeChannelId");
    if (k === "how_it_works_media_url") return "رابط الوسائط (كيف تعمل المنصة)";
    if (k === "how_it_works_media_type") return "نوع الوسائط";
    const map: Record<string, string> = {
      social_whatsapp: "WhatsApp",
      social_facebook: "Facebook",
      social_instagram: "Instagram",
      social_tiktok: "TikTok",
      social_youtube: "YouTube",
      social_linkedin: "LinkedIn",
      bank_name: t("adminPlatform.field.bankName"),
      bank_rib: t("adminPlatform.field.bankRib"),
      bank_iban: t("adminPlatform.field.bankIban"),
      bank_holder: t("adminPlatform.field.bankHolder"),
    };
    return map[k] ?? k.replace(/_/g, " ");
  };

  if (!canEdit) {
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

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
          <Loader2 className="size-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <>
          <Card className="border-slate-800 bg-[#0a1628]/90">
            <CardHeader className="border-b border-slate-800">
              <p className="font-black text-white flex items-center gap-2">
                <Link2 className="size-4" />
                {t("adminPlatform.social")}
              </p>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {SOCIAL_KEYS.map((k) => (
                <div key={k}>
                  <Label className="text-slate-400 text-xs font-semibold">{fieldLabel(k)}</Label>
                  {k === "youtube_channel_id" && (
                    <p className="text-[11px] text-slate-500 mt-1 mb-1">{t("adminPlatform.youtubeChannelHint")}</p>
                  )}
                  <div className="flex gap-2 mt-1">
                    <Input
                      className="bg-[#0c1222] border-slate-700 font-mono text-sm"
                      dir="ltr"
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
                <Link2 className="size-4" />
                كيف تعمل المنصة
              </p>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {HOW_IT_WORKS_KEYS.map((k) => (
                <div key={k}>
                  <Label className="text-slate-400 text-xs font-semibold">{fieldLabel(k)}</Label>
                  {k === "how_it_works_media_type" && (
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-[#0c1222] px-3 py-2 text-sm text-slate-200"
                      value={settings[k] ?? ""}
                      onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))}
                    >
                      <option value="">اختر نوع الوسائط</option>
                      <option value="youtube">YouTube</option>
                      <option value="video">فيديو محلي (MP4/WebM)</option>
                      <option value="image">صورة</option>
                    </select>
                  )}
                  {k === "how_it_works_media_url" && (
                    <>
                      <Input
                        className="mt-1 bg-[#0c1222] border-slate-700 font-mono text-sm"
                        dir="ltr"
                        placeholder="رابط YouTube أو رابط الفيديو/الصورة"
                        value={settings[k] ?? ""}
                        onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))}
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        أدخل رابط YouTube أو رابط مباشر لفيديو/صورة
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <Upload className="size-4 text-slate-500 shrink-0" />
                        <Input
                          type="file"
                          accept="image/*,video/*"
                          onChange={(e) => {
                            handleFileUpload(e);
                            e.target.value = "";
                          }}
                          disabled={uploadingFile}
                          className="cursor-pointer text-slate-300"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        أو ارفع فيديو/صورة من جهازك
                      </p>
                      {(settings[k] && settings[k].length > 0) && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteMedia}
                          className="mt-2 w-full gap-2"
                        >
                          <Trash2 className="size-4" />
                          حذف الوسائط
                        </Button>
                      )}
                    </>
                  )}
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
              {BANK_KEYS.map((k) => (
                <div key={k}>
                  <Label className="text-slate-400 text-xs font-semibold">{fieldLabel(k)}</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      className="bg-[#0c1222] border-slate-700 font-mono text-sm"
                      dir="ltr"
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
                <Link2 className="size-4" />
                مكتبة الفيديوهات والصور
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <MediaLibraryManager />
            </CardContent>
          </Card>

          <Button
            type="button"
            className="w-full gap-2 bg-[#0052CC] font-black"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? t("common.saving") : t("adminPlatform.saveAll")}
          </Button>
        </>
      )}
    </div>
  );
}
