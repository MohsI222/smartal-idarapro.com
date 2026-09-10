import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { BookOpen, ExternalLink, Save, Trash2, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { YOUTUBE_CHANNEL_URL } from "@/constants/youtube";
import { getApiUrlPrefix } from "@/lib/api";
import { api } from "@/lib/api";
import {
  academyYoutubeLinksGet,
  academyYoutubeLinksSave,
  academyYoutubeLinksClear,
} from "@/lib/academyMediaDb";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

function extractYoutubeId(line: string): string | null {
  const u = line.trim();
  if (!u) return null;
  
  // Handle standard YouTube URLs (watch?v=)
  const watchMatch = u.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  
  // Handle short URLs (youtu.be/)
  const shortMatch = u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  
  // Handle embed URLs
  const embedMatch = u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  
  // Handle short URLs
  const shortsMatch = u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  
  // Handle v URLs
  const vMatch = u.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
  if (vMatch) return vMatch[1];
  
  // Handle raw 11-character IDs
  if (/^[a-zA-Z0-9_-]{11}$/.test(u)) return u;
  
  return null;
}

type MediaType = "youtube" | "video" | "image" | "unknown";

function detectMediaType(url: string): MediaType {
  if (!url) return "unknown";
  
  // Check for YouTube URLs
  if (extractYoutubeId(url)) return "youtube";
  
  // Check for video data URLs
  if (url.startsWith("data:video/")) return "video";
  
  // Check for video file extensions
  if (/\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i.test(url)) return "video";
  
  // Check for image data URLs
  if (url.startsWith("data:image/")) return "image";
  
  // Check for image file extensions
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url)) return "image";
  
  return "unknown";
}

function toYoutubeEmbedUrl(url: string): string | null {
  const id = extractYoutubeId(url);
  if (!id) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
}

