let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    document.addEventListener(
      'touchstart',
      () => ctx?.state === 'suspended' && ctx.resume(),
      { once: true }
    );
  }
  return ctx;
}

export function beep(): void {
  const context = getContext();
  if (context.state === 'suspended') return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.type = 'sine';
  oscillator.frequency.value = 440;
  gain.gain.value = 0.3;
  oscillator.start();
  oscillator.stop(context.currentTime + 0.08);
}
