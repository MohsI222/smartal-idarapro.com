import { Request, Response, Router } from 'express';
import axios from 'axios';
import sharp from 'sharp';

const aiRouter = Router();

const SYSTEM_INSTRUCTION = `أنْتَ المُسَاعِد الذَّكِي المُعْتَمَد لِمَنَصَّة "سْمَارْت الإِدَارَة بْرُو". أَجِب بِاحْتِرَافِيَّة عَالِيَّة وَتَنْظِيم إِدَارِي.

IMPORTANT: Respond in the same language as the user's message:
- If user writes in Arabic (العربية), respond in Arabic
- If user writes in French (Français), respond in French  
- If user writes in Spanish (Español), respond in Spanish
- If user writes in English, respond in English

You are a multilingual assistant that can communicate fluently in Arabic, French, Spanish, and English.`;

interface ChatBody { prompt?: string; message?: string; locale?: string; }
interface ImageBody { prompt: string; }

aiRouter.post('/chat', async (req: Request<{}, {}, ChatBody>, res: Response): Promise<void> => {
  try {
    const { prompt, message, locale = 'ar-MA' } = req.body;
    const actualPrompt = prompt || message;
    
    if (!actualPrompt || actualPrompt.trim() === '') {
      res.status(400).json({ success: false, error: 'الرجاء كتابة السؤال' });
      return;
    }

    // جلب المفاتيح من الـ Headers
    const rawGroq = (req.headers['x-groq-api-key'] as string || '').trim();
    const rawGemini = (req.headers['x-gemini-api-key'] as string || '').trim();
    const rawOpenai = (req.headers['x-openai-api-key'] as string || '').trim();

    const isGroqValid = rawGroq !== '' && rawGroq !== 'undefined' && !rawGroq.includes('...') && rawGroq.length > 15;
    const isGeminiValid = rawGemini !== '' && rawGemini !== 'undefined' && !rawGemini.includes('...') && rawGemini.length > 15;
    const isOpenaiValid = rawOpenai !== '' && rawOpenai !== 'undefined' && !rawOpenai.includes('...') && rawOpenai.length > 15;

    if (isGroqValid) {
      const response = await axios.post('https://api.groq.com/v1/chat/completions', {
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: actualPrompt }
        ]
      }, {
        headers: { 'Authorization': `Bearer ${rawGroq}`, 'Content-Type': 'application/json' },
        timeout: 20000
      });
      res.json({ reply: response.data.choices[0].message.content, provider: 'Groq' });
      return;
    }

    if (isGeminiValid) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(rawGemini);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: SYSTEM_INSTRUCTION });
      const response = await model.generateContent(actualPrompt);
      res.json({ reply: response.response.text(), provider: 'Gemini' });
      return;
    }

    if (isOpenaiValid) {
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
      res.json({ reply: response.data.choices[0].message.content, provider: 'OpenAI' });
      return;
    }

    // Fallback مجاني - استخدام خدمة بسيطة
    try {
      // كشف اللغة من الرسالة
      const isArabic = /[\u0600-\u06FF]/.test(actualPrompt);
      const isFrench = /[àâäéèêëïîôùûüÿç]/i.test(actualPrompt);
      const isSpanish = /[áéíóúüñ¿¡]/i.test(actualPrompt);
      
      let languageInstruction = "Respond in English.";
      if (isArabic) languageInstruction = "أجب باللغة العربية فقط. Respond in Arabic only.";
      else if (isFrench) languageInstruction = "Répondez en français uniquement. Respond in French only.";
      else if (isSpanish) languageInstruction = "Responde en español solamente. Respond in Spanish only.";
      
      const fallbackResponse = await axios.post('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
        inputs: `<s>[INST] ${SYSTEM_INSTRUCTION}\n\n${languageInstruction}\n\nUser message: ${actualPrompt} [/INST]`,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7
        }
      }, {
        headers: { 
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      const reply = fallbackResponse.data?.[0]?.generated_text || fallbackResponse.data;
      const cleanReply = reply?.replace(/<s>\[INST\].*?\[\/INST\]/gs, '').trim() || reply;
      res.json({ reply: cleanReply, provider: 'HuggingFace' });
      return;
    } catch (hfError) {
      console.log('HuggingFace failed, trying alternative...');
    }

    // إذا فشل كل شيء، استخدم رد بسيط بناء على لغة الرسالة
    const isArabic = /[\u0600-\u06FF]/.test(actualPrompt);
    const isFrench = /[àâäéèêëïîôùûüÿç]|bonjour|comment|merci|s'il|vous|je suis|c'est/i.test(actualPrompt);
    const isSpanish = /[áéíóúüñ¿¡]|hola|gracias|por favor|buenos|días|noches|cómo|estás/i.test(actualPrompt);
    
    let offlineReply = 'Hello! I am your AI assistant. How can I help you today?';
    if (isArabic) {
      offlineReply = 'أهلاً بك! أنا مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟';
    } else if (isFrench) {
      offlineReply = 'Bonjour! Je suis votre assistant IA. Comment puis-je vous aider aujourd\'hui?';
    } else if (isSpanish) {
      offlineReply = '¡Hola! Soy tu asistente de IA. ¿Cómo puedo ayudarte hoy?';
    }
    
    res.json({ reply: offlineReply, provider: 'Offline' });

  } catch (error: any) {
    console.error('AI Chat Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'فشل في الاتصال بمزود الذكاء الاصطناعي' });
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
