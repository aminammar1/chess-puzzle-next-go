"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  RotateCcw,
  SkipBack,
  SkipForward,
  Undo2,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { playMoveSound, playCaptureSound } from "@/lib/sounds";
import { speak, announceMove, stopSpeaking } from "@/lib/speech";
import { getVoiceStatusConfig, type VoiceStatus } from "@/lib/voice-ui";
import Navbar from "@/components/layout/Navbar";
import Tooltip from "@/components/ui/Tooltip";
import Chip from "@/components/ui/Chip";
import Card, { CardBody } from "@/components/ui/Card";
import Divider from "@/components/ui/Divider";
import VoiceStateIcon from "@/components/voice/VoiceStateIcon";
import { useVoiceModeCommands } from "@/hooks/useVoiceModeCommands";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type MicStatus = VoiceStatus;

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

  /* ── Voice ─────────────────────────────────── */
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [parsedSan, setParsedSan] = useState("");
  const [voiceError, setVoiceError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recorderStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextRecorderResultRef = useRef(false);
  const wakeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeFallbackRunningRef = useRef(false);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Auto / continuous mode ────────────────── */
  const [autoMode, setAutoMode] = useState(false);
  const autoModeRef = useRef(false);
  const autoRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTO_TIMEOUT_MS = 30_000; // 30 seconds of silence → exit auto mode
  const RECORDER_WINDOW_MS = 5000;
  const WAKE_WINDOW_MS = 1800;

  useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);

  /* ── helpers ───────────────────────────────── */
  const currentTurn = game.turn();
  const isGameOver = game.isGameOver();

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
  function goToStart() { setViewIndex(-2); setSelected(null); setTargets([]); }
  function goBack() {
    setViewIndex((prev) => {
      if (prev === -2) return -2;
      if (prev === -1) return moveHistory.length >= 2 ? moveHistory.length - 2 : -2;
      return prev <= 0 ? -2 : prev - 1;
    });
    setSelected(null); setTargets([]);
  }
  function goForward() {
    setViewIndex((prev) => {
      if (prev === -1) return -1;
      if (prev === -2) return moveHistory.length > 0 ? 0 : -1;
      return prev >= moveHistory.length - 1 ? -1 : prev + 1;
    });
    setSelected(null); setTargets([]);
  }
  function goToEnd() { setViewIndex(-1); setSelected(null); setTargets([]); }

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

  const scheduleAutoRestart = useCallback((delayMs = 800) => {
    if (autoRestartTimerRef.current) clearTimeout(autoRestartTimerRef.current);
    autoRestartTimerRef.current = setTimeout(() => {
      if (autoModeRef.current) {
        startListeningRef.current?.();
      }
    }, delayMs);
  }, []);

  /* ── Inactivity timer for auto-mode (30s) ── */
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (!autoModeRef.current) return;
    inactivityTimerRef.current = setTimeout(() => {
      if (autoModeRef.current) {
        toggleAutoRef.current?.(false);
        speak("No speech detected. Auto mode off.");
      }
    }, AUTO_TIMEOUT_MS);
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startListeningRef = useRef<(() => void) | null>(null);
  const toggleAutoRef = useRef<((on: boolean, reason?: "manual" | "voice-stop") => void) | null>(null);

  const applyStopFeedback = useCallback(() => {
    setMicStatus("stopped");
    setVoiceError("Auto listening stopped");
    clearStatusTimeout();
    statusTimeoutRef.current = setTimeout(() => {
      setMicStatus("idle");
      setVoiceError("");
      setTranscript("");
      setParsedSan("");
    }, 1300);
  }, [clearStatusTimeout]);

  const handleModeCommand = useVoiceModeCommands({
    isAutoMode: () => autoModeRef.current,
    onPlay: () => toggleAutoRef.current?.(true),
    onStop: () => toggleAutoRef.current?.(false, "voice-stop"),
  });

  const processVoiceText = useCallback(
    async (text: string) => {
      if (handleModeCommand(text)) {
        return;
      }

      setMicStatus("processing");
      setTranscript(text);

      // Reset 30s inactivity timer — user spoke
      resetInactivityTimer();

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
            announceMove(data.san || data.uci);
          } else {
            setMicStatus("error");
            setVoiceError(`"${text}" → ${data.san || "?"} — illegal move`);
            if (autoModeRef.current) speak("Illegal move. Try again.");
          }
        } else {
          setMicStatus("error");
          setVoiceError(`Couldn't parse: "${text}"`);
          if (autoModeRef.current) speak("Not recognized. Try again.");
        }
      } catch {
        setMicStatus("error");
        setVoiceError("Voice server unreachable — run: make voice-dev");
      }
      clearStatusTimeout();
      statusTimeoutRef.current = setTimeout(() => {
        setMicStatus((prev) => {
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
    [game, applyMove, clearStatusTimeout, scheduleAutoRestart, handleModeCommand],
  );

  /* ── MediaRecorder fallback ── */
  const startMediaRecorder = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      skipNextRecorderResultRef.current = false;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        if (recorderStopTimerRef.current) {
          clearTimeout(recorderStopTimerRef.current);
          recorderStopTimerRef.current = null;
        }

        stream.getTracks().forEach((t) => t.stop());

        if (skipNextRecorderResultRef.current) {
          skipNextRecorderResultRef.current = false;
          mediaRecorderRef.current = null;
          setMicStatus("idle");
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 500) {
          setMicStatus("error");
          setVoiceError("No audio captured");
          if (autoModeRef.current) {
            speak("I did not hear a move. Still listening.");
            scheduleAutoRestart(220);
          }
          return;
        }
        setMicStatus("processing");
        setTranscript("(analyzing audio…)");
        try {
          const form = new FormData();
          form.append("audio", blob, "voice.webm");
          const res = await fetch("/voice-api/voice/move", { method: "POST", body: form });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setTranscript(data.raw_transcript || "");

          const rawTranscript = (data.raw_transcript || "").trim();
          if (rawTranscript) {
            if (handleModeCommand(rawTranscript)) {
              mediaRecorderRef.current = null;
              return;
            }
          }

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
            if (moved) { setMicStatus("success"); setParsedSan(data.san || data.uci); setVoiceError(""); announceMove(data.san || data.uci); }
            else { setMicStatus("error"); setVoiceError(`"${data.raw_transcript}" → ${data.san || "?"} — illegal`); if (autoModeRef.current) speak("Illegal move."); }
          } else {
            setMicStatus("error");
            setVoiceError(data.raw_transcript ? `Couldn't parse: "${data.raw_transcript}"` : "No speech detected");
            if (autoModeRef.current) speak("Not recognized.");
          }
        } catch {
          setMicStatus("error");
          setVoiceError("Voice server unreachable — run: make voice-dev");
        }

        mediaRecorderRef.current = null;

        if (autoModeRef.current) {
          clearStatusTimeout();
          statusTimeoutRef.current = setTimeout(() => {
            setTranscript("");
            setParsedSan("");
            setVoiceError("");
          }, 1800);
          scheduleAutoRestart(220);
        } else {
          clearStatusTimeout();
          statusTimeoutRef.current = setTimeout(() => { setMicStatus("idle"); setTranscript(""); setParsedSan(""); setVoiceError(""); }, 4000);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();

      if (recorderStopTimerRef.current) clearTimeout(recorderStopTimerRef.current);
      recorderStopTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, RECORDER_WINDOW_MS);

      setMicStatus("listening");
      setTranscript("");
    } catch {
      setMicStatus("error");
      setVoiceError("Microphone access denied");
    }
  }, [game, applyMove, clearStatusTimeout, scheduleAutoRestart, handleModeCommand]);

  const startListening = useCallback(() => {
    setMicStatus("listening");
    setTranscript("");
    setParsedSan("");
    setVoiceError("");

    startMediaRecorder();
  }, [startMediaRecorder]);

  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const runWakeFallbackCycle = useCallback(async () => {
    if (wakeFallbackRunningRef.current) return;
    if (autoModeRef.current) return;
    if (recognitionRef.current) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") return;
    if (isGameOver) return;

    wakeFallbackRunningRef.current = true;
    let commandHandled = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve();
        };
        recorder.start();
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, WAKE_WINDOW_MS);
      });

      const blob = new Blob(chunks, { type: "audio/webm" });
      if (blob.size > 500) {
        const form = new FormData();
        form.append("audio", blob, "wake.webm");
        const res = await fetch("/voice-api/voice/transcribe?fast=1", { method: "POST", body: form });
        if (res.ok) {
          const data = await res.json();
          const heard = (data.raw_transcript || "").trim();
          if (heard) {
            if (handleModeCommand(heard)) {
              commandHandled = true;
              return;
            }
          }
        }
      }
    } catch {
      // keep silent in wake mode
    } finally {
      wakeFallbackRunningRef.current = false;
    }

    if (!commandHandled && !autoModeRef.current && !isGameOver) {
      if (wakeFallbackTimerRef.current) clearTimeout(wakeFallbackTimerRef.current);
      wakeFallbackTimerRef.current = setTimeout(() => {
        runWakeFallbackCycle();
      }, 250);
    }
  }, [isGameOver, WAKE_WINDOW_MS]);

  const stopListening = useCallback((opts?: { preserveStatus?: boolean }) => {
    if (autoRestartTimerRef.current) { clearTimeout(autoRestartTimerRef.current); autoRestartTimerRef.current = null; }
    if (recorderStopTimerRef.current) { clearTimeout(recorderStopTimerRef.current); recorderStopTimerRef.current = null; }
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      skipNextRecorderResultRef.current = true;
      mediaRecorderRef.current.stop();
      return;
    }
    if (!opts?.preserveStatus) {
      setMicStatus("idle");
    }
  }, []);

  const toggleAutoMode = useCallback((on: boolean, reason: "manual" | "voice-stop" = "manual") => {
    setAutoMode(on);
    if (on) {
      speak("Auto listen on. Say your moves. Say stop to end. Silence for 30 seconds will exit.");
      resetInactivityTimer();
      setTimeout(() => startListeningRef.current?.(), 600);
    } else {
      clearInactivityTimer();
      stopListening({ preserveStatus: reason === "voice-stop" });
      if (reason === "manual") {
        setMicStatus("idle");
        setTranscript("");
        setParsedSan("");
        setVoiceError("");
      } else {
        applyStopFeedback();
      }
      if (reason === "voice-stop") {
        speak("Auto listen off.");
      }
    }
  }, [resetInactivityTimer, clearInactivityTimer, stopListening, applyStopFeedback]);

  // Keep toggle ref in sync
  useEffect(() => { toggleAutoRef.current = toggleAutoMode; }, [toggleAutoMode]);

  useEffect(() => {
    if (!autoMode && micStatus !== "processing" && !isGameOver) {
      const timer = setTimeout(() => {
        runWakeFallbackCycle();
      }, 250);
      return () => clearTimeout(timer);
    }

    if (wakeFallbackTimerRef.current) {
      clearTimeout(wakeFallbackTimerRef.current);
      wakeFallbackTimerRef.current = null;
    }
  }, [autoMode, micStatus, isGameOver, runWakeFallbackCycle]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
      if (wakeFallbackTimerRef.current) clearTimeout(wakeFallbackTimerRef.current);
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      if (autoRestartTimerRef.current) clearTimeout(autoRestartTimerRef.current);
      if (recorderStopTimerRef.current) clearTimeout(recorderStopTimerRef.current);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      stopSpeaking();
    };
  }, []);

  /* ── derived UI ────────────────────────────── */
  const turnLabel = game.turn() === "w" ? "White" : "Black";
  const activeHistoryIdx = viewIndex === -1 ? moveHistory.length - 1 : viewIndex === -2 ? -1 : viewIndex;

  /* ── Mic status styling ──────────────────── */
  const sc = getVoiceStatusConfig(micStatus, autoMode, parsedSan);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 text-center"
        >
          <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)] sm:text-3xl md:text-4xl">
            Voice{" "}
            <span className="bg-gradient-to-r from-[var(--accent-gold)] via-amber-400 to-orange-400 bg-clip-text text-transparent">
              Lab
            </span>
          </h1>
          <p className="mt-1.5 text-xs text-[var(--text-muted)] sm:text-sm">
            Play any move — drag, click, or speak it. Built for blind &amp; hands-free play.
          </p>
        </motion.div>

        <div className="flex flex-col items-start gap-6 lg:flex-row lg:justify-center lg:gap-8">
          {/* ─── Board column ─── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-[560px] lg:max-w-[520px] xl:max-w-[560px] mx-auto lg:mx-0"
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
            <div className="chess-board-wrapper overflow-hidden rounded-xl shadow-xl shadow-black/30">
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

            {/* ── Controls bar ── */}
            <div className="mt-3 flex items-center justify-center gap-1">
              {([
                { label: "Start (Home)", action: goToStart, disabled: moveHistory.length === 0, icon: <SkipBack size={14} /> },
                { label: "Back (←)", action: goBack, disabled: moveHistory.length === 0, icon: <ChevronLeft size={14} /> },
                { label: "Forward (→)", action: goForward, disabled: isLive || moveHistory.length === 0, icon: <ChevronRight size={14} /> },
                { label: "End", action: goToEnd, disabled: isLive || moveHistory.length === 0, icon: <SkipForward size={14} /> },
              ] as const).map((btn) => (
                <Tooltip key={btn.label} content={btn.label} side="top">
                  <button onClick={btn.action} disabled={btn.disabled} className="board-ctrl-btn">
                    {btn.icon}
                  </button>
                </Tooltip>
              ))}
              <Divider orientation="vertical" className="mx-1.5 h-5" />
              <Tooltip content="Undo" side="top">
                <button onClick={undoMove} disabled={moveHistory.length === 0} className="board-ctrl-btn">
                  <Undo2 size={14} />
                </button>
              </Tooltip>
              <Tooltip content="Reset board" side="top">
                <button onClick={resetBoard} className="board-ctrl-btn">
                  <RotateCcw size={14} />
                </button>
              </Tooltip>
            </div>
          </motion.div>

          {/* ─── Right panel ─── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-[560px] lg:max-w-[340px] mx-auto lg:mx-0 space-y-4"
          >
            {/* ══════ Mic Control Panel ══════ */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
              {/* Mode switcher */}
              <div className="mb-5 flex items-center justify-center">
                <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2">
                  <span className={`text-xs font-medium transition-colors ${!autoMode ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                    Push to talk
                  </span>
                  <button
                    onClick={() => toggleAutoMode(!autoMode)}
                    disabled={isGameOver}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-white/[0.06] transition-colors duration-200
                      ${autoMode ? "bg-emerald-600" : "bg-white/[0.08]"}
                      ${isGameOver ? "cursor-not-allowed opacity-40" : ""}
                    `}
                    role="switch"
                    aria-checked={autoMode}
                    aria-label="Toggle auto listening mode"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
                        ${autoMode ? "translate-x-4" : "translate-x-0.5"}
                      `}
                    />
                  </button>
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

              {/* Mic button */}
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
                      if (autoMode) { toggleAutoMode(false); }
                      else { micStatus === "listening" ? stopListening() : startListening(); }
                    }}
                    disabled={isGameOver}
                    className={`
                      group relative flex h-16 w-16 items-center justify-center rounded-full
                      border border-white/[0.1] ring-[3px] ${sc.ring} ${sc.bg}
                      transition-all duration-300 ease-out
                      ${isGameOver ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:scale-105 active:scale-95"}
                    `}
                    aria-label={micStatus === "listening" ? "Stop listening" : "Start listening"}
                  >
                    {micStatus === "listening" && (
                      <span className="absolute inset-[-6px] rounded-full border border-red-500/25 animate-ping pointer-events-none" />
                    )}
                    {micStatus === "stopped" && (
                      <span className="absolute inset-[-5px] rounded-full border border-blue-400/35 animate-pulse pointer-events-none" />
                    )}
                    <span className="relative z-10">
                      <VoiceStateIcon status={micStatus} size={24} idleClassName="text-[var(--accent-gold)] transition-colors group-hover:text-amber-300" />
                    </span>
                  </button>
                </Tooltip>

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
                      {autoMode ? (<>Auto mode — speak moves · say <span className="font-medium text-emerald-400/80">&quot;stop&quot;</span> to end</>) : (
                        <>Tap mic &amp; say <span className="font-medium text-[var(--text-secondary)]">&quot;e2 to e4&quot;</span> · say <span className="font-medium text-emerald-400/80">&quot;play&quot;</span> for auto</>
                      )}
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
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
                      <span>Processing move</span>
                      <span className="inline-flex">
                        {[0, 140, 280].map((delay) => (
                          <span
                            key={delay}
                            className="mx-[1px] h-1 w-1 rounded-full bg-amber-400/90 animate-pulse"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </span>
                    </span>
                  )}
                  {micStatus === "success" && (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                      ✓ {parsedSan}
                    </span>
                  )}
                  {micStatus === "error" && (
                    <span className="text-[11px] text-red-400/90">{voiceError}</span>
                  )}
                  {micStatus === "stopped" && (
                    <span className="text-[11px] text-blue-300/90">Auto listening stopped</span>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Move notation */}
            <Card className="shadow-none">
              <CardBody>
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <span>Notation</span>
                  <span className="ml-auto text-[10px] font-normal tabular-nums text-[var(--text-muted)]">
                    {Math.ceil(moveHistory.length / 2)} moves
                  </span>
                </h3>
                <div className="max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
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
