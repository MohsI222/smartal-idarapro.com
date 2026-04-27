import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Film,
  ImageIcon,
  Loader2,
  Lock,
  Monitor,
  RefreshCw,
  Smartphone,
  Sparkles,
  Square,
  Star,
  Type,
  Upload,
  Video,
  Wand2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiGenerateButton } from "@/components/AiGenerateButton";
import { ProcessingBar } from "@/components/ProcessingBar";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { postBackendPromoVideo } from "@/lib/backendExportClient";
import { buildCinematicPromoWebm } from "@/lib/cinematicWebm";
import { ensurePdfCanvasOnlyReady } from "@/lib/exportLibraries";
import { tryTranscodeWebmToMp4 } from "@/lib/ffmpegPromo";
import { enhanceImageFileToDataUrl } from "@/lib/imageEnhanceCanvas";
import { enhanceImageWithServer } from "@/lib/mediaLabApi";
import { fetchStudioCapabilities, requestStudioTextToImage } from "@/lib/studioApi";

type MediaAction = "enhance" | "image_to_video" | "ad_campaign";
type StudioFormat = "16:9" | "9:16" | "1:1";
type StudioDuration = 10 | 30 | 60;
type StudioTemplateId = "flyer" | "card" | "poster";

type StudioVideoScene = {
  scene_number?: number;
  description?: string;
  narration?: string;
  visual?: string;
  duration_sec?: number;
};

type StudioVideoScriptResult = {
  title?: string;
  duration?: string;
  script?: string;
  scenes?: StudioVideoScene[];
  music_suggestion?: string;
  cta?: string;
};

type StudioMediaResult =
  | { type: "image"; url: string }
  | { type: "frame_sequence"; frames: string[]; assembly_instructions?: string; engine?: string; duration?: string; ratio?: string }
  | { type: "campaign"; posterUrl: string; script: string }
  | { type: "error"; message: string; details?: string; suggestion?: string };

const FORMAT_OPTIONS: { value: StudioFormat; label: string; icon: typeof Monitor }[] = [
  { value: "16:9", label: "16:9 — YouTube / Ads", icon: Monitor },
  { value: "9:16", label: "9:16 — TikTok / Reels", icon: Smartphone },
  { value: "1:1", label: "1:1 — Instagram / Square", icon: Square },
];

const DURATION_OPTIONS: { value: StudioDuration; label: string }[] = [
  { value: 10, label: "10s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
];

const STYLE_OPTIONS = [
  "Cinematic",
  "Corporate",
  "Minimalist",
  "Bold & Colorful",
  "Elegant Luxury",
  "Moroccan Traditional",
  "Modern Tech",
];

type B44VideoResult =
  | {
      type: "frame_sequence";
      frames: string[];
      assembly_instructions?: string;
      engine?: string;
      duration?: string;
      ratio?: string;
      credits_used?: string;
      credits_type?: string;
      prompt?: string;
    }
    | {
      type: "error";
      message: string;
      details?: string;
      credits_charged?: boolean;
      suggestion?: string;
      retry_count?: number;
    };

/** معاينة موحّدة أسفل التبويبات (توليد رئيسي) */
type MediaLabPreview =
  | { kind: "image"; url: string }
  | { kind: "frames"; frames: string[]; assembly_instructions?: string; engine?: string }
  | { kind: "text"; body: string };

/** ضغط صورة JPEG حتى ≈1MB كحد أقصى */
function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (typeof dataUrl !== "string") {
        reject(new Error("read_failed"));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error("image_decode"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("no_canvas"));
          return;
        }
        const maxWidth = 1280;
        const maxHeight = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.7;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("blob_null"));
                return;
              }
              if (blob.size > 1024 * 1024 && quality > 0.3) {
                quality -= 0.1;
                tryCompress();
              } else {
                resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
              }
            },
            "image/jpeg",
            quality
          );
        };
        tryCompress();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function studioImageSize(format: StudioFormat): "1024x1024" | "1792x1024" | "1024x1792" {
  if (format === "16:9") return "1792x1024";
  if (format === "9:16") return "1024x1792";
  return "1024x1024";
}

function pollinationsDimensions(format: StudioFormat): { width: number; height: number } {
  if (format === "16:9") return { width: 1280, height: 720 };
  if (format === "9:16") return { width: 720, height: 1280 };
  return { width: 1024, height: 1024 };
}

