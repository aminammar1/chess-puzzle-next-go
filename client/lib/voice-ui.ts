export type VoiceStatus = "idle" | "listening" | "processing" | "success" | "error" | "stopped";

export function getVoiceStatusConfig(status: VoiceStatus, autoMode: boolean, message?: string) {
  const config: Record<VoiceStatus, { ring: string; bg: string; text: string; label: string }> = {
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
      label: autoMode ? "Listening (auto)…" : "Listening…",
    },
    processing: {
      ring: "ring-amber-500/30",
      bg: "bg-gradient-to-b from-amber-500/15 to-amber-600/10",
      text: "text-amber-400",
      label: "Processing move…",
    },
    success: {
      ring: "ring-emerald-500/40",
      bg: "bg-gradient-to-b from-emerald-500/20 to-emerald-600/10",
      text: "text-emerald-400",
      label: message || "Done",
    },
    error: {
      ring: "ring-red-400/30",
      bg: "bg-gradient-to-b from-red-400/15 to-red-500/10",
      text: "text-red-400/80",
      label: "Try again",
    },
    stopped: {
      ring: "ring-blue-500/40",
      bg: "bg-gradient-to-b from-blue-500/20 to-indigo-600/10",
      text: "text-blue-300",
      label: "Auto stopped",
    },
  };

  return config[status];
}
