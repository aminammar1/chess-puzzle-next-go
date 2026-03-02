"use client";

import { Mic } from "lucide-react";
import { getVoiceStatusConfig, type VoiceStatus } from "@/lib/voice-ui";
import VoiceStateIcon from "@/components/voice/VoiceStateIcon";
import { useVoiceButtonController } from "@/hooks/useVoiceButtonController";

/**
 * VoiceButton — voice control for puzzle solving.
 *
 * Two modes:
 *   AUTO  — continuous listening. Mic stays open. Every final utterance is
 *           parsed; legal moves are played, illegal ones are announced via TTS
 *           and listening resumes seamlessly. Designed for blind users.
 *   MANUAL — push-to-talk. Tap to start, recognition stops after one utterance.
 *
 * STT path:
 *   Server STT — MediaRecorder audio blob → /voice-api/voice/move
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
  } = useVoiceButtonController({ autoListen });

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
              disabled={!voiceEnabled || solved || failed}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-white/[0.06] transition-colors duration-200
                ${autoMode ? "bg-emerald-600" : "bg-white/[0.08]"}
                ${!voiceEnabled || solved || failed ? "cursor-not-allowed opacity-40" : ""}
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
            disabled={!voiceEnabled || disabled}
            className={`
              group relative flex h-16 w-16 items-center justify-center rounded-full
              border border-white/[0.1] ring-[3px] ${sc.ring} ${sc.bg}
              transition-all duration-300 ease-out
              ${!voiceEnabled || disabled ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:scale-105 active:scale-95"}
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
        disabled={!voiceEnabled || solved || failed}
        title={autoMode ? "Disable auto-listen" : "Enable auto-listen for hands-free play"}
        aria-label={autoMode ? "Disable automatic voice listening" : "Enable automatic voice listening for blind and hands-free play"}
        className={`flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${autoMode
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
          : "bg-white/[0.04] text-[var(--text-muted)] border border-transparent hover:bg-white/[0.06]"
          } ${!voiceEnabled || solved || failed ? "cursor-not-allowed opacity-30" : ""}`}
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
