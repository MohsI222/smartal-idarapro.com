/**
 * فيديو إشهاري «سينمائي» محلي: تدرج هوية المنصة، نصوص، انتقالات، فلاتر، وموسيقى اختيارية.
 * المدة القصوى 60 ثانية.
 */

function loadImageUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img"));
    img.src = url;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cw: number,
  ch: number,
  zoom: number,
  panX: number,
  panY: number
): void {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = cw / ch;
  let dw = cw * zoom;
  let dh = ch * zoom;
  if (ir > cr) {
    dh = dw / ir;
  } else {
    dw = dh * ir;
  }
  const ox = (cw - dw) / 2 + panX;
  const oy = (ch - dh) / 2 + panY;
  ctx.fillStyle = "#050a12";
  ctx.fillRect(0, 0, cw, ch);
  ctx.filter = "contrast(1.08) saturate(1.18) brightness(1.03)";
  ctx.drawImage(img, ox, oy, dw, dh);
  ctx.filter = "none";
}

function drawBrandOverlay(ctx: CanvasRenderingContext2D, cw: number, ch: number, t: number): void {
  const g = ctx.createLinearGradient(0, 0, cw, ch);
  g.addColorStop(0, `rgba(0, 82, 204, ${0.28 + 0.06 * Math.sin(t * 0.002)})`);
  g.addColorStop(0.55, "rgba(10, 22, 40, 0.15)");
  g.addColorStop(1, `rgba(255, 140, 0, ${0.22 + 0.05 * Math.cos(t * 0.002)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);

  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  const scan = ctx.createLinearGradient(0, 0, 0, ch);
  scan.addColorStop(0, `rgba(255,255,255,${0.03 + 0.02 * Math.sin(t * 0.004)})`);
  scan.addColorStop(0.5, "rgba(0,40,120,0.06)");
  scan.addColorStop(1, `rgba(255,140,0,${0.04 + 0.03 * Math.cos(t * 0.003)})`);
  ctx.fillStyle = scan;
  ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = `rgba(0, 200, 255, ${0.12 + 0.08 * Math.sin(t * 0.0015)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cw * 0.08 + (cw * 0.84 * (t * 0.0001) % 1), 0);
  ctx.lineTo(cw * 0.12 + (cw * 0.76 * (t * 0.0001) % 1), ch);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.035;
  for (let y = 0; y < ch; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.15)";
    ctx.fillRect(0, y, cw, 2);
  }
  ctx.restore();
}

function drawCaptions(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  headline: string,
  tagline: string,
  phase: number,
  slideIdx: number,
  slideCount: number,
  elapsedMs: number
): void {
  const a = Math.min(1, phase);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `bold ${Math.round(cw * 0.045)}px "Noto Naskh Arabic", "Segoe UI", sans-serif`;
  ctx.fillText(headline.slice(0, 80), cw / 2, ch * 0.68, cw * 0.88);
  ctx.font = `${Math.round(cw * 0.026)}px "Noto Naskh Arabic", "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(tagline.slice(0, 120), cw / 2, ch * 0.745, cw * 0.9);
  const beat = Math.floor(elapsedMs / 1800) % 2;
  const dynamicSub =
    beat === 0
      ? `◆ ${slideIdx + 1} / ${slideCount} ◆`
      : tagline.trim()
        ? tagline.slice(0, 90)
        : "Cinematic storyboard";
  ctx.font = `${Math.round(cw * 0.022)}px "Noto Naskh Arabic", "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(200,245,255,0.95)";
  ctx.fillText(dynamicSub, cw / 2, ch * 0.805, cw * 0.88);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `${Math.round(cw * 0.018)}px sans-serif`;
  const foot = headline.trim().slice(0, 52) || " ";
  ctx.fillText(foot, cw / 2, ch * 0.93);
  ctx.restore();
}

function pickMime(): string {
  const c = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const m of c) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

export type CinematicOpts = {
  files: File[];
  headline: string;
  tagline: string;
  maxDurationMs?: number;
  audioFile?: File | null;
};

export async function buildCinematicPromoWebm(opts: CinematicOpts): Promise<Blob | null> {
  const { files, headline, tagline, audioFile } = opts;
  const maxDurationMs = Math.min(60_000, Math.max(4000, opts.maxDurationMs ?? 60_000));
  if (typeof MediaRecorder === "undefined" || files.length === 0) return null;

  const cw = 1920;
  const ch = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const urls = files.map((f) => URL.createObjectURL(f));
  try {
    const imgs = await Promise.all(urls.map((u) => loadImageUrl(u)));
    const n = imgs.length;
    const slideMs = Math.min(14_000, Math.floor(maxDurationMs / n));
    const mime = pickMime();

    let audioCtx: AudioContext | null = null;
    let audioDest: MediaStreamAudioDestinationNode | null = null;
    if (audioFile && audioFile.size > 0) {
      try {
        audioCtx = new AudioContext();
        const buf = await audioFile.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(buf);
        const src = audioCtx.createBufferSource();
        src.buffer = decoded;
        const gain = audioCtx.createGain();
        gain.gain.value = 0.35;
        audioDest = audioCtx.createMediaStreamDestination();
        src.connect(gain);
        gain.connect(audioDest);
        src.start(0);
      } catch {
        audioCtx?.close().catch(() => undefined);
        audioCtx = null;
        audioDest = null;
      }
    }

    const canvasStream = canvas.captureStream(24);
    const tracks = [...canvasStream.getVideoTracks()];
    if (audioDest) tracks.push(...audioDest.stream.getAudioTracks());
    const merged = new MediaStream(tracks);

    const chunks: Blob[] = [];
    const rec = new MediaRecorder(merged, { mimeType: mime, videoBitsPerSecond: 3_000_000 });
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    return await new Promise<Blob | null>((resolve) => {
      const base = mime.split(";")[0] || "video/webm";
      rec.onstop = () => {
        try {
          audioCtx?.close();
        } catch {
          /* ignore */
        }
        resolve(chunks.length ? new Blob(chunks, { type: base }) : null);
      };

      let start = 0;
      let raf = 0;
      const loop = (t: number) => {
        if (!start) start = t;
        const elapsed = t - start;
        const idx = Math.min(Math.floor(elapsed / slideMs), n - 1);
        const nextIdx = Math.min(idx + 1, n - 1);
        const slideProgress = (elapsed % slideMs) / slideMs;
        const zoom = 1 + 0.07 * slideProgress;
        const pan = 12 * Math.sin(slideProgress * Math.PI);

        ctx.save();
        if (slideProgress > 0.88 && idx < n - 1) {
          const blend = (slideProgress - 0.88) / 0.12;
          drawCover(ctx, imgs[idx], cw, ch, zoom, pan, 0);
          ctx.globalAlpha = blend;
          drawCover(ctx, imgs[nextIdx], cw, ch, 1.02, -pan, 0);
          ctx.globalAlpha = 1;
        } else {
          drawCover(ctx, imgs[idx], cw, ch, zoom, pan, 0);
        }
        ctx.restore();

        drawBrandOverlay(ctx, cw, ch, elapsed);
        const capPhase = Math.min(1, elapsed / 1200);
        drawCaptions(
          ctx,
          cw,
          ch,
          headline || "Your headline",
          tagline || "",
          capPhase,
          idx,
          n,
          elapsed
        );

        if (elapsed >= maxDurationMs) {
          cancelAnimationFrame(raf);
          rec.stop();
          return;
        }
        raf = requestAnimationFrame(loop);
      };

      rec.start(250);
      drawCover(ctx, imgs[0], cw, ch, 1, 0, 0);
      drawBrandOverlay(ctx, cw, ch, 0);
      drawCaptions(ctx, cw, ch, headline || "Smart Al-Idara Pro", tagline || "", 0.5, 0, n, 0);
      raf = requestAnimationFrame(loop);
    });
  } finally {
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
}
