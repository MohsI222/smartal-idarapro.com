/**
 * ترويسة بصرية (علم المغرب + الشعار + «المملكة المغربية») كصورة PNG Base64 —
 * لتفادي تشويه النص في html2canvas، مع خط Amiri/Cairo بعد التحميل في الصفحة.
 */

const KINGDOM_LINE = "المملكة المغربية";

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** علم المغرب مبسّط: حقل أحمر + نجمة خماسية خضراء */
function drawMoroccoFlag(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "#C1272D";
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  const r = Math.min(w, h) * 0.34;
  ctx.fillStyle = "#006233";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.38;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** نسخة رسومية من الشعار (نفس ألوان العلم) */
function drawMoroccoSeal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const r = Math.max(2, size * 0.06);
  ctx.fillStyle = "#C1272D";
  drawRoundedRect(ctx, x, y, size, size, r);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  ctx.fillStyle = "#006233";
  ctx.beginPath();
  ctx.moveTo(32, 10);
  ctx.lineTo(35.5, 22.5);
  ctx.lineTo(48, 22.5);
  ctx.lineTo(38, 30.5);
  ctx.lineTo(41.5, 43);
  ctx.lineTo(32, 35);
  ctx.lineTo(22.5, 43);
  ctx.lineTo(26, 30.5);
  ctx.lineTo(16, 22.5);
  ctx.lineTo(28.5, 22.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

async function ensureAmiriCairoFonts(): Promise<void> {
  const id = "idara-admin-pdf-fonts-amiri-cairo";
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@600;700&display=block";
    document.head.appendChild(link);
  }
  await document.fonts.ready.catch(() => undefined);
  await Promise.all([
    document.fonts.load("700 22px Amiri").catch(() => undefined),
    document.fonts.load("700 22px Cairo").catch(() => undefined),
  ]);
}

/** PNG (base64) — علم + شعار + نص المملكة */
export async function createKingdomHeaderImageDataUrl(): Promise<string> {
  await ensureAmiriCairoFonts();

  const DPR = 3;
  const W = 640;
  const H = 118;
  const canvas = document.createElement("canvas");
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  ctx.scale(DPR, DPR);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const flagW = 52;
  const flagH = 34;
  const sealS = 52;
  const gap = 16;
  const rowY = 10;
  const totalW = flagW + gap + sealS;
  const cx = W / 2;
  const startX = cx - totalW / 2;

  drawMoroccoFlag(ctx, startX, rowY + (sealS - flagH) / 2, flagW, flagH);
  drawMoroccoSeal(ctx, startX + flagW + gap, rowY, sealS);

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#003876";
  ctx.font = '700 20px Amiri, Cairo, "Noto Naskh Arabic", serif';
  ctx.fillText(KINGDOM_LINE, cx, rowY + sealS + 8);

  return canvas.toDataURL("image/png", 1);
}
