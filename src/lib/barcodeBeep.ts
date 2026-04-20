/**
 * صوت «بيب» قوي فوراً عند قراءة باركود — Web Audio API.
 * يستأنف السياق تلقائياً بعد تفاعل المستخدم (تشغيل الكاميرا).
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

export async function resumeAudioIfNeeded(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    await ctx.resume().catch(() => undefined);
  }
}

/** نغمة عالية التردد فوراً — مسموعة بوضوح عند القراءة */
export function playBarcodeScanBeep(): void {
  void (async () => {
    await resumeAudioIfNeeded();
    const ctx = getAudioContext();
    if (!ctx) return;
    const master = ctx.createGain();
    master.gain.value = 0.58;
    master.connect(ctx.destination);
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 2480;
    osc.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.06);
  })();
}
