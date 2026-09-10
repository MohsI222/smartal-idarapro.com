/** حقل وسائط اختياري (رابط أو رفع ملف) — Delivery Hub media field for logo/banner/product image/video. */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UploadCloud, X, Loader2 } from "lucide-react";

const MAX_IMAGE_MB = 4;
const MAX_VIDEO_MB = 20;
const TARGET_IMAGE_SIZE_KB = 500; // Target 500KB for compressed images
const MAX_IMAGE_WIDTH = 1200; // Max width for compressed images

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

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if too large
        if (width > MAX_IMAGE_WIDTH) {
          height = (height * MAX_IMAGE_WIDTH) / width;
          width = MAX_IMAGE_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try different quality levels to achieve target size
        let quality = 0.9;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Reduce quality if still too large
        while (dataUrl.length > TARGET_IMAGE_SIZE_KB * 1024 && quality > 0.1) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
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
        // Compress image before processing
        result = await compressImage(file);
        toast.success("تم ضغط الصورة بنجاح");
      } else {
        // For videos, just read as data URL
        result = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Failed to read file"));
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
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
