import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { BookOpen, ExternalLink, Save, Trash2, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { YOUTUBE_CHANNEL_URL } from "@/constants/youtube";
import { getApiUrlPrefix } from "@/lib/api";
import {
  academyMediaAdd,
  academyMediaClearUser,
  academyMediaDelete,
  academyMediaListForUser,
} from "@/lib/academyMediaDb";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

const lsKeyYoutube = (uid: string) => `idara_academy_youtube_${uid}`;

function extractYoutubeId(line: string): string | null {
  const u = line.trim();
  if (!u) return null;
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(u)) return u;
  return null;
}

type PreviewRow = { id: string; url: string; kind: "image" | "video"; name: string };

export function CorporateAcademyModule() {
  const { t } = useI18n();
  const { user } = useAuth();
  const uid = user?.id ?? "guest";

  const [channelPageUrl, setChannelPageUrl] = useState(YOUTUBE_CHANNEL_URL);
  const [youtubeLinksText, setYoutubeLinksText] = useState("");
  const [localRows, setLocalRows] = useState<PreviewRow[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const urlsRef = useRef<PreviewRow[]>([]);
  useEffect(() => {
    urlsRef.current = localRows;
  }, [localRows]);

  const revokeAll = useCallback((rows: PreviewRow[]) => {
    rows.forEach((r) => URL.revokeObjectURL(r.url));
  }, []);

  useEffect(() => {
    void fetch(`${getApiUrlPrefix().replace(/\/$/, "")}/settings/public`)
      .then((r) => r.json() as Promise<{ settings?: Record<string, string> }>)
      .then((j) => {
        if (j.settings?.social_youtube?.trim()) setChannelPageUrl(j.settings.social_youtube.trim());
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKeyYoutube(uid));
      if (raw != null) setYoutubeLinksText(raw);
      else setYoutubeLinksText("");
    } catch {
      setYoutubeLinksText("");
    }
    setHydrated(true);
  }, [uid]);

  useEffect(() => {
    if (uid === "guest") {
      setLocalRows((prev) => {
        revokeAll(prev);
        return [];
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const stored = await academyMediaListForUser(uid);
        if (cancelled) return;
        setLocalRows((prev) => {
          revokeAll(prev);
          return stored.map((r) => ({
            id: r.id,
            name: r.name,
            kind: r.mime.startsWith("video") ? ("video" as const) : ("image" as const),
            url: URL.createObjectURL(r.blob),
          }));
        });
      } catch {
        if (!cancelled) toast.error(t("academy.mediaLoadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, revokeAll, t]);

  useEffect(
    () => () => {
      revokeAll(urlsRef.current);
    },
    [revokeAll]
  );

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

  const persistYoutubeText = useCallback(() => {
    try {
      localStorage.setItem(lsKeyYoutube(uid), youtubeLinksText);
      toast.success(t("academy.savedToast"));
    } catch {
      toast.error(t("academy.saveError"));
    }
  }, [uid, youtubeLinksText, t]);

  const clearYoutubeText = useCallback(() => {
    if (!window.confirm(t("academy.clearLinksConfirm"))) return;
    setYoutubeLinksText("");
    try {
      localStorage.removeItem(lsKeyYoutube(uid));
    } catch {
      /* ignore */
    }
    toast.success(t("academy.clearedLinksToast"));
  }, [uid, t]);

  const removeYoutubeId = useCallback(
    (vid: string) => {
      setYoutubeLinksText((prev) => {
        const lines = prev.split(/\r?\n/).filter((line) => extractYoutubeId(line) !== vid);
        const next = lines.join("\n");
        try {
          localStorage.setItem(lsKeyYoutube(uid), next);
        } catch {
          /* ignore */
        }
        return next;
      });
      toast.success(t("academy.removedOneVideo"));
    },
    [uid, t]
  );

  const clearLocalMedia = useCallback(async () => {
    if (!window.confirm(t("academy.clearLocalConfirm"))) return;
    if (uid === "guest") return;
    try {
      await academyMediaClearUser(uid);
      setLocalRows((prev) => {
        revokeAll(prev);
        return [];
      });
      toast.success(t("academy.clearedLocalToast"));
    } catch {
      toast.error(t("academy.mediaClearError"));
    }
  }, [uid, revokeAll, t]);

  const onPickLocal = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || uid === "guest") return;
    let ok = 0;
    for (const f of Array.from(files)) {
      const id = crypto.randomUUID();
      try {
        await academyMediaAdd({
          id,
          userId: uid,
          name: f.name,
          mime: f.type || "application/octet-stream",
          blob: f,
        });
        const url = URL.createObjectURL(f);
        const kind: "image" | "video" = f.type.startsWith("video") ? "video" : "image";
        setLocalRows((prev) => [...prev, { id, url, kind, name: f.name }]);
        ok += 1;
      } catch {
        toast.error(t("academy.mediaAddError"));
      }
    }
    e.target.value = "";
    if (ok > 0) toast.success(t("academy.mediaAddedToast"));
  };

  const removeLocalOne = useCallback(
    async (id: string) => {
      try {
        await academyMediaDelete(id);
        setLocalRows((prev) => {
          const row = prev.find((x) => x.id === id);
          if (row) URL.revokeObjectURL(row.url);
          return prev.filter((x) => x.id !== id);
        });
        toast.success(t("academy.mediaRemovedToast"));
      } catch {
        toast.error(t("academy.mediaDeleteError"));
      }
    },
    [t]
  );

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <BookOpen className="size-8 text-[#0052CC]" />
          {t("academy.title")}
        </h1>
        <p className="text-slate-400 mt-1">{t("academy.subtitle")}</p>
      </div>

      <Tabs defaultValue="lessons" className="w-full">
        <TabsList className="bg-[#0a1628] border border-slate-800">
          <TabsTrigger value="lessons" className="data-[state=active]:bg-[#0052CC]/30">
            {t("academy.tabLessons")}
          </TabsTrigger>
          <TabsTrigger value="courses" className="data-[state=active]:bg-[#0052CC]/30">
            {t("academy.tabCourses")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lessons" className="mt-6 space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" className="gap-2 font-bold" asChild>
              <a href={channelPageUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                {t("academy.openChannelShort")}
              </a>
            </Button>
            <p className="text-xs text-slate-500">{t("academy.embedNote")}</p>
          </div>

          <Card className="border-slate-800 bg-[#0a1628]/80">
            <CardContent className="p-5 space-y-4">
              <Label className="text-white font-semibold">{t("academy.youtubeLinkLabel")}</Label>
              <textarea
                value={youtubeLinksText}
                disabled={!hydrated}
                onChange={(e) => setYoutubeLinksText(e.target.value)}
                placeholder={t("academy.youtubeLinkPlaceholder")}
                rows={5}
                className="w-full rounded-xl border border-slate-700 bg-[#050a12]/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/40 disabled:opacity-50"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="gap-2 bg-[#0052CC] hover:bg-[#0044a8]" onClick={persistYoutubeText}>
                  <Save className="size-4" />
                  {t("academy.saveLessons")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-red-500/40 text-red-200"
                  onClick={clearYoutubeText}
                >
                  <Trash2 className="size-4" />
                  {t("academy.clearLinks")}
                </Button>
              </div>

              {lessonYoutubeIds.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">{t("academy.noVideos")}</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="aspect-video rounded-xl border-2 border-dashed border-slate-600/70 bg-[#050a12]/40 flex items-center justify-center text-slate-500 text-xs sm:text-sm text-center px-3 py-4"
                      >
                        {t("academy.emptySlotHint")}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {lessonYoutubeIds.map((vid) => (
                    <div key={vid} className="rounded-xl overflow-hidden border border-slate-700 bg-black space-y-2">
                      <div className="aspect-video relative">
                        <iframe
                          title={vid}
                          src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1`}
                          className="w-full h-full absolute inset-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                      <div className="px-3 pb-3 flex flex-wrap items-center gap-2">
                        <a
                          href={`https://www.youtube.com/watch?v=${vid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#FF8C00] font-medium truncate flex-1 min-w-0"
                        >
                          youtube.com/watch?v={vid}
                        </a>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="shrink-0 text-xs"
                          onClick={() => removeYoutubeId(vid)}
                        >
                          {t("academy.removeVideo")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0a1628]/80">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Label className="text-white font-semibold">{t("academy.localMaterials")}</Label>
                {localRows.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-red-500/40 text-red-200"
                    onClick={() => void clearLocalMedia()}
                  >
                    <Trash2 className="size-4" />
                    {t("academy.clearLocal")}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Upload className="size-4 text-slate-500 shrink-0" />
                <Input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => void onPickLocal(e)}
                  disabled={uid === "guest"}
                  className="cursor-pointer text-slate-300 max-w-md"
                />
              </div>
              <p className="text-xs text-slate-500">{t("academy.pickMediaPersist")}</p>
              {uid === "guest" && <p className="text-xs text-amber-500/90">{t("academy.loginForLocal")}</p>}
              {localRows.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {localRows.map((p) => (
                    <div key={p.id} className="rounded-xl border border-slate-700 bg-black/40 overflow-hidden space-y-2">
                      <div className="relative">
                        {p.kind === "video" ? (
                          <video src={p.url} controls className="w-full max-h-64 bg-black" />
                        ) : (
                          <img src={p.url} alt={p.name} className="w-full max-h-64 object-contain bg-black/40" />
                        )}
                      </div>
                      <div className="px-3 pb-3 flex items-center gap-2">
                        <span className="text-xs text-slate-400 truncate flex-1" title={p.name}>
                          {p.name}
                        </span>
                        <Button type="button" size="sm" variant="secondary" onClick={() => void removeLocalOne(p.id)}>
                          {t("academy.removeFile")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="mt-6">
          <Card className="border-slate-800/80 bg-[#0a1628]/80 max-w-lg">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-white">{t("academy.courseMgmt")}</h3>
              <p className="text-sm text-slate-400">{t("academy.courseMgmtDesc")}</p>
              <Button type="button" className="bg-[#0052CC] hover:bg-[#0044a8]">
                {t("academy.newCourse")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
