"use client";

import { useCallback } from "react";
import { isPlayCommand, isStopCommand } from "@/lib/voice-commands";

interface UseVoiceModeCommandsParams {
  isAutoMode: () => boolean;
  onPlay: () => void;
  onStop: () => void;
}

export function useVoiceModeCommands({ isAutoMode, onPlay, onStop }: UseVoiceModeCommandsParams) {
  return useCallback((text: string): boolean => {
    if (!text.trim()) return false;

    if (isAutoMode() && isStopCommand(text)) {
      onStop();
      return true;
    }

    if (!isAutoMode() && isPlayCommand(text)) {
      onPlay();
      return true;
    }

    return false;
  }, [isAutoMode, onPlay, onStop]);
}
