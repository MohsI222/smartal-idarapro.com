import { Request, Response, Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import sharp from 'sharp';

const aiRouter = Router();

const SYSTEM_INSTRUCTION = `أنْتَ المُسَاعِد الذَّكِي المُعْتَمَد لِمَنَصَّة "سْمَارْت الإِدَارَة بْرُو". أَجِب بِاحْتِرَافِيَّة عَالِيَّة وَتَنْظِيم إِدَارِي.`;

interface ChatBody { prompt?: string; message?: string; locale?: string; }
interface ImageBody { prompt: string; }

aiRouter.post('/chat', async (req: Request<{}, {}, ChatBody>, res: Response): Promise<void> => {
  try {
    const { prompt, message } = req.body;
    
    // قبول كلا الصيغتين: prompt أو message
    const actualPrompt = prompt || message;
    
    console.log('Chat Request Body:', req.body);
    console.log('Received prompt:', actualPrompt);
    
    if (!actualPrompt || actualPrompt.trim() === '') {
      console.log('Prompt validation failed - prompt is empty or undefined');
      res.status(400).json({ success: false, error: 'الرجاء كتابة السؤال' });
      return;
    }

    // جلب كاع السوارت الممكنة من الـ Headers وتنظيفها
    const rawGroq = (req.headers['x-groq-api-key'] as string || '').trim();
    const rawGemini = (req.headers['x-gemini-api-key'] as string || '').trim();
    const rawOpenai = (req.headers['x-openai-api-key'] as string || '').trim();

    // التحقق من صحة كل مفتاح (تجنب النصوص الفارغة أو النقط)
    const isGroqValid = rawGroq !== '' && rawGroq !== 'undefined' && !rawGroq.includes('...') && rawGroq.length > 15;
    const isGeminiValid = rawGemini !== '' && rawGemini !== 'undefined' && !rawGemini.includes('...') && rawGemini.length > 15;
    const isOpenaiValid = rawOpenai !== '' && rawOpenai !== 'undefined' && !rawOpenai.includes('...') && rawOpenai.length > 15;

    // إذا كان هناك مفتاح صحيح في headers، استخدمه مباشرة
    if (isGroqValid) {
      console.log("-> Running Direct GROQ Route (from header)");
      const response = await axios.post('https://api.groq.com/v1/chat/completions', {
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: actualPrompt }
        ]
      }, {
        headers: { 
          'Authorization': `Bearer ${rawGroq}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });
      res.json({ success: true, text: response.data.choices[0].message.content, provider: 'Groq (User Key)' });
      return;
    }

    if (isGeminiValid) {
      console.log("-> Running Direct Gemini Route (from header)");
      const genAI = new GoogleGenerativeAI(rawGemini);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: SYSTEM_INSTRUCTION });
      const response = await model.generateContent(actualPrompt);
      res.json({ success: true, text: response.response.text(), provider: 'Gemini (User Key)' });
      return;
    }

    if (isOpenaiValid) {
      console.log("-> Running Direct OpenAI Route (from header)");
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: actualPrompt }
        ]
      }, {
        headers: { 'Authorization': `Bearer ${rawOpenai}`, 'Content-Type': 'application/json' },
        timeout: 15000
      });
      res.json({ success: true, text: response.data.choices[0].message.content, provider: 'OpenAI (User Key)' });
      return;
    }

    // إذا لم يكن هناك مفتاح في headers، استخدم المفتاح العام من البيئة
    const envGeminiKey = process.env.GEMINI_API_KEY?.trim();
    if (envGeminiKey && envGeminiKey.length > 15) {
      console.log("-> Using Public Gemini API Key from environment");
      try {
        const genAI = new GoogleGenerativeAI(envGeminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: SYSTEM_INSTRUCTION });
        const response = await model.generateContent(actualPrompt);
        res.json({ success: true, text: response.response.text(), provider: 'Gemini (Public)' });
        return;
      } catch (envError: any) {
        console.error('Environment Gemini Key Error:', envError.response?.data || envError.message);
        // إذا فشل المفتاح العام، تابع للـ fallback
      }
    }

    // إذا لم يكن هناك مفتاح في headers ولا مفتاح عام صالح، حاول من قاعدة البيانات (إذا كان هناك userId)
    const userId = (req as any).userId;
    if (userId) {
      // هذا يتطلب db instance، لكن controller لا يملكه حالياً
      // لذا سنرجع خطأ يطلب من المستخدم إدخال مفتاح
      console.log("No API key in headers, userId exists but DB not accessible in controller");
      res.status(503).json({ 
        success: false, 
        error: 'يرجى إدخال مفتاح API في الإعدادات. يمكن استخدام مفاتيح Gemini (AIza...), Groq (gsk_), أو OpenAI (sk-).' 
      });
      return;
    }

    // إذا لم يكن هناك userId ولا مفتاح، استخدم fallback مجاني
    console.log("-> Running Anonymous Free Fallback");
    const fallbackResponse = await axios.post('https://text.pollinations.ai/', {
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: actualPrompt }
      ]
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000
    });

    res.json({ success: true, text: fallbackResponse.data, provider: 'SmartPro Free AI' });

  } catch (error: any) {
    console.error('AI Global Route Error:', error.response?.data || error.message);
    res.status(200).json({ 
      success: false, 
      error: 'فشل في الاتصال بمزود الذكاء الاصطناعي. يرجى إدخال مفتاح API صحيح في الإعدادات.' 
    });
  }
});

aiRouter.post('/generate-image', async (req: Request<{}, {}, ImageBody>, res: Response): Promise<void> => {
  try {
    const { prompt } = req.body;
    const rawOpenai = (req.headers['x-openai-api-key'] as string || '').trim();

    // تصفية صارمة: الساروت الحقيقي ماخصوش يكون خاوي، أو فيه غي نقط، أو قصير
    const isOpenaiValid = rawOpenai !== '' && rawOpenai !== 'undefined' && !rawOpenai.includes('...') && rawOpenai.length > 15;

    if (!prompt) {
      res.status(400).json({ success: false, error: 'الرجاء إدخال وصف الصورة' });
      return;
    }

    // الخيار 1: ساروت OpenAI حقيقي
    if (isOpenaiValid) {
      console.log("-> Running OpenAI Image Route");
      const response = await axios.post('https://api.openai.com/v1/images/generations', {
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'url'
      }, {
        headers: { Authorization: `Bearer ${rawOpenai}` },
        timeout: 45000
      });
      res.json({ success: true, imageUrl: response.data.data[0].url, provider: 'DALL-E 3 (User Key)' });
      return;
    }

    // الخيار 2 المجاني: ترجمة النص أولاً لتفادي مشاكل الحروف العربية
    let englishPrompt = prompt;
    try {
      const translationRes = await axios.post('https://text.pollinations.ai/', {
        messages: [
          { role: 'system', content: 'Translate the user description into a detailed English prompt for image generation. Return ONLY the English translation, no other text.' },
          { role: 'user', content: prompt }
        ],
        model: 'llama'
      }, { 
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (translationRes.data) {
        englishPrompt = translationRes.data.trim();
      }
    } catch (e) {
      console.log("فشلت الترجمة المؤقتة، سيتم استخدام النص الأصلي");
    }

    const encodedPrompt = encodeURIComponent(englishPrompt);
    const randomSeed = Math.floor(Math.random() * 999999);
    
    // الرابط 第一 (الأساسي): Pollinations
    const primaryUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&seed=${randomSeed}&enhance=true`;
    
    // الرابط الثاني (الاحتياطي): سيرفر Hugging Face العام (بلا ساروت) لنموذج Flux السريع
    const secondaryUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&seed=${randomSeed}&model=flux`;

    let imageBuffer: Buffer | null = null;
    let usedProvider = 'SmartPro Free Designer (Primary)';

    // محاولة الجلب من السيرفر الأساسي مع رفع الـ timeout لـ 30 ثانية
    try {
      console.log("جاري المحاولة من السيرفر الأساسي...");
      const response = await axios.get(primaryUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {}
      });
      imageBuffer = Buffer.from(response.data);
    } catch (primaryError) {
      console.warn("السيرفر الأساسي مضغوط، جاري التحويل للسيرفر الاحتياطي تلقائياً...");
      try {
        // المحاولة من السيرفر البديل (Flux)
        const fallbackResponse = await axios.get(secondaryUrl, { 
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {}
        });
        imageBuffer = Buffer.from(fallbackResponse.data);
        usedProvider = 'SmartPro Free Designer (Backup Flux Server)';
      } catch (secondaryError) {
        console.error("جميع السيرفرات المجانية مضغوطة حالياً");
      }
    }

    // إذا نجح السيستم فجلب الصورة من أحد السيرفرات
    if (imageBuffer) {
      // معالجة وضغط الصورة بـ Sharp لتقليل الحجم وتسريع العرض فـ الـ Frontend
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 80 })
        .toBuffer();

      const base64Image = `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`;

      res.json({ 
        success: true, 
        imageUrl: base64Image, 
        provider: usedProvider 
      });
      return;
    }

    // إذا فشلت جميع المحاولات (نادراً ما يحدث مع وجود السيرفر البديل)
    res.status(200).json({ 
      success: false, 
      error: 'جميع خدمات التوليد المجانية تشهد ضغطاً عالياً حالياً. يرجى إعادة المحاولة بعد ثوانٍ قليلة أو إدخال مفتاح API خاص.' 
    });

  } catch (error: any) {
    console.error('Fatal Image Route Error:', error.response?.data || error.message);
    res.status(200).json({ success: false, error: 'حدث خطأ غير متوقع في خادم الصور.' });
  }
});

export default aiRouter;
