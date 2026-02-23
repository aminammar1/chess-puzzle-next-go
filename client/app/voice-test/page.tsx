"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/theme";
import { playMoveSound, playCaptureSound } from "@/lib/sounds";
import Navbar from "@/components/layout/Navbar";
import Tooltip from "@/components/ui/Tooltip";
import Switch from "@/components/ui/Switch";
import Chip from "@/components/ui/Chip";
import Card, { CardBody } from "@/components/ui/Card";
import Divider from "@/components/ui/Divider";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type MicStatus = "idle" | "listening" | "processing" | "success" | "error";

export default function VoiceTestPage() {
  const { colors } = useTheme();
  /* ── game state ─────────────────────────────── */
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(INITIAL_FEN);
  const [orientation] = useState<"white" | "black">("white");
  const [selected, setSelected] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // Full move history & browsing index
  const [moveHistory, setMoveHistory] = useState<{ san: string; fen: string; from: string; to: string }[]>([]);
  const [viewIndex, setViewIndex] = useState(-1); // -1 = live position

  const game = gameRef.current;
  const isLive = viewIndex === -1 || viewIndex === moveHistory.length - 1;
  const displayFen = isLive ? fen : moveHistory[viewIndex]?.fen ?? fen;

  /* ── Voice ─────────────────────────────────── */
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [parsedSan, setParsedSan] = useState("");
  const [voiceError, setVoiceError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const useFallbackRef = useRef(false); // true = browser STT failed, use server-side
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Auto / continuous mode ────────────────── */
  const [autoMode, setAutoMode] = useState(false);
  const autoModeRef = useRef(false);
  const autoRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);

  /* ── helpers ───────────────────────────────── */
  const currentTurn = game.turn(); // "w" | "b"

  const getLegalTargets = useCallback(
    (sq: string): string[] => {
      try {
        return game.moves({ square: sq as Square, verbose: true }).map((m) => m.to);
      } catch {
        return [];
      }
    },
    [game],
  );

  /** Only the side to move can pick up pieces */
  function isMovablePiece(sq: string): boolean {
    const p = game.get(sq as Square);
    if (!p) return false;
    return p.color === currentTurn;
  }

  const applyMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      try {
        const move = game.move({
          from: from as Square,
          to: to as Square,
          promotion: (promotion ?? undefined) as "q" | "r" | "b" | "n" | undefined,
        });
        if (!move) return false;
        const newFen = game.fen();
        setFen(newFen);
        setLastMove({ from, to });
        setMoveHistory((prev) => [...prev, { san: move.san, fen: newFen, from: move.from, to: move.to }]);
        setViewIndex(-1);
        setSelected(null);
        setTargets([]);
        if (move.captured) playCaptureSound();
        else playMoveSound();
        return true;
      } catch {
        return false;
      }
    },
    [game],
  );

  function autoPromotion(from: string, to: string): string | undefined {
    const piece = game.get(from as Square);
    if (!piece || piece.type !== "p") return undefined;
    if (piece.color === "w" && to[1] === "8") return "q";
    if (piece.color === "b" && to[1] === "1") return "q";
    return undefined;
  }

  /* ── drag & click handlers ─────────────────── */
  function handleDrop({ sourceSquare, targetSquare }: { piece: { pieceType: string }; sourceSquare: string; targetSquare: string | null }): boolean {
    if (!targetSquare || !isLive) return false;
    const promo = autoPromotion(sourceSquare, targetSquare);
    return applyMove(sourceSquare, targetSquare, promo);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleCanDrag({ piece, square }: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }): boolean {
    if (!isLive) return false;
    if (!square) return false;
    return isMovablePiece(square);
  }

  function handleSquareClick({ square }: { piece: unknown; square: string }) {
    if (!square || !isLive) return;
    if (selected && targets.includes(square)) {
      const promo = autoPromotion(selected, square);
      applyMove(selected, square, promo);
      return;
    }
    if (selected === square) {
      setSelected(null);
      setTargets([]);
      return;
    }
    if (isMovablePiece(square)) {
      setSelected(square);
      setTargets(getLegalTargets(square));
    } else {
      setSelected(null);
      setTargets([]);
    }
  }

  function handlePieceClick({ square }: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }) {
    if (!square || !isLive) return;
    if (selected && targets.includes(square)) {
      const promo = autoPromotion(selected, square);
      applyMove(selected, square, promo);
      return;
    }
    if (isMovablePiece(square)) {
      if (selected === square) {
        setSelected(null);
        setTargets([]);
      } else {
        setSelected(square);
        setTargets(getLegalTargets(square));
      }
    } else {
      setSelected(null);
      setTargets([]);
    }
  }

  /* ── history navigation ────────────────────── */
  function goToStart() {
    setViewIndex(-2);
    setSelected(null);
    setTargets([]);
  }
  function goBack() {
    setViewIndex((prev) => {
      if (prev === -2) return -2;
      if (prev === -1) return moveHistory.length >= 2 ? moveHistory.length - 2 : -2;
      return prev <= 0 ? -2 : prev - 1;
    });
    setSelected(null);
    setTargets([]);
  }
  function goForward() {
    setViewIndex((prev) => {
      if (prev === -1) return -1;
      if (prev === -2) return moveHistory.length > 0 ? 0 : -1;
      return prev >= moveHistory.length - 1 ? -1 : prev + 1;
    });
    setSelected(null);
    setTargets([]);
  }
  function goToEnd() {
    setViewIndex(-1);
    setSelected(null);
    setTargets([]);
  }

  // keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") { e.preventDefault(); goBack(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goForward(); }
      else if (e.key === "Home") { e.preventDefault(); goToStart(); }
      else if (e.key === "End") { e.preventDefault(); goToEnd(); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const browseFen = useMemo(() => {
    if (viewIndex === -1) return fen;
    if (viewIndex === -2) return INITIAL_FEN;
    return moveHistory[viewIndex]?.fen ?? fen;
  }, [viewIndex, fen, moveHistory]);

  const browseLastMove = useMemo(() => {
    if (viewIndex === -1) return lastMove;
    if (viewIndex === -2) return null;
    const h = moveHistory[viewIndex];
    return h ? { from: h.from, to: h.to } : null;
  }, [viewIndex, lastMove, moveHistory]);

  /* ── board controls ────────────────────────── */
  function resetBoard() {
    game.reset();
    setFen(INITIAL_FEN);
    setLastMove(null);
    setMoveHistory([]);
    setViewIndex(-1);
    setSelected(null);
    setTargets([]);
    setTranscript("");
    setParsedSan("");
    setVoiceError("");
    setMicStatus("idle");
  }

  function undoMove() {
    game.undo();
    setFen(game.fen());
    setMoveHistory((prev) => prev.slice(0, -1));
    setViewIndex(-1);
    setLastMove(null);
    setSelected(null);
    setTargets([]);
  }

  /* ── square styles ─────────────────────────── */
  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    const lm = browseLastMove;
    if (lm) {
      s[lm.from] = { backgroundColor: "rgba(194,154,88,0.35)" };
      s[lm.to] = { backgroundColor: "rgba(194,154,88,0.45)" };
    }
    if (selected && isLive) {
      s[selected] = { backgroundColor: "rgba(230,145,46,0.4)", boxShadow: "inset 0 0 0 3px rgba(230,145,46,0.6)" };
    }
    if (isLive) {
      targets.forEach((sq) => {
        s[sq] = { ...(s[sq] || {}), backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.25) 22%, transparent 23%)" };
      });
    }
    return s;
  }, [browseLastMove, selected, targets, isLive]);

  /* ── voice ─────────────────────────────────── */
  const clearStatusTimeout = useCallback(() => {
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
  }, []);

  /** Schedule auto-restart of listening (auto mode) */
  const scheduleAutoRestart = useCallback((delayMs = 800) => {
    if (autoRestartTimerRef.current) clearTimeout(autoRestartTimerRef.current);
    autoRestartTimerRef.current = setTimeout(() => {
      if (autoModeRef.current) {
        // We'll call startListening indirectly via ref
        startListeningRef.current?.();
      }
    }, delayMs);
  }, []);

  // Ref to break circular dependency between processVoiceText → scheduleAutoRestart → startListening
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startListeningRef = useRef<(() => void) | null>(null);

  const processVoiceText = useCallback(
    async (text: string) => {
      setMicStatus("processing");
      setTranscript(text);
      try {
        const res = await fetch("/voice-api/voice/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.san || data.uci) {
          let moved = false;
          if (data.san) {
            try {
              const move = game.move(data.san);
              if (move) {
                const newFen = game.fen();
                setFen(newFen);
                setLastMove({ from: move.from, to: move.to });
                setMoveHistory((prev) => [...prev, { san: move.san, fen: newFen, from: move.from, to: move.to }]);
                setViewIndex(-1);
                if (move.captured) playCaptureSound();
                else playMoveSound();
                moved = true;
              }
            } catch { /* uci fallback */ }
          }
          if (!moved && data.uci) {
            const from = data.uci.slice(0, 2);
            const to = data.uci.slice(2, 4);
            const promo = data.uci.length > 4 ? data.uci[4] : undefined;
            moved = applyMove(from, to, promo);
          }
          if (moved) {
            setMicStatus("success");
            setParsedSan(data.san || data.uci);
            setVoiceError("");
            // Auto mode → restart listening after brief feedback
            if (autoModeRef.current) scheduleAutoRestart(900);
          } else {
            setMicStatus("error");
            setVoiceError(`"${text}" → ${data.san || "?"} — illegal move`);
            if (autoModeRef.current) scheduleAutoRestart(1500);
          }
        } else {
          setMicStatus("error");
          setVoiceError(`Couldn't parse: "${text}"`);
          if (autoModeRef.current) scheduleAutoRestart(1500);
        }
      } catch {
        setMicStatus("error");
        setVoiceError("Voice server unreachable — run: make voice-dev");
      }
      clearStatusTimeout();
      statusTimeoutRef.current = setTimeout(() => {
        setMicStatus((prev) => {
          // In auto mode don't reset to idle if we're about to restart
          if (autoModeRef.current && (prev === "success" || prev === "error")) return prev;
          return "idle";
        });
        if (!autoModeRef.current) {
          setTranscript("");
          setParsedSan("");
          setVoiceError("");
        }
      }, 4000);
    },
    [game, applyMove, clearStatusTimeout, scheduleAutoRestart],
  );

  /* ── MediaRecorder fallback (records audio → sends to our server) ── */
  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 500) { setMicStatus("error"); setVoiceError("No audio captured"); return; }
        setMicStatus("processing");
        setTranscript("(analyzing audio…)");
        try {
          const form = new FormData();
          form.append("audio", blob, "voice.webm");
          const res = await fetch("/voice-api/voice/move", { method: "POST", body: form });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setTranscript(data.raw_transcript || "");
          if (data.san || data.uci) {
            let moved = false;
            if (data.san) {
              try {
                const move = game.move(data.san);
                if (move) {
                  const newFen = game.fen();
                  setFen(newFen);
                  setLastMove({ from: move.from, to: move.to });
                  setMoveHistory((prev) => [...prev, { san: move.san, fen: newFen, from: move.from, to: move.to }]);
                  setViewIndex(-1);
                  if (move.captured) playCaptureSound(); else playMoveSound();
                  moved = true;
                }
              } catch { /* uci fallback */ }
            }
            if (!moved && data.uci) {
              const from = data.uci.slice(0, 2); const to = data.uci.slice(2, 4);
              const promo = data.uci.length > 4 ? data.uci[4] : undefined;
              moved = applyMove(from, to, promo);
            }
            if (moved) { setMicStatus("success"); setParsedSan(data.san || data.uci); setVoiceError(""); if (autoModeRef.current) scheduleAutoRestart(900); }
            else { setMicStatus("error"); setVoiceError(`"${data.raw_transcript}" → ${data.san || "?"} — illegal`); if (autoModeRef.current) scheduleAutoRestart(1500); }
          } else {
            setMicStatus("error");
            setVoiceError(data.raw_transcript ? `Couldn't parse: "${data.raw_transcript}"` : "No speech detected");
            if (autoModeRef.current) scheduleAutoRestart(1500);
          }
        } catch {
          setMicStatus("error");
          setVoiceError("Voice server unreachable — run: make voice-dev");
        }
        clearStatusTimeout();
        statusTimeoutRef.current = setTimeout(() => { setMicStatus("idle"); setTranscript(""); setParsedSan(""); setVoiceError(""); }, 4000);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setMicStatus("listening");
      setTranscript("");
    } catch {
      setMicStatus("error");
      setVoiceError("Microphone access denied");
    }
  }, [game, applyMove, clearStatusTimeout, scheduleAutoRestart]);

  const startListening = useCallback(() => {
    setMicStatus("listening");
    setTranscript("");
    setParsedSan("");
    setVoiceError("");

    // If browser STT previously failed with network error, go straight to fallback
    if (useFallbackRef.current) {
      startMediaRecorder();
      return;
    }

    const hasBrowserSTT = ("webkitSpeechRecognition" in window) || ("SpeechRecognition" in window);
    if (!hasBrowserSTT) {
      // No browser STT at all — use server-side recording
      useFallbackRef.current = true;
      startMediaRecorder();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const current = event.results[event.results.length - 1];
      const text = current[0].transcript;
      setTranscript(text);
      if (current.isFinal) processVoiceText(text);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "network" || event.error === "service-not-allowed") {
        // Browser STT needs internet / HTTPS — switch to server-side fallback
        useFallbackRef.current = true;
        recognition.abort();
        startMediaRecorder();
        return;
      }
      setMicStatus("error");
      setVoiceError(event.error === "no-speech" ? "No speech detected" : `Mic error: ${event.error}`);
    };
    recognition.onend = () => {
      setMicStatus((prev) => (prev === "listening" ? "idle" : prev));
      // Auto mode: if recognition ended without error and we're still in auto mode, schedule restart
      if (autoModeRef.current) scheduleAutoRestart(600);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [processVoiceText, startMediaRecorder, scheduleAutoRestart]);

  // Keep ref in sync for auto-restart
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const stopListening = useCallback(() => {
    // Cancel any pending auto-restart
    if (autoRestartTimerRef.current) { clearTimeout(autoRestartTimerRef.current); autoRestartTimerRef.current = null; }
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop(); // triggers onstop → processes audio
      return;
    }
    setMicStatus("idle");
  }, []);

  /** Toggle auto mode on/off */
  const toggleAutoMode = useCallback((on: boolean) => {
    setAutoMode(on);
    if (on) {
      // Immediately start listening
      startListeningRef.current?.();
    } else {
      // Stop everything
      if (autoRestartTimerRef.current) { clearTimeout(autoRestartTimerRef.current); autoRestartTimerRef.current = null; }
      if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setMicStatus("idle");
      setTranscript("");
      setParsedSan("");
      setVoiceError("");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      if (autoRestartTimerRef.current) clearTimeout(autoRestartTimerRef.current);
    };
  }, []);

  /* ── derived UI ────────────────────────────── */
  const turnLabel = game.turn() === "w" ? "White" : "Black";
  const isGameOver = game.isGameOver();

  const activeHistoryIdx = viewIndex === -1 ? moveHistory.length - 1 : viewIndex === -2 ? -1 : viewIndex;

  // Suppress unused var from displayFen
  void displayFen;

  /* ── Mic status styling ──────────────────── */
  const statusColors: Record<MicStatus, { ring: string; bg: string; text: string; label: string }> = {
    idle: {
      ring: "ring-[var(--accent-gold)]/20",
      bg: "bg-gradient-to-b from-[#3a2a1a] to-[#2c1e10]",
      text: "text-[var(--accent-gold)]",
      label: autoMode ? "Auto mode ready" : "Tap to speak",
    },
    listening: {
      ring: "ring-red-500/40",
      bg: "bg-gradient-to-b from-red-500/20 to-red-600/10",
      text: "text-red-400",
      label: "Listening…",
    },
    processing: {
      ring: "ring-amber-500/30",
      bg: "bg-gradient-to-b from-amber-500/15 to-amber-600/10",
      text: "text-amber-400",
      label: "Processing…",
    },
    success: {
      ring: "ring-emerald-500/40",
      bg: "bg-gradient-to-b from-emerald-500/20 to-emerald-600/10",
      text: "text-emerald-400",
      label: parsedSan || "Done",
    },
    error: {
      ring: "ring-red-400/30",
      bg: "bg-gradient-to-b from-red-400/15 to-red-500/10",
      text: "text-red-400/80",
      label: "Try again",
    },
  };

  const sc = statusColors[micStatus];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 text-center sm:mb-8"
        >
          <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)] sm:text-3xl md:text-4xl">
            Voice{" "}
            <span className="bg-gradient-to-r from-[var(--accent-gold)] via-amber-400 to-orange-400 bg-clip-text text-transparent">
              Lab
            </span>
          </h1>
          <p className="mt-1.5 text-xs text-[var(--text-muted)] sm:text-sm">
            Play any move — drag, click, or speak it
          </p>
        </motion.div>

        <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
          {/* ─── Board column ─── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-[520px]"
          >
            {/* Turn indicator */}
            <div className="mb-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-block h-3 w-3 rounded-full ring-2 ring-offset-1 ring-offset-transparent"
                  style={{
                    backgroundColor: game.turn() === "w" ? "#fff" : "#222",
                    boxShadow: game.turn() === "w" ? "0 0 8px rgba(255,255,255,0.3)" : "0 0 8px rgba(0,0,0,0.5)",
                    borderColor: "rgba(255,255,255,0.2)",
                  }}
                />
                <span className="text-sm font-semibold text-[var(--text-primary)]">{turnLabel} to move</span>
              </div>
              {isGameOver && (
                <Chip color="amber" variant="flat" size="sm">
                  {game.isCheckmate() ? "Checkmate!" : game.isDraw() ? "Draw" : "Game Over"}
                </Chip>
              )}
              {!isLive && !isGameOver && (
                <Chip color="amber" variant="dot" size="sm">Reviewing</Chip>
              )}
            </div>

            {/* Board */}
            <div className="chess-board-wrapper overflow-hidden rounded-xl">
              <Chessboard
                options={{
                  position: browseFen,
                  boardOrientation: orientation,
                  onPieceDrop: handleDrop,
                  canDragPiece: handleCanDrag,
                  onSquareClick: handleSquareClick,
                  onPieceClick: handlePieceClick,
                  animationDurationInMs: 200,
                  boardStyle: { borderRadius: "12px" },
                  darkSquareStyle: { backgroundColor: colors.boardDark },
                  lightSquareStyle: { backgroundColor: colors.boardLight },
                  squareStyles,
                }}
              />
            </div>

            {/* ══════ Mic Control Panel ══════ */}
            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
              {/* Mode switcher — clean pill design */}
              <div className="mb-5 flex items-center justify-center">
                <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2">
                  <span className={`text-xs font-medium transition-colors ${!autoMode ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                    Push to talk
                  </span>
                  <Switch
                    checked={autoMode}
                    onCheckedChange={toggleAutoMode}
                    disabled={isGameOver}
                    size="sm"
                    color="green"
                  />
                  <span className={`text-xs font-medium transition-colors ${autoMode ? "text-emerald-400" : "text-[var(--text-muted)]"}`}>
                    Auto
                  </span>
                  {autoMode && micStatus === "listening" && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                  )}
                </div>
              </div>

              {/* Mic button — centered, clean */}
              <div className="flex flex-col items-center gap-3">
                <Tooltip
                  content={
                    autoMode
                      ? micStatus === "listening" ? "Listening… tap to stop" : "Auto mode active"
                      : micStatus === "listening" ? "Tap to stop" : "Tap to speak a move"
                  }
                  side="top"
                >
                  <button
                    onClick={() => {
                      if (autoMode) {
                        toggleAutoMode(false);
                      } else {
                        micStatus === "listening" ? stopListening() : startListening();
                      }
                    }}
                    disabled={isGameOver}
                    className={`
                      group relative flex h-16 w-16 items-center justify-center rounded-full
                      border border-white/[0.1]
                      ring-[3px] ${sc.ring}
                      ${sc.bg}
                      transition-all duration-300 ease-out
                      ${isGameOver ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:scale-105 active:scale-95"}
                    `}
                    aria-label={micStatus === "listening" ? "Stop listening" : "Start listening"}
                  >
                    {/* Pulse ring when listening */}
                    {micStatus === "listening" && (
                      <span className="absolute inset-[-6px] rounded-full border border-red-500/25 animate-ping pointer-events-none" />
                    )}
                    {/* Spin border when processing */}
                    {micStatus === "processing" && (
                      <span className="absolute inset-[-4px] rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin pointer-events-none" />
                    )}
                    {/* Icon */}
                    <span className="relative z-10">
                      {micStatus === "listening" ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-red-400">
                          <rect x="6" y="6" width="12" height="12" rx="3" />
                        </svg>
                      ) : micStatus === "processing" ? (
                        <div className="flex gap-1">
                          {[0, 150, 300].map((d) => (
                            <span key={d} className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                          ))}
                        </div>
                      ) : micStatus === "success" ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : micStatus === "error" ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-red-400">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-gold)] transition-colors group-hover:text-amber-300">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                      )}
                    </span>
                  </button>
                </Tooltip>

                {/* Status label */}
                <span className={`text-[11px] font-medium tracking-wide transition-colors duration-300 ${sc.text}`}>
                  {sc.label}
                </span>
              </div>

              {/* Voice feedback */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={micStatus + transcript}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 flex min-h-[32px] items-center justify-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                >
                  {micStatus === "idle" && !transcript && (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      🎤 {autoMode ? "Toggle auto above to start" : "Tap mic & say"}{" "}
                      {!autoMode && <span className="font-medium text-[var(--text-secondary)]">&quot;e2 to e4&quot;</span>}
                    </span>
                  )}
                  {micStatus === "listening" && (
                    <span className="flex items-center gap-2 text-[11px] font-medium text-red-400">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </span>
                      {transcript ? `"${transcript}"` : "Listening…"}
                    </span>
                  )}
                  {micStatus === "processing" && (
                    <span className="text-[11px] text-amber-400">Parsing &quot;{transcript}&quot;…</span>
                  )}
                  {micStatus === "success" && (
                    <Chip color="green" variant="flat" size="sm" startContent={<span>✓</span>}>
                      {parsedSan}
                    </Chip>
                  )}
                  {micStatus === "error" && (
                    <span className="text-[11px] text-red-400/90">{voiceError}</span>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Controls bar ── */}
            <div className="mt-3 flex items-center justify-center gap-1">
              {/* Navigation */}
              {([
                { label: "Start (Home)", action: goToStart, disabled: moveHistory.length === 0, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6 1.41-1.41zM6 6h2v12H6V6z" /></svg> },
                { label: "Back (←)", action: goBack, disabled: moveHistory.length === 0, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" /></svg> },
                { label: "Forward (→)", action: goForward, disabled: !isLive ? false : true || moveHistory.length === 0, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" /></svg> },
                { label: "End", action: goToEnd, disabled: isLive || moveHistory.length === 0, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6-1.41 1.41zM16 6h2v12h-2V6z" /></svg> },
              ] as const).map((btn) => (
                <Tooltip key={btn.label} content={btn.label} side="top">
                  <button
                    onClick={btn.action}
                    disabled={btn.disabled}
                    className="board-ctrl-btn"
                  >
                    {btn.icon}
                  </button>
                </Tooltip>
              ))}

              <Divider orientation="vertical" className="mx-1.5 h-5" />

              {/* Undo & Reset */}
              <Tooltip content="Undo" side="top">
                <button onClick={undoMove} disabled={moveHistory.length === 0} className="board-ctrl-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05 1.04-6.83 2.73L3 8v9h9l-2.83-2.83c1.28-1.28 3.05-2.03 5-2.03 3.04 0 5.58 2.14 6.2 5l1.96-.66C21.46 13.16 17.34 8 12.5 8z" /></svg>
                </button>
              </Tooltip>
              <Tooltip content="Reset board" side="top">
                <button onClick={resetBoard} className="board-ctrl-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.96 7.96 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>
                </button>
              </Tooltip>
            </div>
          </motion.div>

          {/* ─── Side panel ─── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-[260px] space-y-3"
          >
            {/* Move sheet */}
            <Card className="shadow-none">
              <CardBody>
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>Notation</span>
                  <span className="ml-auto text-[10px] font-normal tabular-nums text-[var(--text-muted)]">
                    {Math.ceil(moveHistory.length / 2)} moves
                  </span>
                </h3>
                <div className="max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                  {moveHistory.length === 0 ? (
                    <p className="py-4 text-center text-[11px] italic text-[var(--text-muted)]">Play or speak a move…</p>
                  ) : (
                    <div className="grid grid-cols-[28px_1fr_1fr] gap-y-0.5 text-xs">
                      {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => {
                        const wIdx = i * 2;
                        const bIdx = i * 2 + 1;
                        return (
                          <div key={i} className="contents">
                            <span className="py-0.5 text-[var(--text-muted)] tabular-nums">{i + 1}.</span>
                            <button
                              onClick={() => setViewIndex(wIdx)}
                              className={`rounded px-1 py-0.5 text-left font-medium transition-colors ${activeHistoryIdx === wIdx ? "bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]" : "text-[var(--text-primary)] hover:bg-white/[0.06]"}`}
                            >
                              {moveHistory[wIdx]?.san}
                            </button>
                            {moveHistory[bIdx] ? (
                              <button
                                onClick={() => setViewIndex(bIdx)}
                                className={`rounded px-1 py-0.5 text-left font-medium transition-colors ${activeHistoryIdx === bIdx ? "bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]" : "text-[var(--text-secondary)] hover:bg-white/[0.06]"}`}
                              >
                                {moveHistory[bIdx].san}
                              </button>
                            ) : <span />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Voice examples */}
            <Card className="shadow-none">
              <CardBody>
                <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Voice examples
                </h3>
                <div className="space-y-1.5">
                  {['"e2 to e4"', '"knight to f3"', '"bishop takes d5"', '"castle king side"', '"queen h5 check"'].map((ex) => (
                    <div key={ex} className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-gold)]/60" />
                      <span className="font-mono">{ex}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {/* Keyboard shortcuts */}
            <Card className="shadow-none">
              <CardBody>
                <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Shortcuts
                </h3>
                <div className="space-y-1 text-[11px] text-[var(--text-secondary)]">
                  {[
                    ["←  →", "Navigate moves"],
                    ["Home / End", "First / last move"],
                  ].map(([keys, desc]) => (
                    <div key={keys} className="flex items-center justify-between">
                      <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">{keys}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
