"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePuzzleStore } from "@/lib/store";

export default function VoiceButton() {
  const {
    voiceListening,
    setVoiceListening,
    setVoiceTranscript,
    processVoiceMove,
    solved,
    failed,
    waitingForOpponent,
  } = usePuzzleStore();

  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<"idle" | "listening" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStatus = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setStatus("idle");
      setMessage("");
      setTranscript("");
    }, 3000);
  }, []);

  const startListening = useCallback(() => {
    setStatus("listening");
    setMessage("");
    setTranscript("");

    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setStatus("error");
      setMessage("Not supported in this browser");
      clearStatus();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setVoiceListening(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const current = event.results[event.results.length - 1];
      const text = current[0].transcript;
      setTranscript(text);
      setVoiceTranscript(text);

      if (current.isFinal) {
        const success = processVoiceMove(text);
        if (success) {
          setStatus("success");
          setMessage(text);
        } else {
          setStatus("error");
          setMessage(`"${text}" — try "e2 to e4"`);
        }
        setVoiceListening(false);
        clearStatus();
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setStatus("error");
      setMessage(event.error === "no-speech" ? "No speech detected" : `Error: ${event.error}`);
      setVoiceListening(false);
      clearStatus();
    };

    recognition.onend = () => setVoiceListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, [setVoiceListening, setVoiceTranscript, processVoiceMove, clearStatus]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setVoiceListening(false);
  }, [setVoiceListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const disabled = solved || failed || waitingForOpponent;

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      {/* Mic button */}
      <button
        onClick={voiceListening ? stopListening : startListening}
        disabled={disabled}
        title={voiceListening ? "Stop" : 'Say "e2 to e4"'}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
          voiceListening
            ? "bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110"
            : disabled
              ? "cursor-not-allowed bg-white/[0.04] text-white/20"
              : "bg-white/[0.06] text-[var(--text-muted)] hover:bg-white/[0.1] hover:text-[var(--accent-gold)]"
        }`}
      >
        {voiceListening ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}
      </button>

      {/* Feedback text — only shows when active */}
      {status !== "idle" && (
        <div className="min-w-0 overflow-hidden">
          {status === "listening" && !transcript && (
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--accent-gold)] font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent-gold)] opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent-gold)]" />
              </span>
              Listening…
            </span>
          )}
          {status === "listening" && transcript && (
            <span className="text-[11px] text-[var(--text-secondary)] font-medium truncate block">
              &ldquo;{transcript}&rdquo;
            </span>
          )}
          {status === "success" && (
            <span className="text-[11px] text-green-400 font-medium truncate block">
              ✓ {message}
            </span>
          )}
          {status === "error" && (
            <span className="text-[11px] text-red-400/80 font-medium truncate block">
              {message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
