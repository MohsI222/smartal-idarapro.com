import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode, type ChangeEvent, type MouseEvent } from 'react';
import {
  Sparkles, Image as ImageIcon, Film, Wand2, Heart, Zap, Download, Loader2,
  Upload, RefreshCw, Star, Camera, Monitor, Smartphone, Square,
  Printer, Layers, Check, Gem, X, Search, Grid3x3, Crown, Trash2, CheckSquare,
  Phone, Package, type LucideIcon
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { api } from '@/lib/api';

/* ────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS
   Palette: warm parchment paper + jewel-toned zellige accents (amethyst,
   saffron, emerald, indigo, rose, antique gold) — grounded in the Moroccan
   design-studio subject matter (flyers, business cards, wedding invitations)
   rather than a generic AI-cream-and-terracotta default.
   ──────────────────────────────────────────────────────────────────────── */
const COLORS = {
  lilac: '#6C5CA6',   // amethyst — brand / image studio
  amber: '#E2A33B',   // saffron — templates
  teal: '#1F8C7A',    // emerald — media lab
  coral: '#C0533F',   // brick red — destructive / errors
  green: '#3F7D52',   // sage — success / favorites
  pink: '#B8577A',    // muted rose — weddings
  blue: '#3E4B8C',    // royal indigo — video
  gold: '#A9812E',    // antique gold — luxury / cards
  ink: '#211D18',      // warm charcoal — primary text
  sub: '#6B6357',      // secondary text
  muted: '#8A8073',    // tertiary / placeholder text
  paper: '#FAF6EC',    // page background
  line: '#EAE2CF',     // hairline borders
  faint: '#D8CDB0'     // empty-state iconography
} as const;

const DISPLAY_FONT = '"Amiri", "Cairo", "Segoe UI", system-ui, serif';
const BODY_FONT = '"Cairo", "IBM Plex Sans Arabic", "Segoe UI", system-ui, sans-serif';

/* ────────────────────────────────────────────────────────────────────────
   DOMAIN TYPES
   ──────────────────────────────────────────────────────────────────────── */
type TabId = 'studio' | 'templates' | 'media' | 'video' | 'wedding' | 'gallery';
type MediaAction = 'enhance' | 'restyle' | 'remove_bg';
type QualityLevel = 'ultra' | 'print' | 'high' | 'web';
type DesignType =
  | 'image' | 'flyer' | 'card' | 'poster' | 'banner' | 'social' | 'menu'
  | 'wedding' | 'video_script' | 'enhance' | 'campaign';

interface DesignItem {
  id: string;
  title: string;
  type: DesignType;
  url: string;
  prompt?: string;
  style?: string;
  format?: string;
  notes?: string;
  favorite: boolean;
  created_at: string;
}

interface GalleryStats {
  total: number;
  favs: number;
  byType: Partial<Record<DesignType, number>>;
}

interface TemplateVars {
  business?: string;
  city?: string;
  service?: string;
  fullname?: string;
  phone?: string;
  email?: string;
  website?: string;
  title?: string;
  company?: string;
  event?: string;
  date?: string;
  location?: string;
  message?: string;
}

interface VideoScene {
  scene_number: number;
  description: string;
  narration?: string;
  visual?: string;
  duration_sec?: number;
}

interface VideoScriptResult {
  title: string;
  duration?: string;
  script?: string;
  scenes?: VideoScene[];
  music_suggestion?: string;
  cta?: string;
}

interface MediaResult {
  type: 'image';
  url: string;
}

interface PrintModalState {
  items: { url: string; title: string }[];
  batch: boolean;
}

interface AiImageResponse {
  b64?: string;
  imageUrl?: string;
  description?: string;
  error?: string;
}

interface AiGenerateResponse {
  text: string;
  error?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface TypeMeta {
  label: string;
  color: string;
}

/* ────────────────────────────────────────────────────────────────────────
   STATIC CONFIG
   ──────────────────────────────────────────────────────────────────────── */
const FORMATS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: '1:1', label: 'مربع · إنستاجرام', icon: Square },
  { value: '9:16', label: 'عمودي · ريلز/ستوري', icon: Smartphone },
  { value: '16:9', label: 'أفقي · يوتيوب', icon: Monitor },
  { value: '4:5', label: 'فيسبوك · لوحة', icon: Monitor },
  { value: 'A4', label: 'A4 · طباعة', icon: Printer },
  { value: '3.5:2', label: 'بطاقة أعمال', icon: Layers }
];

const IMAGE_STYLES: SelectOption[] = [
  { value: 'Cinematic', label: '🎬 سينمائي' },
  { value: 'Corporate', label: '💼 مؤسسي' },
  { value: 'Minimalist', label: '⬜ مينيمال' },
  { value: 'Bold & Colorful', label: '🌈 جريء وملون' },
  { value: 'Elegant Luxury', label: '✨ فاخر راقي' },
  { value: 'Moroccan Traditional', label: '🕌 مغربي تقليدي' },
  { value: 'Modern Tech', label: '🤖 تقني عصري' },
  { value: 'Vintage Retro', label: '📷 كلاسيكي' },
  { value: 'Watercolor Art', label: '🎨 ألوان مائية' },
  { value: 'Neon Cyberpunk', label: '⚡ نيون سايبر' }
];

const QUALITY: SelectOption[] = [
  { value: 'ultra', label: '🚀 Ultra 4K' },
  { value: 'print', label: '🖨️ طباعة 300dpi' },
  { value: 'high', label: '🌟 جودة عالية' },
  { value: 'web', label: '🌐 للويب' }
];

const CAMERAS: SelectOption[] = [
  { value: 'professional_dslr', label: '📷 DSLR احترافي' },
  { value: 'cinematic', label: '🎬 كاميرا سينما' },
  { value: 'drone', label: '🚁 درون جوي' },
  { value: 'studio', label: '💡 استوديو' },
  { value: 'iphone', label: '📱 آيفون Pro' }
];

const TEMPLATES: { id: string; emoji: string; label: string; color: string; desc: string }[] = [
  { id: 'flyer', emoji: '📄', label: 'فلاير', color: COLORS.amber, desc: 'إعلان ترويجي' },
  { id: 'card', emoji: '💼', label: 'بطاقة أعمال', color: COLORS.gold, desc: 'كارت فيزيت' },
  { id: 'poster', emoji: '🎨', label: 'ملصق حدث', color: COLORS.coral, desc: 'إيفنت / حفلة' },
  { id: 'banner', emoji: '🖼️', label: 'بانر إعلاني', color: COLORS.teal, desc: 'واجهة / لافتة' },
  { id: 'social', emoji: '📱', label: 'بوست سوشيال', color: COLORS.pink, desc: 'محتوى منصات' },
  { id: 'menu', emoji: '🍽️', label: 'قائمة طعام', color: COLORS.green, desc: 'ريستو / كافيه' }
];

const WEDDING_STYLES: SelectOption[] = [
  { value: 'moroccan_royal', label: '👑 مغربي ملكي' },
  { value: 'floral_elegant', label: '🌸 زهور راقي' },
  { value: 'minimalist_gold', label: '✨ ذهبي مينيمال' },
  { value: 'vintage_arabic', label: '🕌 كلاسيكي عربي' },
  { value: 'modern_luxury', label: '💎 عصري فاخر' },
  { value: 'garden_bohemian', label: '🌿 حديقة بوهيمي' }
];

const WEDDING_SHAPES: SelectOption[] = [
  { value: 'rectangle', label: 'مستطيل كلاسيكي' },
  { value: 'heart', label: '❤️ شكل قلب' },
  { value: 'butterfly', label: '🦋 شكل فراشة' },
  { value: 'crown', label: '👑 شكل تاج' },
  { value: 'flower', label: '🌸 شكل زهرة' },
  { value: 'bride_groom', label: '👰🤵 شكل عروس وعريس' },
  { value: 'egg', label: '🥚 شكل بيضوي' },
  { value: 'arch', label: '🏛️ شكل قوس' },
  { value: 'soap', label: '🧼 شكل صابونة' }
];

