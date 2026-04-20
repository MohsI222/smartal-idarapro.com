/** قناة المنصة على YouTube */
export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@SmartAlIdaraPro";
/** فيديو احتياطي عند عدم ضبط معرف القناة (UC…) في الإعدادات */
export const YOUTUBE_EMBED_VIDEO_ID = "jNQXAC9IVRw";

/** فيديوهات تعليمية مباشرة (معرّف YouTube فقط) — أضف معرفات من قناتك */
export const HOW_IT_WORKS_VIDEO_IDS = ["jNQXAC9IVRw"];

/**
 * قائمة «رفع القناة» على YouTube: UC… → UU… (للتضمين داخل المنصة).
 * @see https://stackoverflow.com/questions/18953499/youtube-api-to-fetch-all-videos-on-a-channel
 */
export function youtubeChannelToUploadsPlaylistEmbedSrc(channelId: string): string | null {
  const c = channelId.trim();
  if (!c.startsWith("UC") || c.length < 24) return null;
  const list = `UU${c.slice(2)}`;
  return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}&rel=0&modestbranding=1`;
}
