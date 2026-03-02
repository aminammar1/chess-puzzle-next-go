"use client";

import { useEffect, useCallback } from "react";

export function usePuzzleHistoryKeyboardNavigation(
  navigateHistory: (direction: "back" | "forward") => void
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateHistory("back");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateHistory("forward");
      }
    },
    [navigateHistory]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
