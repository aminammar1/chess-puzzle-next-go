/**
 * Text-to-Speech utility for blind / accessibility users.
 * Uses the browser's built-in speechSynthesis API.
 *
 * Usage:
 *   speak("Your turn. Knight to f3.")
 *   speak("Puzzle solved!", { rate: 0.9 })
 */

let ttsEnabled = true;

/** Enable or disable TTS globally */
export function setTTSEnabled(on: boolean) {
  ttsEnabled = on;
  if (!on) stopSpeaking();
}

export function isTTSEnabled(): boolean {
  return ttsEnabled;
}

/** Speak text aloud. Cancels any current utterance first. */
export function speak(text: string, opts?: { rate?: number; pitch?: number; volume?: number }) {
  if (!ttsEnabled) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  // Cancel anything currently being spoken
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = opts?.rate ?? 1.05;
  utterance.pitch = opts?.pitch ?? 1.0;
  utterance.volume = opts?.volume ?? 0.9;
  utterance.lang = "en-US";

  // Try to pick a good English voice
  const voices = window.speechSynthesis.getVoices();
  const english = voices.find((v) => v.lang.startsWith("en") && v.localService)
    ?? voices.find((v) => v.lang.startsWith("en"));
  if (english) utterance.voice = english;

  window.speechSynthesis.speak(utterance);
}

/** Stop any current speech */
export function stopSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

/* ── Chess-specific announcement helpers ─────────────────── */

/** Announce a move in natural language: "Knight to f3" */
export function announceMove(san: string, isOpponent = false) {
  const prefix = isOpponent ? "Opponent plays " : "";
  speak(`${prefix}${sanToWords(san)}`);
}

/** Announce puzzle state changes */
export function announcePuzzleState(state: "your-turn" | "solved" | "failed" | "waiting" | "hint", extra?: string) {
  switch (state) {
    case "your-turn":
      speak(extra ? `Your turn. ${extra}` : "Your turn.");
      break;
    case "solved":
      speak("Puzzle solved! Well done.");
      break;
    case "failed":
      speak("Wrong move. Resetting puzzle.");
      break;
    case "waiting":
      speak("Opponent is thinking.");
      break;
    case "hint":
      speak(extra ? `Hint: look at ${extra}` : "Hint available.");
      break;
  }
}

/** Convert SAN notation to spoken words */
function sanToWords(san: string): string {
  if (!san) return "";

  // Castling
  if (san === "O-O") return "castles kingside";
  if (san === "O-O-O") return "castles queenside";

  let s = san;

  // Remove check/checkmate symbols for speech, announce separately
  const isCheck = s.includes("+");
  const isMate = s.includes("#");
  s = s.replace(/[+#]/g, "");

  // Piece names
  const pieces: Record<string, string> = {
    K: "King",
    Q: "Queen",
    R: "Rook",
    B: "Bishop",
    N: "Knight",
  };

  // Capture
  const isCapture = s.includes("x");
  s = s.replace("x", "");

  // Promotion
  let promoStr = "";
  const promoMatch = s.match(/=([QRBN])/);
  if (promoMatch) {
    promoStr = ` promotes to ${pieces[promoMatch[1]] ?? promoMatch[1]}`;
    s = s.replace(/=[QRBN]/, "");
  }

  // Extract piece + squares
  let result = "";
  if (s[0] && pieces[s[0]]) {
    result = pieces[s[0]] + " ";
    s = s.slice(1);
  }

  // Disambiguation (e.g., Nbd2 → "Knight b")
  // What's left should be [disambig]square
  if (s.length === 3) {
    result += `${s[0]} `;
    s = s.slice(1);
  }

  // Target square — spell it out: "e4" → "e 4"
  if (s.length === 2) {
    result += isCapture ? `takes ${s[0]} ${s[1]}` : `${s[0]} ${s[1]}`;
  } else {
    result += s;
  }

  result += promoStr;
  if (isMate) result += ", checkmate!";
  else if (isCheck) result += ", check";

  return result.trim();
}
