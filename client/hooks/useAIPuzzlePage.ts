"use client";

import { useState, useCallback, useMemo } from "react";
import { usePuzzleStore } from "@/lib/store";
import type { DifficultyLevel } from "@/lib/types";

const DEFAULT_AI_PROMPT = "Create a tactical chess puzzle";

export function useAIPuzzlePage() {
  const { puzzle, loading, error, loadPuzzle } = usePuzzleStore();
  const [started, setStarted] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>("medium");
  const [prompt, setPrompt] = useState("");

  const aiPrompt = useMemo(() => prompt.trim() || DEFAULT_AI_PROMPT, [prompt]);

  const handleGenerate = useCallback(async () => {
    await loadPuzzle("ai", selectedDifficulty, aiPrompt);
    setStarted(true);
  }, [loadPuzzle, selectedDifficulty, aiPrompt]);

  const handleNextPuzzle = useCallback(
    async (difficulty: DifficultyLevel) => {
      await loadPuzzle("ai", difficulty, aiPrompt);
    },
    [loadPuzzle, aiPrompt]
  );

  return {
    puzzle,
    loading,
    error,
    started,
    setStarted,
    selectedDifficulty,
    setSelectedDifficulty,
    prompt,
    setPrompt,
    handleGenerate,
    handleNextPuzzle,
  };
}