const VIDEO_TYPES: SelectOption[] = [
  { value: 'corporate', label: '💼 مؤسسي' },
  { value: 'ad', label: '📢 إعلان' },
  { value: 'explainer', label: '📚 تعليمي' },
  { value: 'social', label: '📱 سوشيال' },
  { value: 'testimonial', label: '⭐ شهادة' },
  { value: 'product', label: '🛍️ منتج' }
];

const VIDEO_QUICK_PROMPTS = ['إعلان مطعم', 'فيديو تعليمي', 'ترويج منتج', 'قصة نجاح', 'بوست سوشيال'];
const IMAGE_QUICK_PROMPTS = ['فلاير مطعم فاخر', 'بطاقة أعمال ذهبية', 'ملصق حفل موسيقي', 'إعلان عقار', 'بوست إنستاجرام', 'بانر عيادة'];
const VIDEO_DURATIONS = [10, 15, 30, 60];

const TYPE_META: Record<DesignType, TypeMeta> = {
  image: { label: 'صورة', color: COLORS.lilac },
  flyer: { label: 'فلاير', color: COLORS.amber },
  card: { label: 'بطاقة', color: COLORS.gold },
  poster: { label: 'ملصق', color: COLORS.coral },
  banner: { label: 'بانر', color: COLORS.teal },
  social: { label: 'سوشيال', color: COLORS.pink },
  menu: { label: 'قائمة', color: COLORS.green },
  wedding: { label: 'زفاف', color: COLORS.pink },
  video_script: { label: 'سكريبت', color: COLORS.blue },
  enhance: { label: 'محسّنة', color: COLORS.teal },
  campaign: { label: 'حملة', color: COLORS.coral }
};

const GALLERY_FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'fav', label: '⭐ مفضّل' },
  { id: 'image', label: TYPE_META.image.label },
  { id: 'flyer', label: TYPE_META.flyer.label },
  { id: 'card', label: TYPE_META.card.label },
  { id: 'poster', label: TYPE_META.poster.label },
  { id: 'wedding', label: TYPE_META.wedding.label },
  { id: 'enhance', label: TYPE_META.enhance.label }
];

const MEDIA_ACTION_OPTIONS: SelectOption[] = [
  { value: 'enhance', label: '⚡ تحسين 4K' },
  { value: 'restyle', label: '🎨 إعادة تصميم' },
  { value: 'remove_bg', label: '✂️ إزالة خلفية' }
];

const MEDIA_ACTION_PROMPTS: Record<MediaAction, string> = {
  enhance: 'Enhance this image to ultra-sharp 4K professional quality: improve lighting, color balance, contrast and fine detail while preserving the original composition and subject.',
  restyle: 'Reimagine this image with a fresh, professional creative style while keeping the main subject clearly recognizable.',
  remove_bg: 'Remove the background completely, isolating the main subject on a clean transparent/white background, edges crisp and clean.'
};

const STORAGE_KEY = 'ai_design_gallery';

function qualityDescriptor(q: string): string {
  if (q === 'ultra') return 'Ultra 4K 300dpi photorealistic';
  if (q === 'print') return '300dpi CMYK print-ready';
  if (q === 'web') return 'Web-optimized 1080p';
  return 'High resolution professional';
}

function joinContact(parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' | ');
}

function downloadImage(url: string, name = 'design.png'): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function resolveImageUrl(res: AiImageResponse): string | null {
  if (res.b64) return `data:image/png;base64,${res.b64}`;
  if (res.imageUrl) return res.imageUrl;
  return null;
}

