/** فيديو WebM قصير (حتى 60 ثانية) من صور محلية — دون رفع لخادم. */

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load"));
    img.src = url;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cw: number,
  ch: number
): void {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = cw / ch;
  let dw = cw;
  let dh = ch;
  let ox = 0;
  let oy = 0;
  if (ir > cr) {
    dh = cw / ir;
    oy = (ch - dh) / 2;
  } else {
    dw = ch * ir;
    ox = (cw - dw) / 2;
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, ox, oy, dw, dh);
}

function pickMime(): string {
  const c = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const m of c) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

export async function buildSlideshowWebm(
  imageFiles: File[],
  opts?: { maxDurationMs?: number }
): Promise<Blob | null> {
  if (typeof MediaRecorder === "undefined" || imageFiles.length === 0) return null;
  const maxDurationMs = Math.min(60_000, Math.max(3000, opts?.maxDurationMs ?? 60_000));
  const cw = 1280;
  const ch = 720;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const urls = imageFiles.map((f) => URL.createObjectURL(f));
  try {
    const imgs = await Promise.all(urls.map((u) => loadImageFromUrl(u)));
    const slideMs = Math.min(12_000, Math.floor(maxDurationMs / imgs.length));
    const mime = pickMime();
    const stream = canvas.captureStream(24);
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    return await new Promise<Blob | null>((resolve) => {
      const base = mime.split(";")[0] || "video/webm";
      rec.onstop = () => {
        resolve(chunks.length ? new Blob(chunks, { type: base }) : null);
      };
      let start = 0;
      let raf = 0;
      const loop = (t: number) => {
        if (!start) start = t;
        const elapsed = t - start;
        const idx = Math.min(Math.floor(elapsed / slideMs), imgs.length - 1);
        drawCover(ctx, imgs[idx], cw, ch);
        if (elapsed >= maxDurationMs) {
          cancelAnimationFrame(raf);
          rec.stop();
          return;
        }
        raf = requestAnimationFrame(loop);
      };
      drawCover(ctx, imgs[0], cw, ch);
      rec.start(200);
      raf = requestAnimationFrame(loop);
    });
  } finally {
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
}
