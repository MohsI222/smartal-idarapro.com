import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { BookOpen, Clock, ExternalLink, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  YOUTUBE_CHANNEL_URL,
  YOUTUBE_EMBED_VIDEO_ID,
  youtubeChannelToUploadsPlaylistEmbedSrc,
} from "@/constants/youtube";
import { useI18n } from "@/i18n/I18nProvider";

const PLACEHOLDER_THUMB =
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=640&q=80&auto=format&fit=crop";

const DEMO_VIDEOS = [
  { id: "1", titleKey: "academy.demo.v1.title", duration: "3:33", moduleKey: "academy.demo.v1.module" },
  { id: "2", titleKey: "academy.demo.v2.title", duration: "12:04", moduleKey: "academy.demo.v2.module" },
  { id: "3", titleKey: "academy.demo.v3.title", duration: "8:21", moduleKey: "academy.demo.v3.module" },
];

function extractYoutubeId(line: string): string | null {
  const u = line.trim();
  if (!u) return null;
  const m = u.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(u)) return u;
  return null;
}

type LocalPreview = { url: string; kind: "image" | "video" };

export function CorporateAcademyModule() {
  const { t } = useI18n();
  const [channelId, setChannelId] = useState("");
  const [channelPageUrl, setChannelPageUrl] = useState(YOUTUBE_CHANNEL_URL);
  const [youtubeLinksText, setYoutubeLinksText] = useState("");
  const [localPreviews, setLocalPreviews] = useState<LocalPreview[]>([]);

  const previewsRef = useRef<LocalPreview[]>([]);
  useEffect(() => {
    previewsRef.current = localPreviews;
  }, [localPreviews]);
  useEffect(
    () => () => {
      previewsRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    },
    []
  );

  useEffect(() => {
    void fetch("/api/settings/public")
      .then((r) => r.json() as Promise<{ settings?: Record<string, string> }>)
      .then((j) => {
        const s = j.settings ?? {};
        setChannelId((s.youtube_channel_id ?? "").trim());
        if (s.social_youtube?.trim()) setChannelPageUrl(s.social_youtube.trim());
      })
      .catch(() => undefined);
  }, []);

  useEffect(
    () => () => {
      localPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    },
    [localPreviews]
  );

  const embedSrc = useMemo(() => {
    const fromSettings = youtubeChannelToUploadsPlaylistEmbedSrc(channelId);
    if (fromSettings) return fromSettings;
    return `https://www.youtube-nocookie.com/embed/${YOUTUBE_EMBED_VIDEO_ID}?rel=0&modestbranding=1`;
  }, [channelId]);

  const lessonYoutubeIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const line of youtubeLinksText.split(/\r?\n/)) {
      const id = extractYoutubeId(line);
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }, [youtubeLinksText]);

  const onPickLocal = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const next: LocalPreview[] = [];
    for (const f of Array.from(files)) {
      const url = URL.createObjectURL(f);
      next.push({ url, kind: f.type.startsWith("video") ? "video" : "image" });
    }
    setLocalPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return next;
    });
    e.target.value = "";
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <BookOpen className="size-8 text-[#0052CC]" />
          {t("academy.title")}
        </h1>
        <p className="text-slate-400 mt-1">{t("academy.subtitle")}</p>
        <p className="text-sm text-[#FF8C00] font-semibold mt-2 max-w-3xl">
          {channelId
            ? t("academy.youtubeFromChannel")
            : t("academy.youtubeHint")}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 overflow-hidden bg-black/40">
        <div className="aspect-video w-full max-h-[420px]">
          <iframe
            title="Smart Al-Idara Pro — YouTube"
            src={embedSrc}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-[#0a1628] border-t border-slate-800">
          <p className="text-xs text-slate-500">{t("academy.embedNote")}</p>
          <Button type="button" variant="secondary" size="sm" className="gap-2 font-bold" asChild>
            <a href={channelPageUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              {t("academy.openChannel")}
            </a>
          </Button>
        </div>
      </div>

      <Card className="border-slate-800 bg-[#0a1628]/80">
        <CardContent className="p-5 space-y-3">
          <Label className="text-white">{t("academy.youtubeLinkLabel")}</Label>
          <textarea
            value={youtubeLinksText}
            onChange={(e) => setYoutubeLinksText(e.target.value)}
            placeholder={t("academy.youtubeLinkPlaceholder")}
            rows={4}
            className="w-full rounded-xl border border-slate-700 bg-[#050a12]/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/40"
          />
          {lessonYoutubeIds.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {lessonYoutubeIds.map((vid) => (
                <div
                  key={vid}
                  className="aspect-video rounded-xl overflow-hidden border border-slate-700 bg-black"
                >
                  <iframe
                    title={vid}
                    src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-[#0a1628]/80">
        <CardContent className="p-5 space-y-3">
          <Label className="text-white">{t("academy.localMaterials")}</Label>
          <Input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={onPickLocal}
            className="cursor-pointer text-slate-300"
          />
          <p className="text-xs text-slate-500">{t("academy.pickMedia")}</p>
          {localPreviews.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {localPreviews.map((p) =>
                p.kind === "video" ? (
                  <video
                    key={p.url}
                    src={p.url}
                    controls
                    className="w-full rounded-xl border border-slate-700 max-h-64 bg-black"
                  />
                ) : (
                  <img
                    key={p.url}
                    src={p.url}
                    alt=""
                    className="w-full rounded-xl border border-slate-700 object-contain max-h-64 bg-black/40"
                  />
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="lessons" className="w-full">
        <TabsList className="bg-[#0a1628] border border-slate-800">
          <TabsTrigger value="lessons" className="data-[state=active]:bg-[#0052CC]/30">
            {t("academy.tabLessons")}
          </TabsTrigger>
          <TabsTrigger value="courses" className="data-[state=active]:bg-[#0052CC]/30">
            {t("academy.tabCourses")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lessons" className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_VIDEOS.map((v, i) => (
              <Card
                key={v.id}
                className="border-slate-800/80 bg-[#0a1628]/80 overflow-hidden group hover:border-[#0052CC]/40 transition-all idara-animate-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <a
                  href={channelPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative aspect-video bg-slate-900 block"
                >
                  <img
                    src={PLACEHOLDER_THUMB}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-[1.02] transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <span className="absolute inset-0 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                    <span className="size-14 rounded-full bg-[#FF8C00]/95 flex items-center justify-center shadow-xl">
                      <Play className="size-7 text-[#050a12] ms-1" fill="currentColor" />
                    </span>
                  </span>
                  <span className="absolute bottom-2 end-2 text-xs font-mono bg-black/70 px-2 py-0.5 rounded flex items-center gap-1 text-white">
                    <Clock className="size-3" />
                    {v.duration}
                  </span>
                </a>
                <CardContent className="p-4">
                  <p className="text-xs text-[#0052CC] font-medium">{t(v.moduleKey)}</p>
                  <h3 className="font-bold text-white mt-1 leading-snug">{t(v.titleKey)}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="courses" className="mt-6">
          <Card className="border-slate-800/80 bg-[#0a1628]/80 max-w-lg">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-white">{t("academy.courseMgmt")}</h3>
              <p className="text-sm text-slate-400">{t("academy.courseMgmtDesc")}</p>
              <Button className="bg-[#0052CC] hover:bg-[#0044a8]">{t("academy.newCourse")}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
