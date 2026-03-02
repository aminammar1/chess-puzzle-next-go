"use client";

import { useState, useCallback, useRef, useEffect, useMemo, type CSSProperties } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { playMoveSound, playCaptureSound } from "@/lib/sounds";
import { speak, announceMove, stopSpeaking } from "@/lib/speech";
import type { VoiceStatus } from "@/lib/voice-ui";
import { useVoiceModeCommands } from "@/hooks/useVoiceModeCommands";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type MicStatus = VoiceStatus;

export function useVoiceTestController() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(INITIAL_FEN);
  const [orientation] = useState<"white" | "black">("white");
  const [selected, setSelected] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const [moveHistory, setMoveHistory] = useState<{ san: string; fen: string; from: string; to: string }[]>([]);
  const [viewIndex, setViewIndex] = useState(-1);

  const game = gameRef.current;
  const isLive = viewIndex === -1 || viewIndex === moveHistory.length - 1;

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

  const [autoMode, setAutoMode] = useState(false);
  const autoModeRef = useRef(false);
  const autoRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTO_TIMEOUT_MS = 30_000;
  const RECORDER_WINDOW_MS = 5000;
  const WAKE_WINDOW_MS = 2600;

  useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);

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
    [game]
  );

  const isMovablePiece = useCallback(
    (sq: string): boolean => {
      const piece = game.get(sq as Square);
      if (!piece) return false;
      return piece.color === currentTurn;
    },
    [game, currentTurn]
  );

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
    [game]
  );

  const autoPromotion = useCallback(
    (from: string, to: string): string | undefined => {
      const piece = game.get(from as Square);
      if (!piece || piece.type !== "p") return undefined;
      if (piece.color === "w" && to[1] === "8") return "q";
      if (piece.color === "b" && to[1] === "1") return "q";
      return undefined;
    },
    [game]
  );

  const handleDrop = useCallback(
    ({ sourceSquare, targetSquare }: { piece: { pieceType: string }; sourceSquare: string; targetSquare: string | null }): boolean => {
      if (!targetSquare || !isLive) return false;
      const promo = autoPromotion(sourceSquare, targetSquare);
      return applyMove(sourceSquare, targetSquare, promo);
    },
    [isLive, autoPromotion, applyMove]
  );

  const handleCanDrag = useCallback(
    ({ square }: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }): boolean => {
      if (!isLive) return false;
      if (!square) return false;
      return isMovablePiece(square);
    },
    [isLive, isMovablePiece]
  );

  const handleSquareClick = useCallback(
    ({ square }: { piece: unknown; square: string }) => {
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
    },
    [isLive, selected, targets, autoPromotion, applyMove, isMovablePiece, getLegalTargets]
  );

  const handlePieceClick = useCallback(
    ({ square }: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }) => {
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
    },
    [isLive, selected, targets, autoPromotion, applyMove, isMovablePiece, getLegalTargets]
  );

  const goToStart = useCallback(() => {
    setViewIndex(-2);
    setSelected(null);
    setTargets([]);
  }, []);

  const goBack = useCallback(() => {
    setViewIndex((prev) => {
      if (prev === -2) return -2;
      if (prev === -1) return moveHistory.length >= 2 ? moveHistory.length - 2 : -2;
      return prev <= 0 ? -2 : prev - 1;
    });
    setSelected(null);
    setTargets([]);
  }, [moveHistory.length]);

  const goForward = useCallback(() => {
    setViewIndex((prev) => {
      if (prev === -1) return -1;
      if (prev === -2) return moveHistory.length > 0 ? 0 : -1;
      return prev >= moveHistory.length - 1 ? -1 : prev + 1;
    });
    setSelected(null);
    setTargets([]);
  }, [moveHistory.length]);

  const goToEnd = useCallback(() => {
    setViewIndex(-1);
    setSelected(null);
    setTargets([]);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
      } else if (e.key === "Home") {
        e.preventDefault();
        goToStart();
      } else if (e.key === "End") {
        e.preventDefault();
        goToEnd();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goBack, goForward, goToStart, goToEnd]);

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

  const resetBoard = useCallback(() => {
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
  }, [game]);

  const undoMove = useCallback(() => {
    game.undo();
    setFen(game.fen());
    setMoveHistory((prev) => prev.slice(0, -1));
    setViewIndex(-1);
    setLastMove(null);
    setSelected(null);
    setTargets([]);
  }, [game]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    const lm = browseLastMove;
    if (lm) {
      styles[lm.from] = { backgroundColor: "rgba(194,154,88,0.35)" };
      styles[lm.to] = { backgroundColor: "rgba(194,154,88,0.45)" };
    }
    if (selected && isLive) {
      styles[selected] = {
        backgroundColor: "rgba(230,145,46,0.4)",
        boxShadow: "inset 0 0 0 3px rgba(230,145,46,0.6)",
      };
    }
    if (isLive) {
      targets.forEach((sq) => {
        styles[sq] = {
          ...(styles[sq] || {}),
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.25) 22%, transparent 23%)",
        };
      });
    }
    return styles;
  }, [browseLastMove, selected, targets, isLive]);

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
      if (handleModeCommand(text)) return;

      setMicStatus("processing");
      setTranscript(text);
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
            } catch {
              // uci fallback
            }
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
    [game, applyMove, clearStatusTimeout, handleModeCommand, resetInactivityTimer]
  );

  const startMediaRecorder = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      skipNextRecorderResultRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
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
          if (rawTranscript && handleModeCommand(rawTranscript)) {
            mediaRecorderRef.current = null;
            return;
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
                  if (move.captured) playCaptureSound();
                  else playMoveSound();
                  moved = true;
                }
              } catch {
                // uci fallback
              }
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
              setVoiceError(`"${data.raw_transcript}" → ${data.san || "?"} — illegal`);
              if (autoModeRef.current) speak("Illegal move.");
            }
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
          statusTimeoutRef.current = setTimeout(() => {
            setMicStatus("idle");
            setTranscript("");
            setParsedSan("");
            setVoiceError("");
          }, 4000);
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

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

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
        const res = await fetch("/voice-api/voice/transcribe", { method: "POST", body: form });
        if (res.ok) {
          const data = await res.json();
          const heard = (data.raw_transcript || "").trim();
          if (heard && handleModeCommand(heard)) {
            commandHandled = true;
            return;
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
  }, [isGameOver, WAKE_WINDOW_MS, handleModeCommand]);

  const stopListening = useCallback((opts?: { preserveStatus?: boolean }) => {
    if (autoRestartTimerRef.current) {
      clearTimeout(autoRestartTimerRef.current);
      autoRestartTimerRef.current = null;
    }
    if (recorderStopTimerRef.current) {
      clearTimeout(recorderStopTimerRef.current);
      recorderStopTimerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      skipNextRecorderResultRef.current = true;
      mediaRecorderRef.current.stop();
      return;
    }
    if (!opts?.preserveStatus) {
      setMicStatus("idle");
    }
  }, []);

  const toggleAutoMode = useCallback(
    (on: boolean, reason: "manual" | "voice-stop" = "manual") => {
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
          speak("Auto listen off.");
        }
      }
    },
    [resetInactivityTimer, clearInactivityTimer, stopListening, applyStopFeedback]
  );

  useEffect(() => {
    toggleAutoRef.current = toggleAutoMode;
  }, [toggleAutoMode]);

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

  const turnLabel = game.turn() === "w" ? "White" : "Black";
  const activeHistoryIdx = viewIndex === -1 ? moveHistory.length - 1 : viewIndex === -2 ? -1 : viewIndex;

  return {
    game,
    orientation,
    browseFen,
    squareStyles,
    turnLabel,
    isGameOver,
    isLive,
    moveHistory,
    activeHistoryIdx,
    micStatus,
    autoMode,
    transcript,
    parsedSan,
    voiceError,
    handleDrop,
    handleCanDrag,
    handleSquareClick,
    handlePieceClick,
    goToStart,
    goBack,
    goForward,
    goToEnd,
    undoMove,
    resetBoard,
    setViewIndex,
    toggleAutoMode,
    stopListening,
    startListening,
  };
}
