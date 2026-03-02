"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Chess } from "chess.js";
import { usePuzzleStore } from "@/lib/store";
import { speak, announceMove, announcePuzzleState, stopSpeaking } from "@/lib/speech";
import type { VoiceStatus } from "@/lib/voice-ui";
import { useVoiceModeCommands } from "@/hooks/useVoiceModeCommands";

interface UseVoiceButtonControllerArgs {
  autoListen: boolean;
}

export function useVoiceButtonController({ autoListen }: UseVoiceButtonControllerArgs) {
  const pathname = usePathname();
  const voiceEnabled =
    pathname === "/voice-test" ||
    pathname === "/daily" ||
    pathname.startsWith("/puzzles");

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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
  const AUTO_TIMEOUT_MS = 30_000;
  const RECORDER_WINDOW_MS = 5000;
  const WAKE_WINDOW_MS = 1800;

  useEffect(() => {
    autoModeRef.current = autoMode;
  }, [autoMode]);
  useEffect(() => {
    solvedRef.current = solved;
  }, [solved]);
  useEffect(() => {
    failedRef.current = failed;
  }, [failed]);

  const puzzleReady = !!puzzle && !solved && !failed && !waitingForOpponent;
  useEffect(() => {
    puzzleReadyRef.current = puzzleReady;
  }, [puzzleReady]);

  const disabled = solved || failed || waitingForOpponent;

  const updateStatus = useCallback((nextStatus: VoiceStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
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

  const clearFeedback = useCallback(
    (delayMs = 3000) => {
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
    },
    [updateStatus]
  );

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

  const processVoiceText = useCallback(
    async (text: string) => {
      if (handleModeCommand(text)) return;
      if (!puzzleReadyRef.current) return;

      resetInactivityTimer();

      updateStatus("processing");
      setTranscript(text);
      setVoiceTranscript(text);

      let moved = false;
      let moveSan = "";

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
            } catch {
              // try UCI
            }
          }
          if (!moved && data.uci) {
            const from = data.uci.slice(0, 2);
            const to = data.uci.slice(2, 4);
            const promo = data.uci.length > 4 ? data.uci[4] : undefined;
            moved = makeMove(from, to, promo);
            if (moved) moveSan = data.san || data.uci;
          }
        }
      } catch {
        // server unreachable
      }

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
    [processVoiceMove, makeMove, game, setVoiceTranscript, clearFeedback, updateStatus, resetInactivityTimer, handleModeCommand]
  );

  const processVoiceTextRef = useRef(processVoiceText);
  useEffect(() => {
    processVoiceTextRef.current = processVoiceText;
  }, [processVoiceText]);

  const startListeningAutoRef = useRef<(() => void) | null>(null);

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
              } catch {
                // noop
              }
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

  const startListening = useCallback(() => {
    if (!voiceEnabled) {
      setVoiceListening(false);
      updateStatus("idle");
      return;
    }
    if (recognitionRef.current) return;
    startMediaRecorder();
  }, [voiceEnabled, setVoiceListening, updateStatus, startMediaRecorder]);

  useEffect(() => {
    startListeningAutoRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(
    (opts?: { preserveStatus?: boolean; preserveFeedback?: boolean }) => {
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
    },
    [setVoiceListening, updateStatus]
  );

  const runWakeFallbackCycle = useCallback(async () => {
    if (!voiceEnabled) return;
    if (wakeFallbackRunningRef.current) return;
    if (autoModeRef.current) return;
    if (recognitionRef.current) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") return;
    if (solvedRef.current || failedRef.current) return;

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
      // wake mode remains silent on failures
    } finally {
      wakeFallbackRunningRef.current = false;
    }

    if (!commandHandled && !autoModeRef.current && !solvedRef.current && !failedRef.current) {
      if (wakeFallbackTimerRef.current) clearTimeout(wakeFallbackTimerRef.current);
      wakeFallbackTimerRef.current = setTimeout(() => {
        runWakeFallbackCycle();
      }, 250);
    }
  }, [voiceEnabled, WAKE_WINDOW_MS, handleModeCommand]);

  const toggleAutoMode = useCallback(
    (on: boolean, reason: "manual" | "voice-stop" = "manual") => {
      if (!voiceEnabled) return;
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
          speak("Auto listen off.");
        }
      }
    },
    [voiceEnabled, stopListening, resetInactivityTimer, clearInactivityTimer, applyStopFeedback]
  );

  useEffect(() => {
    toggleAutoRef.current = toggleAutoMode;
  }, [toggleAutoMode]);

  useEffect(() => {
    if (!voiceEnabled) {
      if (wakeFallbackTimerRef.current) {
        clearTimeout(wakeFallbackTimerRef.current);
        wakeFallbackTimerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setVoiceListening(false);
      return;
    }

    if (!autoMode && !voiceListening && !disabled && status !== "processing") {
      const timer = setTimeout(() => {
        runWakeFallbackCycle();
      }, 250);
      return () => clearTimeout(timer);
    }

    if (wakeFallbackTimerRef.current) {
      clearTimeout(wakeFallbackTimerRef.current);
      wakeFallbackTimerRef.current = null;
    }
  }, [voiceEnabled, autoMode, voiceListening, disabled, status, runWakeFallbackCycle, setVoiceListening]);

  useEffect(() => {
    if (voiceEnabled && autoMode && puzzleReady && !recognitionRef.current && statusRef.current !== "processing") {
      const timer = setTimeout(() => {
        if (autoModeRef.current && puzzleReadyRef.current && !recognitionRef.current) {
          startListeningAutoRef.current?.();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [voiceEnabled, autoMode, puzzleReady, moveIndex]);

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

  useEffect(() => {
    if (voiceEnabled && autoListen && puzzle && !solved && !failed) {
      toggleAutoRef.current?.(true);
    }
  }, [voiceEnabled, autoListen, puzzle, solved, failed]);

  useEffect(() => {
    if (autoMode && puzzle && !solved && !failed && moveIndex === 1 && !waitingForOpponent) {
      const turnColor = orientation === "white" ? "White" : "Black";
      setTimeout(() => speak(`Puzzle loaded. You play as ${turnColor}. Your turn.`), 800);
    }
  }, [autoMode, puzzle, solved, failed, moveIndex, waitingForOpponent, orientation]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
      if (wakeFallbackTimerRef.current) clearTimeout(wakeFallbackTimerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (recorderStopTimerRef.current) clearTimeout(recorderStopTimerRef.current);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      stopSpeaking();
    };
  }, []);

  return {
    voiceEnabled,
    voiceListening,
    solved,
    failed,
    disabled,
    puzzleReady,
    status,
    transcript,
    message,
    autoMode,
    startListening,
    stopListening,
    toggleAutoMode,
  };
}
