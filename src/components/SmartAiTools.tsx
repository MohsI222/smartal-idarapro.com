import React, { useState } from 'react';

export const SmartAiTools: React.FC = () => {
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  
  const [chatPrompt, setChatPrompt] = useState<string>('');
  const [chatResponse, setChatResponse] = useState<string>('');
  const [chatProvider, setChatProvider] = useState<string>('');

  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageProvider, setImageProvider] = useState<string>('');
  
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const [loadingImage, setLoadingImage] = useState<boolean>(false);
  
  // تسيير رسائل الأخطاء لكل قسم بشكل مستقل
  const [chatError, setChatError] = useState<string>('');
  const [imageError, setImageError] = useState<string>('');

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingChat(true);
    setChatError('');
    setChatResponse('');
    
    console.log('Sending chat request with prompt:', chatPrompt);
    
    try {
      // تأكد أن Devin ك يصيفط الهيدرز بهاد الطريقة النقية
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // ما نصيفطو المفتاح إلا يلا كان عامر ومكتوب وصحيح (ماشي غي نقط)
      if (geminiKey && geminiKey.trim() !== '' && geminiKey.length > 15 && !geminiKey.includes('...')) {
        headers['x-gemini-api-key'] = geminiKey.trim();
      }

      if (openaiKey && openaiKey.trim() !== '' && openaiKey.length > 15 && !openaiKey.includes('...')) {
        headers['x-openai-api-key'] = openaiKey.trim();
      }

      // طلب الـ API دابا غ يكون آمن 100%
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ prompt: chatPrompt }),
      });
      
      const data = await response.json();
      console.log('Chat response:', data);
      
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'فشل في الاتصال بسيرفر النصوص.');
      }
      
      setChatResponse(data.text);
      setChatProvider(data.provider);
    } catch (err: any) {
      console.error('Frontend Chat Error:', err);
      setChatError(err.message || 'حدث خطأ غير متوقع أثناء إرسال الطلب.');
    } finally {
      setLoadingChat(false);
    }
  };

  const handleImage = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingImage(true);
    setImageError('');
    setImageUrl('');
    
    try {
      // تأكد أن Devin ك يصيفط الهيدرز بهاد الطريقة النقية
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // ما نصيفطو المفتاح إلا يلا كان عامر ومكتوب وصحيح (ماشي غي نقط)
      if (openaiKey && openaiKey.trim() !== '' && openaiKey.length > 15 && !openaiKey.includes('...')) {
        headers['x-openai-api-key'] = openaiKey.trim();
      }

      // طلب الـ API دابا غ يكون آمن 100%
      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ prompt: imagePrompt }),
      });
      
      const data = await response.json();
      
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'فشل في توليد الصورة من السيرفر.');
      }
      
      setImageUrl(data.imageUrl);
      setImageProvider(data.provider);
    } catch (err: any) {
      console.error('Frontend Image Error:', err);
      setImageError(err.message || 'حدث خطأ غير متوقع أثناء توليد التصميم.');
    } finally {
      setLoadingImage(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-right" dir="rtl">
      
      {/* لوحة التحكم وإعداد المفاتيح */}
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="border-b pb-2">
          <h3 className="text-base font-bold text-slate-800">⚙️ إعدادات مفاتيح الـ API (اختياري / نظام هجين)</h3>
          <p className="text-xs text-slate-500 mt-1">إذا تركت الحقول فارغة، ستعمل منصة سمارت الإدارة برو تلقائياً بالنظام المجاني البديل والمحمي.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Gemini API Key:</label>
            <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="أدخل مفتاح Gemini الشخصي..." className="w-full p-2.5 border rounded-lg text-left dir-ltr text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">OpenAI API Key:</label>
            <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="أدخل مفتاح OpenAI الشخصي..." className="w-full p-2.5 border rounded-lg text-left dir-ltr text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* قسم الاستشارات والتقارير */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <form onSubmit={handleChat} className="space-y-4">
            <h3 className="text-lg font-bold text-indigo-600">💬 الاستشارات والتقارير الإدارية</h3>
            <textarea value={chatPrompt} onChange={(e) => setChatPrompt(e.target.value)} placeholder="اطلب صياغة قرار إداري، جدول عمل، أو تحليل بيانات..." className="w-full p-3 border rounded-lg h-28 resize-none text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            <button type="submit" disabled={loadingChat || !chatPrompt.trim()} className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm transition">
              {loadingChat ? 'جاري الصياغة الفورية...' : 'إرسال الطلب'}
            </button>
          </form>

          {/* عرض الأخطاء إن وجدت فـ قسم الشات */}
          {chatError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium">
              ⚠️ {chatError}
            </div>
          )}

          {/* عرض النتيجة */}
          {chatResponse && (
            <div className="p-4 bg-slate-50 rounded-lg max-h-60 overflow-y-auto text-slate-700 text-sm whitespace-pre-wrap border leading-relaxed">
              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold block w-fit mb-2">المزود: {chatProvider}</span>
              {chatResponse}
            </div>
          )}
        </div>

        {/* قسم توليد الصور واللوغوهات */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <form onSubmit={handleImage} className="space-y-4">
            <h3 className="text-lg font-bold text-emerald-600">🖼️ مؤلد القوالب والتصاميم الاحترافي</h3>
            <textarea value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="صف التصميم أو الشعار الإداري المطلوب بدقة باللغة العربية..." className="w-full p-3 border rounded-lg h-28 resize-none text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
            <button type="submit" disabled={loadingImage || !imagePrompt.trim()} className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm transition">
              {loadingImage ? 'جاري التصميم والمعالجة...' : 'توليد التصميم'}
            </button>
          </form>

          {/* هنا غ يبان الخطأ بشكل نقي ومستقر للمستخدم يلا تعطل السيرفر */}
          {imageError && (
            <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium leading-normal">
              ⚠️ {imageError}
            </div>
          )}

          {/* عرض الصورة الناتج كـ Base64 مستقر وبدون انقطاع روابط */}
          {imageUrl && (
            <div className="border rounded-lg overflow-hidden bg-slate-50 p-3 text-center flex flex-col items-center justify-center">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold inline-block mb-2">المزود: {imageProvider}</span>
              <div className="w-full h-44 flex justify-center items-center rounded bg-white border shadow-inner">
                <img src={imageUrl} alt="AI Smart Design" className="max-w-full max-h-full object-contain" />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
