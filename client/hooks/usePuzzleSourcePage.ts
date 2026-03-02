"use client";

import { useState, useCallback } from "react";
import { usePuzzleStore } from "@/lib/store";
import type { DifficultyLevel, PuzzleSource } from "@/lib/types";

export function usePuzzleSourcePage(source: Extract<PuzzleSource, "lichess" | "dataset">) {
  const { puzzle, loading, error, loadPuzzle } = usePuzzleStore();
  const [started, setStarted] = useState(false);

  const handleSelectDifficulty = useCallback(
    async (difficulty: DifficultyLevel) => {
      await loadPuzzle(source, difficulty);
      setStarted(true);
    },
    [loadPuzzle, source]
  );

  const handleNextPuzzle = useCallback(
    async (difficulty: DifficultyLevel) => {
      await loadPuzzle(source, difficulty);
    },
    [loadPuzzle, source]
  );

  return {
    puzzle,
    loading,
    error,
    started,
    setStarted,
    handleSelectDifficulty,
    handleNextPuzzle,
  };
}