function buildPollinationsImageUrl(prompt: string, format: StudioFormat, style?: string): string {
  const { width, height } = pollinationsDimensions(format);
  const finalPrompt = [
    prompt.trim(),
    style ? `Style: ${style}` : "",
    "professional marketing quality, high resolution, clean Moroccan market design, sharp details",
  ]
    .filter(Boolean)
    .join(". ");
  const seed = Math.floor(Date.now() / 1000);
  const encoded = encodeURIComponent(finalPrompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=flux&nologo=true&enhance=true&seed=${seed}`;
}

function preloadImageUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error("image_generation_failed"));
    img.src = url;
  });
}

function stringifyAiResponse(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value ?? "");
}

function normalizeVideoScriptResult(value: unknown): StudioVideoScriptResult {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as StudioVideoScriptResult;
  }
  return {
    title: "سكريبت فيديو احترافي",
    duration: "60s",
    script: stringifyAiResponse(value),
    scenes: [],
  };
}

function downloadUrl(url: string, name: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function studioSvgPlaceholder(opts: {
  title: string;
  subtitle?: string;
  format: StudioFormat;
  style?: string;
  badge?: string;
}): string {
  const [w, h] = opts.format === "16:9" ? [1600, 900] : opts.format === "9:16" ? [900, 1600] : [1200, 1200];
  const title = opts.title.trim().slice(0, 72) || "AI Creative Studio";
  const subtitle = (opts.subtitle || "تصميم احترافي جاهز للمعاينة").trim().slice(0, 120);
  const badge = opts.badge || opts.style || "Studio 2.0";
  const isTall = h > w;
  const fontSize = isTall ? 62 : 68;
  const subSize = isTall ? 34 : 32;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#26115f"/>
      <stop offset="45%" stop-color="#5b21b6"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
    <radialGradient id="glow" cx="25%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <rect x="${w * 0.055}" y="${h * 0.055}" width="${w * 0.89}" height="${h * 0.89}" rx="42" fill="rgba(2,6,23,.28)" stroke="rgba(255,255,255,.35)" stroke-width="3"/>
  <text x="${w / 2}" y="${h * 0.16}" text-anchor="middle" fill="#fde68a" font-family="Arial, sans-serif" font-size="${Math.round(fontSize * 0.45)}" font-weight="800" letter-spacing="8">${badge}</text>
  <text x="${w / 2}" y="${h * 0.43}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="900">${title}</text>
  <foreignObject x="${w * 0.16}" y="${h * 0.5}" width="${w * 0.68}" height="${h * 0.18}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;color:#e0f2fe;font-size:${subSize}px;font-weight:700;text-align:center;line-height:1.45;direction:rtl">${subtitle}</div>
  </foreignObject>
  <text x="${w / 2}" y="${h * 0.82}" text-anchor="middle" fill="#ffffff" opacity=".82" font-family="Arial, sans-serif" font-size="${Math.round(subSize * 0.75)}" font-weight="700">Smart Al-Idara Pro • Built-in Studio</text>
</svg>`;
  return svgDataUrl(svg);
}

function localVideoScript(prompt: string, type: string, format: StudioFormat, duration: StudioDuration): StudioVideoScriptResult {
  const topic = prompt.trim() || "خدمة احترافية للسوق المغربي";
  const sceneCount = duration === 10 ? 3 : duration === 30 ? 5 : 7;
  const perScene = Math.max(2, Math.round(duration / sceneCount));
  const scenes: StudioVideoScene[] = Array.from({ length: sceneCount }, (_, i) => ({
    scene_number: i + 1,
    duration_sec: perScene,
    description:
      i === 0
        ? `لقطة افتتاحية قوية تُظهر هوية العرض: ${topic}.`
        : i === sceneCount - 1
          ? "لقطة ختامية مع إبراز وسيلة التواصل والدعوة لاتخاذ القرار."
          : `إبراز فائدة عملية رقم ${i} مع حركة كاميرا ناعمة ونص قصير على الشاشة.`,
    narration:
      i === 0
        ? `هل تبحث عن حل مهني وموثوق؟ ${topic}.`
        : i === sceneCount - 1
          ? "تواصل معنا الآن واستفد من تجربة احترافية مصممة خصيصاً لك."
          : "خدمة واضحة، تنفيذ سريع، ونتائج قابلة للقياس.",
    visual:
      format === "9:16"
        ? "Vertical social media shot, clean overlay, bold readable Arabic text."
        : "Wide cinematic composition, premium light, Moroccan modern business mood.",
  }));
  return {
    title: `فيديو ${type} — ${topic.slice(0, 48)}`,
    duration: `${duration}s`,
    script: `افتتاحية: ${topic}\n\nالرسالة الرئيسية: تقديم عرض واضح ومقنع بلغة بسيطة تجمع بين العربية والفرنسية عند الحاجة.\n\nالنهاية: دعوة مباشرة للتواصل والحجز أو طلب الخدمة.`,
    scenes,
    music_suggestion: "موسيقى عصرية هادئة بإيقاع تصاعدي، مناسبة للإعلانات المغربية.",
    cta: "تواصل معنا اليوم — Réservez maintenant",
  };
}

function localCampaignScript(topic: string): string {
  const subject = topic.trim() || "هذه الخدمة";
  return [
    "📢 حملة إعلانية جاهزة",
    "",
    `العنوان: اكتشف ${subject} بطريقة احترافية وسريعة`,
    "",
    "النص العربي:",
    `خدمة موثوقة، تصميم احترافي، وتجربة سهلة. ${subject} الآن بين يديك بجودة تناسب السوق المغربي.`,
    "",
    "Texte français:",
    `Une solution professionnelle, claire et fiable pour vos besoins: ${subject}.`,
    "",
    "Caption:",
    "جودة عالية • سرعة في الإنجاز • دعم احترافي",
    "",
    "Hashtags:",
    "#المغرب #خدمات #تسويق #تصميم #SmartAlIdara",
    "",
    "خطة النشر:",
    "اليوم 1: إعلان تعريفي",
    "اليوم 3: منشور فوائد الخدمة",
    "اليوم 5: شهادة/عرض خاص",
    "اليوم 7: دعوة مباشرة للتواصل",
  ].join("\n");
}

export function AiMediaLabModule() {
  const { token, isApproved, approvedModules } = useAuth();
  const allowed = isApproved && approvedModules.includes("media_lab");
  const { t, locale } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardRole, setCardRole] = useState("");
  const [cardPhone, setCardPhone] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  const [enhanceFile, setEnhanceFile] = useState<File | null>(null);
  const [originalDataUrl, setOriginalDataUrl] = useState<string | null>(null);
  const [enhancedDataUrl, setEnhancedDataUrl] = useState<string | null>(null);
  const [enhanceBusy, setEnhanceBusy] = useState(false);
  const [removeBgEnhance, setRemoveBgEnhance] = useState(false);

  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoEncodeProgress, setVideoEncodeProgress] = useState(0);
  const [promoHeadline, setPromoHeadline] = useState("");
  const [promoTagline, setPromoTagline] = useState("");
  const [promoAudio, setPromoAudio] = useState<File | null>(null);
  const [cardExportBusy, setCardExportBusy] = useState(false);
  const [studioCaps, setStudioCaps] = useState<{ textToImage: boolean; openAiKeyConfigured: boolean }>({
    textToImage: false,
    openAiKeyConfigured: false,
  });
  const [activeTab, setActiveTab] = useState("ideas");
  const [motionScore, setMotionScore] = useState(70);
  const [mediaResult, setMediaResult] = useState<MediaLabPreview | null>(null);
  const [handleGenBusy, setHandleGenBusy] = useState(false);
  const [handleGenProgress, setHandleGenProgress] = useState(0);
  const [ttiPrompt, setTtiPrompt] = useState("");
  const [ttiSize, setTtiSize] = useState<"1024x1024" | "1792x1024" | "1024x1792">("1024x1024");
  const [ttiBusy, setTtiBusy] = useState(false);
  const [ttiPreview, setTtiPreview] = useState<string | null>(null);
  const [logoImgBusy, setLogoImgBusy] = useState(false);

  const [b44UploadedUrl, setB44UploadedUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [b44Progress, setB44Progress] = useState(0);
  const [b44VideoResult, setB44VideoResult] = useState<B44VideoResult | null>(null);
  const [promoVideoPrompt, setPromoVideoPrompt] = useState("");
  const [promoVidFormat, setPromoVidFormat] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [promoVidDuration, setPromoVidDuration] = useState<10 | 30 | 60>(30);

  const [studioImgPrompt, setStudioImgPrompt] = useState("");
  const [studioImgFormat, setStudioImgFormat] = useState<StudioFormat>("1:1");
  const [studioImgStyle, setStudioImgStyle] = useState("Corporate");
  const [studioImgResult, setStudioImgResult] = useState<string | null>(null);
  const [studioImgLoading, setStudioImgLoading] = useState(false);

  const [studioScriptPrompt, setStudioScriptPrompt] = useState("");
  const [studioScriptFormat, setStudioScriptFormat] = useState<StudioFormat>("16:9");
  const [studioScriptDuration, setStudioScriptDuration] = useState<StudioDuration>(60);
  const [studioVideoType, setStudioVideoType] = useState("corporate");
  const [studioScriptResult, setStudioScriptResult] = useState<StudioVideoScriptResult | null>(null);
  const [studioScriptLoading, setStudioScriptLoading] = useState(false);

  const [studioTemplate, setStudioTemplate] = useState<StudioTemplateId>("flyer");
  const [studioTemplateVars, setStudioTemplateVars] = useState<Record<string, string>>({});
  const [studioTemplateResult, setStudioTemplateResult] = useState<string | null>(null);
  const [studioTemplateLoading, setStudioTemplateLoading] = useState(false);

  const [studioUploadedFile, setStudioUploadedFile] = useState<File | null>(null);
  const [studioUploadedUrl, setStudioUploadedUrl] = useState<string | null>(null);
  const [studioMediaLoading, setStudioMediaLoading] = useState(false);
  const [studioMediaResult, setStudioMediaResult] = useState<StudioMediaResult | null>(null);
  const [studioMediaAction, setStudioMediaAction] = useState<MediaAction>("enhance");
  const [studioMediaStyle, setStudioMediaStyle] = useState("cinematic");
  const [studioVideoPrompt, setStudioVideoPrompt] = useState("");
  const [studioProgress, setStudioProgress] = useState(0);

  useEffect(() => {
    if (!allowed || !token) return;
    void fetchStudioCapabilities(token).then((c) => setStudioCaps(c));
  }, [allowed, token]);

  useEffect(() => {
    if (!activeTab) setActiveTab("ideas");
  }, [activeTab]);

  const runImageGeneration = async (): Promise<string> => {
    if (!ttiPrompt.trim()) {
      throw new Error("أدخل وصفاً للصورة");
    }
    const ratioHint =
      ttiSize === "1024x1024" ? "1:1" : ttiSize === "1792x1024" ? "16:9 landscape" : "9:16 portrait";
    const format: StudioFormat =
      ttiSize === "1792x1024" ? "16:9" : ttiSize === "1024x1792" ? "9:16" : "1:1";
    const pollinationsUrl = buildPollinationsImageUrl(
      `${ttiPrompt.trim()}. Format ratio: ${ratioHint}`,
      format,
      "Professional"
    );
    try {
      return await preloadImageUrl(pollinationsUrl);
    } catch {
      if (!studioCaps.textToImage) throw new Error("تعذّر الاتصال بخدمة Pollinations.ai مؤقتاً");
      const fullPrompt = `${ttiPrompt.trim()}. Format ratio: ${ratioHint}. Professional marketing quality, high resolution, clean design.`;
      const res = await base44.integrations.Core.GenerateImage({ prompt: fullPrompt, size: ttiSize });
      return res.url;
    }
  };

  const handleUpload = async (file: File | null): Promise<string | null> => {
    if (!file) return null;
    setUploadProgress(true);
    try {
      let processedFile = file;
      if (file.type.startsWith("image/") && file.size > 1024 * 1024) {
        toast.info("تصغير حجم الصورة تلقائياً إلى 1MB...");
        processedFile = await compressImage(file);
      }
      const { file_url } = await base44.integrations.Core.UploadFile({ file: processedFile });
      if (!file_url || (!file_url.startsWith("http") && !file_url.startsWith("/"))) {
        throw new Error("رابط الملف غير صالح");
      }
      setB44UploadedUrl(file_url);
      toast.success("تم رفع الملف بنجاح!");
      return file_url;
    } catch (err) {
      toast.error("فشل رفع الملف");
      console.error("[Upload Error]", err);
      return null;
    } finally {
      setUploadProgress(false);
    }
  };

  const generateImage = async () => {
    if (!ttiPrompt.trim()) {
      toast.error("أدخل وصفاً للصورة");
      return;
    }
    setTtiBusy(true);
    setTtiPreview(null);
    try {
      const url = await runImageGeneration();
      setTtiPreview(url);
      setMediaResult({ kind: "image", url });
      toast.success("تم توليد الصورة عبر Pollinations.ai");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ أثناء التوليد");
    } finally {
      setTtiBusy(false);
    }
  };

  const uploadStudioMedia = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("المحرك الحالي يقبل الصور فقط. ارفع JPG أو PNG لتشغيل التحسين أو تحويل الصورة لفيديو.");
      return;
    }
    setStudioUploadedFile(file);
    setStudioMediaResult(null);
    const uploaded = await handleUpload(file);
    if (uploaded) setStudioUploadedUrl(uploaded);
  };

  const generateStudioImage = async () => {
    if (!studioImgPrompt.trim()) {
      toast.error("أدخل وصفاً للصورة");
      return;
    }
    setStudioImgLoading(true);
    setStudioImgResult(null);
    try {
      const pollinationsUrl = buildPollinationsImageUrl(studioImgPrompt, studioImgFormat, studioImgStyle);
      const generatedUrl = await preloadImageUrl(pollinationsUrl);
      setStudioImgResult(generatedUrl);
      setMediaResult({ kind: "image", url: generatedUrl });
      toast.success("تم توليد الصورة عبر Pollinations.ai");
    } catch {
      try {
        if (!studioCaps.textToImage) {
          throw new Error("pollinations_unavailable");
        }
        const fullPrompt = `${studioImgPrompt.trim()}. Style: ${studioImgStyle}. Format ratio: ${studioImgFormat}. Professional marketing quality, high resolution, clean Moroccan-market design.`;
        const res = await base44.integrations.Core.GenerateImage({
          prompt: fullPrompt,
          size: studioImageSize(studioImgFormat),
        });
        setStudioImgResult(res.url);
        setMediaResult({ kind: "image", url: res.url });
        toast.success("تم توليد الصورة عبر API المنصة");
      } catch {
        const fallback = studioSvgPlaceholder({
          title: studioImgPrompt,
          subtitle: "تعذّر الاتصال بخدمة الصور المجانية مؤقتاً. هذه معاينة آمنة قابلة للتحميل.",
          format: studioImgFormat,
          style: studioImgStyle,
          badge: "Preview",
        });
        setStudioImgResult(fallback);
        setMediaResult({ kind: "image", url: fallback });
        toast.info("تعذر جلب الصورة الحقيقية مؤقتاً، تم عرض معاينة بديلة");
      }
    } finally {
      setStudioImgLoading(false);
    }
  };

  const generateStudioVideoScript = async () => {
    if (!studioScriptPrompt.trim()) {
      toast.error("أدخل وصف الفيديو");
      return;
    }
    setStudioScriptLoading(true);
    setStudioScriptResult(null);
    try {
      if (!studioCaps.openAiKeyConfigured) {
        const fallback = localVideoScript(studioScriptPrompt, studioVideoType, studioScriptFormat, studioScriptDuration);
        setStudioScriptResult(fallback);
        setMediaResult({ kind: "text", body: stringifyAiResponse(fallback) });
        toast.success("تم إنشاء السكريبت بالمحرك الداخلي");
        return;
      }
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert marketing video director for the Moroccan market.
Create a complete video production package for: "${studioScriptPrompt.trim()}"
Video type: ${studioVideoType} | Format: ${studioScriptFormat} | Duration: ${studioScriptDuration} seconds | Resolution: 1080p HD

Return a professional production brief with bilingual Arabic + French content. Scale the number of scenes to fit the ${studioScriptDuration}s duration.`,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            duration: { type: "string" },
            script: { type: "string" },
            scenes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  scene_number: { type: "number" },
                  description: { type: "string" },
                  narration: { type: "string" },
                  visual: { type: "string" },
                  duration_sec: { type: "number" },
                },
              },
            },
            music_suggestion: { type: "string" },
            cta: { type: "string" },
          },
        },
      });
      const parsed = normalizeVideoScriptResult(res);
      setStudioScriptResult(parsed);
      setMediaResult({ kind: "text", body: stringifyAiResponse(parsed) });
      toast.success("تم إنشاء سكريبت الفيديو!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ أثناء الإنشاء");
    } finally {
      setStudioScriptLoading(false);
    }
  };

  const generateStudioTemplate = async () => {
    const prompts: Record<StudioTemplateId, string> = {
      flyer: `Design a professional marketing flyer for ${studioTemplateVars.business || "business"} in ${studioTemplateVars.city || "Morocco"}. Include services, contact info, strong CTA. Modern Moroccan premium style.`,
      card: `Create a minimalist business card design for ${studioTemplateVars.name || "Name"}, ${studioTemplateVars.title || "Title"} at ${studioTemplateVars.company || "Company"}. Professional colors, clean typography.`,
      poster: `Design a social media poster for ${studioTemplateVars.event || "event"} on ${studioTemplateVars.date || "date"}. Eye-catching modern design with Arabic and French text.`,
    };
    setStudioTemplateLoading(true);
    setStudioTemplateResult(null);
    try {
      const pollinationsUrl = buildPollinationsImageUrl(
        `${prompts[studioTemplate]} High quality, print-ready, professional.`,
        "1:1",
        "Moroccan Premium"
      );
      const generatedUrl = await preloadImageUrl(pollinationsUrl);
      setStudioTemplateResult(generatedUrl);
      setMediaResult({ kind: "image", url: generatedUrl });
      toast.success("تم إنشاء التصميم عبر Pollinations.ai");
    } catch {
      try {
        if (!studioCaps.textToImage) {
          throw new Error("pollinations_unavailable");
        }
        const res = await base44.integrations.Core.GenerateImage({
          prompt: `${prompts[studioTemplate]} High quality, print-ready, professional.`,
          size: "1024x1024",
        });
        setStudioTemplateResult(res.url);
        setMediaResult({ kind: "image", url: res.url });
        toast.success("تم إنشاء التصميم عبر API المنصة");
      } catch {
        const fallback = studioSvgPlaceholder({
          title:
            studioTemplate === "flyer"
              ? studioTemplateVars.business || "فلاير تسويقي"
              : studioTemplate === "card"
                ? studioTemplateVars.name || "بطاقة أعمال"
                : studioTemplateVars.event || "ملصق سوشيال ميديا",
          subtitle: prompts[studioTemplate],
          format: "1:1",
          style: "Moroccan Premium",
          badge: studioTemplate.toUpperCase(),
        });
        setStudioTemplateResult(fallback);
        setMediaResult({ kind: "image", url: fallback });
        toast.info("تعذر جلب التصميم الحقيقي مؤقتاً، تم عرض معاينة بديلة");
      }
    } finally {
      setStudioTemplateLoading(false);
    }
  };

  const processStudioMedia = async () => {
    if (!studioUploadedUrl) {
      toast.error("❌ يجب رفع صورة أولاً");
      return;
    }
    setStudioMediaLoading(true);
    setStudioMediaResult(null);
    setStudioProgress(0);

    if (studioMediaAction === "image_to_video") {
      const progressTimer = window.setInterval(() => {
        setStudioProgress((current) => (current >= 95 ? 95 : Math.min(current + Math.random() * 2.5 + 1, 95)));
      }, 2000);
      try {
        const generationPrompt =
          studioVideoPrompt.trim() ||
          `Cinematic high quality movement, ${studioMediaStyle} style, smooth camera motion, professional cinematography`;
        const response = await base44.generateBuiltInVideo({
          image_url: studioUploadedUrl.trim(),
          prompt: generationPrompt,
          ratio: studioScriptFormat,
          duration: studioScriptDuration,
          motion_score: motionScore,
        });
        window.clearInterval(progressTimer);
        setStudioProgress(100);
        const frames = response.data?.frames ?? [];
        if (!frames.length && !response.data?.video_url) {
          throw new Error(response.data?.error || "فشل توليد الفيديو");
        }
        setStudioMediaResult({
          type: "frame_sequence",
          frames,
          assembly_instructions: response.data?.assembly_instructions,
          engine: response.data?.engine ?? "Local Frame Engine",
          duration: `${studioScriptDuration}s`,
          ratio: studioScriptFormat,
        });
        setMediaResult({
          kind: "frames",
          frames,
          assembly_instructions: response.data?.assembly_instructions,
          engine: response.data?.engine ?? "Local Frame Engine",
        });
        toast.success("🎉 تم توليد الإطارات بنجاح!");
      } catch (e) {
        window.clearInterval(progressTimer);
        setStudioProgress(0);
        const message = e instanceof Error ? e.message : "حدث خطأ في توليد الفيديو";
        setStudioMediaResult({
          type: "error",
          message,
          details: "تأكد من أن الصورة بجودة جيدة وحجم مناسب.",
          suggestion: "جرب رفع صورة جديدة أو تقليل الحركة.",
        });
        toast.error(`❌ ${message}`);
      } finally {
        setStudioMediaLoading(false);
      }
      return;
    }

    try {
      if (studioMediaAction === "enhance") {
        if (!studioCaps.openAiKeyConfigured) {
          setStudioMediaResult({ type: "image", url: studioUploadedUrl });
          setMediaResult({ kind: "image", url: studioUploadedUrl });
          toast.success("تم تجهيز الصورة للتحميل والمعاينة بالمحرك الداخلي");
          return;
        }
        const descRes = await base44.integrations.Core.InvokeLLM({
          prompt:
            "Analyze this image and describe it in great detail for regeneration. Focus on composition, subjects, colors, and quality improvements needed.",
          file_urls: [studioUploadedUrl],
        });
        const enhanced = await base44.integrations.Core.GenerateImage({
          prompt: `Ultra high quality, 4K enhanced, sharpened, professional photography of: ${stringifyAiResponse(descRes)}. Noise reduction applied, perfect exposure, cinematic color grading.`,
          existing_image_urls: [studioUploadedUrl],
          size: "1024x1024",
        });
        setStudioMediaResult({ type: "image", url: enhanced.url });
        setMediaResult({ kind: "image", url: enhanced.url });
        toast.success("تم تحسين الصورة!");
      } else if (studioMediaAction === "ad_campaign") {
        if (!studioCaps.openAiKeyConfigured) {
          const script = localCampaignScript(studioVideoPrompt || studioImgPrompt || studioUploadedFile?.name || "حملة إعلانية");
          const posterUrl = studioSvgPlaceholder({
            title: "حملة إعلانية جاهزة",
            subtitle: script.split("\n").slice(0, 5).join(" • "),
            format: "1:1",
            style: studioMediaStyle,
            badge: "CAMPAIGN",
          });
          setStudioMediaResult({ type: "campaign", posterUrl, script });
          setMediaResult({ kind: "text", body: script });
          toast.success("تم إنشاء الحملة الإعلانية بالمحرك الداخلي");
          return;
        }
        const [posterRes, scriptRes] = await Promise.all([
          base44.integrations.Core.GenerateImage({
            prompt: `Create a professional advertising campaign poster based on this image. Add bold marketing text, brand colors, call-to-action button. ${studioMediaStyle} style.`,
            existing_image_urls: [studioUploadedUrl],
            size: "1024x1024",
          }),
          base44.integrations.Core.InvokeLLM({
            prompt:
              "Create a complete ad campaign package for this image. Include social media captions in Arabic, French and English, hashtags, target audience, budget recommendation, and a 1-week posting schedule.",
            file_urls: [studioUploadedUrl],
          }),
        ]);
        const script = stringifyAiResponse(scriptRes);
        setStudioMediaResult({ type: "campaign", posterUrl: posterRes.url, script });
        setMediaResult({ kind: "text", body: script });
        toast.success("تم إنشاء الحملة الإعلانية الكاملة!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ أثناء المعالجة");
    } finally {
      setStudioMediaLoading(false);
    }
  };

  const processMedia = async (
    mediaAction: MediaAction,
    options?: {
      sourceUrl?: string;
      videoPrompt?: string;
      vidFormat?: string;
      vidDuration?: number;
      motionScore?: number;
    }
  ): Promise<boolean> => {
    const uploadedUrl = options?.sourceUrl ?? b44UploadedUrl;
    if (!uploadedUrl) {
      toast.error("❌ يجب رفع صورة أولاً");
      return false;
    }

    if (mediaAction === "image_to_video") {
      setB44VideoResult(null);
      setB44Progress(0);
      const generationPrompt =
        (options?.videoPrompt ?? promoVideoPrompt).trim() ||
        "Cinematic high quality movement, smooth camera motion, professional cinematography";
      const vidFormat = options?.vidFormat ?? promoVidFormat;
      const vidDuration = options?.vidDuration ?? promoVidDuration;
      const motion = options?.motionScore ?? motionScore;

      toast.info("🎬 جاري توليد الإطارات…");
      const progressTimer = window.setInterval(() => {
        setB44Progress((current) => (current >= 95 ? 95 : Math.min(current + Math.random() * 2.5 + 1, 95)));
      }, 2000);

      let videoResponse: Awaited<ReturnType<typeof base44.generateBuiltInVideo>> | null = null;

      try {
        videoResponse = await base44.generateBuiltInVideo({
          image_url: uploadedUrl.trim(),
          prompt: generationPrompt,
          ratio: vidFormat,
          duration: Number(vidDuration) || 30,
          motion_score: motion,
        });
        window.clearInterval(progressTimer);
        setB44Progress(100);

        const frames = videoResponse.data?.frames;
        const videoUrl = videoResponse.data?.video_url;
        if (frames?.length || videoUrl) {
          const frameList = frames ?? [];
          setB44VideoResult({
            type: "frame_sequence",
            frames: frameList,
            assembly_instructions: videoResponse.data?.assembly_instructions,
            engine: videoResponse.data?.engine ?? "Built-in frame engine",
            duration: `${vidDuration}s`,
            ratio: vidFormat,
            credits_used: "Standard",
            credits_type: "Platform",
            prompt: generationPrompt,
          });
          setMediaResult({
            kind: "frames",
            frames: frameList,
            assembly_instructions: videoResponse.data?.assembly_instructions,
            engine: videoResponse.data?.engine ?? "Built-in frame engine",
          });
          toast.success("🎉 تم تجهيز الإطارات بنجاح!");
          window.setTimeout(() => {
            document.querySelector("[data-b44-video-result]")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 300);
        } else {
          const errorMsg = videoResponse.data?.error ?? "فشل توليد الإطارات";
          const errorDetails = videoResponse.data?.details ?? "";
          throw new Error(`${errorMsg}${errorDetails ? ` — ${errorDetails}` : ""}`);
        }
      } catch (error) {
        window.clearInterval(progressTimer);
        setB44Progress(0);
        const errorMsg = error instanceof Error ? error.message : "حدث خطأ في توليد الفيديو";
        toast.error(`❌ ${errorMsg}`);
        console.error("[Media Lab] Generation Error:", error);
        setB44VideoResult({
          type: "error",
          message: errorMsg,
          details: videoResponse?.data?.details ?? "تأكد من رفع صورة صالحة.",
          credits_charged: false,
          suggestion: "جرّب صورة أخرى أو قلّل الحجم.",
        });
        return false;
      }
      return true;
    }

    try {
      if (mediaAction === "enhance") {
        if (!studioCaps.openAiKeyConfigured) {
          toast.error("OPENAI_API_KEY غير مضبوط على الخادم — مطلوب للتحسين عبر الذكاء الاصطناعي");
          return false;
        }
        const descRes = await base44.integrations.Core.InvokeLLM({
          prompt:
            "Analyze this image and describe it in great detail for regeneration. Focus on composition, subjects, colors, and quality improvements needed.",
          file_urls: [uploadedUrl],
        });
        const descText = typeof descRes === "string" ? descRes : JSON.stringify(descRes);
        const enhanced = await base44.integrations.Core.GenerateImage({
          prompt: `Ultra high quality, 4K enhanced, sharpened, professional photography of: ${descText}. Noise reduction applied, perfect exposure, cinematic color grading.`,
          existing_image_urls: [uploadedUrl],
          size: "1024x1024",
        });
        setEnhancedDataUrl(enhanced.url);
        toast.success("تم تحسين الصورة!");
      } else if (mediaAction === "ad_campaign") {
        if (!studioCaps.openAiKeyConfigured) {
          toast.error("OPENAI_API_KEY غير مضبوط على الخادم — مطلوب للحملة الإعلانية");
          return false;
        }
        const [posterRes, scriptRes] = await Promise.all([
          base44.integrations.Core.GenerateImage({
            prompt: `Create a professional advertising campaign poster based on this image. Add bold marketing text, brand colors, call-to-action button.`,
            existing_image_urls: [uploadedUrl],
            size: "1024x1024",
          }),
          base44.integrations.Core.InvokeLLM({
            prompt: `Create a complete ad campaign package for this image. Include: social media captions (Arabic/French/English), hashtags, target audience, budget recommendation, posting schedule for 1 week.`,
            file_urls: [uploadedUrl],
          }),
        ]);
        window.alert(
          `حملة إعلانية (نص):\n\n${typeof scriptRes === "string" ? scriptRes : JSON.stringify(scriptRes, null, 2).slice(0, 2000)}`
        );
        window.open(posterRes.url, "_blank", "noopener,noreferrer");
        toast.success("تم إنشاء عناصر الحملة!");
      }
    } catch {
      toast.error("حدث خطأ أثناء المعالجة");
      return false;
    }
    return true;
  };

  async function handleGenerate() {
    if (!token) {
      toast.error("سجّل الدخول أولاً");
      return;
    }
    setHandleGenBusy(true);
    setHandleGenProgress(4);
    const tick = window.setInterval(() => {
      setHandleGenProgress((p) => (p >= 92 ? p : p + 3 + Math.random() * 2));
    }, 320);
    try {
      if (activeTab === "tti") {
        if (!ttiPrompt.trim()) {
          toast.error("أدخل وصفاً للصورة");
          return;
        }
        setTtiBusy(true);
        setTtiPreview(null);
        setMediaResult(null);
        const url = await runImageGeneration();
        setTtiPreview(url);
        setMediaResult({ kind: "image", url });
        setHandleGenProgress(100);
        toast.success("تم توليد الصورة — المعاينة أدناه");
        return;
      }
      if (activeTab === "promo") {
        if (videoFiles.length === 0) {
          toast.error("ارفع صورة واحدة على الأقل للفيديو");
          return;
        }
        setMediaResult(null);
        setVideoBusy(true);
        try {
          const first = videoFiles[0];
          let toUpload = first;
          if (first.type.startsWith("image/") && first.size > 1024 * 1024) {
            toast.info("تصغير حجم الصورة تلقائياً…");
            toUpload = await compressImage(first);
          }
          const file_url = await handleUpload(toUpload);
          if (!file_url) {
            toast.error("فشل رفع الصورة");
            return;
          }
          setB44VideoResult(null);
          setB44Progress(0);
          await processMedia("image_to_video", {
            sourceUrl: file_url,
            videoPrompt: promoVideoPrompt,
            vidFormat: promoVidFormat,
            vidDuration: promoVidDuration,
            motionScore,
          });
          setHandleGenProgress(100);
        } finally {
          setVideoBusy(false);
        }
        return;
      }
      if (activeTab === "ideas" || activeTab === "script") {
        if (!studioCaps.openAiKeyConfigured) {
          toast.error("OPENAI_API_KEY غير مضبوط على الخادم — مطلوب للنص");
          return;
        }
        if (!prompt.trim()) {
          toast.error("أدخل وصفاً أو موضوعاً");
          return;
        }
        setMediaResult(null);
        const scriptBody = await base44.integrations.Core.InvokeLLM({
          prompt: `أنت خبير تسويق ومونتاج فيديو للسوق المغربي. أنتج مسودة سكريبت/أفكار واضحة بالعربية مع جمل قصيرة بالفرنسية حيث يلزم.\n\nالموضوع: ${prompt.trim()}\n\nاللغة: ${locale}. رد كنص منظم بعناوين فرعية.`,
        });
        const body = typeof scriptBody === "string" ? scriptBody : JSON.stringify(scriptBody, null, 2);
        setMediaResult({ kind: "text", body });
        setHandleGenProgress(100);
        toast.success("تم توليد النص — المعاينة أدناه");
        return;
      }
      toast.info("افتح تبويب «توليد صور AI» أو «فيديو ترويجي» أو «أفكار / سكريبت» ثم اضغط توليد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التوليد");
    } finally {
      window.clearInterval(tick);
      setTtiBusy(false);
      setHandleGenBusy(false);
      window.setTimeout(() => setHandleGenProgress(0), 450);
    }
  }

  const exportCardPng = useCallback(async () => {
    const el = cardRef.current;
    if (!el) return;
    setCardExportBusy(true);
    try {
      await ensurePdfCanvasOnlyReady().catch(() => undefined);
      await document.fonts.ready.catch(() => undefined);
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        scale: 3,
        backgroundColor: "#0a1628",
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `carte-visite-${Date.now()}.png`;
      a.click();
    } finally {
      setCardExportBusy(false);
    }
  }, []);

  const runEnhance = async () => {
    if (!enhanceFile) return;
    if (removeBgEnhance && token) {
      setEnhanceBusy(true);
      setEnhancedDataUrl(null);
      try {
        await ensurePdfCanvasOnlyReady().catch(() => undefined);
        const blob = await enhanceImageWithServer(enhanceFile, token, { removeBg: true });
        setEnhancedDataUrl(URL.createObjectURL(blob));
        toast.success("تمت المعالجة على الخادم");
      } catch {
        try {
          const url = await enhanceImageFileToDataUrl(enhanceFile);
          setEnhancedDataUrl(url);
        } catch {
          setEnhancedDataUrl(null);
          toast.error("فشل التحسين");
        }
      } finally {
        setEnhanceBusy(false);
      }
      return;
    }

    setEnhanceBusy(true);
    setEnhancedDataUrl(null);
    try {
      let file = enhanceFile;
      if (file.type.startsWith("image/") && file.size > 1024 * 1024) {
        toast.info("تصغير حجم الصورة تلقائياً إلى 1MB…");
        file = await compressImage(file);
      }
      const file_url = await handleUpload(file);
      if (!file_url) return;
      await processMedia("enhance", { sourceUrl: file_url });
    } catch {
      toast.error("فشل التحسين عبر Base44");
    } finally {
      setEnhanceBusy(false);
    }
  };

  const downloadEnhanced = () => {
    if (!enhancedDataUrl) return;
    const a = document.createElement("a");
    a.href = enhancedDataUrl;
    a.download = `enhanced-${Date.now()}.png`;
    a.click();
  };

  const downloadTti = () => {
    if (!ttiPreview) return;
    const a = document.createElement("a");
    a.href = ttiPreview;
    a.download = `studio-ai-${Date.now()}.png`;
    a.click();
  };

  const runLogoPreviewImage = async () => {
    if (!token || !studioCaps.textToImage) return;
    if (!studioCaps.openAiKeyConfigured) {
      toast.error("OPENAI_API_KEY غير مضبوط على الخادم");
      return;
    }
    const brand = (cardName || prompt || "premium brand").trim();
    if (!brand) return;
    setLogoImgBusy(true);
    try {
      const brief = `${brand}: professional corporate logo, clean vector-style flat design, Moroccan premium palette royal blue #0052CC and gold #FF8C00, white background, centered, high detail, print-ready`;
      const b64 = await requestStudioTextToImage(token, brief, "1024x1024");
      const url = `data:image/png;base64,${b64}`;
      setTtiPreview(url);
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("تم توليد المعاينة");
    } catch {
      toast.error(t("media.ttiErr"));
    } finally {
      setLogoImgBusy(false);
    }
  };

  const buildVideo = async () => {
    if (videoFiles.length === 0) return;
    setVideoBusy(true);
    setB44VideoResult(null);
    setB44Progress(0);
    setVideoEncodeProgress(0);
    try {
      if (token) {
        const first = videoFiles[0];
        let toUpload = first;
        if (first.type.startsWith("image/") && first.size > 1024 * 1024) {
          toast.info("تصغير حجم الصورة تلقائياً إلى 1MB…");
          toUpload = await compressImage(first);
        }
        const file_url = await handleUpload(toUpload);
        if (!file_url) {
          toast.error("فشل الرفع");
          return;
        }

        const framesOk = await processMedia("image_to_video", {
          sourceUrl: file_url,
          videoPrompt: promoVideoPrompt,
          vidFormat: promoVidFormat,
          vidDuration: promoVidDuration,
          motionScore,
        });
        if (framesOk) return;
      }

      const fd = new FormData();
      for (const f of videoFiles) fd.append("images", f);
      fd.append("headline", promoHeadline.trim() || "Smart Al-Idara Pro");
      fd.append("tagline", promoTagline.trim() || "");
      fd.append(
        "captions",
        [promoHeadline.trim(), promoTagline.trim(), `Lang: ${locale}`].filter((s) => s.length > 0).join("\n\n")
      );
      if (promoAudio) fd.append("music", promoAudio);
      const backend = await postBackendPromoVideo(fd);
      if (backend.ok) {
        window.open(backend.url, "_blank", "noopener,noreferrer");
        toast.success("فيديو جاهز");
        return;
      }
      if (backend.message && !backend.imageUrls?.length) {
        toast.error(backend.message);
      } else if (backend.imageUrls?.length) {
        toast.error(
          `${backend.message ?? t("media.videoErr")}\n\nCloudinary: ${backend.imageUrls.length} صورة. أضف SHOTSTACK_API_KEY لدمج MP4.`
        );
      }

      await document.fonts.ready.catch(() => undefined);
      setVideoEncodeProgress(0.15);
      const webmBlob = await buildCinematicPromoWebm({
        files: videoFiles,
        headline: promoHeadline.trim() || "Smart Al-Idara Pro",
        tagline: promoTagline.trim() || t("media.subtitle"),
        maxDurationMs: 60_000,
        audioFile: promoAudio,
      });
      if (!webmBlob) {
        toast.error(t("media.videoErr"));
        return;
      }
      setVideoEncodeProgress(0.45);
      const mp4 = await tryTranscodeWebmToMp4(webmBlob, (r) => setVideoEncodeProgress(0.45 + r * 0.52));
      const blob = mp4 ?? webmBlob;
      const ext = mp4 ? "mp4" : "webm";
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `idara-cinematic-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(u);
      setVideoEncodeProgress(1);
      toast.success("تم تصدير الفيديو محلياً");
    } catch {
      toast.error(t("media.videoErr"));
    } finally {
      setVideoBusy(false);
      window.setTimeout(() => setVideoEncodeProgress(0), 400);
    }
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4 max-w-lg mx-auto">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("media.lockedTitle")}</h2>
        <p className="text-slate-400 text-sm">{t("media.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl pb-16">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-l from-[#FF8C00] to-[#0052CC] bg-clip-text text-transparent flex items-center gap-3">
          <Sparkles className="size-8 text-[#FF8C00]" />
          {t("media.title")}
        </h1>
        <p className="text-slate-400 text-sm max-w-2xl">{t("media.subtitle")}</p>
        <p className="text-[11px] text-slate-600 max-w-2xl leading-relaxed border border-cyan-500/20 rounded-xl px-3 py-2 bg-black/20">
          {t("media.privacyEngine")}
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto bg-white/5 backdrop-blur-xl border border-white/10 p-1 gap-1">
          <TabsTrigger value="studio2" className="gap-1">
            <Zap className="size-4" />
            AI Studio 2.0
          </TabsTrigger>
          <TabsTrigger value="ideas">{t("media.tabIdeas")}</TabsTrigger>
          <TabsTrigger value="tti">{t("media.tabTti")}</TabsTrigger>
          <TabsTrigger value="card">{t("media.tabCard")}</TabsTrigger>
          <TabsTrigger value="logo">{t("media.tabLogo")}</TabsTrigger>
          <TabsTrigger value="enhance">{t("media.tabEnhance")}</TabsTrigger>
          <TabsTrigger value="promo">{t("media.tabPromoVideo")}</TabsTrigger>
          <TabsTrigger value="script">{t("media.tabScriptVideo")}</TabsTrigger>
        </TabsList>

        <div className="mt-4 rounded-xl border border-white/10 bg-[#050a12]/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="gap-2 bg-gradient-to-r from-[#0052CC] to-fuchsia-600 font-black"
              disabled={handleGenBusy}
              onClick={() => void handleGenerate()}
            >
              {handleGenBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {t("ai.generate")}
            </Button>
            {handleGenProgress > 0 && (
              <div className="flex-1 min-w-[140px] max-w-md space-y-1">
                <div className="h-2 rounded-full bg-white/10 overflow-hidden border border-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-cyan-400 to-fuchsia-500"
                    style={{ width: `${Math.min(100, Math.round(handleGenProgress))}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 text-center">{Math.round(handleGenProgress)}%</p>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            يتصرّف حسب التبويب النشط:{" "}
            <strong className="text-slate-300">
              {activeTab === "tti"
                ? "توليد صورة من النص"
                : activeTab === "promo"
                  ? "إطارات فيديو من أول صورة مرفوعة"
                  : activeTab === "studio2"
                    ? "استوديو متكامل: صور + فيديو + قوالب + حملات"
                  : activeTab === "ideas" || activeTab === "script" || activeTab === "logo"
                    ? "نص / سكريبت (OpenAI) — أو زر التوليد في التبويب"
                    : "انتقل لتبويب الصور أو «فيديو ترويجي»"}
            </strong>
          </p>
          {mediaResult && (
            <div data-media-lab-preview className="rounded-lg border border-cyan-500/25 bg-black/40 p-3 space-y-2">
              <p className="text-xs font-bold text-cyan-300">معاينة النتيجة</p>
              {mediaResult.kind === "image" && (
                <img src={mediaResult.url} alt="" className="max-h-64 rounded-lg border border-white/10 mx-auto" />
              )}
              {mediaResult.kind === "frames" && (
                <div className="grid grid-cols-2 gap-1 max-w-lg mx-auto">
                  {mediaResult.frames.slice(0, 4).map((src, i) => (
                    <img key={i} src={src} alt="" className="rounded object-cover aspect-video w-full" />
                  ))}
                </div>
              )}
              {mediaResult.kind === "text" && (
                <pre className="text-xs text-slate-200 whitespace-pre-wrap max-h-56 overflow-y-auto p-2 bg-black/40 rounded">
                  {mediaResult.body}
                </pre>
              )}
            </div>
          )}
        </div>

        <TabsContent value="studio2" className="mt-6 space-y-6">
          <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 text-white shadow-xl">
            <div className="flex flex-wrap items-center gap-3">
              <Sparkles className="size-8" />
              <h2 className="text-2xl font-black">AI Creative Studio 2.0</h2>
              <Badge className="border-white/25 bg-white/15 text-white">استديو الإبداع المتقدم</Badge>
              <Badge className="border-emerald-400/35 bg-emerald-500/20 text-emerald-50">
                Built-in Ready
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-violet-100">
              توليد صور احترافية، تحويل الصور إلى إطارات فيديو، تحسين الجودة، وإنشاء حملات إعلانية وقوالب جاهزة للسوق المغربي.
            </p>
            <p className="mt-2 max-w-3xl text-xs text-violet-100/85">
              يعمل بالمحرك الداخلي دائماً، ويستعمل API المنصة عند توفره: Base44 Upload، Generate Image، Invoke LLM، و Built-in Video Engine.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-violet-500/25 bg-white/5 backdrop-blur-xl">
              <CardHeader className="border-b border-white/10">
                <p className="flex items-center gap-2 font-black text-white">
                  <ImageIcon className="size-5 text-violet-300" />
                  مولّد الصور والجرافيك
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div>
                  <Label className="text-slate-300">وصف التصميم المطلوب *</Label>
                  <textarea
                    className="mt-1 flex min-h-[112px] w-full rounded-xl border border-slate-600 bg-[#050a12]/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                    placeholder="مثال: فلاير احترافي لمكتب إداري، ألوان زرقاء وذهبية، يشمل خدمات التأشيرة..."
                    value={studioImgPrompt}
                    onChange={(e) => setStudioImgPrompt(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-slate-300">النسبة / الحجم</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {FORMAT_OPTIONS.map((f) => (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => setStudioImgFormat(f.value)}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                            studioImgFormat === f.value
                              ? "border-violet-400 bg-violet-950/50 text-white"
                              : "border-white/15 text-slate-300 hover:border-violet-400/60"
                          }`}
                        >
                          <f.icon className="size-4" />
                          {f.value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300">الأسلوب البصري</Label>
                    <select
                      value={studioImgStyle}
                      onChange={(e) => setStudioImgStyle(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-600 bg-[#050a12]/80 px-3 py-2 text-sm text-white"
                    >
                      {STYLE_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["فلاير تأشيرة إسبانيا", "بطاقة أعمال مكتب إداري", "ملصق إنستغرام", "بانر احترافي"].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setStudioImgPrompt(q)}
                      className="rounded-full border border-violet-400/25 bg-violet-950/30 px-3 py-1 text-xs text-violet-100 hover:bg-violet-900/40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  disabled={studioImgLoading || !studioImgPrompt.trim()}
                  onClick={() => void generateStudioImage()}
                  className="w-full gap-2 bg-violet-600 hover:bg-violet-700"
                >
                  {studioImgLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {studioImgLoading ? "جاري التوليد..." : "ولّد التصميم الآن"}
                </Button>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  {studioImgLoading && (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="size-10 animate-spin text-violet-300" />
                      <p className="text-sm">جاري إنشاء تصميمك الاحترافي...</p>
                    </div>
                  )}
                  {!studioImgLoading && !studioImgResult && (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 text-slate-500">
                      <ImageIcon className="size-12 opacity-40" />
                      <p className="text-sm">سيظهر تصميمك هنا</p>
                    </div>
                  )}
                  {studioImgResult && (
                    <div className="space-y-3">
                      <img src={studioImgResult} alt="" className="mx-auto max-h-80 w-full rounded-xl object-contain" />
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => downloadUrl(studioImgResult, "studio-design.png")}>
                          <Download className="size-4" />
                          تحميل
                        </Button>
                        <Button type="button" variant="ghost" className="gap-2" onClick={() => setStudioImgResult(null)}>
                          <RefreshCw className="size-4" />
                          جديد
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/25 bg-white/5 backdrop-blur-xl">
              <CardHeader className="border-b border-white/10">
                <p className="flex items-center gap-2 font-black text-white">
                  <Zap className="size-5 text-amber-300" />
                  Media Lab — رفع وتحويل الوسائط
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <label className="block cursor-pointer">
                  <div className="rounded-xl border-2 border-dashed border-amber-400/30 p-6 text-center transition-colors hover:border-amber-400/70 hover:bg-amber-950/20">
                    {uploadProgress ? (
                      <Loader2 className="mx-auto mb-2 size-8 animate-spin text-amber-300" />
                    ) : studioUploadedFile ? (
                      <div className="space-y-1">
                        <ImageIcon className="mx-auto size-8 text-amber-300" />
                        <p className="text-sm font-bold text-amber-100">{studioUploadedFile.name}</p>
                        <p className="text-xs text-emerald-300">تم الرفع بنجاح</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto mb-2 size-8 text-amber-300" />
                        <p className="text-sm text-slate-300">اسحب صورة أو اضغط للرفع</p>
                        <p className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP — يتم ضغطها تلقائياً قبل إرسالها للـ API</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void uploadStudioMedia(e.target.files?.[0] ?? null)}
                  />
                </label>

                <div className="grid gap-2">
                  {[
                    { id: "enhance" as const, label: "⚡ تحسين وتشارب الصورة", desc: "رفع جودة الصور المنخفضة وتحسين الإضاءة" },
                    { id: "image_to_video" as const, label: "🎬 تحويل صورة إلى فيديو سينمائي", desc: "توليد إطارات فيديو احترافية من الصورة" },
                    { id: "ad_campaign" as const, label: "📢 إنشاء حملة إعلانية كاملة", desc: "ملصق + نصوص سوشيال ميديا" },
                  ].map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => setStudioMediaAction(action.id)}
                      className={`rounded-xl border p-3 text-start transition-colors ${
                        studioMediaAction === action.id
                          ? "border-amber-400 bg-amber-950/35 text-white"
                          : "border-white/10 text-slate-300 hover:border-amber-400/40"
                      }`}
                    >
                      <p className="text-sm font-bold">{action.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{action.desc}</p>
                    </button>
                  ))}
                </div>

                {studioMediaAction === "image_to_video" && (
                  <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div>
                      <Label className="text-slate-300">وصف مشهد الفيديو والصوت (اختياري)</Label>
                      <textarea
                        className="mt-1 flex min-h-[76px] w-full rounded-xl border border-slate-600 bg-[#050a12]/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35"
                        placeholder="مثال: حركة بطيئة للكاميرا، إضاءة دافئة، موسيقى هادئة..."
                        value={studioVideoPrompt}
                        onChange={(e) => setStudioVideoPrompt(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-slate-300">أسلوب الفيديو</Label>
                        <select
                          value={studioMediaStyle}
                          onChange={(e) => setStudioMediaStyle(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-600 bg-[#050a12]/80 px-3 py-2 text-sm text-white"
                        >
                          <option value="cinematic">Cinematic / سينمائي</option>
                          <option value="corporate">Corporate / مؤسسي</option>
                          <option value="social">Social Media / سوشيال</option>
                          <option value="luxury">Luxury / فاخر</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-slate-300">المدة</Label>
                        <div className="mt-1 flex gap-2">
                          {DURATION_OPTIONS.map((d) => (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => setStudioScriptDuration(d.value)}
                              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-black ${
                                studioScriptDuration === d.value
                                  ? "border-amber-400 bg-amber-950/40 text-white"
                                  : "border-white/15 text-slate-400"
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {FORMAT_OPTIONS.map((f) => (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => setStudioScriptFormat(f.value)}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                            studioScriptFormat === f.value
                              ? "border-amber-400 bg-amber-950/40 text-white"
                              : "border-white/15 text-slate-400"
                          }`}
                        >
                          <f.icon className="size-4" />
                          {f.value}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  disabled={studioMediaLoading || !studioUploadedUrl}
                  className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
                  onClick={() => void processStudioMedia()}
                >
                  {studioMediaLoading ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4" />}
                  {studioMediaLoading ? "جاري المعالجة..." : "ابدأ المعالجة"}
                </Button>

                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  {studioMediaLoading && (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="size-10 animate-spin text-amber-300" />
                      <p className="text-sm font-semibold text-amber-100">
                        {studioProgress >= 85 ? "🎬 جاري التصدير النهائي..." : "⚙️ جاري المعالجة..."}
                      </p>
                      {studioProgress > 0 && (
                        <div className="w-full max-w-xs">
                          <div className="h-3 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all" style={{ width: `${studioProgress}%` }} />
                          </div>
                          <p className="mt-1 text-center text-xs font-bold text-amber-200">{Math.round(studioProgress)}%</p>
                        </div>
                      )}
                    </div>
                  )}
                  {!studioMediaLoading && !studioMediaResult && (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 text-slate-500">
                      <Zap className="size-12 opacity-40" />
                      <p className="text-sm">ارفع ملفاً واختر العملية</p>
                    </div>
                  )}
                  {studioMediaResult?.type === "image" && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-emerald-300">صورة محسّنة بجودة عالية</p>
                      <img src={studioMediaResult.url} alt="" className="mx-auto max-h-80 w-full rounded-xl object-contain" />
                      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => downloadUrl(studioMediaResult.url, "enhanced.png")}>
                        <Download className="size-4" />
                        تحميل الصورة
                      </Button>
                    </div>
                  )}
                  {studioMediaResult?.type === "frame_sequence" && (
                    <div className="space-y-3" data-studio2-video-result>
                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3">
                        <p className="text-sm font-bold text-emerald-200">فيديو جاهز كإطارات — {studioMediaResult.duration}</p>
                        <p className="text-xs text-emerald-400">{studioMediaResult.engine} • {studioMediaResult.ratio}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/50 p-1">
                        {studioMediaResult.frames.slice(0, 4).map((frame, i) => (
                          <img key={i} src={frame} alt="" className="aspect-video w-full rounded object-cover" />
                        ))}
                      </div>
                      {studioMediaResult.assembly_instructions && (
                        <pre className="max-h-40 overflow-y-auto rounded-lg bg-black/40 p-2 text-xs text-slate-300 whitespace-pre-wrap">
                          {studioMediaResult.assembly_instructions}
                        </pre>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => {
                            studioMediaResult.frames.forEach((frame, i) => downloadUrl(frame, `frame-${i + 1}.png`));
                            toast.success("جاري تحميل الإطارات...");
                          }}
                        >
                          <Download className="size-4" />
                          تحميل الإطارات
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            void navigator.clipboard.writeText(studioMediaResult.frames.join("\n"));
                            toast.success("تم نسخ روابط الإطارات");
                          }}
                        >
                          نسخ الروابط
                        </Button>
                      </div>
                    </div>
                  )}
                  {studioMediaResult?.type === "campaign" && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-emerald-300">الحملة الإعلانية الكاملة</p>
                      <img src={studioMediaResult.posterUrl} alt="" className="mx-auto max-h-80 w-full rounded-xl object-contain" />
                      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => downloadUrl(studioMediaResult.posterUrl, "campaign-poster.png")}>
                        <Download className="size-4" />
                        تحميل الملصق
                      </Button>
                      <pre className="max-h-56 overflow-y-auto rounded-lg bg-emerald-950/20 p-3 text-xs text-emerald-50 whitespace-pre-wrap">
                        {studioMediaResult.script}
                      </pre>
                    </div>
                  )}
                  {studioMediaResult?.type === "error" && (
                    <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-center">
                      <p className="font-bold text-red-200">{studioMediaResult.message}</p>
                      <p className="mt-1 text-xs text-red-300">{studioMediaResult.details}</p>
                      {studioMediaResult.suggestion && <p className="mt-2 text-xs text-blue-200">{studioMediaResult.suggestion}</p>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-cyan-500/25 bg-white/5 backdrop-blur-xl">
              <CardHeader className="border-b border-white/10">
                <p className="flex items-center gap-2 font-black text-white">
                  <Film className="size-5 text-cyan-300" />
                  مولّد سكريبت الفيديو
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div>
                  <Label className="text-slate-300">وصف الفيديو المطلوب *</Label>
                  <textarea
                    className="mt-1 flex min-h-[112px] w-full rounded-xl border border-slate-600 bg-[#050a12]/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                    placeholder="مثال: إعلان 30 ثانية لخدمات التأشيرة لإسبانيا..."
                    value={studioScriptPrompt}
                    onChange={(e) => setStudioScriptPrompt(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-slate-300">نوع الفيديو</Label>
                    <select
                      value={studioVideoType}
                      onChange={(e) => setStudioVideoType(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-600 bg-[#050a12]/80 px-3 py-2 text-sm text-white"
                    >
                      <option value="corporate">Corporate / مؤسسي</option>
                      <option value="ad">إعلان تجاري</option>
                      <option value="explainer">فيديو تعليمي</option>
                      <option value="social">سوشيال ميديا</option>
                      <option value="testimonial">شهادة عميل</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-slate-300">النسبة</Label>
                    <select
                      value={studioScriptFormat}
                      onChange={(e) => setStudioScriptFormat(e.target.value as StudioFormat)}
                      className="mt-1 w-full rounded-xl border border-slate-600 bg-[#050a12]/80 px-3 py-2 text-sm text-white"
                    >
                      {FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-slate-300">المدة</Label>
                    <select
                      value={studioScriptDuration}
                      onChange={(e) => setStudioScriptDuration(Number(e.target.value) as StudioDuration)}
                      className="mt-1 w-full rounded-xl border border-slate-600 bg-[#050a12]/80 px-3 py-2 text-sm text-white"
                    >
                      {DURATION_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["إعلان تأشيرة 30ث", "فيديو تعريف بالمكتب", "شهادة عميل", "TikTok رياض أعمال"].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setStudioScriptPrompt(q)}
                      className="rounded-full border border-cyan-400/25 bg-cyan-950/30 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-900/40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  disabled={studioScriptLoading || !studioScriptPrompt.trim()}
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                  onClick={() => void generateStudioVideoScript()}
                >
                  {studioScriptLoading ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
                  {studioScriptLoading ? "جاري الإنشاء..." : "أنشئ السكريبت"}
                </Button>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  {!studioScriptLoading && !studioScriptResult && (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 text-slate-500">
                      <Film className="size-12 opacity-40" />
                      <p className="text-sm">سيظهر السكريبت هنا</p>
                    </div>
                  )}
                  {studioScriptLoading && (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="size-10 animate-spin text-cyan-300" />
                      <p className="text-sm">جاري كتابة السكريبت...</p>
                    </div>
                  )}
                  {studioScriptResult && (
                    <div className="max-h-[520px] space-y-3 overflow-y-auto">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-cyan-200">{studioScriptResult.title || "سكريبت فيديو"}</h3>
                        <Badge variant="outline">{studioScriptResult.duration || `${studioScriptDuration}s`}</Badge>
                      </div>
                      {studioScriptResult.script && (
                        <div className="rounded-lg bg-cyan-950/25 p-3">
                          <p className="mb-1 text-xs font-bold text-cyan-300">النص الكامل</p>
                          <p className="whitespace-pre-wrap text-xs text-cyan-50">{studioScriptResult.script}</p>
                        </div>
                      )}
                      {studioScriptResult.scenes?.map((scene, i) => (
                        <div key={i} className="rounded-lg bg-white/5 p-3 text-xs">
                          <div className="mb-1 flex items-center gap-2">
                            <Badge className="bg-blue-500/20 text-blue-100">مشهد {scene.scene_number ?? i + 1}</Badge>
                            {scene.duration_sec != null && <span className="text-slate-500">{scene.duration_sec}s</span>}
                          </div>
                          <p className="font-medium text-slate-100">{scene.description}</p>
                          {scene.narration && <p className="mt-1 text-slate-400">"{scene.narration}"</p>}
                          {scene.visual && <p className="mt-1 text-cyan-300">📷 {scene.visual}</p>}
                        </div>
                      ))}
                      {studioScriptResult.music_suggestion && (
                        <div className="rounded-lg bg-purple-950/25 p-3 text-xs text-purple-100">
                          🎵 {studioScriptResult.music_suggestion}
                        </div>
                      )}
                      {studioScriptResult.cta && (
                        <div className="rounded-lg bg-emerald-950/25 p-3 text-xs text-emerald-100">
                          🎯 {studioScriptResult.cta}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-500/25 bg-white/5 backdrop-blur-xl">
              <CardHeader className="border-b border-white/10">
                <p className="flex items-center gap-2 font-black text-white">
                  <Wand2 className="size-5 text-orange-300" />
                  القوالب الجاهزة
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "flyer" as const, label: "فلاير" },
                    { id: "card" as const, label: "بطاقة أعمال" },
                    { id: "poster" as const, label: "ملصق" },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setStudioTemplate(tpl.id);
                        setStudioTemplateVars({});
                        setStudioTemplateResult(null);
                      }}
                      className={`rounded-xl border p-3 text-sm font-bold transition-colors ${
                        studioTemplate === tpl.id
                          ? "border-orange-400 bg-orange-950/35 text-white"
                          : "border-white/10 text-slate-300 hover:border-orange-400/40"
                      }`}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {studioTemplate === "flyer" && (
                    <>
                      <Input
                        className="bg-[#050a12]/60 border-slate-600"
                        placeholder="اسم النشاط التجاري"
                        value={studioTemplateVars.business || ""}
                        onChange={(e) => setStudioTemplateVars((p) => ({ ...p, business: e.target.value }))}
                      />
                      <Input
                        className="bg-[#050a12]/60 border-slate-600"
                        placeholder="المدينة"
                        value={studioTemplateVars.city || ""}
                        onChange={(e) => setStudioTemplateVars((p) => ({ ...p, city: e.target.value }))}
                      />
                    </>
                  )}
                  {studioTemplate === "card" && (
                    <>
                      <Input
                        className="bg-[#050a12]/60 border-slate-600"
                        placeholder="الاسم الكامل"
                        value={studioTemplateVars.name || ""}
                        onChange={(e) => setStudioTemplateVars((p) => ({ ...p, name: e.target.value }))}
                      />
                      <Input
                        className="bg-[#050a12]/60 border-slate-600"
                        placeholder="المنصب / اللقب"
                        value={studioTemplateVars.title || ""}
                        onChange={(e) => setStudioTemplateVars((p) => ({ ...p, title: e.target.value }))}
                      />
                      <Input
                        className="bg-[#050a12]/60 border-slate-600"
                        placeholder="اسم الشركة"
                        value={studioTemplateVars.company || ""}
                        onChange={(e) => setStudioTemplateVars((p) => ({ ...p, company: e.target.value }))}
                      />
                    </>
                  )}
                  {studioTemplate === "poster" && (
                    <>
                      <Input
                        className="bg-[#050a12]/60 border-slate-600"
                        placeholder="اسم الفعالية"
                        value={studioTemplateVars.event || ""}
                        onChange={(e) => setStudioTemplateVars((p) => ({ ...p, event: e.target.value }))}
                      />
                      <Input
                        className="bg-[#050a12]/60 border-slate-600"
                        placeholder="التاريخ"
                        value={studioTemplateVars.date || ""}
                        onChange={(e) => setStudioTemplateVars((p) => ({ ...p, date: e.target.value }))}
                      />
                    </>
                  )}
                </div>
                <Button
                  type="button"
                  disabled={studioTemplateLoading}
                  className="w-full gap-2 bg-orange-600 hover:bg-orange-700"
                  onClick={() => void generateStudioTemplate()}
                >
                  {studioTemplateLoading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                  {studioTemplateLoading ? "جاري الإنشاء..." : "أنشئ من القالب"}
                </Button>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  {studioTemplateLoading && (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="size-10 animate-spin text-orange-300" />
                      <p className="text-sm">جاري تطبيق القالب...</p>
                    </div>
                  )}
                  {!studioTemplateLoading && !studioTemplateResult && (
                    <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 text-slate-500">
                      <Wand2 className="size-12 opacity-40" />
                      <p className="text-sm">اختر قالباً وأدخل البيانات</p>
                    </div>
                  )}
                  {studioTemplateResult && (
                    <div className="space-y-3">
                      <img src={studioTemplateResult} alt="" className="mx-auto max-h-80 w-full rounded-xl object-contain" />
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => downloadUrl(studioTemplateResult, `${studioTemplate}.png`)}>
                          <Download className="size-4" />
                          تحميل
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setStudioTemplateResult(null)}>
                          <RefreshCw className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tti" className="mt-6 space-y-4">
            <Card className="border-[#0052CC]/30 bg-gradient-to-br from-[#0a1628]/95 to-[#050a12] backdrop-blur-xl">
              <CardHeader className="border-b border-white/10">
                <p className="font-black text-white flex items-center gap-2">
                  <ImageIcon className="size-5 text-[#FF8C00]" />
                  {t("media.ttiTitle")}
                </p>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm text-slate-400">{t("media.ttiHint")}</p>
                <p className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-100">
                  Free image generation is powered by Pollinations.ai. No external API key is required.
                </p>
                <Label>{t("media.ttiPrompt")}</Label>
                <textarea
                  className="flex min-h-[100px] w-full rounded-xl border border-slate-600 bg-[#050a12]/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/40"
                  value={ttiPrompt}
                  onChange={(e) => setTtiPrompt(e.target.value)}
                  placeholder={t("media.prompt")}
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    value={ttiSize}
                    onChange={(e) => setTtiSize(e.target.value as typeof ttiSize)}
                    className="rounded-lg border border-slate-600 bg-[#050a12]/80 px-3 py-2 text-sm text-white"
                  >
                    <option value="1024x1024">{t("media.ttiSizeSq")}</option>
                    <option value="1792x1024">{t("media.ttiSizeWide")}</option>
                    <option value="1024x1792">{t("media.ttiSizeTall")}</option>
                  </select>
                </div>
                <Button
                  type="button"
                  className="bg-gradient-to-r from-[#0052CC] to-fuchsia-600"
                  disabled={ttiBusy || !ttiPrompt.trim()}
                  onClick={() => void generateImage()}
                >
                  {ttiBusy ? t("media.ttiBusy") : t("media.ttiGenerate")}
                </Button>
                {uploadProgress && (
                  <p className="text-xs text-cyan-400 flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" /> جاري الرفع…
                  </p>
                )}
                {ttiPreview && (
                  <div className="space-y-2">
                    <img src={ttiPreview} alt="" className="max-w-full rounded-xl border border-white/10" />
                    <Button type="button" variant="secondary" className="gap-2" onClick={downloadTti}>
                      <Download className="size-4" />
                      {t("media.ttiDownload")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="script" className="mt-6 space-y-4">
          <Card className="border-cyan-500/25 bg-gradient-to-br from-cyan-950/30 to-[#0a1628]/90 backdrop-blur-xl">
            <CardHeader className="border-b border-white/10">
              <p className="font-black text-white flex items-center gap-2">
                <Video className="size-5 text-cyan-400" />
                {t("media.tabScriptVideo")}
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm text-slate-400">{t("media.scriptVideoIntro")}</p>
              <Label>{t("media.prompt")}</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-xl border border-slate-600 bg-[#050a12]/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("media.scriptVideoPlaceholder")}
              />
              <AiGenerateButton
                token={token}
                module="mediaLab"
                locale={locale}
                context={{
                  prompt,
                  topic: prompt,
                  name: cardName || "brand",
                  city: "MA",
                  format: "ad_script_60s",
                  output: "script_to_video_master",
                }}
                className="bg-gradient-to-r from-cyan-600 to-[#0052CC]"
                onGenerated={(text) => {
                  setMediaResult({ kind: "text", body: text });
                  toast.success("تم توليد السكريبت — المعاينة أعلاه");
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ideas" className="mt-6 space-y-4">
          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader className="border-b border-white/10">
              <p className="font-black text-white flex items-center gap-2">
                <Video className="size-5 text-[#0052CC]" />
                {t("media.tabIdeas")}
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Label>{t("media.prompt")}</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-xl border border-slate-600 bg-[#050a12]/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/40"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="مثال: محل حلويات في الدار البيضاء…"
              />
              <AiGenerateButton
                token={token}
                module="mediaLab"
                locale={locale}
                context={{
                  prompt,
                  topic: prompt,
                  name: cardName || "—",
                  city: "—",
                  format: "ad_script_60s",
                }}
                className="bg-gradient-to-r from-[#0052CC] to-[#003d99]"
                onGenerated={(text) => {
                  setMediaResult({ kind: "text", body: text });
                  toast.success("تم توليد الأفكار — المعاينة أعلاه");
                }}
              />
              <p className="text-xs text-slate-500 border-t border-white/10 pt-3">{t("media.videoHint")}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="card" className="mt-6 space-y-4">
          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader>
              <p className="font-black text-white flex items-center gap-2">
                <Type className="size-5 text-[#FF8C00]" />
                {t("media.tabCard")}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label>{t("media.cardName")}</Label>
                  <Input
                    className="mt-1 bg-[#050a12]/60 border-slate-600"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("media.cardRole")}</Label>
                  <Input
                    className="mt-1 bg-[#050a12]/60 border-slate-600"
                    value={cardRole}
                    onChange={(e) => setCardRole(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t("media.cardPhone")}</Label>
                  <Input
                    className="mt-1 bg-[#050a12]/60 border-slate-600"
                    value={cardPhone}
                    onChange={(e) => setCardPhone(e.target.value)}
                  />
                </div>
              </div>
              <div
                ref={cardRef}
                className="rounded-2xl p-8 max-w-md mx-auto border border-white/20 bg-gradient-to-br from-[#0052CC]/30 via-[#0a1628] to-[#FF8C00]/20 shadow-2xl"
                style={{ aspectRatio: "1.75 / 1" }}
              >
                <div className="h-full flex flex-col justify-between text-center">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-[#FF8C00]/90">PRO</div>
                  <div>
                    <p className="text-2xl font-black text-white">{cardName || "—"}</p>
                    <p className="text-sm text-slate-300 mt-1">{cardRole || "—"}</p>
                  </div>
                  <p className="text-[#0052CC] font-bold">{cardPhone || "—"}</p>
                </div>
              </div>
              <Button
                type="button"
                className="bg-[#FF8C00] text-[#050a12]"
                disabled={cardExportBusy}
                onClick={() => void exportCardPng()}
              >
                {cardExportBusy ? t("common.processing") : t("media.cardExport")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logo" className="mt-6">
          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader>
              <p className="font-black text-white flex items-center gap-2">
                <ImageIcon className="size-5 text-emerald-400" />
                {t("media.tabLogo")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl h-48 flex items-center justify-center border-2 border-dashed border-[#0052CC]/40 bg-black/20">
                <span className="text-6xl font-black bg-gradient-to-br from-[#0052CC] to-[#FF8C00] bg-clip-text text-transparent">
                  AI
                </span>
              </div>
              <p className="text-sm text-slate-400">{t("media.logoHint")}</p>
              <AiGenerateButton
                token={token}
                module="mediaLab"
                locale={locale}
                context={{
                  prompt: prompt || "premium brand logo",
                  topic: "professional_logo_design",
                  name: cardName || "brand",
                  city: "MA",
                  format: "logo_brief_vector",
                }}
                className="bg-emerald-600 hover:bg-emerald-500"
                onGenerated={(text) => {
                  setMediaResult({ kind: "text", body: text });
                  toast.success("تم توليد نص الشعار — المعاينة أعلاه");
                }}
              />
              {studioCaps.textToImage && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-100"
                  disabled={logoImgBusy}
                  onClick={() => void runLogoPreviewImage()}
                >
                  {logoImgBusy ? t("media.ttiBusy") : t("media.logoGenBtn")}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enhance" className="mt-6">
          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader>
              <p className="font-black text-white flex items-center gap-2">
                <Wand2 className="size-5 text-cyan-400" />
                {t("media.tabEnhance")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="file"
                accept="image/*"
                className="cursor-pointer text-slate-300"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (originalDataUrl) URL.revokeObjectURL(originalDataUrl);
                  setEnhanceFile(f ?? null);
                  setEnhancedDataUrl(null);
                  setOriginalDataUrl(f ? URL.createObjectURL(f) : null);
                }}
              />
              <p className="text-xs text-slate-500">{t("media.uploadImage")}</p>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeBgEnhance}
                  onChange={(e) => setRemoveBgEnhance(e.target.checked)}
                  className="rounded border-slate-600"
                />
                {t("media.removeBgOpt")}
              </label>
              <p className="text-[10px] text-slate-600">{t("media.serverEnhanceHint")}</p>
              <Button
                type="button"
                variant="secondary"
                disabled={!enhanceFile || enhanceBusy}
                onClick={() => void runEnhance()}
              >
                {enhanceBusy ? t("common.loading") : t("media.enhanceBtnPro")}
              </Button>
              {(originalDataUrl || enhancedDataUrl) && (
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {originalDataUrl && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">{t("media.before")}</p>
                        <img src={originalDataUrl} alt="" className="w-full max-h-72 object-contain rounded-xl border border-white/10 bg-black/30" />
                      </div>
                    )}
                    {enhancedDataUrl && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-cyan-400/90">{t("media.after")}</p>
                        <img src={enhancedDataUrl} alt="" className="w-full max-h-72 object-contain rounded-xl border border-cyan-500/30 bg-black/30 shadow-[0_0_24px_rgba(0,200,255,0.12)]" />
                      </div>
                    )}
                  </div>
                  {enhancedDataUrl && (
                    <Button type="button" className="gap-2 bg-[#0052CC]" onClick={downloadEnhanced}>
                      <Download className="size-4" />
                      {t("media.downloadEnhanced")}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promo" className="mt-6">
          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader>
              <p className="font-black text-white flex items-center gap-2">
                <Video className="size-5 text-fuchsia-400" />
                {t("media.tabPromoVideo")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="file"
                accept="image/*"
                multiple
                className="cursor-pointer text-slate-300"
                onChange={(e) => {
                  const list = e.target.files;
                  setVideoFiles(list ? Array.from(list) : []);
                  setB44VideoResult(null);
                }}
              />
              <div>
                <Label className="text-slate-300">وصف الحركة / المشهد (Base44 — اختياري)</Label>
                <textarea
                  className="mt-1 flex min-h-[72px] w-full rounded-xl border border-slate-600 bg-[#050a12]/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/35"
                  value={promoVideoPrompt}
                  onChange={(e) => setPromoVideoPrompt(e.target.value)}
                  placeholder="مثال: زوم بطيء، إضاءة دافئة، حركة سينمائية…"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">نسبة الإطارات (محرك الإطارات)</Label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { v: "16:9" as const, icon: Monitor, label: "16:9" },
                      { v: "9:16" as const, icon: Smartphone, label: "9:16" },
                      { v: "1:1" as const, icon: Square, label: "1:1" },
                    ] as const
                  ).map((x) => (
                    <button
                      key={x.v}
                      type="button"
                      onClick={() => setPromoVidFormat(x.v)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                        promoVidFormat === x.v
                          ? "border-fuchsia-400 bg-fuchsia-950/40 text-white"
                          : "border-white/15 text-slate-300 hover:border-fuchsia-500/40"
                      }`}
                    >
                      <x.icon className="size-4" />
                      {x.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">مدة مستهدفة (ثوانٍ)</Label>
                <div className="flex flex-wrap gap-2">
                  {([10, 30, 60] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPromoVidDuration(d)}
                      className={`rounded-xl border px-4 py-2 text-xs font-black ${
                        promoVidDuration === d
                          ? "border-[#0052CC] bg-[#0052CC]/20 text-white"
                          : "border-white/15 text-slate-400 hover:border-white/25"
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="media-motion-score" className="text-slate-300">
                    شدة الحركة (محرك الإطارات)
                  </Label>
                  <span className="text-xs font-mono text-fuchsia-300 tabular-nums">{motionScore}</span>
                </div>
                <input
                  id="media-motion-score"
                  type="range"
                  min={0}
                  max={100}
                  value={motionScore}
                  onChange={(e) => setMotionScore(Number(e.target.value))}
                  className="w-full h-2 accent-fuchsia-500 rounded-full cursor-pointer bg-white/10"
                />
                <p className="text-[10px] text-slate-500">قيم أعلى = زوم وحركة أوضح في إطارات المعاينة</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300">{t("media.promoHeadline")}</Label>
                  <Input
                    className="mt-1 bg-[#050a12]/60 border-slate-600"
                    value={promoHeadline}
                    onChange={(e) => setPromoHeadline(e.target.value)}
                    placeholder="Smart Al-Idara Pro"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">{t("media.promoTagline")}</Label>
                  <Input
                    className="mt-1 bg-[#050a12]/60 border-slate-600"
                    value={promoTagline}
                    onChange={(e) => setPromoTagline(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">{t("media.promoAudio")}</Label>
                <Input
                  type="file"
                  accept="audio/*"
                  className="mt-1 cursor-pointer text-slate-300"
                  onChange={(e) => setPromoAudio(e.target.files?.[0] ?? null)}
                />
              </div>
              <p className="text-xs text-slate-500">{t("media.videoPickImages")}</p>
              <p className="text-[10px] text-slate-600">{t("media.cinematicHint")}</p>
              <Button
                type="button"
                className="bg-gradient-to-r from-fuchsia-600 to-[#0052CC] gap-2"
                disabled={videoFiles.length === 0 || videoBusy}
                onClick={() => void buildVideo()}
              >
                {videoBusy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("media.videoBusy")}
                  </>
                ) : (
                  <>
                    <Star className="size-4" />
                    {t("media.videoBuildCinematic")}
                  </>
                )}
              </Button>
              {videoBusy && b44Progress > 0 && (
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden border border-white/10">
                    <div
                      className={`h-full transition-all duration-700 ${
                        b44Progress >= 95 ? "bg-gradient-to-r from-amber-500 to-emerald-500" : "bg-fuchsia-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.round(b44Progress))}%` }}
                    />
                  </div>
                  <p className="text-center text-xs font-bold text-fuchsia-200">{Math.round(b44Progress)}%</p>
                </div>
              )}
              {videoFiles.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  {videoFiles.length} {t("media.filesSelected")}
                </p>
              )}

              {b44VideoResult && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3" data-b44-video-result>
                  {b44VideoResult.type === "frame_sequence" && (
                    <>
                      <p className="text-sm font-bold text-emerald-200 flex items-center gap-2">
                        <Video className="size-4" />
                        إطارات جاهزة — دمجها في محرر فيديو
                      </p>
                      <div className="grid grid-cols-2 gap-1 bg-black/40 p-1 rounded-lg">
                        {b44VideoResult.frames.slice(0, 4).map((src, i) => (
                          <img key={i} src={src} alt="" className="w-full rounded object-cover aspect-video" />
                        ))}
                      </div>
                      {b44VideoResult.assembly_instructions && (
                        <pre className="text-[10px] text-slate-300 whitespace-pre-wrap bg-black/30 rounded-lg p-2 max-h-40 overflow-y-auto">
                          {b44VideoResult.assembly_instructions}
                        </pre>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="gap-2 bg-emerald-600"
                          onClick={() => {
                            b44VideoResult.frames.forEach((href, i) => {
                              const a = document.createElement("a");
                              a.href = href;
                              a.download = `frame-${i + 1}.jpg`;
                              a.click();
                            });
                            toast.success("جاري تحميل الإطارات…");
                          }}
                        >
                          <Download className="size-4" />
                          تحميل الإطارات
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 border-emerald-500/40"
                          onClick={() => {
                            void navigator.clipboard.writeText(b44VideoResult.frames.join("\n"));
                            toast.success("تم نسخ الروابط");
                          }}
                        >
                          نسخ الروابط
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="gap-2 text-slate-400"
                          onClick={() => {
                            setB44VideoResult(null);
                            setB44Progress(0);
                          }}
                        >
                          <RefreshCw className="size-4" />
                          إعادة ضبط
                        </Button>
                      </div>
                    </>
                  )}
                  {b44VideoResult.type === "error" && (
                    <div className="text-sm text-red-300 space-y-2">
                      <p className="font-bold">{b44VideoResult.message}</p>
                      <p className="text-xs opacity-90">{b44VideoResult.details}</p>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setB44VideoResult(null)}>
                        إغلاق
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProcessingBar
        active={enhanceBusy || videoBusy || cardExportBusy || ttiBusy || logoImgBusy}
        label={videoBusy ? t("media.videoBusy") : t("common.processing")}
        progress={videoBusy && videoEncodeProgress > 0 && !b44Progress ? videoEncodeProgress : undefined}
      />
    </div>
  );
}
