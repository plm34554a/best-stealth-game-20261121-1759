// All sound in The Gilded Hedge is synthesised with WebAudio — no audio files.
// Short oscillator blips: footsteps, key chimes, the alarm sting, the caught
// sting and the win arpeggio. Created lazily on first user input (browsers
// block audio before a gesture) and silenced with M.
let ctx = null;
let muted = false;
let padNodes = null;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

export function unlockAudio() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') c.resume();
}

export function toggleMute() {
  muted = !muted;
  if (padNodes) padNodes.gain.gain.value = muted ? 0 : 0.035;
  return muted;
}

export function isMuted() {
  return muted;
}

function blip(freq, dur, type, vol, when = 0, slideTo = null) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playStep(sprinting) {
  blip(sprinting ? 150 : 110, 0.07, 'triangle', sprinting ? 0.05 : 0.028);
}

export function playKey() {
  blip(880, 0.12, 'sine', 0.09);
  blip(1318, 0.18, 'sine', 0.07, 0.09);
}

export function playPebble() {
  blip(420, 0.08, 'square', 0.04, 0, 180);
}

export function playSuspicious() {
  blip(330, 0.16, 'sine', 0.06, 0, 415);
}

export function playAlarm() {
  blip(220, 0.22, 'sawtooth', 0.08, 0, 440);
  blip(440, 0.22, 'sawtooth', 0.06, 0.2, 220);
}

export function playCaught() {
  blip(196, 0.5, 'sawtooth', 0.1, 0, 65);
  blip(98, 0.7, 'triangle', 0.09, 0.1, 49);
}

export function playGate() {
  [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.22, 'sine', 0.07, i * 0.11));
}

export function playWin() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, 0.3, 'triangle', 0.08, i * 0.13));
}

/** A quiet two-note night pad that starts once the player first moves. */
export function startPad() {
  const c = ensureCtx();
  if (!c || padNodes) return;
  const gain = c.createGain();
  gain.gain.value = muted ? 0 : 0.035;
  gain.connect(c.destination);
  const oscs = [110, 164.8].map((f) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(gain);
    o.start();
    return o;
  });
  padNodes = { gain, oscs };
}
