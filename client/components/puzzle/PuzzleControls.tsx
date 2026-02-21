"use client";

import { usePuzzleStore } from "@/lib/store";
import type { DifficultyLevel, PuzzleSource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";

export default function PuzzleControls() {
  const { loading, solved, failed, resetPuzzle, loadPuzzle, getHint } =
    usePuzzleStore();
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<DifficultyLevel>("medium");
  const [showAiInput, setShowAiInput] = useState(false);

  const difficulties: DifficultyLevel[] = ["easy", "medium", "hard"];

  function handleLoadPuzzle(source: PuzzleSource) {
    if (source === "ai") {
      setShowAiInput(true);
      return;
    }
    loadPuzzle(source, selectedDifficulty);
  }

  function handleAiGenerate() {
    const prompt = aiPrompt.trim() || "Create a tactical chess puzzle";
    loadPuzzle("ai", selectedDifficulty, prompt);
    setShowAiInput(false);
    setAiPrompt("");
  }

  return (
    <div className="space-y-3">
      {/* Difficulty Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Difficulty</CardTitle>
        </CardHeader>
        <div className="flex gap-2">
          {difficulties.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDifficulty(d)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-all duration-200",
                selectedDifficulty === d
                  ? d === "easy"
                    ? "border-green-700/40 bg-green-900/30 text-green-400"
                    : d === "medium"
                      ? "border-yellow-700/40 bg-yellow-900/30 text-yellow-400"
                      : "border-red-700/40 bg-red-900/30 text-red-400"
                  : "border-white/[0.06] bg-white/[0.02] text-[var(--text-muted)] hover:border-white/[0.12] hover:text-[var(--text-secondary)]"
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </Card>

      {/* Puzzle Sources */}
      <Card>
        <CardHeader>
          <CardTitle>New Puzzle</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          <button
            onClick={() => handleLoadPuzzle("lichess")}
            disabled={loading}
            className="group flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-all duration-200 hover:border-green-700/40 hover:bg-green-900/10 disabled:opacity-40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-900/30 text-lg transition-transform group-hover:scale-105">
              ♞
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Lichess</p>
              <p className="text-[10px] text-[var(--text-muted)]">Random rated puzzle</p>
            </div>
          </button>

          <button
            onClick={() => handleLoadPuzzle("dataset")}
            disabled={loading}
            className="group flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-all duration-200 hover:border-blue-700/40 hover:bg-blue-900/10 disabled:opacity-40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-900/30 text-lg transition-transform group-hover:scale-105">
              ♜
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Dataset</p>
              <p className="text-[10px] text-[var(--text-muted)]">Lichess puzzle database</p>
            </div>
          </button>

          <button
            onClick={() => handleLoadPuzzle("ai")}
            disabled={loading}
            className="group flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-all duration-200 hover:border-purple-700/40 hover:bg-purple-900/10 disabled:opacity-40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-900/30 text-lg transition-transform group-hover:scale-105">
              ♛
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">AI Puzzle</p>
              <p className="text-[10px] text-[var(--text-muted)]">Custom AI-generated</p>
            </div>
          </button>
        </div>
      </Card>

      {/* AI Prompt Modal */}
      {showAiInput && (
        <Card className="border-purple-800/30">
          <h4 className="mb-2 font-serif text-sm font-medium text-purple-300">
            Describe your puzzle
          </h4>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g. Create a tactical puzzle with a discovered attack..."
            className="mb-3 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-purple-700/50"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleAiGenerate}
              loading={loading}
              variant="primary"
              fullWidth
            >
              Generate
            </Button>
            <Button onClick={() => setShowAiInput(false)} variant="ghost">
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Retry & Hint */}
      <div className="flex gap-2">
        {(solved || failed) && (
          <Button onClick={resetPuzzle} variant="secondary" fullWidth>
            <span className="mr-1">↺</span> Retry
          </Button>
        )}
        <Button
          onClick={() => getHint()}
          disabled={solved || failed || loading}
          variant="gold"
          fullWidth
        >
          <span className="mr-1">✦</span> Hint
        </Button>
      </div>
    </div>
  );
}
