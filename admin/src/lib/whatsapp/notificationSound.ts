"use client";

// Short two-tone chime for incoming WhatsApp messages, synthesized with
// WebAudio so no audio asset is needed. Browsers block audio until the user
// has interacted with the page, so failures are swallowed silently.

let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

export function playIncomingMessageSound(): void {
  if (typeof window === "undefined") return;

  // Throttle so a burst of messages doesn't stack into noise.
  const now = Date.now();
  if (now - lastPlayedAt < 800) return;
  lastPlayedAt = now;

  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    ctx = ctx ?? new Ctor();
    if (ctx.state === "suspended") void ctx.resume();

    const start = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const t = start + i * 0.12;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  } catch {
    // Autoplay blocked or audio unavailable — ignore.
  }
}
