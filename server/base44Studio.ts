import type { Express, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import sharp from "sharp";

type AuthMw = (req: Request, res: Response, next: () => void) => void;

function serverOrigin(): string {
  return (
    process.env.PUBLIC_API_URL?.trim().replace(/\/$/, "") ||
    `http://127.0.0.1:${Number(process.env.PORT ?? 4000)}`
  );
}

export function registerBase44StudioRoutes(
  app: Express,
  opts: {
    authMiddleware: AuthMw;
    uploadDir: string;
    aiGenerateAllowed: (userId: string, module: string) => boolean;
  }
): void {
  const { authMiddleware, uploadDir, aiGenerateAllowed } = opts;
  const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 },
  });

  async function readAssetImage(id: string): Promise<Buffer | null> {
    const p = path.join(uploadDir, `b44-${id}.jpg`);
    if (!fs.existsSync(p)) return null;
    return fs.promises.readFile(p);
  }

  async function resolveSourceBuffer(image_url: string): Promise<Buffer> {
    const trimmed = image_url.trim();
    const m = trimmed.match(/\/api\/studio\/base44\/asset\/([a-f0-9-]{36})/i);
    if (m) {
      const buf = await readAssetImage(m[1]);
      if (buf) return buf;
    }
    if (trimmed.startsWith("data:")) {
      const i = trimmed.indexOf("base64,");
      if (i < 0) throw new Error("bad_data_url");
      return Buffer.from(trimmed.slice(i + 7), "base64");
    }
    const url = trimmed.startsWith("http")
      ? trimmed
      : `${serverOrigin()}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch_image_${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }

  app.get("/api/studio/base44/asset/:id", (req, res) => {
    const id = String(req.params.id || "").replace(/[^\w-]/g, "");
    if (!id) {
      res.status(400).end();
      return;
    }
    const p = path.join(uploadDir, `b44-${id}.jpg`);
    if (!fs.existsSync(p)) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", "image/jpeg");
    res.sendFile(p);
  });

  app.get("/api/studio/base44/video-frame/:job/:index", (req, res) => {
    const job = String(req.params.job || "").replace(/[^\w-]/g, "");
    const index = String(req.params.index || "").replace(/[^\d]/g, "");
    if (!job || !index) {
      res.status(400).end();
      return;
    }
    const p = path.join(uploadDir, `b44-vid-${job}-f${index}.jpg`);
    if (!fs.existsSync(p)) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", "image/jpeg");
    res.sendFile(p);
  });

  app.post(
    "/api/studio/base44/upload",
    authMiddleware,
    memoryUpload.single("file"),
    async (req, res) => {
      const userId = (req as Request & { userId: string }).userId;
      if (!aiGenerateAllowed(userId, "mediaLab")) {
        res.status(403).json({ error: "القسم غير مفعّل أو انتهى الاشتراك" });
        return;
      }
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file?.buffer) {
        res.status(400).json({ error: "ملف ناقص" });
        return;
      }
      try {
        const id = randomUUID();
        const outPath = path.join(uploadDir, `b44-${id}.jpg`);
        await sharp(file.buffer).rotate().jpeg({ quality: 88 }).toFile(outPath);
        res.json({ file_url: `/api/studio/base44/asset/${id}` });
      } catch (e) {
        console.error("[base44 upload]", e);
        res.status(500).json({ error: "فشل الرفع" });
      }
    }
  );

  app.post("/api/studio/base44/generate-image", authMiddleware, async (req, res) => {
    const userId = (req as Request & { userId: string }).userId;
    if (!aiGenerateAllowed(userId, "mediaLab")) {
      res.status(403).json({ error: "القسم غير مفعّل أو انتهى الاشتراك" });
      return;
    }
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({ error: "توليد الصور غير مفعّل على الخادم" });
      return;
    }
    const body = req.body as { prompt?: string; size?: string; existing_image_urls?: string[] };
    let prompt = (body.prompt ?? "").trim().slice(0, 4000);
    if (!prompt.length) {
      res.status(400).json({ error: "الوصف ناقص" });
      return;
    }
    const sizeRaw = body.size ?? "1024x1024";
    const size =
      sizeRaw === "1792x1024" || sizeRaw === "1024x1792" || sizeRaw === "1024x1024"
        ? sizeRaw
        : "1024x1024";

    if (body.existing_image_urls?.length) {
      try {
        const buf = await resolveSourceBuffer(body.existing_image_urls[0]);
        const b64 = buf.toString("base64");
        const vr = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 500,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Describe this image briefly in one English sentence (max 40 words) for use in an image generation prompt: subjects, palette, layout.",
                  },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${b64}` },
                  },
                ],
              },
            ],
          }),
        });
        const vj = (await vr.json()) as { choices?: { message?: { content?: string } }[] };
        const desc = vj.choices?.[0]?.message?.content?.trim();
        if (desc) prompt = `${prompt}\nVisual reference: ${desc}`.slice(0, 4000);
      } catch {
        /* text prompt only */
      }
    }

    try {
      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size,
          quality: "hd",
          response_format: "b64_json",
        }),
      });
      const json = (await r.json()) as {
        data?: { b64_json?: string }[];
        error?: { message?: string };
      };
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) {
        const msg = json.error?.message ?? `openai_images_${r.status}`;
        res.status(r.ok ? 502 : r.status).json({ error: msg });
        return;
      }
      res.json({ url: `data:image/png;base64,${b64}` });
    } catch {
      res.status(500).json({ error: "فشل الاتصال بتوليد الصورة" });
    }
  });

  app.post("/api/studio/base44/invoke-llm", authMiddleware, async (req, res) => {
    const userId = (req as Request & { userId: string }).userId;
    if (!aiGenerateAllowed(userId, "mediaLab")) {
      res.status(403).json({ error: "القسم غير مفعّل أو انتهى الاشتراك" });
      return;
    }
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({ error: "مفتاح OpenAI غير مضبوط" });
      return;
    }
    const body = req.body as {
      prompt?: string;
      file_urls?: string[];
      response_json_schema?: unknown;
    };
    const prompt = (body.prompt ?? "").trim();
    if (!prompt.length) {
      res.status(400).json({ error: "نص ناقص" });
      return;
    }

    const wantJson = Boolean(body.response_json_schema);
    const contentParts: (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    )[] = [{ type: "text", text: prompt }];

    if (body.file_urls?.length) {
      for (const u of body.file_urls.slice(0, 4)) {
        try {
          const buf = await resolveSourceBuffer(u);
          const b64 = buf.toString("base64");
          contentParts.push({
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${b64}` },
          });
        } catch {
          /* skip broken url */
        }
      }
    }

    const sys = wantJson
      ? "You reply with JSON only. Match the user's requested structure as closely as possible."
      : "You are a helpful assistant.";

    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: wantJson ? 4096 : 1200,
          response_format: wantJson ? { type: "json_object" } : undefined,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: contentParts },
          ],
        }),
      });
      const data = (await r.json()) as {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
      };
      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text) {
        res.status(502).json({ error: data.error?.message ?? "empty_llm" });
        return;
      }
      if (wantJson) {
        try {
          res.json(JSON.parse(text));
        } catch {
          res.json({ raw: text });
        }
      } else {
        res.json(text);
      }
    } catch {
      res.status(500).json({ error: "فشل الاتصال بالنموذج" });
    }
  });

  app.post(
    "/api/studio/base44/functions/:name",
    authMiddleware,
    async (req, res) => {
      const userId = (req as Request & { userId: string }).userId;
      if (!aiGenerateAllowed(userId, "mediaLab")) {
        res.status(403).json({ error: "القسم غير مفعّل أو انتهى الاشتراك" });
        return;
      }
      const name = String(req.params.name || "");
      if (name !== "generateBuiltInVideo") {
        res.status(404).json({ error: "function_not_found" });
        return;
      }
      const body = req.body as {
        image_url?: string;
        prompt?: string;
        ratio?: string;
        duration?: number;
        motion_score?: number;
      };
      const image_url = String(body.image_url ?? "").trim();
      if (!image_url) {
        res.status(400).json({ data: { error: "image_url مطلوب", status: "error" } });
        return;
      }
      let prompt = String(body.prompt ?? "").trim() || "Cinematic motion, smooth camera, professional lighting";
      const duration = Math.min(120, Math.max(5, Number(body.duration) || 30));
      const ratio = String(body.ratio ?? "16:9");
      const motionScore = Math.min(100, Math.max(1, Number(body.motion_score) || 70));
      prompt = `${prompt}\nMotion intensity (user score): ${motionScore}/100.`.slice(0, 4000);

      try {
        const src = await resolveSourceBuffer(image_url);
        const job = randomUUID().slice(0, 12);
        const base = await sharp(src).rotate().jpeg({ quality: 90 }).toBuffer();
        const meta = await sharp(base).metadata();
        const w = meta.width ?? 1024;
        const h = meta.height ?? 1024;

        const m = motionScore / 100;
        const zoomFactor = 0.88 + (1 - m) * 0.06;
        const cropW2 = Math.max(1, Math.round(w * zoomFactor));
        const cropH2 = Math.max(1, Math.round(h * zoomFactor));
        const left2 = Math.max(0, Math.round((w - cropW2) / 2));
        const top2 = Math.max(0, Math.round((h - cropH2) / 2));

        const pipelines: sharp.Sharp[] = [
          sharp(base).resize(1280, 1280, { fit: "inside" }).jpeg({ quality: 86 }),
          sharp(src)
            .rotate()
            .extract({ left: left2, top: top2, width: cropW2, height: cropH2 })
            .resize(1280, 1280, { fit: "inside" })
            .jpeg({ quality: 86 }),
          sharp(base)
            .modulate({ brightness: 1 + 0.05 * m, saturation: 1 + 0.08 * m })
            .jpeg({ quality: 86 }),
          sharp(base)
            .gamma(1 + 0.03 * m)
            .sharpen({ sigma: 0.35 + 0.35 * m })
            .jpeg({ quality: 86 }),
        ];

        const frames: string[] = [];
        for (let i = 0; i < pipelines.length; i++) {
          const outp = path.join(uploadDir, `b44-vid-${job}-f${i}.jpg`);
          await pipelines[i].toFile(outp);
          frames.push(`/api/studio/base44/video-frame/${job}/${i}`);
        }

        const perSlice = Math.max(2, Math.round(duration / frames.length));
        const assembly = [
          `تعليمات التجميع (محرك الإطارات المضمّن):`,
          `• نسبة العرض: ${ratio} — طول مستهدف ~${duration}ث.`,
          `• شدة الحركة (من الواجهة): ${motionScore}/100`,
          `• رتّب الإطارات 1→2→3→4 بانتقال dissolve أو slide خفيف (~${perSlice}ث لكل إطار).`,
          `• أضف حركة كاميرا بسيطة عبر تحريك المقطع (pan/zoom 2–4%).`,
          `• المزاج البصري: ${prompt.slice(0, 200)}`,
          `• صدَر بصيغة MP4 أو WebM من محرر فيديو بسيط بعد تنزيل الإطارات.`,
        ].join("\n");

        res.json({
          data: {
            status: "ok",
            frames,
            assembly_instructions: assembly,
            engine: "Built-in frame engine (Sharp)",
            duration_sec: duration,
            ratio,
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "فشل توليد الإطارات";
        console.error("[generateBuiltInVideo]", e);
        res.status(500).json({
          data: { error: msg, status: "error", details: String(msg) },
        });
      }
    }
  );
}
