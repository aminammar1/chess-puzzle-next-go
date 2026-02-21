/**
 * Chess board sound effects using the Web Audio API.
 * No external files needed — all sounds are synthesised.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/* ── Low-level helpers ─────────────────────────────────────── */

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.15,
  rampDown = true,
) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    if (rampDown) {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Silently ignore — sound is non-critical
  }
}

function playNoise(duration: number, volume = 0.06) {
  try {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  } catch {
    // Silently ignore
  }
}

/* ── Public sound effects ──────────────────────────────────── */

/** Regular piece move — soft "click" */
export function playMoveSound() {
  playTone(600, 0.08, "sine", 0.12);
  playNoise(0.05, 0.04);
}

/** Piece capture — sharper click + low thud */
export function playCaptureSound() {
  playTone(300, 0.12, "triangle", 0.18);
  playNoise(0.08, 0.08);
  setTimeout(() => playTone(180, 0.1, "sine", 0.1), 30);
}

/** Check — rising double beep */
export function playCheckSound() {
  playTone(880, 0.1, "square", 0.1);
  setTimeout(() => playTone(1100, 0.12, "square", 0.12), 120);
}

/** Puzzle solved — ascending chime */
export function playSolvedSound() {
  playTone(523.25, 0.15, "sine", 0.12); // C5
  setTimeout(() => playTone(659.25, 0.15, "sine", 0.12), 120); // E5
  setTimeout(() => playTone(783.99, 0.18, "sine", 0.14), 240); // G5
  setTimeout(() => playTone(1046.5, 0.3, "sine", 0.16), 380);  // C6
}

/** Puzzle failed — descending minor */
export function playFailedSound() {
  playTone(440, 0.15, "triangle", 0.1);  // A4
  setTimeout(() => playTone(349.23, 0.2, "triangle", 0.1), 180); // F4
  setTimeout(() => playTone(293.66, 0.25, "triangle", 0.08), 360); // D4
}

/** Illegal move attempt — low buzz */
export function playIllegalSound() {
  playTone(150, 0.15, "sawtooth", 0.06);
}
