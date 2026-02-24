"use client";

import { Check, Loader2, Mic, Square, X } from "lucide-react";
import type { VoiceStatus } from "@/lib/voice-ui";

interface VoiceStateIconProps {
  status: VoiceStatus;
  size?: number;
  idleClassName?: string;
}

export default function VoiceStateIcon({ status, size = 22, idleClassName = "text-[var(--accent-gold)]" }: VoiceStateIconProps) {
  if (status === "listening") {
    return <Square size={size - 2} className="text-red-400" fill="currentColor" />;
  }

  if (status === "processing") {
    return <Loader2 size={size - 1} className="text-amber-400 animate-spin" />;
  }

  if (status === "success") {
    return <Check size={size} className="text-emerald-400" strokeWidth={2.6} />;
  }

  if (status === "error") {
    return <X size={size - 1} className="text-red-400" strokeWidth={2.6} />;
  }

  if (status === "stopped") {
    return <Square size={size - 1} className="text-blue-300 animate-pulse" strokeWidth={2.5} />;
  }

  return <Mic size={size} className={idleClassName} strokeWidth={1.9} />;
}
