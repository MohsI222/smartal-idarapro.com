import { useEffect, useState } from "react";
import { Video, Youtube, Image as ImageIcon, Loader2 } from "lucide-react";

type MediaType = "youtube" | "external" | "video" | "image";

interface MediaItem {
  id: string;
  type: MediaType;
  title: string;
  url?: string;
  youtube_video_id?: string;
  file_path?: string;
  file_name?: string;
  file_mime?: string;
  sort_order: number;
}

export function PublicMediaGallery() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicMedia();
  }, []);

  const fetchPublicMedia = async () => {
    try {
      const res = await fetch("/api/media-library/public");
      if (!res.ok) {
        console.warn("Media library endpoint returned non-OK status:", res.status);
        setItems([]);
        return;
      }
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error("Error fetching public media:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const getMediaIcon = (type: MediaType) => {
    switch (type) {
      case "youtube":
        return <Youtube className="w-4 h-4 text-red-500" />;
      case "video":
        return <Video className="w-4 h-4 text-blue-500" />;
      case "image":
        return <ImageIcon className="w-4 h-4 text-green-500" />;
      default:
        return <Video className="w-4 h-4 text-gray-500" />;
    }
  };

  const getMediaPreview = (item: MediaItem) => {
    if (item.type === "youtube" && item.youtube_video_id) {
      return (
        <iframe
          width="100%"
          height="180"
          src={`https://www.youtube.com/embed/${item.youtube_video_id}`}
          title={item.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="rounded-lg"
        />
      );
    }

    if (item.type === "external" && item.url) {
      return (
        <video
          width="100%"
          height="180"
          controls
          src={item.url}
          className="rounded-lg"
        />
      );
    }

    if (item.file_path) {
      const mediaUrl = item.url || `/uploads/${item.file_name}`;
      if (item.type === "video") {
        return (
          <video
            width="100%"
            height="180"
            controls
            src={mediaUrl}
            className="rounded-lg"
          />
        );
      }

      if (item.type === "image") {
        return (
          <img
            src={mediaUrl}
            alt={item.title}
            className="w-full h-44 object-cover rounded-lg"
          />
        );
      }
    }

    return <div className="w-full h-44 bg-gray-800 rounded-lg flex items-center justify-center text-gray-500">لا توجد معاينة</div>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        جاري التحميل...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>فيديوهات توضيحية مباشرة من يوتيوب — خطوات بسيطة للانطلاق</p>
        <a href="https://www.youtube.com/@alidrapro" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline mt-1 block">
          https://www.youtube.com/@alidrapro
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-slate-400 mb-4">كيف تعمل المنصة؟ / How it works</p>
      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center gap-2">
              {getMediaIcon(item.type)}
              <h3 className="text-sm font-semibold text-slate-300">{item.title}</h3>
            </div>
            <div className="rounded-lg overflow-hidden">
              {getMediaPreview(item)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
