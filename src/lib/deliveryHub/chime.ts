/**
 * تنبيه صوتي مميز عند وصول طلب جديد — Delivery Hub new-order chime.
 * نغمتان صاعدتان (Web Audio API) — لا يحتاج ملف صوتي خارجي.
 */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new Ctor();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

export async function resumeDeliveryHubAudio(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    await ctx.resume().catch(() => undefined);
  }
}

/** نغمة تنبيه واضحة لطلب جديد (دينغ-دونغ) */
export function playNewOrderChime(): void {
  void (async () => {
    await resumeDeliveryHubAudio();
    const ctx = getAudioContext();
    if (!ctx) return;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    const notes: [number, number, number][] = [
      [0, 0.18, 880],
      [0.16, 0.22, 1174.66],
      [0.34, 0.3, 1567.98],
    ];
    for (const [start, dur, freq] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    }
  })();
}
