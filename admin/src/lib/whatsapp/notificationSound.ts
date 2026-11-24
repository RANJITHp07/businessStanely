"use client";

// Two-note bell chime for incoming WhatsApp messages, synthesized with
// WebAudio so no audio asset is needed. Browsers block audio until the user
// has interacted with the page, so failures are swallowed silently.

let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

const MUTE_KEY = "wa-sound-muted";

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

function getContext(): AudioContext | null {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = ctx ?? new Ctor();
  return ctx;
}

// Browsers only allow audio after a user gesture. Create + resume the context
// on the first click/keypress so later chimes can play even when the tab is in
// the background or minimized.
let unlockInstalled = false;
export function installSoundUnlock(): void {
  if (typeof window === "undefined" || unlockInstalled) return;
  unlockInstalled = true;

  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const unlock = () => {
    try {
      const c = getContext();
      if (c && c.state === "suspended") void c.resume();
      if (c && c.state === "running") {
        events.forEach((e) => window.removeEventListener(e, unlock, true));
      }
    } catch {
      // ignore
    }
  };
  events.forEach((e) => window.addEventListener(e, unlock, true));
}

export function playIncomingMessageSound(): void {
  if (typeof window === "undefined" || isSoundMuted()) return;

  // Throttle so a burst of messages doesn't stack into noise.
  const now = Date.now();
  if (now - lastPlayedAt < 800) return;
  lastPlayedAt = now;

  try {
    const c = getContext();
    if (!c) return;
    ctx = c;
    if (ctx.state === "suspended") void ctx.resume();

    // Bell-style "ding-dong": two notes, each a fundamental plus an
    // inharmonic partial, with a longer decay so it is easy to notice.
    const start = ctx.currentTime;
    const notes = [
      { freq: 1319, at: 0 },
      { freq: 988, at: 0.28 },
    ];
    notes.forEach(({ freq, at }) => {
      [
        { mult: 1, peak: 0.3 },
        { mult: 2.76, peak: 0.1 },
      ].forEach(({ mult, peak }) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        const t = start + at;
        osc.type = "sine";
        osc.frequency.value = freq * mult;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        osc.connect(gain).connect(ctx!.destination);
        osc.start(t);
        osc.stop(t + 0.95);
      });
    });
  } catch {
    // Autoplay blocked or audio unavailable — ignore.
  }
}
