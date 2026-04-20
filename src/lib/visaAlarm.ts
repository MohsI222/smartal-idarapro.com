/** إنذار صوتي قوي حتى stopAlarm() — Web Audio (صفارات متعاقبة) */

let audioCtx: AudioContext | null = null;
const oscillators: OscillatorNode[] = [];
let sirenInterval: number | null = null;

export function isAlarmPlaying(): boolean {
  return oscillators.length > 0;
}

export function startAlarm(): void {
  stopAlarm();
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.38;
    gain.connect(ctx.destination);
    const makeOsc = (freq: number, type: OscillatorType) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(gain);
      o.start();
      oscillators.push(o);
    };

    makeOsc(880, "square");
    makeOsc(1320, "sawtooth");

    let toggle = false;
    sirenInterval = window.setInterval(() => {
      toggle = !toggle;
      try {
        oscillators[0]?.frequency.setTargetAtTime(toggle ? 1200 : 720, ctx.currentTime, 0.02);
        oscillators[1]?.frequency.setTargetAtTime(toggle ? 1800 : 960, ctx.currentTime, 0.02);
        gain.gain.setTargetAtTime(toggle ? 0.48 : 0.32, ctx.currentTime, 0.05);
      } catch {
        /* ignore */
      }
    }, 280);

    audioCtx = ctx;
  } catch {
    /* ignore */
  }
}

/** نغمة قصيرة عند فتح رابط السفارة */
export function playEmbassyOpenChime(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 720;
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    osc.start(t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    osc.stop(t0 + 0.22);
    osc.onended = () => {
      try {
        void ctx.close();
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* ignore */
  }
}

export function stopAlarm(): void {
  if (sirenInterval != null) {
    window.clearInterval(sirenInterval);
    sirenInterval = null;
  }
  for (const o of oscillators) {
    try {
      o.stop();
    } catch {
      /* ignore */
    }
  }
  oscillators.length = 0;
  try {
    void audioCtx?.close();
  } catch {
    /* ignore */
  }
  audioCtx = null;
}