type AcademyMediaItem = {
  id: string;
  type: "video" | "image";
  title: string | null;
  description: string | null;
  url: string;
  file_name: string;
  file_mime: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type VideoErrorState = { [videoId: string]: boolean };

interface AcademyMediaRendererProps {
  url: string;
  alt?: string;
  className?: string;
  onVideoError?: (error: boolean) => void;
  forceKey?: string;
  mediaKind?: "image" | "video";
}

function AcademyMediaRenderer({ url, alt = "Media", className = "", onVideoError, forceKey, mediaKind }: AcademyMediaRendererProps) {
  // Use provided mediaKind if available, otherwise detect from URL
  const mediaType = mediaKind === "video" ? "video" : mediaKind === "image" ? "image" : detectMediaType(url);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);

  const handleVideoError = () => {
    setVideoLoadError(true);
    onVideoError?.(true);
  };

  const handleImageError = () => {
    setImageLoadError(true);
  };

  // YouTube video rendering
  if (mediaType === "youtube") {
    const embedUrl = toYoutubeEmbedUrl(url);
    const rawYoutubeUrl = url.includes('youtube.com') || url.includes('youtu.be') ? url : `https://www.youtube.com/watch?v=${extractYoutubeId(url)}`;
    
    if (!embedUrl) {
      return (
        <div className={`w-full h-full flex items-center justify-center bg-[#0a1628] ${className}`}>
          <p className="text-sm text-slate-400">Invalid YouTube URL</p>
        </div>
      );
    }
    
    if (videoLoadError) {
      return (
        <div className={`w-full h-full flex flex-col items-center justify-center bg-[#0a1628] p-4 text-center ${className}`}>
          <p className="text-sm text-slate-400 mb-3">
            هذا الفيديو محظور على فئات عمرية معيّنة أو متوفّر فقط على YouTube
          </p>
          <Button
            type="button"
            size="sm"
            className="gap-2 bg-[#FF8C00] hover:bg-[#e07b00] text-white"
            asChild
          >
            <a
              href={rawYoutubeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" />
              فتح الفيديو مباشرة على يوتيوب
            </a>
          </Button>
        </div>
      );
    }
    
    return (
      <iframe
        key={forceKey}
        title={alt}
        src={embedUrl}
        className={`w-full h-full ${className}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        onError={handleVideoError}
      />
    );
  }

  // Video file rendering (MP4, WebM, etc.)
  if (mediaType === "video") {
    if (videoLoadError) {
      return (
        <div className={`w-full h-full flex flex-col items-center justify-center bg-[#0a1628] p-4 text-center ${className}`}>
          <p className="text-sm text-slate-400 mb-2">Failed to load video</p>
          <p className="text-xs text-slate-500">The video file may be corrupted or unsupported</p>
        </div>
      );
    }
    return (
      <video
        key={forceKey}
        src={url}
        controls
        className={`w-full h-full bg-black ${className}`}
        onError={handleVideoError}
      >
        Your browser does not support the video tag.
      </video>
    );
  }

  // Image rendering
  if (mediaType === "image") {
    if (imageLoadError) {
      return (
        <div className={`w-full h-full flex items-center justify-center bg-[#0a1628] ${className}`}>
          <p className="text-sm text-slate-400">Failed to load image</p>
        </div>
      );
    }
    return (
      <img
        key={forceKey}
        src={url}
        alt={alt}
        className={`w-full h-full object-contain ${className}`}
        onError={handleImageError}
      />
    );
  }

  // Unknown media type - show placeholder
  return (
    <div className={`w-full h-full flex items-center justify-center bg-[#0a1628] ${className}`}>
      <p className="text-sm text-slate-400">Unsupported media type</p>
    </div>
  );
}

export function CorporateAcademyModule() {
  const { t } = useI18n();
  const { user, token } = useAuth();
  const uid = user?.id ?? "guest";

  const [channelPageUrl, setChannelPageUrl] = useState(YOUTUBE_CHANNEL_URL);
  const [youtubeLinksText, setYoutubeLinksText] = useState("");
  const [academyMedia, setAcademyMedia] = useState<AcademyMediaItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [videoErrors, setVideoErrors] = useState<VideoErrorState>({});
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    void fetch(`${getApiUrlPrefix().replace(/\/$/, "")}/settings/public`)
      .then((r) => r.json() as Promise<{ settings?: Record<string, string> }>)
      .then((j) => {
        if (j.settings?.social_youtube?.trim()) setChannelPageUrl(j.settings.social_youtube.trim());
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (uid === "guest") {
      setYoutubeLinksText("");
      setHydrated(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const stored = await academyYoutubeLinksGet(uid);
        if (cancelled) return;
        setYoutubeLinksText(stored ?? "");
      } catch {
        if (!cancelled) setYoutubeLinksText("");
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (uid === "guest") {
      setAcademyMedia([]);
      setHydrated(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        console.log("[Academy] Loading media from server...");
        const res = await api<{ items: AcademyMediaItem[] }>("/academy-media", { token });
        if (cancelled) return;
        console.log("[Academy] Media loaded successfully:", res);
        if (res.items) {
          setAcademyMedia(res.items);
        }
      } catch (error) {
        console.error("[Academy] Error loading media:", error);
        if (!cancelled) toast.error(t("academy.mediaLoadError"));
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, t, token]);

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

  const persistYoutubeText = useCallback(async () => {
    if (uid === "guest") return;
    try {
      await academyYoutubeLinksSave(uid, youtubeLinksText);
      toast.success(t("academy.savedToast"));
    } catch {
      toast.error(t("academy.saveError"));
    }
  }, [uid, youtubeLinksText, t]);

  const clearYoutubeText = useCallback(async () => {
    if (!window.confirm(t("academy.clearLinksConfirm"))) return;
    setYoutubeLinksText("");
    if (uid === "guest") return;
    try {
      await academyYoutubeLinksClear(uid);
    } catch {
      /* ignore */
    }
    toast.success(t("academy.clearedLinksToast"));
  }, [uid, t]);

  const removeYoutubeId = useCallback(
    async (vid: string) => {
      const lines = youtubeLinksText.split(/\r?\n/).filter((line) => extractYoutubeId(line) !== vid);
      const next = lines.join("\n");
      setYoutubeLinksText(next);
      if (uid === "guest") return;
      try {
        await academyYoutubeLinksSave(uid, next);
      } catch {
        /* ignore */
      }
      toast.success(t("academy.removedOneVideo"));
    },
    [uid, youtubeLinksText, t]
  );

  const clearLocalMedia = useCallback(async () => {
    if (!window.confirm(t("academy.clearLocalConfirm"))) return;
    if (uid === "guest") return;
    try {
      // Delete all items
      for (const item of academyMedia) {
        await api(`/academy-media/${item.id}`, { method: "DELETE", token });
      }
      setAcademyMedia([]);
      toast.success(t("academy.clearedLocalToast"));
    } catch {
      toast.error(t("academy.mediaClearError"));
    }
  }, [uid, academyMedia, t, token]);

  const onPickLocal = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || uid === "guest") return;
    
    // Get metadata from input fields
    const titleInput = document.getElementById('lessonTitleInput') as HTMLInputElement;
    const descriptionInput = document.getElementById('lessonDescriptionInput') as HTMLTextAreaElement;
    
    const title = titleInput?.value?.trim() || "";
    const description = descriptionInput?.value?.trim() || "";
    
    setUploading(true);
    let ok = 0;
    let invalid = 0;
    
    for (const f of Array.from(files)) {
      // Validate file type
      const isVideo = f.type.startsWith("video/");
      const isImage = f.type.startsWith("image/");
      
      if (!isVideo && !isImage) {
        invalid++;
        toast.error(`Invalid file type: ${f.name}. Only images and videos are allowed.`);
        continue;
      }
      
      try {
        const formData = new FormData();
        formData.append("file", f);
        if (title) formData.append("title", title);
        if (description) formData.append("description", description);
        
        const prefix = "/api";
        const res = await fetch(`${prefix}/academy-media/upload`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
          body: formData
        });

        const text = await res.text();
        console.log("Academy upload response:", { status: res.status, text });

        if (!res.ok) {
          try {
            const errorData = JSON.parse(text);
            throw new Error(errorData.error || text || "فشل في الرفع");
          } catch {
            throw new Error(text || "فشل في الرفع");
          }
        }

        const data = JSON.parse(text) as { item: AcademyMediaItem };
        
        if (data.item) {
          setAcademyMedia((prev) => [...prev, data.item]);
          ok += 1;
        }
      } catch (error) {
        console.error("Error uploading academy media:", error);
        const errorMessage = error instanceof Error ? error.message : "فشل في الرفع";
        toast.error(errorMessage);
      }
    }
    
    // Clear input fields after upload
    e.target.value = "";
    if (titleInput) titleInput.value = "";
    if (descriptionInput) descriptionInput.value = "";
    
    setUploading(false);
    
    if (ok > 0) toast.success(`${ok} file(s) uploaded successfully`);
    if (invalid > 0) toast.error(`${invalid} file(s) skipped (invalid type)`);
  };

  const removeLocalOne = useCallback(
    async (id: string) => {
      try {
        console.log("[Academy] Deleting media item:", id);
        await api(`/academy-media/${id}`, { method: "DELETE", token });
        setAcademyMedia((prev) => prev.filter((x) => x.id !== id));
        toast.success(t("academy.mediaRemovedToast"));
      } catch (error) {
        console.error("[Academy] Error deleting media:", error);
        toast.error(t("academy.mediaDeleteError"));
      }
    },
    [t, token]
  );

  const startEdit = useCallback((item: AcademyMediaItem) => {
    setEditingItem(item.id);
    setEditTitle(item.title || "");
    setEditDescription(item.description || "");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingItem) return;
    try {
      const res = await api<{ item: AcademyMediaItem }>(`/academy-media/${editingItem}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ title: editTitle, description: editDescription }),
      });
      if (res.item) {
        setAcademyMedia((prev) => prev.map((x) => (x.id === editingItem ? res.item : x)));
        toast.success("تم حفظ التعديلات");
      }
      setEditingItem(null);
    } catch (error) {
      console.error("[Academy] Error saving edit:", error);
      toast.error("فشل في حفظ التعديلات");
    }
  }, [editingItem, editTitle, editDescription, token]);

  const cancelEdit = useCallback(() => {
    setEditingItem(null);
    setEditTitle("");
    setEditDescription("");
  }, []);

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
              <p className="text-xs text-amber-500/80">
                ملاحظة: الفيديوهات المقيدة عمرياً أو التي قام صاحبها بتعطيل التضمين لن تعمل داخل المنصة وستحتاج لفتحها مباشرة على YouTube
              </p>
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

              {/* Preview Section */}
              {(lessonYoutubeIds.length > 0 || academyMedia.length > 0) && (
                <div className="mt-6 pt-6 border-t border-slate-700/50">
                  <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <BookOpen className="size-4 text-[#0052CC]" />
                    معاينة الدروس
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {lessonYoutubeIds.map((vid) => (
                      <div key={vid} className="rounded-xl overflow-hidden border border-slate-700 bg-black space-y-2">
                        <div className="aspect-video relative">
                          {videoErrors[vid] ? (
                            <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center bg-[#0a1628] p-4 text-center">
                              <p className="text-sm text-slate-400 mb-3">
                                هذا الفيديو محظور على فئات عمرية معيّنة أو متوفّر فقط على YouTube
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                className="gap-2 bg-[#FF8C00] hover:bg-[#e07b00] text-white"
                                asChild
                              >
                                <a
                                  href={`https://www.youtube.com/watch?v=${vid}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="size-4" />
                                  مشاهدة مباشرة على YouTube
                                </a>
                              </Button>
                            </div>
                          ) : (
                            <AcademyMediaRenderer
                              url={`https://www.youtube.com/watch?v=${vid}`}
                              alt={vid}
                              className="w-full h-full absolute inset-0"
                              forceKey={`${vid}-${youtubeLinksText}`}
                              onVideoError={(error) => setVideoErrors((prev) => ({ ...prev, [vid]: error }))}
                            />
                          )}
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
                    {academyMedia.map((p) => (
                      <div key={p.id} className="rounded-xl border border-slate-700 bg-black/40 overflow-hidden space-y-2">
                        <div className="relative max-h-64">
                          <AcademyMediaRenderer
                            url={p.url}
                            alt={p.title || p.file_name}
                            className="w-full h-full"
                            forceKey={`${p.id}-${academyMedia.length}`}
                            mediaKind={p.type}
                          />
                        </div>
                        <div className="px-3 pb-3 space-y-2">
                          {editingItem === p.id ? (
                            <div className="space-y-2">
                              <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder="عنوان الدرس"
                                className="text-sm bg-[#050a12]/80 border-slate-700 text-slate-200"
                              />
                              <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="وصف الدرس"
                                rows={2}
                                className="w-full rounded-lg border border-slate-700 bg-[#050a12]/80 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600"
                              />
                              <div className="flex gap-2">
                                <Button type="button" size="sm" onClick={saveEdit} className="flex-1">
                                  <Save className="size-3 mr-1" />
                                  حفظ
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={cancelEdit} className="flex-1">
                                  إلغاء
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {p.title && (
                                <h4 className="text-sm font-semibold text-white truncate" title={p.title}>
                                  {p.title}
                                </h4>
                              )}
                              {p.description && (
                                <p className="text-xs text-slate-400 line-clamp-2" title={p.description}>
                                  {p.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 truncate flex-1" title={p.file_name}>
                                  {p.file_name}
                                </span>
                                <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(p)}>
                                  <Save className="size-3" />
                                </Button>
                                <Button type="button" size="sm" variant="secondary" onClick={() => void removeLocalOne(p.id)}>
                                  {t("academy.removeFile")}
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lessonYoutubeIds.length === 0 && academyMedia.length === 0 && (
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
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0a1628]/80">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Label className="text-white font-semibold">{t("academy.localMaterials")}</Label>
                {academyMedia.length > 0 && (
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
              
              {/* Lesson Metadata Fields */}
              <div className="space-y-3">
                <div>
                  <Label className="text-white text-sm">عنوان الدرس (اختياري)</Label>
                  <Input
                    type="text"
                    placeholder="أدخل عنوان الدرس"
                    className="mt-1 bg-[#050a12]/80 border-slate-700 text-slate-200"
                    id="lessonTitleInput"
                  />
                </div>
                <div>
                  <Label className="text-white text-sm">وصف الدرس (اختياري)</Label>
                  <textarea
                    placeholder="أدخل وصف الدرس"
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-[#050a12]/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/40"
                    id="lessonDescriptionInput"
                  />
                </div>
                <div>
                  <Label className="text-white text-sm">صورة مصغرة (اختياري)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="mt-1 cursor-pointer text-slate-300"
                    id="lessonThumbnailInput"
                    onChange={(e) => {
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Upload className="size-4 text-slate-500 shrink-0" />
                <Input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => {
                    void onPickLocal(e);
                    e.target.value = "";
                  }}
                  disabled={uid === "guest" || uploading}
                  className="cursor-pointer text-slate-300 max-w-md"
                />
                {uploading && <span className="text-xs text-slate-400">جاري الرفع...</span>}
              </div>
              <p className="text-xs text-slate-500">{t("academy.pickMediaPersist")}</p>
              {uid === "guest" && <p className="text-xs text-amber-500/90">{t("academy.loginForLocal")}</p>}
              <p className="text-xs text-slate-400">
                💡 الملفات المرفوعة ستظهر فوراً في قسم "معاينة الدروس" أعلاه
              </p>
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
