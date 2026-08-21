import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Youtube, Image as ImageIcon, Video, Upload, GripVertical, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

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
  is_public: number;
  created_at: string;
  updated_at: string;
}

export function MediaLibraryManager() {
  const { token, isAdmin } = useAuth();
  const [items, setItems] = useState<MediaItem[]>([]);

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>هذا القسم متاح للمشرفين فقط</p>
      </div>
    );
  }
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    type: "youtube" as MediaType,
    title: "",
    url: "",
    youtube_video_id: "",
    is_public: false
  });

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadIsPublic, setUploadIsPublic] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [token]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api<{ items: MediaItem[] }>("/media-library", { token });
      if (res.items) {
        setItems(res.items);
      }
    } catch (error) {
      console.error("Error fetching media:", error);
      toast("فشل في جلب المكتبة", { style: { background: "#ef4444", color: "#fff" } });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.title.trim()) {
      toast("العنوان مطلوب", { style: { background: "#ef4444", color: "#fff" } });
      return;
    }

    if (formData.type === "youtube" && !formData.youtube_video_id.trim()) {
      toast("معرف فيديو YouTube مطلوب", { style: { background: "#ef4444", color: "#fff" } });
      return;
    }

    if (formData.type === "external" && !formData.url.trim()) {
      toast("الرابط مطلوب", { style: { background: "#ef4444", color: "#fff" } });
      return;
    }

    try {
      const res = await api<{ item: MediaItem }>("/media-library", {
        method: "POST",
        token,
        body: JSON.stringify({
          type: formData.type,
          title: formData.title,
          url: formData.url,
          youtube_video_id: formData.youtube_video_id,
          is_public: formData.is_public ? "1" : "0"
        })
      });

      if (res.item) {
        setItems([...items, res.item]);
        setShowAddModal(false);
        setFormData({ type: "youtube", title: "", url: "", youtube_video_id: "", is_public: false });
        toast("تمت الإضافة بنجاح", { style: { background: "#22c55e", color: "#fff" } });
      }
    } catch (error) {
      console.error("Error adding item:", error);
      toast("فشل في الإضافة", { style: { background: "#ef4444", color: "#fff" } });
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast("اختر ملفاً أولاً", { style: { background: "#ef4444", color: "#fff" } });
      return;
    }

    if (!uploadTitle.trim()) {
      toast("العنوان مطلوب", { style: { background: "#ef4444", color: "#fff" } });
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("title", uploadTitle);
    formData.append("is_public", uploadIsPublic ? "1" : "0");

    console.log("Uploading file:", {
      fileName: uploadFile.name,
      fileSize: uploadFile.size,
      fileType: uploadFile.type,
      title: uploadTitle,
      isPublic: uploadIsPublic
    });

    setUploading(true);

    try {
      const prefix = "/api";
      const res = await fetch(`${prefix}/media-library/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData
      });

      const text = await res.text();
      console.log("Upload response:", { status: res.status, text });

      if (!res.ok) {
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || text || "فشل في الرفع");
        } catch {
          throw new Error(text || "فشل في الرفع");
        }
      }

      const data = JSON.parse(text) as { item: MediaItem };
      
      if (data.item) {
        setItems([...items, data.item]);
        setShowUploadForm(false);
        setUploadFile(null);
        setUploadTitle("");
        setUploadIsPublic(false);
        toast("تم الرفع بنجاح", { style: { background: "#22c55e", color: "#fff" } });
      }
    } catch (error) {
      console.error("Error uploading:", error);
      const errorMessage = error instanceof Error ? error.message : "فشل في الرفع";
      toast(errorMessage, { style: { background: "#ef4444", color: "#fff" } });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingItem) return;

    try {
      const res = await api<{ item: MediaItem }>(`/media-library/${editingItem.id}`, {
        method: "PUT",
        token,
        body: JSON.stringify({
          title: formData.title,
          url: formData.url,
          youtube_video_id: formData.youtube_video_id,
          is_public: formData.is_public ? "1" : "0"
        })
      });

      if (res.item) {
        setItems(items.map(i => i.id === res.item.id ? res.item : i));
        setEditingItem(null);
        setFormData({ type: "youtube", title: "", url: "", youtube_video_id: "", is_public: false });
        toast("تم التعديل بنجاح", { style: { background: "#22c55e", color: "#fff" } });
      }
    } catch (error) {
      console.error("Error editing:", error);
      toast("فشل في التعديل", { style: { background: "#ef4444", color: "#fff" } });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;

    try {
      await api(`/media-library/${id}`, {
        method: "DELETE",
        token
      });

      setItems(items.filter(i => i.id !== id));
      toast("تم الحذف بنجاح", { style: { background: "#22c55e", color: "#fff" } });
    } catch (error) {
      console.error("Error deleting:", error);
      toast("فشل في الحذف", { style: { background: "#ef4444", color: "#fff" } });
    }
  };

  const handleReorder = async (newItems: MediaItem[]) => {
    try {
      await api("/media-library/reorder", {
        method: "POST",
        token,
        body: JSON.stringify({
          items: newItems.map((item, index) => ({ id: item.id, sort_order: index }))
        })
      });

      setItems(newItems);
      toast("تم إعادة الترتيب", { style: { background: "#22c55e", color: "#fff" } });
    } catch (error) {
      console.error("Error reordering:", error);
      toast("فشل في إعادة الترتيب", { style: { background: "#ef4444", color: "#fff" } });
    }
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const newItems = [...items];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= newItems.length) return;
    
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    handleReorder(newItems);
  };

  const getMediaIcon = (type: MediaType) => {
    switch (type) {
      case "youtube":
        return <Youtube className="w-5 h-5 text-red-500" />;
      case "video":
        return <Video className="w-5 h-5 text-blue-500" />;
      case "image":
        return <ImageIcon className="w-5 h-5 text-green-500" />;
      default:
        return <Video className="w-5 h-5 text-gray-500" />;
    }
  };

  const getMediaPreview = (item: MediaItem) => {
    console.log("Media preview for item:", item);
    
    if (item.type === "youtube" && item.youtube_video_id) {
      return (
        <iframe
          width="100%"
          height="200"
          src={`https://www.youtube.com/embed/${item.youtube_video_id}`}
          title={item.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    if (item.type === "external" && item.url) {
      return (
        <video
          width="100%"
          height="200"
          controls
          src={item.url}
        />
      );
    }

    if (item.file_path || item.file_name) {
      const mediaUrl = item.url || `/uploads/${item.file_name}`;
      console.log("Media URL:", mediaUrl);
      
      if (item.type === "video") {
        return (
          <video
            width="100%"
            height="200"
            controls
            src={mediaUrl}
            onError={(e) => console.error("Video load error:", e)}
          />
        );
      }

      if (item.type === "image") {
        return (
          <img
            src={mediaUrl}
            alt={item.title}
            className="w-full h-48 object-cover rounded"
            onError={(e) => console.error("Image load error:", e)}
          />
        );
      }
    }

    return <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center">لا توجد معاينة</div>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">مكتبة الفيديوهات والصور</h2>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddModal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة من YouTube
          </Button>
          <Button onClick={() => setShowUploadForm(true)} variant="outline" className="gap-2">
            <Upload className="w-4 h-4" />
            رفع ملف
          </Button>
        </div>
      </div>

      {showUploadForm && (
        <Card className="border-blue-200">
          <CardHeader>
            <h3 className="font-semibold">رفع ملف من الجهاز</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
            <Input
              placeholder="عنوان الملف"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="upload_is_public"
                checked={uploadIsPublic}
                onChange={(e) => setUploadIsPublic(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="upload_is_public" className="text-sm">عرض في صفحة الدخول (عام)</label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={!uploadFile || !uploadTitle || uploading}>
                {uploading ? "جاري الرفع..." : "رفع"}
              </Button>
              <Button variant="outline" onClick={() => { setShowUploadForm(false); setUploadFile(null); setUploadTitle(""); setUploadIsPublic(false); }} disabled={uploading}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-8">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>لم يتم إضافة فيديوهات أو صور بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((item, index) => (
            <Card key={item.id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveItem(index, "up")}
                      disabled={index === 0}
                    >
                      <GripVertical className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => moveItem(index, "down")}
                      disabled={index === items.length - 1}
                    >
                      <GripVertical className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getMediaIcon(item.type)}
                      <h3 className="font-semibold">{item.title}</h3>
                    </div>
                    <div className="rounded-lg overflow-hidden mb-2">
                      {getMediaPreview(item)}
                    </div>
                    <p className="text-sm text-gray-500">
                      {item.type === "youtube" && `YouTube ID: ${item.youtube_video_id}`}
                      {item.type === "external" && `الرابط: ${item.url}`}
                      {item.file_name && `الملف: ${item.file_name}`}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPreviewItem(item)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingItem(item);
                        setFormData({
                          type: item.type,
                          title: item.title,
                          url: item.url || "",
                          youtube_video_id: item.youtube_video_id || ""
                        });
                        setShowAddModal(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="font-semibold">
                {editingItem ? "تعديل" : "إضافة"} فيديو أو صورة
              </h3>
              <Button size="icon" variant="ghost" onClick={() => {
                setShowAddModal(false);
                setEditingItem(null);
                setFormData({ type: "youtube", title: "", url: "", youtube_video_id: "" });
              }}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">النوع</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as MediaType })}
                  className="w-full p-2 border rounded"
                  disabled={!!editingItem}
                >
                  <option value="youtube">YouTube</option>
                  <option value="external">رابط خارجي</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">العنوان</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="أدخل العنوان"
                />
              </div>

              {formData.type === "youtube" && (
                <div>
                  <label className="block text-sm font-medium mb-1">معرف فيديو YouTube</label>
                  <Input
                    value={formData.youtube_video_id}
                    onChange={(e) => setFormData({ ...formData, youtube_video_id: e.target.value })}
                    placeholder="مثال: dQw4w9WgXcQ"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    الجزء بعد v= في رابط YouTube
                  </p>
                </div>
              )}

              {formData.type === "external" && (
                <div>
                  <label className="block text-sm font-medium mb-1">الرابط</label>
                  <Input
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://example.com/video.mp4"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_public" className="text-sm">عرض في صفحة الدخول (عام)</label>
              </div>

              <Button
                onClick={editingItem ? handleEdit : handleAdd}
                className="w-full"
                disabled={!formData.title.trim()}
              >
                {editingItem ? "حفظ التعديلات" : "إضافة"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => setPreviewItem(null)}>
          <div className="w-full max-w-4xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <Button size="icon" variant="ghost" onClick={() => setPreviewItem(null)}>
                <X className="w-6 h-6 text-white" />
              </Button>
            </div>
            <div className="bg-black rounded-lg overflow-hidden">
              {getMediaPreview(previewItem)}
            </div>
            <p className="text-white text-center mt-2">{previewItem.title}</p>
          </div>
        </div>
      )}
    </div>
  );
}
