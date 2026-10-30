// A short two-note chime for new orders, made with Web Audio (no sound file to load).
// Browsers only allow sound after the person has interacted with the page, so the first
// click anywhere "unlocks" it.

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  context ??= new AudioContext();
  return context;
}

export function unlockAudio() {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function playNewOrderChime() {
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime;
  [880, 1318.5].forEach((frequency, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const t = start + i * 0.16;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}
