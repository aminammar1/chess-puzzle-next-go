"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import { Mic } from "lucide-react";
import { usePuzzleStore } from "@/lib/store";
import { speak, announceMove, announcePuzzleState, stopSpeaking } from "@/lib/speech";
import { getVoiceStatusConfig, type VoiceStatus } from "@/lib/voice-ui";
import VoiceStateIcon from "@/components/voice/VoiceStateIcon";
import { useVoiceModeCommands } from "@/hooks/useVoiceModeCommands";

/**
 * VoiceButton — voice control for puzzle solving.
 *
 * Two modes:
 *   AUTO  — continuous listening. Mic stays open. Every final utterance is
 *           parsed; legal moves are played, illegal ones are announced via TTS
 *           and listening resumes seamlessly. Designed for blind users.
 *   MANUAL — push-to-talk. Tap to start, recognition stops after one utterance.
 *
 * Two STT paths (transparent to the user):
 *   A) Browser SpeechRecognition (Chrome / Edge) — text → /voice-api/voice/parse
 *   B) MediaRecorder fallback — audio blob → /voice-api/voice/move
 *
 * Two visual variants:
 *   compact — inline row for puzzle solver (auto toggle + mic + feedback text)
 *   full    — large panel for voice lab (big mic button + mode switch + status)
 */

interface VoiceButtonProps {
  autoListen?: boolean;
  /** compact = inline row (puzzle solver). full = larger mic panel (voice lab). */
  variant?: "compact" | "full";
}

