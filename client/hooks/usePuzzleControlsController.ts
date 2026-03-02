"use client";

import { useState, useCallback } from "react";
import { usePuzzleStore } from "@/lib/store";
import type { DifficultyLevel, PuzzleSource } from "@/lib/types";

export function usePuzzleControlsController() {
  const { loading, solved, failed, resetPuzzle, loadPuzzle, getHint } = usePuzzleStore();
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>("medium");
  const [showAiInput, setShowAiInput] = useState(false);

  const difficulties: DifficultyLevel[] = ["easy", "medium", "hard"];

  const handleLoadPuzzle = useCallback(
    (source: PuzzleSource) => {
      if (source === "ai") {
        setShowAiInput(true);
        return;
      }
      loadPuzzle(source, selectedDifficulty);
    },
    [loadPuzzle, selectedDifficulty]
  );

  const handleAiGenerate = useCallback(() => {
    const prompt = aiPrompt.trim() || "Create a tactical chess puzzle";
    loadPuzzle("ai", selectedDifficulty, prompt);
    setShowAiInput(false);
    setAiPrompt("");
  }, [aiPrompt, loadPuzzle, selectedDifficulty]);

  return {
    loading,
    solved,
    failed,
    resetPuzzle,
    getHint,
    aiPrompt,
    setAiPrompt,
    selectedDifficulty,
    setSelectedDifficulty,
    showAiInput,
    setShowAiInput,
    difficulties,
    handleLoadPuzzle,
    handleAiGenerate,
  };
}
