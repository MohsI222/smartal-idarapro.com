/** معالجة محلية قوية: رفع دقة العرض (DPI الفعلي)، تشبع، وحدة Unsharp */

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** Per-channel histogram stretch — classic auto-levels before tone/saturation tweaks. */
function autoLevelsPerChannel(data: Uint8ClampedArray): void {
  for (let ch = 0; ch < 3; ch++) {
    let minV = 255;
    let maxV = 0;
    for (let i = ch; i < data.length; i += 4) {
      const v = data[i];
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const span = maxV - minV;
    if (span < 6) continue;
    const scale = 255 / span;
    for (let i = ch; i < data.length; i += 4) {
      data[i] = clampByte((data[i] - minV) * scale);
    }
  }
}

function meanLuminance(imageData: ImageData): number {
  const d = imageData.data;
  let sum = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  return sum / n;
}

function saturateRgbInPlace(d: Uint8ClampedArray, factor: number): void {
  for (let i = 0; i < d.length; i += 4) {
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    const ns = Math.min(1, s * factor);
    const [r, g, b] = hslToRgb(h, ns, l);
    d[i] = clampByte(r);
    d[i + 1] = clampByte(g);
    d[i + 2] = clampByte(b);
  }
}

function boxBlurGray(src: Float32Array, w: number, h: number, rad: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const r = rad;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) {
      const xx = Math.min(w - 1, Math.max(0, x));
      sum += src[y * w + xx];
    }
    for (let x = 0; x < w; x++) {
      if (x > r) sum -= src[y * w + (x - r - 1)];
      if (x + r < w) sum += src[y * w + (x + r)];
      tmp[y * w + x] = sum / (2 * r + 1);
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) {
      const yy = Math.min(h - 1, Math.max(0, y));
      sum += tmp[yy * w + x];
    }
    for (let y = 0; y < h; y++) {
      if (y > r) sum -= tmp[(y - r - 1) * w + x];
      if (y + r < h) sum += tmp[(y + r) * w + x];
      out[y * w + x] = sum / (2 * r + 1);
    }
  }
  return out;
}

function luminanceFloat(d: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    g[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  return g;
}

function unsharpRgb(imageData: ImageData, amount: number, blurRad: number): void {
  const w = imageData.width;
  const h = imageData.height;
  const d = imageData.data;
  const lum = luminanceFloat(d, w, h);
  const blurred = boxBlurGray(boxBlurGray(lum, w, h, blurRad), w, h, blurRad);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const high = lum[i] - blurred[i];
      const f = 1 + (amount * high) / Math.max(1, lum[i]);
      const o = i * 4;
      d[o] = clampByte(d[o] * f);
      d[o + 1] = clampByte(d[o + 1] * f);
      d[o + 2] = clampByte(d[o + 2] * f);
    }
  }
}

/**
 * تحسين احترافي: تكبير ذكي (زيادة دقة الملف)، تشبع أعلى، تلقيم ضوئي، Unsharp.
 * يُستدعى من زر «تحسين» لإظهار فرق واضح قبل/بعد.
 */
export async function enhanceImageFileToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("load"));
      i.src = url;
    });

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    /** زيادة DPI الفعلية: تكبير حتى حد أدنى ~1400px للضلع الأطول (مع سقف) */
    const longSide = Math.max(iw, ih);
    const targetLong = Math.min(2560, Math.max(1400, longSide * (longSide < 900 ? 2 : longSide < 1400 ? 1.65 : 1.35)));
    const scaleUp = targetLong / longSide;
    let w = Math.round(iw * scaleUp);
    let h = Math.round(ih * scaleUp);
    const maxDim = 2560;
    if (Math.max(w, h) > maxDim) {
      const s = maxDim / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("ctx");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.filter = "contrast(1.14) saturate(1.12) brightness(1.04)";
    ctx.drawImage(img, 0, 0, w, h);
    ctx.filter = "none";

    let id = ctx.getImageData(0, 0, w, h);
    autoLevelsPerChannel(id.data);
    const lum0 = meanLuminance(id);
    if (lum0 > 0 && lum0 < 215) {
      const gain = Math.min(1.28, Math.max(0.9, 122 / lum0));
      const dd = id.data;
      for (let i = 0; i < dd.length; i += 4) {
        dd[i] = clampByte(dd[i] * gain);
        dd[i + 1] = clampByte(dd[i + 1] * gain);
        dd[i + 2] = clampByte(dd[i + 2] * gain);
      }
    }
    saturateRgbInPlace(id.data, 1.38);
    ctx.putImageData(id, 0, 0);
    id = ctx.getImageData(0, 0, w, h);
    unsharpRgb(id, 0.85, 2);
    ctx.putImageData(id, 0, 0);

    return canvas.toDataURL("image/png", 0.96);
  } finally {
    URL.revokeObjectURL(url);
  }
}