function extractJsonObject<T>(raw: string): T {
  let text = raw.trim();
  if (text.startsWith('```')) {
    const match = text.match(/```(?:json)?\n([\s\S]*?)```/);
    if (match) text = match[1].trim();
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.substring(start, end + 1);
  return JSON.parse(text) as T;
}

/* ────────────────────────────────────────────────────────────────────────
   FONT LOADER — injects Amiri (display) once, degrades gracefully if the
   host page cannot reach Google Fonts.
   ──────────────────────────────────────────────────────────────────────── */
function useDisplayFont(): void {
  useEffect(() => {
    const id = 'ai-design-studio-font-amiri';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap';
    document.head.appendChild(link);
  }, []);
}

/* ────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ──────────────────────────────────────────────────────────────────────── */
export default function AiDesignStudio() {
  const { token, isAdmin } = useAuth();
  useDisplayFont();

  const [activeTab, setActiveTab] = useState<TabId>('studio');

  // Gallery state
  const [gallery, setGallery] = useState<DesignItem[]>([]);

  // Image generation state
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgStyle, setImgStyle] = useState('Elegant Luxury');
  const [imgFormat, setImgFormat] = useState('1:1');
  const [imgQuality, setImgQuality] = useState<QualityLevel>('ultra');
  const [imgCamera, setImgCamera] = useState('professional_dslr');
  const [imgBrand, setImgBrand] = useState('');
  const [imgPhone, setImgPhone] = useState('');
  const [imgEmail, setImgEmail] = useState('');
  const [imgWeb, setImgWeb] = useState('');
  const [imgResult, setImgResult] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);

  // Template state
  const [tpl, setTpl] = useState('flyer');
  const [tplVars, setTplVars] = useState<TemplateVars>({});
  const [tplStyle, setTplStyle] = useState('Bold & Colorful');
  const [tplQuality, setTplQuality] = useState<QualityLevel>('print');
  const [tplFormat, setTplFormat] = useState('1:1');
  const [tplResult, setTplResult] = useState<string | null>(null);
  const [tplLoading, setTplLoading] = useState(false);

  // Media upload state
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [mediaAction, setMediaAction] = useState<MediaAction>('enhance');
  const [mediaDesc, setMediaDesc] = useState('');
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaResult, setMediaResult] = useState<MediaResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Wedding state
  const [wedGroom, setWedGroom] = useState('');
  const [wedBride, setWedBride] = useState('');
  const [wedDate, setWedDate] = useState('');
  const [wedVenue, setWedVenue] = useState('');
  const [wedStyle, setWedStyle] = useState('moroccan_royal');
  const [wedQuote, setWedQuote] = useState('');
  const [wedShape, setWedShape] = useState('rectangle');
  const [wedImage, setWedImage] = useState<string | null>(null);
  const [wedImageName, setWedImageName] = useState('');
  const [wedUploading, setWedUploading] = useState(false);
  const wedFileRef = useRef<HTMLInputElement>(null);
  const [wedResult, setWedResult] = useState<string | null>(null);
  const [wedLoading, setWedLoading] = useState(false);

  // Video script state
  const [vidPrompt, setVidPrompt] = useState('');
  const [vidType, setVidType] = useState('corporate');
  const [vidDuration, setVidDuration] = useState(30);
  const [vidFormat, setVidFormat] = useState('9:16');
  const [vidResult, setVidResult] = useState<VideoScriptResult | null>(null);
  const [vidLoading, setVidLoading] = useState(false);

  // Print/export modal state
  const [printModal, setPrintModal] = useState<PrintModalState | null>(null);

  // Gallery filter state
  const [gSearch, setGSearch] = useState('');
  const [gFilter, setGFilter] = useState('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Load gallery from localStorage once on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const items = JSON.parse(saved) as DesignItem[];
      setGallery(items);
    } catch (e) {
      console.error('Failed to load gallery', e);
    }
  }, []);

  const stats: GalleryStats = useMemo(() => {
    const byType: Partial<Record<DesignType, number>> = {};
    gallery.forEach(item => {
      byType[item.type] = (byType[item.type] || 0) + 1;
    });
    return { total: gallery.length, favs: gallery.filter(i => i.favorite).length, byType };
  }, [gallery]);

  const addToGallery = useCallback((item: Omit<DesignItem, 'id' | 'created_at'>) => {
    setGallery(prev => {
      const newItem: DesignItem = { ...item, id: Date.now().toString(), created_at: new Date().toISOString() };
      const updated = [newItem, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    toast('تم الحفظ في المعرض', { style: { background: COLORS.green, color: '#fff' } });
  }, []);

  const toggleFav = useCallback((id: string) => {
    setGallery(prev => {
      const updated = prev.map(item => (item.id === id ? { ...item, favorite: !item.favorite } : item));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteItem = useCallback((id: string) => {
    if (!confirm('حذف هذا العنصر؟')) return;
    setGallery(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    toast('تم الحذف', { style: { background: COLORS.coral, color: '#fff' } });
  }, []);

  // Image generation via backend AI
  const genImage = useCallback(async () => {
    if (!imgPrompt.trim()) {
      toast('أدخل وصف التصميم أولاً', { style: { background: COLORS.coral, color: '#fff' } });
      return;
    }
    setImgLoading(true);
    setImgResult(null);
    try {
      const contact = joinContact([
        imgBrand && `Brand/Name: ${imgBrand}`,
        imgPhone && `Phone: ${imgPhone}`,
        imgEmail && `Email: ${imgEmail}`,
        imgWeb && `Website: ${imgWeb}`
      ]);
      const q = qualityDescriptor(imgQuality);
      const prompt = `Generate a professional marketing/design image.\nDescription: ${imgPrompt}. Visual style: ${imgStyle}. Camera: ${imgCamera}. Aspect ratio: ${imgFormat}. Quality: ${q}.\n${contact ? `Include contact info elegantly integrated: ${contact}.` : ''}\nVibrant vivid colors, sharp details, professional typography, no watermarks, no placeholder text.`;

      // Direct Pollinations.ai generation (no server call)
      const encodedPrompt = encodeURIComponent(prompt);
      const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}&nologo=true`;

      setImgResult(imageUrl);
      addToGallery({ title: imgPrompt.slice(0, 60), type: 'image', url: imageUrl, prompt: imgPrompt, style: imgStyle, format: imgFormat, favorite: false });
      toast('✨ تم توليد الصورة بنجاح!', { style: { background: COLORS.lilac, color: '#fff' } });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل التوليد';
      console.error('Image generation error:', error);
      toast('خطأ: ' + message, { style: { background: COLORS.coral, color: '#fff' } });
    } finally {
      setImgLoading(false);
    }
  }, [imgPrompt, imgBrand, imgPhone, imgEmail, imgWeb, imgQuality, imgStyle, imgCamera, imgFormat, addToGallery]);

  // Template generation via backend AI
  const genTemplate = useCallback(async () => {
    setTplLoading(true);
    setTplResult(null);
    try {
      const contact = joinContact([
        tplVars.fullname && `Name: ${tplVars.fullname}`,
        tplVars.phone && `Tel: ${tplVars.phone}`,
        tplVars.email && `Email: ${tplVars.email}`,
        tplVars.website && `Web: ${tplVars.website}`
      ]);
      const q = qualityDescriptor(tplQuality);

      const templatePrompts: Record<string, string> = {
        flyer: `Professional marketing flyer for "${tplVars.business || 'business'}"${tplVars.city ? ` in ${tplVars.city}` : ''}. Services: ${tplVars.service || 'general services'}. Style: ${tplStyle}.`,
        card: `Premium business card design. Style: ${tplStyle}. ${tplVars.title ? `Title: ${tplVars.title}.` : ''} ${tplVars.company ? `Company: ${tplVars.company}.` : ''}`,
        poster: `Vibrant event poster for "${tplVars.event || 'Event'}". Date: ${tplVars.date || ''}. Venue: ${tplVars.location || ''}. Style: ${tplStyle}.`,
        banner: `Professional advertising banner for "${tplVars.business || 'business'}". Message: ${tplVars.message || ''}. Style: ${tplStyle}.`,
        social: `Social media post for "${tplVars.business || 'brand'}". Topic: ${tplVars.message || ''}. Style: ${tplStyle}.`,
        menu: `Restaurant menu for "${tplVars.business || 'restaurant'}"${tplVars.city ? ` in ${tplVars.city}` : ''}. Items: ${tplVars.service || ''}. Style: ${tplStyle}.`
      };

      const prompt = `Generate a professional ${tpl}.\n${templatePrompts[tpl] || templatePrompts.flyer}\n${contact ? `Contact info: ${contact}.` : ''} Aspect ratio: ${tplFormat}. Quality: ${q}. Vibrant colors, no watermarks.`;

      const res = await api<AiImageResponse>('/ai/image', {
        method: 'POST',
        token,
        body: JSON.stringify({ prompt, locale: 'ar' })
      });

      if (res.error) throw new Error(res.error);
      const url = resolveImageUrl(res);
      const templateLabel = TEMPLATES.find(t => t.id === tpl)?.label || tpl;

      if (url) {
        setTplResult(url);
        addToGallery({
          title: `${templateLabel} — ${tplVars.business || tplVars.fullname || 'تصميم'}`,
          type: tpl as DesignType,
          url,
          prompt: JSON.stringify(tplVars),
          style: tplStyle,
          format: tplFormat,
          favorite: false
        });
        toast('✨ تم إنشاء التصميم!', { style: { background: COLORS.amber, color: '#fff' } });
      } else {
        const placeholderUrl = `https://placehold.co/1024x1024/${COLORS.amber.replace('#', '')}/${COLORS.ink.replace('#', '')}?text=${encodeURIComponent(templateLabel)}`;
        setTplResult(placeholderUrl);
        toast('تم إنشاء معاينة توضيحية', { style: { background: COLORS.amber, color: '#fff' } });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل الإنشاء';
      console.error('Template generation error:', error);
      toast('خطأ: ' + message, { style: { background: COLORS.coral, color: '#fff' } });
    } finally {
      setTplLoading(false);
    }
  }, [tpl, tplVars, tplStyle, tplQuality, tplFormat, token, addToGallery]);

  // File upload helpers (client-side base64 read)
  const readFileAsDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);
    setUploadedUrl(null);
    setUploadedName(file.name);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setUploadedUrl(dataUrl);
      toast('✅ تم رفع الملف', { style: { background: COLORS.green, color: '#fff' } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل الرفع';
      toast('خطأ في الرفع: ' + message, { style: { background: COLORS.coral, color: '#fff' } });
    } finally {
      setUploading(false);
    }
  }, [readFileAsDataUrl]);

  const handleWedUpload = useCallback(async (file: File) => {
    if (!file) return;
    setWedUploading(true);
    setWedImage(null);
    setWedImageName(file.name);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setWedImage(dataUrl);
      toast('✅ تم رفع الصورة المرجعية', { style: { background: COLORS.green, color: '#fff' } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل الرفع';
      toast('خطأ في الرفع: ' + message, { style: { background: COLORS.coral, color: '#fff' } });
    } finally {
      setWedUploading(false);
    }
  }, [readFileAsDataUrl]);

  // Media processing — wired to the real image AI, passing the uploaded
  // image along as a reference so the backend can edit it in place.
  const processMedia = useCallback(async () => {
    if (!uploadedUrl) {
      toast('ارفع صورة أولاً', { style: { background: COLORS.coral, color: '#fff' } });
      return;
    }
    setMediaLoading(true);
    setMediaResult(null);
    try {
      const basePrompt = MEDIA_ACTION_PROMPTS[mediaAction];
      const prompt = `${basePrompt}${mediaDesc ? ` Additional instructions: ${mediaDesc}.` : ''} Ultra high quality output, no watermark.`;

      const res = await api<AiImageResponse>('/ai/image', {
        method: 'POST',
        token,
        body: JSON.stringify({ prompt, locale: 'ar', referenceImage: uploadedUrl })
      });

      if (res.error) throw new Error(res.error);
      const url = resolveImageUrl(res);

      if (url) {
        setMediaResult({ type: 'image', url });
        addToGallery({
          title: `${MEDIA_ACTION_OPTIONS.find(o => o.value === mediaAction)?.label || 'صورة محسّنة'} — ${uploadedName || 'صورة'}`.slice(0, 60),
          type: 'enhance',
          url,
          prompt,
          favorite: false
        });
        toast('✅ تمت المعالجة!', { style: { background: COLORS.teal, color: '#fff' } });
      } else {
        throw new Error('لم يتم استلام نتيجة المعالجة');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشلت المعالجة';
      console.error('Media processing error:', error);
      toast('خطأ: ' + message, { style: { background: COLORS.coral, color: '#fff' } });
    } finally {
      setMediaLoading(false);
    }
  }, [uploadedUrl, uploadedName, mediaAction, mediaDesc, token, addToGallery]);

  // Video script generation via backend AI
  const genVideoScript = useCallback(async () => {
    if (!vidPrompt.trim()) {
      toast('أدخل وصف الفيديو أولاً', { style: { background: COLORS.coral, color: '#fff' } });
      return;
    }
    setVidLoading(true);
    setVidResult(null);
    try {
      const prompt = `You are a professional video director. Create video script for: "${vidPrompt}". Type: ${vidType}. Aspect: ${vidFormat}. Duration: ${vidDuration}s.\nReturn ONLY valid JSON: {"title":"<Ar title>","duration":"<e.g. 30s>","script":"<full narration Ar+Fr>","scenes":[{"scene_number":1,"description":"...","narration":"...","visual":"...","duration_sec":5}],"music_suggestion":"...","cta":"..."}`;

      const res = await api<AiGenerateResponse>('/ai/generate', {
        method: 'POST',
        token,
        body: JSON.stringify({
          module: 'videoScript',
          locale: 'ar',
          context: { prompt, type: vidType, format: vidFormat, duration: vidDuration }
        })
      });

      if (res.error) throw new Error(res.error);

      let parsed: VideoScriptResult;
      try {
        parsed = extractJsonObject<VideoScriptResult>(res.text);
      } catch {
        throw new Error('فشل في تحليل النتيجة');
      }

      setVidResult(parsed);
      addToGallery({
        title: parsed.title || vidPrompt.slice(0, 60),
        type: 'video_script',
        url: 'https://placehold.co/400x400?text=Video+Script',
        prompt: vidPrompt,
        notes: (parsed.script || '').slice(0, 200),
        favorite: false
      });
      toast('✨ تم إنشاء السكريبت!', { style: { background: COLORS.blue, color: '#fff' } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل الإنشاء';
      console.error('Video script error:', error);
      toast('خطأ: ' + message, { style: { background: COLORS.coral, color: '#fff' } });
    } finally {
      setVidLoading(false);
    }
  }, [vidPrompt, vidType, vidFormat, vidDuration, token, addToGallery]);

  // Wedding invitation generation via backend AI
  const genWedding = useCallback(async () => {
    if (!wedGroom.trim() || !wedBride.trim()) {
      toast('أدخل اسم العريس والعروس', { style: { background: COLORS.coral, color: '#fff' } });
      return;
    }
    setWedLoading(true);
    setWedResult(null);
    try {
      const styleObj = WEDDING_STYLES.find(s => s.value === wedStyle);
      const shapeObj = WEDDING_SHAPES.find(s => s.value === wedShape);

      let prompt = `Create luxurious wedding invitation. Couple: ${wedGroom} & ${wedBride}. Date: ${wedDate || 'TBA'}. Venue: ${wedVenue || 'TBA'}.\nStyle: ${styleObj?.label || wedStyle}. ${wedQuote ? `Quote: "${wedQuote}".` : ''}\nUltra 4K print-ready.`;

      if (wedShape !== 'rectangle') {
        prompt += `\nCRITICAL: The entire invitation design MUST be die-cut shaped exactly like a ${shapeObj?.value} (${shapeObj?.label}). The background outside the ${shapeObj?.value} shape MUST be pure white, so it can be easily printed and cut out.`;
      }
      if (wedImage) {
        prompt += `\nUse the attached reference image as visual inspiration (palette, motif, or layout cues) while keeping the design original and print-ready.`;
      }

      const res = await api<AiImageResponse>('/ai/image', {
        method: 'POST',
        token,
        body: JSON.stringify({ prompt, locale: 'ar', referenceImage: wedImage || undefined })
      });

      if (res.error) throw new Error(res.error);
      const url = resolveImageUrl(res);

      if (url) {
        setWedResult(url);
        addToGallery({
          title: `دعوة زفاف: ${wedGroom} & ${wedBride}`,
          type: 'wedding',
          url,
          prompt: `${wedGroom} & ${wedBride}`,
          style: wedStyle,
          notes: `${wedDate} — ${wedVenue} — Shape: ${wedShape}`,
          favorite: false
        });
        toast('💍 تم إنشاء دعوة الزفاف!', { style: { background: COLORS.pink, color: '#fff' } });
      } else {
        const placeholderUrl = `https://placehold.co/1024x1024/${COLORS.pink.replace('#', '')}/${COLORS.ink.replace('#', '')}?text=${encodeURIComponent('Wedding Invitation')}`;
        setWedResult(placeholderUrl);
        toast('تم إنشاء معاينة توضيحية', { style: { background: COLORS.amber, color: '#fff' } });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل الإنشاء';
      console.error('Wedding generation error:', error);
      toast('خطأ: ' + message, { style: { background: COLORS.coral, color: '#fff' } });
    } finally {
      setWedLoading(false);
    }
  }, [wedGroom, wedBride, wedDate, wedVenue, wedStyle, wedQuote, wedShape, wedImage, token, addToGallery]);

  // Print / export
  const openPrint = useCallback((url: string, title: string) => {
    if (!url) return;
    setPrintModal({ items: [{ url, title: title || 'تصميم' }], batch: false });
  }, []);

  // Gallery filtering — memoized so it isn't recomputed on every render
  const filteredGallery = useMemo(() => {
    const q = gSearch.trim().toLowerCase();
    return gallery
      .filter(item => gFilter === 'all' || (gFilter === 'fav' ? item.favorite : item.type === gFilter))
      .filter(item => !q || item.title.toLowerCase().includes(q) || (item.prompt || '').toLowerCase().includes(q));
  }, [gallery, gFilter, gSearch]);

  const printableFilteredCount = useMemo(() => filteredGallery.filter(r => r.url).length, [filteredGallery]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(filteredGallery.filter(r => r.url).map(r => r.id));
  }, [filteredGallery]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds([]);
  }, []);

  const batchDownload = useCallback(() => {
    const items = gallery.filter(r => selectedIds.includes(r.id) && r.url);
    if (items.length === 0) {
      toast('حدد تصاميم أولاً');
      return;
    }
    toast('جارٍ تحميل ' + items.length + ' ملف…');
    items.forEach((it, i) => {
      setTimeout(() => downloadImage(it.url, `${it.type || 'design'}-${it.id}.png`), i * 400);
    });
  }, [gallery, selectedIds]);

  const batchDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    if (!confirm('حذف ' + selectedIds.length + ' تصميم من المعرض؟')) return;
    setGallery(prev => {
      const updated = prev.filter(item => !selectedIds.includes(item.id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setSelectedIds([]);
    setSelectMode(false);
    toast('تم الحذف');
  }, [selectedIds]);

  const openBatchPrint = useCallback(() => {
    const items = gallery.filter(r => selectedIds.includes(r.id) && r.url).map(r => ({ url: r.url, title: r.title }));
    if (items.length === 0) {
      toast('حدد تصاميم أولاً');
      return;
    }
    setPrintModal({ items, batch: true });
  }, [gallery, selectedIds]);

  const TABS: { id: TabId; label: string; icon: LucideIcon; color: string }[] = [
    { id: 'studio', label: 'استوديو الصور', icon: ImageIcon, color: COLORS.lilac },
    { id: 'templates', label: 'القوالب', icon: Wand2, color: COLORS.amber },
    { id: 'media', label: 'ميديا لاب', icon: Zap, color: COLORS.teal },
    { id: 'video', label: 'سكريبت فيديو', icon: Film, color: COLORS.blue },
    ...(isAdmin ? [{ id: 'wedding' as TabId, label: 'دعوات الزفاف', icon: Heart, color: COLORS.pink }] : []),
    { id: 'gallery', label: 'المعرض', icon: Grid3x3, color: COLORS.green }
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-[#FAF6EC]" style={{ fontFamily: BODY_FONT }}>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-[#EAE2CF]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <LogoMark />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-[#211D18] tracking-tight" style={{ fontFamily: DISPLAY_FONT }}>
                    استوديو التصميم بالذكاء الاصطناعي
                  </h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: COLORS.lilac }}>PRO</span>
                </div>
                <p className="text-[11px] text-[#8A8073] mt-0.5">صور · فيديو · فلاير · بطاقات · دعوات · طباعة احترافية</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: COLORS.lilac + '15', color: '#3D2E63', border: `1px solid ${COLORS.lilac}30` }}>
                <Layers size={11} /><span>{stats.total} تصميم</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: COLORS.amber + '15', color: '#7A5216', border: `1px solid ${COLORS.amber}30` }}>
                <Star size={11} /><span>{stats.favs} مفضّل</span>
              </div>
            </div>
          </div>

          <div className="flex gap-1 mt-4 bg-[#EAE2CF]/50 rounded-full p-1 w-fit max-w-full overflow-x-auto">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => { setActiveTab(t.id); exitSelectMode(); }}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap transition-all duration-200 ${active ? 'bg-white text-[#211D18] shadow-sm' : 'text-[#6B6357] hover:text-[#211D18]'}`}>
                  <Icon size={13} style={{ color: active ? t.color : undefined }} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <ZelligeDivider />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'studio' && (
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <Card icon={ImageIcon} color={COLORS.lilac} title="مولّد الصور الاحترافي" desc="ولّد صور تسويقية فاخرة بجودة 4K">
                <div className="space-y-4">
                  <Field label="وصف التصميم *">
                    <textarea
                      rows={3}
                      value={imgPrompt}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setImgPrompt(e.target.value)}
                      placeholder="مثال: فلاير احترافي لوكالة سفر بألوان زرقاء وذهبية..."
                      className="w-full px-4 py-3 text-sm border border-[#EAE2CF] rounded-2xl bg-white text-[#211D18] placeholder:text-[#8A8073] focus:outline-none focus:ring-2 focus:ring-[#6C5CA6]/30 resize-none"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {IMAGE_QUICK_PROMPTS.map(s => (
                      <button key={s} onClick={() => setImgPrompt(s)}
                        className="text-[11px] px-3 py-1.5 rounded-full font-medium transition-all"
                        style={{ backgroundColor: COLORS.lilac + '12', color: '#3D2E63', border: `1px solid ${COLORS.lilac}25` }}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="الأسلوب البصري"><SelectPill value={imgStyle} onChange={setImgStyle} options={IMAGE_STYLES} /></Field>
                    <Field label="الجودة"><SelectPill value={imgQuality} onChange={v => setImgQuality(v as QualityLevel)} options={QUALITY} /></Field>
                    <Field label="النسبة / المنصة"><SelectPill value={imgFormat} onChange={setImgFormat} options={FORMATS.map(f => ({ value: f.value, label: f.label }))} /></Field>
                    <Field label="نوع الكاميرا"><SelectPill value={imgCamera} onChange={setImgCamera} options={CAMERAS} /></Field>
                  </div>
                  <div className="pt-2 border-t border-[#EAE2CF]">
                    <div className="flex items-center gap-1.5 mb-3">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: COLORS.lilac + '15' }}>
                        <Phone size={11} style={{ color: '#3D2E63' }} />
                      </div>
                      <span className="text-[11px] font-semibold text-[#6B6357]">معلومات الاتصال (اختياري)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <PlainInput placeholder="اسم العلامة التجارية" value={imgBrand} onChange={setImgBrand} />
                      <PlainInput placeholder="رقم الهاتف" value={imgPhone} onChange={setImgPhone} />
                      <PlainInput placeholder="البريد الإلكتروني" value={imgEmail} onChange={setImgEmail} />
                      <PlainInput placeholder="الموقع الإلكتروني" value={imgWeb} onChange={setImgWeb} />
                    </div>
                  </div>
                  <CTA onClick={genImage} loading={imgLoading} label="ولّد الصورة" icon={Sparkles} color={COLORS.lilac} />
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <ResultPanel
                loading={imgLoading}
                result={imgResult}
                onClear={() => setImgResult(null)}
                onDownload={() => imgResult && downloadImage(imgResult, 'design.png')}
                onPrint={() => imgResult && openPrint(imgResult, imgPrompt.slice(0, 30))}
                color={COLORS.lilac}
                emptyIcon={ImageIcon}
                emptyText="ستظهر الصورة هنا"
                loadingText="جارٍ التوليد…"
              />
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <Card icon={Wand2} color={COLORS.amber} title="مولّد القوالب الاحترافي" desc="فلاير، بطاقات، ملصقات، قوائم">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {TEMPLATES.map(t => (
                      <button key={t.id} onClick={() => setTpl(t.id)}
                        className={`p-3 rounded-xl text-center transition-all ${tpl === t.id ? 'ring-2 ring-offset-2' : ''}`}
                        style={tpl === t.id ? { borderColor: t.color, backgroundColor: t.color + '15' } : { backgroundColor: 'white', border: '1px solid #EAE2CF' }}>
                        <div className="text-2xl mb-1">{t.emoji}</div>
                        <div className="text-[11px] font-bold">{t.label}</div>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="اسم النشاط/الشركة"><PlainInput placeholder="اسم الشركة" value={tplVars.business || ''} onChange={(v: string) => setTplVars(p => ({ ...p, business: v }))} /></Field>
                    <Field label="المدينة"><PlainInput placeholder="المدينة" value={tplVars.city || ''} onChange={(v: string) => setTplVars(p => ({ ...p, city: v }))} /></Field>
                    <Field label="الخدمات/النشاط"><PlainInput placeholder="الخدمات المقدمة" value={tplVars.service || ''} onChange={(v: string) => setTplVars(p => ({ ...p, service: v }))} /></Field>
                    <Field label="الأسلوب"><SelectPill value={tplStyle} onChange={setTplStyle} options={IMAGE_STYLES} /></Field>
                    <Field label="الجودة"><SelectPill value={tplQuality} onChange={v => setTplQuality(v as QualityLevel)} options={QUALITY} /></Field>
                    <Field label="النسبة / المنصة"><SelectPill value={tplFormat} onChange={setTplFormat} options={FORMATS.map(f => ({ value: f.value, label: f.label }))} /></Field>
                  </div>
                  <CTA onClick={genTemplate} loading={tplLoading} label="أنشئ القالب" icon={Wand2} color={COLORS.amber} />
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <ResultPanel
                loading={tplLoading}
                result={tplResult}
                onClear={() => setTplResult(null)}
                onDownload={() => tplResult && downloadImage(tplResult, 'template.png')}
                onPrint={() => tplResult && openPrint(tplResult, TEMPLATES.find(t => t.id === tpl)?.label || 'Template')}
                color={COLORS.amber}
                emptyIcon={Wand2}
                emptyText="سيظهر التصميم هنا"
                loadingText="جارٍ الإنشاء…"
              />
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <Card icon={Zap} color={COLORS.teal} title="ميديا لاب" desc="تحسين وتعديل الصور بالذكاء الاصطناعي">
                <div className="space-y-4">
                  <Field label="رفع صورة">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (e.target.files?.[0]) {
                        handleUpload(e.target.files[0]);
                      }
                      e.target.value = "";
                    }} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="w-full border-2 border-dashed rounded-2xl p-6 text-center transition-all hover:bg-[#1F8C7A]/5 flex flex-col items-center justify-center gap-2"
                      style={{ borderColor: uploadedUrl ? COLORS.green + '80' : COLORS.teal + '60' }}>
                      {uploading ? (
                        <><Loader2 size={20} className="animate-spin" style={{ color: COLORS.teal }} /><span className="text-xs">جارٍ الرفع...</span></>
                      ) : uploadedUrl ? (
                        <><Check size={20} style={{ color: COLORS.green }} /><span className="text-xs">{uploadedName}</span></>
                      ) : (
                        <><Upload size={20} style={{ color: COLORS.teal }} /><span className="text-xs">ارفع الصورة للمعالجة</span></>
                      )}
                    </button>
                    {uploadedUrl && <img src={uploadedUrl} alt="uploaded" className="mt-2 w-full max-h-40 object-contain rounded-xl border border-[#EAE2CF]" />}
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="الإجراء">
                      <SelectPill value={mediaAction} onChange={v => setMediaAction(v as MediaAction)} options={MEDIA_ACTION_OPTIONS} />
                    </Field>
                    <Field label="وصف التعديل (اختياري)">
                      <PlainInput placeholder="أضف نص، علامة تجارية..." value={mediaDesc} onChange={setMediaDesc} />
                    </Field>
                  </div>
                  <CTA onClick={processMedia} loading={mediaLoading} label="عالج الصورة" icon={Zap} color={COLORS.teal} />
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <ResultPanel
                loading={mediaLoading}
                result={mediaResult?.url ?? null}
                onClear={() => setMediaResult(null)}
                onDownload={() => mediaResult?.url && downloadImage(mediaResult.url, 'enhanced.png')}
                onPrint={() => mediaResult?.url && openPrint(mediaResult.url, 'صورة محسنة')}
                color={COLORS.teal}
                emptyIcon={Zap}
                emptyText="ستظهر النتيجة هنا"
                loadingText="جارٍ المعالجة…"
              />
            </div>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <Card icon={Film} color={COLORS.blue} title="سكريبت الفيديو" desc="إنشاء نصوص احترافية للفيديو">
                <div className="space-y-4">
                  <Field label="وصف الفيديو *">
                    <textarea
                      rows={3}
                      value={vidPrompt}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setVidPrompt(e.target.value)}
                      placeholder="مثال: إعلان لمطعم جديد باللغة العربية والفرنسية..."
                      className="w-full px-4 py-3 text-sm border border-[#EAE2CF] rounded-2xl bg-white text-[#211D18] placeholder:text-[#8A8073] focus:outline-none focus:ring-2 focus:ring-[#3E4B8C]/30 resize-none"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_QUICK_PROMPTS.map(q => (
                      <button key={q} onClick={() => setVidPrompt(q)}
                        className="text-[11px] px-3 py-1.5 rounded-full font-medium"
                        style={{ backgroundColor: COLORS.blue + '12', color: '#28305C', border: `1px solid ${COLORS.blue}25` }}>{q}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="نوع الفيديو">
                      <SelectPill value={vidType} onChange={setVidType} options={VIDEO_TYPES} />
                    </Field>
                    <Field label="المدة">
                      <div className="flex gap-2">
                        {VIDEO_DURATIONS.map(d => (
                          <button key={d} onClick={() => setVidDuration(d)}
                            className="flex-1 py-2.5 rounded-xl text-xs font-bold"
                            style={vidDuration === d
                              ? { backgroundColor: COLORS.blue + '15', color: '#28305C', border: `1px solid ${COLORS.blue}60` }
                              : { backgroundColor: 'white', color: '#6B6357', border: '1px solid #EAE2CF' }}>{d}s</button>
                        ))}
                      </div>
                    </Field>
                  </div>
                  <Field label="نسبة الأبعاد">
                    <div className="grid grid-cols-4 gap-2">
                      {FORMATS.slice(0, 4).map(f => {
                        const Icon = f.icon;
                        const active = vidFormat === f.value;
                        return (
                          <button key={f.value} onClick={() => setVidFormat(f.value)}
                            className="flex flex-col items-center gap-1 p-2.5 rounded-xl text-[10px] font-semibold"
                            style={active
                              ? { backgroundColor: COLORS.blue + '15', color: '#28305C', border: `1px solid ${COLORS.blue}60` }
                              : { backgroundColor: 'white', color: '#6B6357', border: '1px solid #EAE2CF' }}>
                              <Icon size={14} />{f.value}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <CTA onClick={genVideoScript} loading={vidLoading} label="أنشئ السكريبت" icon={Film} color={COLORS.blue} />
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card icon={Film} color={COLORS.blue} title="سكريبت الفيديو" desc="النص الكامل والمشاهد">
                {vidLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 size={24} className="animate-spin" style={{ color: COLORS.blue }} />
                    <p className="text-sm font-medium text-[#211D18]">جارٍ الكتابة…</p>
                  </div>
                ) : vidResult ? (
                  <div className="space-y-3 max-h-[560px] overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm">{vidResult.title}</h3>
                      {vidResult.duration && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: COLORS.blue + '15', color: '#28305C' }}>{vidResult.duration}</span>}
                    </div>
                    {vidResult.script && (
                      <div className="p-3.5 rounded-2xl border" style={{ backgroundColor: COLORS.blue + '08', borderColor: COLORS.blue + '20' }}>
                        <p className="text-xs whitespace-pre-wrap leading-relaxed">{vidResult.script}</p>
                      </div>
                    )}
                    {Array.isArray(vidResult.scenes) && vidResult.scenes.map((s, i) => (
                      <div key={s.scene_number ?? i} className="p-3 rounded-2xl border border-[#EAE2CF] text-xs">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: COLORS.blue + '15', color: '#28305C' }}>مشهد {s.scene_number}</span>
                          {s.duration_sec && <span className="text-[10px] text-[#8A8073]">{s.duration_sec}ث</span>}
                        </div>
                        <p className="font-medium">{s.description}</p>
                        {s.narration && <p className="text-[#6B6357] italic mt-1 text-[11px]">« {s.narration} »</p>}
                        {s.visual && <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: COLORS.teal }}><Camera size={10} /> {s.visual}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Film} text="سيظهر السكريبت هنا" />
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'wedding' && isAdmin && (
          <div className="grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <Card icon={Heart} color={COLORS.pink} title="استوديو دعوات الزفاف" desc="دعوات فاخرة بأسلوب مغربي أو عالمي">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="اسم العريس *"><PlainInput placeholder="محمد" value={wedGroom} onChange={setWedGroom} /></Field>
                    <Field label="اسم العروس *"><PlainInput placeholder="فاطمة" value={wedBride} onChange={setWedBride} /></Field>
                    <Field label="تاريخ الحفل"><PlainInput placeholder="السبت 15 مارس 2026" value={wedDate} onChange={setWedDate} /></Field>
                    <Field label="مكان الحفل"><PlainInput placeholder="قاعة الأندلس، مراكش" value={wedVenue} onChange={setWedVenue} /></Field>
                  </div>
                  <Field label="آية أو عبارة (اختياري)">
                    <textarea
                      rows={2}
                      value={wedQuote}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setWedQuote(e.target.value)}
                      placeholder="﴿ومن آياته أن خلق لكم من أنفسكم أزواجاً﴾"
                      className="w-full px-4 py-3 text-sm border border-[#EAE2CF] rounded-2xl bg-white resize-none"
                    />
                  </Field>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <Field label="أسلوب الدعوة">
                      <SelectPill value={wedStyle} onChange={setWedStyle} options={WEDDING_STYLES} />
                    </Field>
                    <Field label="شكل القص (للطباعة)">
                      <SelectPill value={wedShape} onChange={setWedShape} options={WEDDING_SHAPES} />
                    </Field>
                  </div>
                  <Field label="صورة مرجعية (اختياري)">
                    <input ref={wedFileRef} type="file" accept="image/*" className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (e.target.files?.[0]) {
                        handleWedUpload(e.target.files[0]);
                      }
                      e.target.value = "";
                    }} />
                    <button onClick={() => wedFileRef.current?.click()} disabled={wedUploading}
                      className="w-full border-2 border-dashed rounded-2xl p-4 text-center transition-all hover:bg-[#B8577A]/5 flex flex-col items-center justify-center gap-2"
                      style={{ borderColor: wedImage ? COLORS.green + '80' : COLORS.pink + '60' }}>
                      {wedUploading ? (
                        <><Loader2 size={20} className="animate-spin" style={{ color: COLORS.pink }} /><span className="text-xs">جارٍ الرفع...</span></>
                      ) : wedImage ? (
                        <><Check size={20} style={{ color: COLORS.green }} /><span className="text-xs">{wedImageName}</span></>
                      ) : (
                        <><Upload size={20} style={{ color: COLORS.pink }} /><span className="text-xs">ارفع صورة كنموذج أو للتعديل عليها</span></>
                      )}
                    </button>
                    {wedImage && <img src={wedImage} alt="reference" className="mt-2 w-full max-h-32 object-contain rounded-xl border border-[#EAE2CF]" />}
                  </Field>
                  <CTA onClick={genWedding} loading={wedLoading} label="أنشئ دعوة الزفاف" icon={Crown} color={COLORS.pink} />
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <ResultPanel
                loading={wedLoading}
                result={wedResult}
                onClear={() => setWedResult(null)}
                onDownload={() => wedResult && downloadImage(wedResult, 'wedding.png')}
                onPrint={() => wedResult && openPrint(wedResult, `دعوة ${wedGroom} & ${wedBride}`)}
                color={COLORS.pink}
                emptyIcon={Heart}
                emptyText="ستظهر دعوة الزفاف هنا"
                loadingText="جارٍ نسج التفاصيل…"
              />
            </div>
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: 'الإجمالي', value: stats.total, icon: Layers, color: COLORS.lilac },
                { label: 'صور', value: stats.byType.image || 0, icon: ImageIcon, color: COLORS.amber },
                { label: 'فلاير', value: stats.byType.flyer || 0, icon: Wand2, color: COLORS.coral },
                { label: 'بطاقات', value: stats.byType.card || 0, icon: Layers, color: COLORS.gold },
                { label: 'زفاف', value: stats.byType.wedding || 0, icon: Heart, color: COLORS.pink },
                { label: 'مفضّل', value: stats.favs, icon: Star, color: COLORS.green }
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="bg-white rounded-2xl border border-[#EAE2CF] p-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + '15' }}>
                        <Icon size={13} style={{ color: s.color }} />
                      </div>
                      <span className="text-xl font-bold text-[#211D18]">{s.value}</span>
                    </div>
                    <p className="text-[11px] text-[#8A8073] font-medium">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Filter + Select-mode toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8A8073]" />
                <input
                  value={gSearch}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setGSearch(e.target.value)}
                  placeholder="بحث في المعرض…"
                  className="w-full pr-10 pl-4 py-2.5 text-sm border border-[#EAE2CF] rounded-full bg-white"
                />
              </div>
              <div className="flex gap-1 bg-[#EAE2CF]/50 rounded-full p-1 overflow-x-auto">
                {GALLERY_FILTERS.map(f => (
                  <button key={f.id} onClick={() => setGFilter(f.id)}
                    className="px-3 py-1.5 text-[11px] font-semibold rounded-full whitespace-nowrap transition-all"
                    style={gFilter === f.id
                      ? { backgroundColor: 'white', color: '#211D18', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }
                      : { color: '#6B6357' }}>{f.label}</button>
                ))}
              </div>
              <span className="text-[11px] text-[#8A8073] font-medium">{filteredGallery.length} عنصر</span>
              <button onClick={() => { setSelectMode(v => !v); setSelectedIds([]); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all"
                style={selectMode
                  ? { backgroundColor: COLORS.lilac, color: '#fff' }
                  : { backgroundColor: 'white', color: '#211D18', border: '1px solid #EAE2CF' }}>
                {selectMode ? <><X size={12} /> إلغاء التحديد</> : <><CheckSquare size={12} /> تحديد للطباعة الدفعية</>}
              </button>
            </div>

            {/* Batch action bar */}
            {selectMode && (
              <div className="sticky top-[calc(56px+64px+20px)] z-30 bg-white rounded-2xl border shadow-md p-3 flex items-center gap-3 flex-wrap"
                style={{ borderColor: COLORS.lilac + '40' }}>
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: COLORS.lilac + '20' }}>
                    <Package size={14} style={{ color: '#3D2E63' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#211D18]">{selectedIds.length} تصميم محدد</p>
                    <p className="text-[10px] text-[#8A8073]">من أصل {printableFilteredCount} تصميم قابل للطباعة</p>
                  </div>
                </div>
                <button onClick={selectAll} className="text-[11px] font-semibold px-3 py-2 rounded-full bg-[#FAF6EC] hover:bg-[#EAE2CF] transition-all">
                  تحديد الكل
                </button>
                <button onClick={clearSelection} disabled={selectedIds.length === 0} className="text-[11px] font-semibold px-3 py-2 rounded-full bg-[#FAF6EC] hover:bg-[#EAE2CF] transition-all disabled:opacity-40">
                  مسح
                </button>
                <button onClick={batchDownload} disabled={selectedIds.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold transition-all disabled:opacity-40"
                  style={{ backgroundColor: COLORS.teal + '15', color: '#164F44', border: `1px solid ${COLORS.teal}40` }}>
                  <Download size={12} /> تحميل الكل
                </button>
                <button onClick={batchDelete} disabled={selectedIds.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold transition-all disabled:opacity-40"
                  style={{ backgroundColor: COLORS.coral + '15', color: '#8A3324', border: `1px solid ${COLORS.coral}40` }}>
                  <Trash2 size={12} /> حذف
                </button>
                <button onClick={openBatchPrint} disabled={selectedIds.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold bg-[#211D18] text-white hover:bg-[#3A342B] transition-all disabled:opacity-40">
                  <Printer size={12} /> طباعة الدفعة ({selectedIds.length})
                </button>
              </div>
            )}

            {filteredGallery.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#EAE2CF] p-16 text-center">
                <Grid3x3 size={40} className="mx-auto mb-3 text-[#D8CDB0]" />
                <p className="text-sm text-[#8A8073]">لا توجد تصاميم بعد</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredGallery.map(row => (
                  <GalleryCard
                    key={row.id}
                    row={row}
                    onToggleFav={toggleFav}
                    onDelete={deleteItem}
                    onDownload={downloadImage}
                    onPrint={openPrint}
                    selectMode={selectMode}
                    selected={selectedIds.includes(row.id)}
                    onToggleSelect={() => toggleSelect(row.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Print / export modal */}
      {printModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPrintModal(null)}>
          <div className="bg-white rounded-3xl border border-[#EAE2CF] shadow-2xl w-full max-w-md p-6" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: DISPLAY_FONT }}>طباعة / تصدير</h3>
            <p className="text-sm text-[#6B6357] mb-4">
              {printModal.batch
                ? `طباعة دفعة ${printModal.items.length} تصميم`
                : `طباعة: ${printModal.items[0].title}`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  printModal.items.forEach(item => downloadImage(item.url, item.title + '.png'));
                  setPrintModal(null);
                }}
                className="flex-1 py-2 rounded-full text-sm font-semibold bg-[#211D18] text-white"
              >
                تحميل PNG
              </button>
              <button
                onClick={() => setPrintModal(null)}
                className="flex-1 py-2 rounded-full text-sm font-semibold border border-[#EAE2CF]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      ` }} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   SIGNATURE ELEMENTS
   ──────────────────────────────────────────────────────────────────────── */

// Logo mark: two overlapping squares (a classic Rub el Hizb / zellige
// eight-point star silhouette) behind a spark icon — nods to Moroccan
// geometric ornament instead of a generic gradient blob.
function LogoMark() {
  return (
    <div className="w-11 h-11 rounded-2xl relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: COLORS.ink }}>
      <div className="absolute w-6 h-6 bg-white/25 rotate-45" />
      <div className="absolute w-6 h-6 bg-white/15" />
      <Sparkles size={17} className="text-white relative z-10" />
    </div>
  );
}

// Thin zellige-lattice divider used once, under the header, as the page's
// single decorative signature.
function ZelligeDivider() {
  return (
    <div
      className="h-2 w-full"
      style={{
        backgroundImage: `repeating-linear-gradient(45deg, ${COLORS.gold}30 0 1px, transparent 1px 10px), repeating-linear-gradient(-45deg, ${COLORS.gold}30 0 1px, transparent 1px 10px)`
      }}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
   ──────────────────────────────────────────────────────────────────────── */

interface CardProps {
  icon: LucideIcon;
  color: string;
  title: string;
  desc?: string;
  children: ReactNode;
}

function Card({ icon: Icon, color, title, desc, children }: CardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#EAE2CF] overflow-hidden hover:shadow-sm transition-all duration-200">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EAE2CF]">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '15' }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-[#211D18]">{title}</h3>
          {desc && <p className="text-[11px] text-[#8A8073] mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#6B6357] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

interface PlainInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

function PlainInput({ placeholder = '', value = '', onChange = () => {} }: PlainInputProps) {
  return (
    <input
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 text-sm border border-[#EAE2CF] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#6C5CA6]/30"
    />
  );
}

interface SelectPillProps {
  value?: string;
  onChange?: (value: string) => void;
  options?: SelectOption[];
}

function SelectPill({ value = '', onChange = () => {}, options = [] }: SelectPillProps) {
  return (
    <select
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 text-sm border border-[#EAE2CF] rounded-xl bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#211D18]/5"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

interface CTAProps {
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  label: string;
  icon: LucideIcon;
  color?: string;
}

function CTA({ onClick = () => {}, loading = false, disabled = false, label, icon: Icon, color = COLORS.lilac }: CTAProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-bold hover:shadow-md transition-all disabled:opacity-40"
      style={{ backgroundColor: color, color: '#211D18' }}
    >
      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#211D18]">
        {loading ? <Loader2 size={11} className="animate-spin text-white" /> : <Icon size={11} className="text-white" />}
      </span>
      {loading ? 'جارٍ المعالجة…' : label}
    </button>
  );
}

interface ResultPanelProps {
  loading?: boolean;
  result?: string | null;
  onClear?: () => void;
  onDownload?: () => void;
  onPrint?: (() => void) | null;
  color: string;
  emptyIcon: LucideIcon;
  emptyText: string;
  loadingText: string;
}

function ResultPanel({ loading = false, result = null, onClear = () => {}, onDownload = () => {}, onPrint = null, color, emptyIcon: Icon, emptyText, loadingText }: ResultPanelProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#EAE2CF] overflow-hidden sticky top-32">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#EAE2CF]">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
          <Gem size={16} style={{ color }} />
        </div>
        <h3 className="text-sm font-bold text-[#211D18]">النتيجة</h3>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={24} className="animate-spin" style={{ color }} />
            <p className="text-sm font-medium text-[#211D18]">{loadingText}</p>
          </div>
        ) : result ? (
          <div className="space-y-3">
            <img 
              src={result} 
              alt="result" 
              className="w-full rounded-2xl border border-[#EAE2CF] shadow-sm"
              onLoad={() => console.log('Image loaded successfully')}
              onError={() => console.error('Image failed to load:', result)}
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onDownload}
                className="flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold"
                style={{ backgroundColor: color + '15', color: '#211D18', border: `1px solid ${color}30` }}>
                <Download size={13} /> تحميل PNG
              </button>
              {onPrint && (
                <button onClick={onPrint}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold bg-[#211D18] text-white hover:bg-[#3A342B]">
                  <Printer size={13} /> طباعة / PDF
                </button>
              )}
            </div>
            <button onClick={onClear}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-full text-xs text-[#8A8073] hover:bg-[#EAE2CF]/60">
              <RefreshCw size={11} /> إعادة تعيين
            </button>
          </div>
        ) : (
          <EmptyState icon={Icon} text={emptyText} />
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  text: string;
}

function EmptyState({ icon: Icon, text }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed border-[#EAE2CF] rounded-2xl">
      <Icon size={36} className="text-[#D8CDB0]" />
      <p className="text-xs text-[#8A8073] text-center px-4">{text}</p>
    </div>
  );
}

interface GalleryCardProps {
  row: DesignItem;
  onToggleFav: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (url: string, name?: string) => void;
  onPrint: (url: string, title: string) => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}

function GalleryCard({ row, onToggleFav, onDelete, onDownload, onPrint, selectMode, selected, onToggleSelect }: GalleryCardProps) {
  const meta = TYPE_META[row.type] ?? { label: row.type, color: COLORS.lilac };

  const handleCardClick = () => {
    if (selectMode && row.url) onToggleSelect();
  };

  return (
    <div className={`group bg-white rounded-2xl border overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ${selectMode ? 'cursor-pointer' : ''}`}
      onClick={handleCardClick}
      style={selected ? { borderColor: COLORS.lilac, boxShadow: `0 0 0 2px ${COLORS.lilac}40` } : { borderColor: '#EAE2CF' }}>
      <div className="relative aspect-square bg-[#FAF6EC] overflow-hidden">
        {row.url ? (
          <img src={row.url} alt={row.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={36} className="text-[#D8CDB0]" />
          </div>
        )}
        {selectMode && row.url && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all flex items-start justify-start p-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
              style={selected
                ? { backgroundColor: COLORS.lilac, color: 'white' }
                : { backgroundColor: 'rgba(255,255,255,0.9)', border: '2px solid #D8CDB0' }}>
              {selected && <Check size={14} strokeWidth={3} />}
            </div>
          </div>
        )}
        {!selectMode && (
          <div className="absolute top-2 right-2 flex gap-1">
            <button onClick={() => onToggleFav(row.id)} aria-label="تبديل المفضلة"
              className="w-7 h-7 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:scale-110 transition-all">
              <Star size={13} style={{ color: row.favorite ? COLORS.amber : '#8A8073', fill: row.favorite ? COLORS.amber : 'transparent' }} />
            </button>
          </div>
        )}
        <span className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-white/90 backdrop-blur"
          style={{ color: meta.color, border: `1px solid ${meta.color}40` }}>{meta.label}</span>
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold text-[#211D18] truncate">{row.title}</p>
        <p className="text-[10px] text-[#8A8073] mt-0.5">{new Date(row.created_at).toLocaleDateString('ar-MA')}</p>
        {!selectMode && (
          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {row.url && (
              <>
                <button onClick={() => onDownload(row.url, `${row.type}-${row.id}.png`)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: meta.color + '15', color: '#211D18' }} title="تحميل PNG" aria-label="تحميل PNG">
                  <Download size={10} />
                </button>
                <button onClick={() => onPrint(row.url, row.title)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-[10px] font-semibold bg-[#211D18] text-white hover:bg-[#3A342B]"
                  title="طباعة / PDF" aria-label="طباعة أو تصدير PDF">
                  <Printer size={10} />
                </button>
              </>
            )}
            <button onClick={() => onDelete(row.id)}
              className="px-2 py-1.5 rounded-full text-[#8A3324] hover:bg-[#C0533F]/10" title="حذف" aria-label="حذف">
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
