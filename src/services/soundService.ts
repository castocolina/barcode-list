// Generate a 880 Hz beep as a WAV data URL — no audio file required.
// Lazy-initialised so the (cheap) computation runs only on first gesture.
function makeBeepUrl(): string {
  const sr = 22050;
  const dur = 0.15;
  const len = Math.ceil(sr * dur);
  const ab = new ArrayBuffer(44 + len * 2);
  const v = new DataView(ab);
  v.setUint32(0, 0x52494646, false); // RIFF
  v.setUint32(4, 36 + len * 2, true);
  v.setUint32(8, 0x57415645, false); // WAVE
  v.setUint32(12, 0x666d7420, false); // fmt
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  v.setUint32(36, 0x64617461, false); // data
  v.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 25); // fast decay
    v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 880 * t) * env * 0.5 * 32767), true);
  }
  const bytes = new Uint8Array(ab);
  let b64 = '';
  for (const b of bytes) b64 += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(b64)}`;
}

let audio: HTMLAudioElement | null = null;

// Register unlock handlers immediately so they fire on first user gesture.
// HTMLAudioElement.play() must be called from a gesture handler on iOS;
// once called (even silently), subsequent play() calls work without a gesture.
const ac = new AbortController();
function unlockAudio() {
  try {
    if (!audio) {
      audio = new Audio(makeBeepUrl());
      audio.volume = 0; // silent on unlock gesture — just primes iOS
    }
    const p = audio.play();
    if (p instanceof Promise) {
      p.then(() => { if (audio) audio.volume = 1; }).catch(() => undefined);
    }
  } catch { /* ignore */ }
  ac.abort(); // removes unlock listeners
}
document.addEventListener('touchstart', unlockAudio, { signal: ac.signal, passive: true });
document.addEventListener('click', unlockAudio, { signal: ac.signal, passive: true });

export function beep(): void {
  if (!audio) return; // no gesture yet
  try {
    audio.currentTime = 0;
    const p = audio.play();
    if (p instanceof Promise) p.catch(() => undefined);
  } catch { /* ignore */ }
}
