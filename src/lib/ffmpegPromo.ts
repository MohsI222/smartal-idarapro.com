/**
 * محرك اختياري: FFmpeg.wasm لتحويل WebM (Canvas/MediaRecorder) إلى MP4
 * متوافق مع مشغلات أوسع. عند الفشل يُرجع null ويُستخدم WebM.
 */
const FFMPEG_CORE_VER = "0.12.10";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VER}/dist/esm`;

let loadPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

async function getLoadedFfmpeg(): Promise<import("@ffmpeg/ffmpeg").FFmpeg | null> {
  if (typeof window === "undefined") return null;
  if (!loadPromise) {
    loadPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })();
  }
  try {
    return await loadPromise;
  } catch {
    loadPromise = null;
    return null;
  }
}

export type FfmpegProgress = (ratio: number) => void;

/** يحوّل تدفق WebM إلى MP4 (H.264 + AAC إن وُجد صوت) — قد يستغرق وقتاً على الأجهزة الضعيفة */
export async function tryTranscodeWebmToMp4(
  webmBlob: Blob,
  onProgress?: FfmpegProgress
): Promise<Blob | null> {
  if (!webmBlob.size || webmBlob.size > 120 * 1024 * 1024) return null;
  const ffmpeg = await getLoadedFfmpeg();
  if (!ffmpeg) return null;
  const { fetchFile } = await import("@ffmpeg/util");
  try {
    ffmpeg.on("progress", ({ progress }) => onProgress?.(Math.min(1, Math.max(0, progress))));

    const input = "input.webm";
    const output = "output.mp4";
    await ffmpeg.writeFile(input, await fetchFile(webmBlob));

    await ffmpeg.exec([
      "-y",
      "-i",
      input,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "28",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      output,
    ]);

    const data = await ffmpeg.readFile(output);
    await ffmpeg.deleteFile(input).catch(() => undefined);
    await ffmpeg.deleteFile(output).catch(() => undefined);

    const u8 =
      data instanceof Uint8Array ? data : new Uint8Array(data as unknown as ArrayBuffer);
    return new Blob([u8], { type: "video/mp4" });
  } catch {
    return null;
  }
}
