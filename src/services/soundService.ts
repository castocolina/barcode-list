let ctx: AudioContext | null = null;

// Register unlock handlers immediately so they're ready before the first scan.
// On iOS, AudioContext starts suspended and requires a user gesture to resume.
const ac = new AbortController();
function unlockAudio() {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  } catch { /* ignore */ }
  ac.abort(); // removes all unlock listeners after first gesture
}
document.addEventListener('touchstart', unlockAudio, { signal: ac.signal, passive: true });
document.addEventListener('click', unlockAudio, { signal: ac.signal, passive: true });

export function beep(): void {
  if (!ctx || ctx.state !== 'running') return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.type = 'sine';
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.15);
}
