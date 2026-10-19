/** حقل وسائط اختياري (رابط أو رفع ملف) — Delivery Hub media field for logo/banner/product image/video. */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UploadCloud, X, Loader2 } from "lucide-react";
import { compressImageUnder100KB } from "@/lib/imageUtils";
import { uploadFile } from "@/lib/supabaseClient";

const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 20;

function isVideoSrc(value: string): boolean {
  return value.startsWith("data:video") || /\.(mp4|webm|ogg)(\?.*)?$/i.test(value);
}

function toEmbedVideoUrl(url: string): string {
  // Convert YouTube URLs to embed format
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/,
    /youtube\.com\/shorts\/([\w-]{6,})/,
  ];
  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  }
  return url;
}

export function MediaUploadField({
  label,
  value,
  onChange,
  kind,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  kind: "image" | "video";
  /** اختياري: يظهر فقط عند إفراغ الحقل، حتى لا يخفي روابط base64 الطويلة بعد الرفع */
  placeholder?: string;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxMb = kind === "image" ? MAX_IMAGE_MB : MAX_VIDEO_MB;
  const isUploadedFile = value.startsWith("data:");

  async function handleFile(file: File | null) {
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`الملف كبير جداً — الحد الأقصى ${maxMb} ميجابايت`);
      return;
    }
    setBusy(true);
    try {
      let result: string;
      if (kind === "image") {
        // Compress image to under 100KB and upload to Supabase
        const compressedBlob = await compressImageUnder100KB(file);
        const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
        const fileName = `delivery-hub/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
        result = await uploadFile(compressedFile, fileName);
        toast.success("تم رفع الصورة بنجاح");
      } else {
        // For videos, upload directly to Supabase
        const ext = file.name.split('.').pop() || "mp4";
        const fileName = `delivery-hub-videos/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        result = await uploadFile(file, fileName);
        toast.success("تم رفع الفيديو بنجاح");
      }
      onChange(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر معالجة الملف");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Label>{label} (اختياري)</Label>
      <div className="flex gap-2">
        <Input
          value={isUploadedFile ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isUploadedFile ? "تم رفع ملف ✅ — أو الصق رابطاً جديداً لاستبداله" : placeholder ?? "https://..."}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          رفع ملف
        </Button>
        {value && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange("")} title="إزالة">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={kind === "image" ? "image/*" : "video/*"}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {value && kind === "image" && (
        <img src={value} alt="معاينة" className="h-28 w-full rounded-lg object-cover border border-slate-800" />
      )}
      {value && kind === "video" && isVideoSrc(value) && (
        <video src={value} controls className="h-40 w-full rounded-lg border border-slate-800 bg-black" />
      )}
      {value && kind === "video" && !isVideoSrc(value) && (
        <div className="h-40 w-full rounded-lg border border-slate-800 bg-black overflow-hidden">
          <iframe
            src={toEmbedVideoUrl(value)}
            title="معاينة الفيديو"
            className="h-full w-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
