/**
 * Chess board sound effects using the Web Audio API.
 * Woody / realistic piece sounds — no external files needed.
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

function playNoise(duration: number, volume = 0.06, hpFreq = 800) {
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
    filter.frequency.setValueAtTime(hpFreq, ctx.currentTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  } catch {
    // Silently ignore
  }
}

/**
 * Simulate a woody "thunk" — a short low-mid resonant tap heard when
 * a wooden piece is set onto a wooden board surface.
 */
function playWoodyThunk(pitch = 320, vol = 0.18) {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // Main body — band-passed noise burst (wood resonance)
    const noiseLen = 0.06;
    const buf = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(pitch, t);
    bp.Q.setValueAtTime(3, t);

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.7, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + noiseLen);

    noise.connect(bp).connect(ng).connect(ctx.destination);
    noise.start(t);

    // Attack transient — very short high click
    const clickBuf = ctx.createBuffer(1, ctx.sampleRate * 0.008, ctx.sampleRate);
    const cd = clickBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1);
    const click = ctx.createBufferSource();
    click.buffer = clickBuf;

    const chp = ctx.createBiquadFilter();
    chp.type = "highpass";
    chp.frequency.setValueAtTime(2000, t);

    const cg = ctx.createGain();
    cg.gain.setValueAtTime(vol * 0.5, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.008);

    click.connect(chp).connect(cg).connect(ctx.destination);
    click.start(t);

    // Low resonant thud (the board vibrating)
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch * 0.6, t);
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol * 0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(og).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  } catch {
    // Silently ignore
  }
}

/* ── Public sound effects ──────────────────────────────────── */

/** Regular piece move — woody "place" sound */
export function playMoveSound() {
  playWoodyThunk(340, 0.16);
}

/** Piece capture — heavier thud + a little slide noise */
export function playCaptureSound() {
  playWoodyThunk(260, 0.24);
  playNoise(0.04, 0.06, 1200);        // scrape of captured piece
  setTimeout(() => playWoodyThunk(400, 0.1), 40);  // second tap
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
