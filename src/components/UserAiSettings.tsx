import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Key, Loader2, Save, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

type AiProvider = 'gemini' | 'openai' | 'groq' | 'huggingface' | 'pollinations' | 'together';

export function UserAiSettings() {
  const { token } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<AiProvider>('gemini');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message?: string } | null>(null);

  const loadKeyStatus = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api<{ hasKey: boolean; provider: string }>("/user/ai-api-key", { token });
      setHasKey(data.hasKey);
      setCurrentProvider((data.provider as AiProvider) || 'gemini');
    } catch (error) {
      console.error("Error loading API key status:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadKeyStatus();
  }, [loadKeyStatus]);

  // Auto-detect provider based on API key prefix
  useEffect(() => {
    if (apiKey.startsWith('sk-')) {
      setProvider('openai');
    } else if (apiKey.startsWith('AIza')) {
      setProvider('gemini');
    } else if (apiKey.startsWith('gsk_')) {
      setProvider('groq');
    } else if (apiKey.startsWith('hf_')) {
      setProvider('huggingface');
    } else if (apiKey.startsWith('key_')) {
      setProvider('together');
    }
  }, [apiKey]);

  const handleSave = async () => {
    if (!token) return;
    
    // For pollinations, no API key is needed
    if (provider !== 'pollinations' && !apiKey.trim()) return;
    
    setSaving(true);
    setTestResult(null);
    try {
      const payload = provider === 'pollinations' 
        ? { apiKey: '', provider }
        : { apiKey: apiKey.trim(), provider };
      
      await api("/user/ai-api-key", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      toast.success("تم حفظ مفتاح API بنجاح");
      setApiKey("");
      setHasKey(true);
      setTestResult(null);
      setCurrentProvider(provider);
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("فشل حفظ مفتاح API");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!token || !apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const data = await api<{ valid: boolean; message?: string; error?: string }>("/user/ai-api-key/test", {
        method: "POST",
        token,
        body: JSON.stringify({ apiKey: apiKey.trim(), provider }),
      });
      setTestResult(data);

      if (data.valid) {
        toast.success(data.message || "مفتاح API صالح");
      } else {
        toast.error(data.error || "مفتاح API غير صالح");
      }
    } catch (error) {
      console.error("Error testing API key:", error);
      setTestResult({ valid: false, message: "فشل اختبار مفتاح API" });
      toast.error("فشل اختبار مفتاح API");
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    if (!token) return;
    if (!confirm("هل أنت متأكد من حذف مفتاح API؟")) return;

    try {
      await api("/user/ai-api-key", {
        method: "DELETE",
        token,
      });
      toast.success("تم حذف مفتاح API بنجاح");
      setHasKey(false);
      setApiKey("");
      setTestResult(null);
      setCurrentProvider('gemini');
    } catch (error) {
      console.error("Error removing API key:", error);
      toast.error("فشل حذف مفتاح API");
    }
  };

  return (
    <Card className="border-slate-700 bg-slate-800/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Key className="size-5 text-cyan-400" />
          إعدادات الذكاء الاصطناعي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-slate-400" />
          </div>
        ) : hasKey && !apiKey ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="size-5" />
              <span>مفتاح API محفوظ ({currentProvider === 'openai' ? 'OpenAI' : currentProvider === 'groq' ? 'Groq' : currentProvider === 'huggingface' ? 'HuggingFace' : currentProvider === 'pollinations' ? 'Pollinations (مجاني)' : currentProvider === 'together' ? 'Together AI' : 'Gemini'})</span>
            </div>
            <Button
              variant="destructive"
              onClick={handleRemove}
              className="w-full"
            >
              <Trash2 className="size-4 mr-2" />
              حذف مفتاح API
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="provider">مزود الذكاء الاصطناعي</Label>
              <div className="relative mt-1">
                <select
                  id="provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as AiProvider)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="gemini">Google Gemini (موصى به للصور)</option>
                  <option value="openai">OpenAI (GPT-4o / DALL-E)</option>
                  <option value="groq">Groq (Llama 3.3 - سريع واقتصادي)</option>
                  <option value="huggingface">HuggingFace (نماذج متنوعة)</option>
                  <option value="together">Together AI (FLUX.1 - سريع ومجاني للصور)</option>
                  <option value="pollinations">Pollinations.ai (مجاني للصور فقط)</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {provider === 'gemini' 
                  ? 'Gemini ممتاز لتوليد الصور والمحادثة باللغة العربية'
                  : provider === 'groq'
                  ? 'Groq يوفر Llama 3.3 بسرعة عالية وتكلفة منخفضة (لا يدعم الصور)'
                  : provider === 'huggingface'
                  ? 'HuggingFace يوفر نماذج متنوعة للصور والصوت والنصوص'
                  : provider === 'together'
                  ? 'Together AI يوفر FLUX.1 لتوليد الصور بسرعة عالية ومجاني'
                  : provider === 'pollinations'
                  ? 'Pollinations.ai مجاني تماماً لتوليد الصور (لا يحتاج مفتاح)'
                  : 'OpenAI يوفر GPT-4o للمحادثة و DALL-E لتوليد الصور'
                }
              </p>
            </div>

            <div>
              <Label htmlFor="api-key">مفتاح API الخاص بك</Label>
              {provider === 'pollinations' ? (
                <div className="mt-1 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-400">
                    ✅ Pollinations.ai لا يحتاج مفتاح API - مجاني تماماً
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative mt-1">
                    <Input
                      id="api-key"
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={provider === 'gemini' ? 'أدخل مفتاح Gemini API (يبدأ بـ AIza)' : provider === 'groq' ? 'أدخل مفتاح Groq API (يبدأ بـ gsk_)' : provider === 'huggingface' ? 'أدخل مفتاح HuggingFace API (يبدأ بـ hf_)' : provider === 'together' ? 'أدخل مفتاح Together AI API (يبدأ بـ key_)' : 'أدخل مفتاح OpenAI API (يبدأ بـ sk-)'}
                      className="bg-slate-900 border-slate-700 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    سيتم استخدام مفتاحك لجميع طلبات الذكاء الاصطناعي بدلاً من مفتاح النظام
                  </p>
                </>
              )}
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                testResult.valid ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
              }`}>
                {testResult.valid ? <CheckCircle className="size-4" /> : <XCircle className="size-4" />}
                <span className="text-sm">{testResult.message}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleTest}
                disabled={(provider !== 'pollinations' && !apiKey.trim()) || testing}
                variant="outline"
                className="flex-1"
              >
                {testing ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    جاري الاختبار...
                  </>
                ) : (
                  "اختبار المفتاح"
                )}
              </Button>
              <Button
                onClick={handleSave}
                disabled={(provider !== 'pollinations' && !apiKey.trim()) || saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="size-4 mr-2" />
                    حفظ المفتاح
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