export default function VoiceButton({
  autoListen = false,
  variant = "compact",
}: VoiceButtonProps) {
  const {
    voiceListening,
    setVoiceListening,
    setVoiceTranscript,
    processVoiceMove,
    makeMove,
    game,
    solved,
    failed,
    waitingForOpponent,
    puzzle,
    moveIndex,
    sanMoves,
    orientation,
  } = usePuzzleStore();

  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [message, setMessage] = useState("");
  const [autoMode, setAutoMode] = useState(autoListen);

  // ── Refs ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeRecognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const useFallbackRef = useRef(false);
  const recorderStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextRecorderResultRef = useRef(false);
  const wakeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeFallbackRunningRef = useRef(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoModeRef = useRef(autoMode);
  const statusRef = useRef<VoiceStatus>("idle");
  const puzzleReadyRef = useRef(false);
  const solvedRef = useRef(false);
  const failedRef = useRef(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTO_TIMEOUT_MS = 30_000; // 30 seconds of silence → exit auto mode
  const RECORDER_WINDOW_MS = 5000;

  // Keep refs in sync
  useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);
  useEffect(() => { solvedRef.current = solved; }, [solved]);
  useEffect(() => { failedRef.current = failed; }, [failed]);

  const puzzleReady = !!puzzle && !solved && !failed && !waitingForOpponent;
  useEffect(() => { puzzleReadyRef.current = puzzleReady; }, [puzzleReady]);

  const disabled = solved || failed || waitingForOpponent;

  const updateStatus = useCallback((s: VoiceStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  /* ── Inactivity timer for auto-mode (30s) ── */
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (!autoModeRef.current) return;
    inactivityTimerRef.current = setTimeout(() => {
      if (autoModeRef.current) {
        // 30s of silence → exit auto mode
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

  /* Clear transient visual feedback after delay */
  const clearFeedback = useCallback((delayMs = 3000) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      if (autoModeRef.current) {
        setMessage("");
        setTranscript("");
        if (statusRef.current !== "listening") updateStatus("idle");
      } else {
        updateStatus("idle");
        setMessage("");
        setTranscript("");
      }
    }, delayMs);
  }, [updateStatus]);

  /* ── Toggle auto from voice trigger ── */
  const toggleAutoRef = useRef<((on: boolean, reason?: "manual" | "voice-stop") => void) | null>(null);

  const applyStopFeedback = useCallback(() => {
    updateStatus("stopped");
    setMessage("Auto stopped");
    clearFeedback(1300);
  }, [clearFeedback, updateStatus]);

  const handleModeCommand = useVoiceModeCommands({
    isAutoMode: () => autoModeRef.current,
    onPlay: () => toggleAutoRef.current?.(true),
    onStop: () => toggleAutoRef.current?.(false, "voice-stop"),
  });

  /* ── Process recognized text ── */
  const processVoiceText = useCallback(
    async (text: string) => {
      if (handleModeCommand(text)) {
        return;
      }

      if (!puzzleReadyRef.current) return;

      // Reset 30s inactivity timer — user spoke
      resetInactivityTimer();

      updateStatus("processing");
      setTranscript(text);
      setVoiceTranscript(text);

      let moved = false;
      let moveSan = "";

      // 1. Try server-side parsing
      try {
        const res = await fetch("/voice-api/voice/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.san && game) {
            try {
              const copy = new Chess(game.fen());
              const result = copy.move(data.san);
              if (result) {
                moved = makeMove(result.from, result.to, result.promotion);
                if (moved) moveSan = result.san;
              }
            } catch { /* try UCI */ }
          }
          if (!moved && data.uci) {
            const from = data.uci.slice(0, 2);
            const to = data.uci.slice(2, 4);
            const promo = data.uci.length > 4 ? data.uci[4] : undefined;
            moved = makeMove(from, to, promo);
            if (moved) moveSan = data.san || data.uci;
          }
        }
      } catch { /* server unreachable */ }

      // 2. Local regex fallback
      if (!moved) {
        moved = processVoiceMove(text);
      }

      if (moved) {
        updateStatus("success");
        setMessage(moveSan || text);
        if (moveSan) announceMove(moveSan);
        else speak("Move played.");
        clearFeedback(2000);
      } else {
        updateStatus("error");
        setMessage(`"${text}" — not a valid move`);
        if (autoModeRef.current) {
          speak("Not recognized. Still listening.");
        }
        clearFeedback(2500);
      }
    },
    [processVoiceMove, makeMove, game, setVoiceTranscript, clearFeedback, updateStatus, applyStopFeedback, handleModeCommand],
  );
  const processVoiceTextRef = useRef(processVoiceText);
  useEffect(() => { processVoiceTextRef.current = processVoiceText; }, [processVoiceText]);

  /* ── MediaRecorder fallback ── */
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
          setVoiceListening(false);
          updateStatus("idle");
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size < 500) {
          updateStatus("error");
          setMessage("No audio captured");
          if (autoModeRef.current) {
            speak("I did not hear a move. Still listening.");
            setTimeout(() => {
              if (autoModeRef.current && !solvedRef.current && !failedRef.current && puzzleReadyRef.current) {
                startListeningAutoRef.current?.();
              }
            }, 250);
          }
          clearFeedback(1400);
          return;
        }

        updateStatus("processing");
        try {
          const form = new FormData();
          form.append("audio", blob, "voice.webm");
          const res = await fetch("/voice-api/voice/move", { method: "POST", body: form });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const rawTranscript = (data.raw_transcript || "").trim();

          if (rawTranscript) {
            if (handleModeCommand(rawTranscript)) {
              mediaRecorderRef.current = null;
              setVoiceListening(false);
              return;
            }
          }

          if (data.san || data.uci) {
            let moved = false;
            if (data.san && game) {
              try {
                const copy = new Chess(game.fen());
                const result = copy.move(data.san);
                if (result) moved = makeMove(result.from, result.to, result.promotion);
              } catch { /* */ }
            }
            if (!moved && data.uci) {
              const from = data.uci.slice(0, 2);
              const to = data.uci.slice(2, 4);
              const promo = data.uci.length > 4 ? data.uci[4] : undefined;
              moved = makeMove(from, to, promo);
            }
            if (!moved) moved = processVoiceMove(data.raw_transcript || "");
            if (moved) {
              updateStatus("success");
              setMessage(data.san || data.uci);
              announceMove(data.san || data.uci);
            } else {
              updateStatus("error");
              setMessage("Illegal move");
              if (autoModeRef.current) speak("Not a legal move. Try again.");
            }
          } else {
            updateStatus("error");
            setMessage("No speech detected");
          }
        } catch {
          updateStatus("error");
          setMessage("Voice server unreachable");
        }

        mediaRecorderRef.current = null;
        setVoiceListening(false);

        if (autoModeRef.current && !solvedRef.current && !failedRef.current && puzzleReadyRef.current) {
          setTimeout(() => {
            if (autoModeRef.current && !solvedRef.current && !failedRef.current && puzzleReadyRef.current) {
              startListeningAutoRef.current?.();
            }
          }, 220);
        }

        clearFeedback(1800);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      if (recorderStopTimerRef.current) clearTimeout(recorderStopTimerRef.current);
      recorderStopTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, RECORDER_WINDOW_MS);

      updateStatus("listening");
      setVoiceListening(true);
    } catch {
      updateStatus("error");
      setMessage("Microphone denied");
      clearFeedback();
    }
  }, [processVoiceMove, makeMove, game, setVoiceListening, clearFeedback, updateStatus, handleModeCommand]);

  /* ── Start listening ── */
  const startListening = useCallback(() => {
    if (recognitionRef.current) return;

    if (wakeRecognitionRef.current) {
      wakeRecognitionRef.current.abort();
      wakeRecognitionRef.current = null;
    }

    if (useFallbackRef.current) {
      startMediaRecorder();
      return;
    }

    const hasBrowserSTT = ("webkitSpeechRecognition" in window) || ("SpeechRecognition" in window);
    if (!hasBrowserSTT) {
      useFallbackRef.current = true;
      startMediaRecorder();
      return;
    }

    updateStatus("listening");
    setMessage("");
    setTranscript("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();

    // Auto mode → continuous (mic stays open). Manual → stops after one utterance.
    recognition.continuous = autoModeRef.current;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setVoiceListening(true);
      updateStatus("listening");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const current = event.results[event.results.length - 1];
      const text = current[0].transcript;
      setTranscript(text);
      setVoiceTranscript(text);
      if (current.isFinal) {
        processVoiceTextRef.current(text);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "network" || event.error === "service-not-allowed") {
        useFallbackRef.current = true;
        recognition.abort();
        recognitionRef.current = null;
        startMediaRecorder();
        return;
      }
      if (event.error === "no-speech" && autoModeRef.current) return;
      if (event.error !== "aborted") {
        updateStatus("error");
        setMessage(event.error === "no-speech" ? "No speech detected" : `Error: ${event.error}`);
        clearFeedback();
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (autoModeRef.current && !solvedRef.current && !failedRef.current) {
        // Auto mode: seamlessly restart after a tiny delay
        setTimeout(() => {
          if (autoModeRef.current && !solvedRef.current && !failedRef.current) {
            startListeningAutoRef.current?.();
          } else {
            setVoiceListening(false);
            updateStatus("idle");
          }
        }, 200);
      } else {
        setVoiceListening(false);
        if (statusRef.current === "listening") updateStatus("idle");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [setVoiceListening, setVoiceTranscript, clearFeedback, startMediaRecorder, updateStatus]);

  const startListeningAutoRef = useRef<(() => void) | null>(null);
  useEffect(() => { startListeningAutoRef.current = startListening; }, [startListening]);

  /* ── Stop listening ── */
  const stopListening = useCallback((opts?: { preserveStatus?: boolean; preserveFeedback?: boolean }) => {
    if (recorderStopTimerRef.current) {
      clearTimeout(recorderStopTimerRef.current);
      recorderStopTimerRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      skipNextRecorderResultRef.current = true;
      mediaRecorderRef.current.stop();
      return;
    }
    setVoiceListening(false);
    if (!opts?.preserveStatus) {
      updateStatus("idle");
    }
    if (!opts?.preserveFeedback) {
      setTranscript("");
      setMessage("");
    }
    stopSpeaking();
  }, [setVoiceListening, updateStatus]);

  const runWakeFallbackCycle = useCallback(async () => {
    if (wakeFallbackRunningRef.current) return;
    if (!useFallbackRef.current) return;
    if (autoModeRef.current) return;
    if (recognitionRef.current || wakeRecognitionRef.current) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") return;
    if (solvedRef.current || failedRef.current) return;

    wakeFallbackRunningRef.current = true;
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
        }, 2200);
      });

      const blob = new Blob(chunks, { type: "audio/webm" });
      if (blob.size > 500) {
        const form = new FormData();
        form.append("audio", blob, "wake.webm");
        const res = await fetch("/voice-api/voice/transcribe", { method: "POST", body: form });
        if (res.ok) {
          const data = await res.json();
          const heard = (data.raw_transcript || "").trim();
          if (heard) {
            if (handleModeCommand(heard)) {
              return;
            }
          }
        }
      }
    } catch {
      // keep silent for wake mode; user may have denied mic or no input available
    } finally {
      wakeFallbackRunningRef.current = false;
    }

    if (!autoModeRef.current && useFallbackRef.current && !solvedRef.current && !failedRef.current) {
      if (wakeFallbackTimerRef.current) clearTimeout(wakeFallbackTimerRef.current);
      wakeFallbackTimerRef.current = setTimeout(() => {
        runWakeFallbackCycle();
      }, 350);
    }
  }, []);

  const startWakeCommandListener = useCallback(() => {
    if (wakeRecognitionRef.current) return;
    if (autoModeRef.current) return;
    if (recognitionRef.current) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") return;
    if (useFallbackRef.current) return;
    if (solvedRef.current || failedRef.current) return;

    const hasBrowserSTT = ("webkitSpeechRecognition" in window) || ("SpeechRecognition" in window);
    if (!hasBrowserSTT) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const wake = new SR();
    wake.continuous = true;
    wake.interimResults = false;
    wake.lang = "en-US";
    wake.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wake.onresult = (event: any) => {
      const current = event.results[event.results.length - 1];
      if (!current?.isFinal) return;
      const text = current[0]?.transcript || "";
      handleModeCommand(text);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wake.onerror = (event: any) => {
      if (["network", "service-not-allowed", "not-allowed", "audio-capture"].includes(event.error)) {
        useFallbackRef.current = true;
        wakeRecognitionRef.current = null;
        runWakeFallbackCycle();
        return;
      }
      if (event.error !== "aborted" && event.error !== "no-speech") {
        wakeRecognitionRef.current = null;
      }
    };

    wake.onend = () => {
      wakeRecognitionRef.current = null;
      if (!autoModeRef.current && !recognitionRef.current && !solvedRef.current && !failedRef.current) {
        setTimeout(() => {
          if (!wakeRecognitionRef.current) startWakeCommandListener();
        }, 350);
      }
    };

    wakeRecognitionRef.current = wake;
    wake.start();
  }, [runWakeFallbackCycle, handleModeCommand]);

  /* ── Toggle auto mode ── */
  const toggleAutoMode = useCallback((on: boolean, reason: "manual" | "voice-stop" = "manual") => {
    setAutoMode(on);
    if (on) {
      speak("Auto listen on. Say your moves. Say stop to end. Silence for 30 seconds will exit.");
      resetInactivityTimer();
      setTimeout(() => startListeningAutoRef.current?.(), 600);
    } else {
      clearInactivityTimer();
      stopListening({ preserveStatus: reason === "voice-stop", preserveFeedback: reason === "voice-stop" });
      if (reason === "voice-stop") {
        applyStopFeedback();
      }
      speak("Auto listen off.");
    }
  }, [stopListening, resetInactivityTimer, clearInactivityTimer, applyStopFeedback]);

  // Keep toggle ref in sync
  useEffect(() => { toggleAutoRef.current = toggleAutoMode; }, [toggleAutoMode]);

  useEffect(() => {
    if (!autoMode && !voiceListening && !disabled && status !== "processing") {
      const timer = setTimeout(() => {
        if (useFallbackRef.current) runWakeFallbackCycle();
        else startWakeCommandListener();
      }, 250);
      return () => clearTimeout(timer);
    }

    if (wakeRecognitionRef.current) {
      wakeRecognitionRef.current.abort();
      wakeRecognitionRef.current = null;
    }
    if (wakeFallbackTimerRef.current) {
      clearTimeout(wakeFallbackTimerRef.current);
      wakeFallbackTimerRef.current = null;
    }
  }, [autoMode, voiceListening, disabled, status, startWakeCommandListener, runWakeFallbackCycle]);

  /* ── Auto-start when puzzle is ready ── */
  useEffect(() => {
    if (autoMode && puzzleReady && !recognitionRef.current && statusRef.current !== "processing") {
      const timer = setTimeout(() => {
        if (autoModeRef.current && puzzleReadyRef.current && !recognitionRef.current) {
          startListeningAutoRef.current?.();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoMode, puzzleReady, moveIndex]);

  /* ── TTS: announce opponent moves ── */
  const prevMoveIndexRef = useRef(moveIndex);
  useEffect(() => {
    if (!autoMode || !puzzle) return;
    if (moveIndex > prevMoveIndexRef.current && !waitingForOpponent && !solved && !failed) {
      const opponentMoveIdx = moveIndex - 1;
      if (opponentMoveIdx >= 0 && opponentMoveIdx < sanMoves.length) {
        const oppSan = sanMoves[opponentMoveIdx];
        setTimeout(() => announceMove(oppSan, true), 200);
        setTimeout(() => speak("Your turn."), 1200);
      }
    }
    prevMoveIndexRef.current = moveIndex;
  }, [moveIndex, waitingForOpponent, solved, failed, autoMode, puzzle, sanMoves]);

  /* ── TTS: announce solved / failed ── */
  useEffect(() => {
    if (!autoMode) return;
    if (solved) {
      stopListening();
      setTimeout(() => announcePuzzleState("solved"), 500);
    }
  }, [solved, autoMode, stopListening]);

  useEffect(() => {
    if (!autoMode) return;
    if (failed) {
      stopListening();
      setTimeout(() => announcePuzzleState("failed"), 300);
    }
  }, [failed, autoMode, stopListening]);

  /* ── Enable auto mode from prop ── */
  useEffect(() => {
    if (autoListen && puzzle && !solved && !failed) {
      toggleAutoRef.current?.(true);
    }
  }, [autoListen, puzzle, solved, failed]);

  /* ── Announce puzzle start ── */
  useEffect(() => {
    if (autoMode && puzzle && !solved && !failed && moveIndex === 1 && !waitingForOpponent) {
      const turnColor = orientation === "white" ? "White" : "Black";
      setTimeout(() => speak(`Puzzle loaded. You play as ${turnColor}. Your turn.`), 800);
    }
  }, [autoMode, puzzle, solved, failed, moveIndex, waitingForOpponent, orientation]);

  /* ── Cleanup ── */
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (wakeRecognitionRef.current) wakeRecognitionRef.current.abort();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
      if (wakeFallbackTimerRef.current) clearTimeout(wakeFallbackTimerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (recorderStopTimerRef.current) clearTimeout(recorderStopTimerRef.current);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      stopSpeaking();
    };
  }, []);

  /* ═══════════════════════ FULL VARIANT (voice lab) ═══════════════════════ */
  if (variant === "full") {
    const sc = getVoiceStatusConfig(status, autoMode, message);

    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5" role="region" aria-label="Voice move input">
        {/* Mode switcher */}
        <div className="mb-5 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2">
            <span className={`text-xs font-medium transition-colors ${!autoMode ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
              Push to talk
            </span>
            <button
              onClick={() => toggleAutoMode(!autoMode)}
              disabled={solved || failed}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-white/[0.06] transition-colors duration-200
                ${autoMode ? "bg-emerald-600" : "bg-white/[0.08]"}
                ${solved || failed ? "cursor-not-allowed opacity-40" : ""}
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
            {autoMode && status === "listening" && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>
        </div>

        {/* Mic button */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => {
              if (autoMode) {
                toggleAutoMode(false);
              } else {
                status === "listening" ? stopListening() : startListening();
              }
            }}
            disabled={disabled}
            className={`
              group relative flex h-16 w-16 items-center justify-center rounded-full
              border border-white/[0.1] ring-[3px] ${sc.ring} ${sc.bg}
              transition-all duration-300 ease-out
              ${disabled ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:scale-105 active:scale-95"}
            `}
            aria-label={status === "listening" ? "Stop listening" : "Start listening"}
          >
            {status === "listening" && (
              <span className="absolute inset-[-6px] rounded-full border border-red-500/25 animate-ping pointer-events-none" />
            )}
            {status === "stopped" && (
              <span className="absolute inset-[-5px] rounded-full border border-blue-400/35 animate-pulse pointer-events-none" />
            )}
            <span className="relative z-10">
              <VoiceStateIcon status={status} size={24} idleClassName="text-[var(--accent-gold)] transition-colors group-hover:text-amber-300" />
            </span>
          </button>

          {/* Status label */}
          <span className={`text-[11px] font-medium tracking-wide transition-colors duration-300 ${sc.text}`}>
            {sc.label}
          </span>
        </div>

        {/* Voice feedback */}
        <div className="mt-4 flex min-h-[32px] items-center justify-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2" aria-live="polite" aria-atomic="true">
          {status === "idle" && !transcript && (
            <span className="text-[11px] text-[var(--text-muted)]">
              {autoMode ? (<>Auto mode — speak moves · say <span className="font-medium text-emerald-400/80">&quot;stop&quot;</span> to end</>) : (
                <>Tap mic &amp; say <span className="font-medium text-[var(--text-secondary)]">&quot;e2 to e4&quot;</span> · say <span className="font-medium text-emerald-400/80">&quot;play&quot;</span> for auto</>
              )}
            </span>
          )}
          {status === "listening" && (
            <span className="flex items-center gap-2 text-[11px] font-medium text-red-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              {transcript ? `"${transcript}"` : "Listening…"}
            </span>
          )}
          {status === "processing" && (
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
          {status === "success" && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              <span>✓</span> {message}
            </span>
          )}
          {status === "error" && (
            <span className="text-[11px] text-red-400/90">{message}</span>
          )}
          {status === "stopped" && (
            <span className="text-[11px] text-blue-300/90 font-medium">Auto listening stopped</span>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════ COMPACT VARIANT (puzzle solver) ═══════════════════════ */
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0" role="region" aria-label="Voice move input">
      {/* Auto mode toggle */}
      <button
        onClick={() => toggleAutoMode(!autoMode)}
        disabled={solved || failed}
        title={autoMode ? "Disable auto-listen" : "Enable auto-listen for hands-free play"}
        aria-label={autoMode ? "Disable automatic voice listening" : "Enable automatic voice listening for blind and hands-free play"}
        className={`flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${autoMode
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
          : "bg-white/[0.04] text-[var(--text-muted)] border border-transparent hover:bg-white/[0.06]"
          } ${solved || failed ? "cursor-not-allowed opacity-30" : ""}`}
      >
        <Mic size={12} />
        <span>Auto</span>
      </button>

      {/* Manual mic button */}
      <button
        onClick={() => {
          if (autoMode) return;
          if (voiceListening) stopListening();
          else startListening();
        }}
        disabled={disabled || autoMode}
        title={autoMode ? "Auto mode active" : voiceListening ? "Stop" : 'Say "e2 to e4"'}
        aria-label={voiceListening ? "Stop listening" : "Start voice input. Say a chess move like e2 to e4"}
        aria-pressed={voiceListening}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${status === "listening"
          ? "bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110"
          : status === "processing"
            ? "bg-amber-500/20 text-amber-400 animate-pulse"
            : status === "success"
              ? "bg-emerald-500/20 text-emerald-400"
              : status === "error"
                ? "bg-red-500/15 text-red-400"
                : status === "stopped"
                  ? "bg-blue-500/20 text-blue-300"
                  : disabled || autoMode
                    ? "cursor-not-allowed bg-white/[0.04] text-white/20"
                    : "bg-white/[0.06] text-[var(--text-muted)] hover:bg-white/[0.1] hover:text-[var(--accent-gold)]"
          }`}
      >
        <VoiceStateIcon status={status} size={14} />
      </button>

      {/* Feedback — ARIA live region */}
      <div className="min-w-0 overflow-hidden" aria-live="polite" aria-atomic="true">
        {status === "listening" && !transcript && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
            <span className={autoMode ? "text-emerald-400" : "text-[var(--accent-gold)]"}>
              {autoMode ? "Listening (auto)…" : "Listening…"}
            </span>
          </span>
        )}
        {status === "listening" && transcript && (
          <span className="text-[11px] text-[var(--text-secondary)] font-medium truncate block">
            &ldquo;{transcript}&rdquo;
          </span>
        )}
        {status === "processing" && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
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
        {status === "success" && (
          <span className="text-[11px] text-green-400 font-medium truncate block">✓ {message}</span>
        )}
        {status === "error" && (
          <span className="text-[11px] text-red-400/80 font-medium truncate block">{message}</span>
        )}
        {status === "stopped" && (
          <span className="text-[11px] text-blue-300/90 font-medium truncate block">Auto stopped</span>
        )}
        {status === "idle" && autoMode && puzzleReady && (
          <span className="text-[11px] text-emerald-400/60 font-medium">Auto mode — say &quot;stop&quot; to end</span>
        )}
      </div>
    </div>
  );
}
