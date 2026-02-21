"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import PuzzleSolver from "@/components/puzzle/PuzzleSolver";
import SubscriptionGate from "@/components/ui/SubscriptionGate";
import Button from "@/components/ui/Button";
import { usePuzzleStore } from "@/lib/store";
import type { DifficultyLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const difficulties: { level: DifficultyLevel; label: string; color: string; active: string }[] = [
  { level: "easy", label: "Easy", color: "text-green-400", active: "border-green-600/50 bg-green-900/20 text-green-400" },
  { level: "medium", label: "Medium", color: "text-yellow-400", active: "border-yellow-600/50 bg-yellow-900/20 text-yellow-400" },
  { level: "hard", label: "Hard", color: "text-red-400", active: "border-red-600/50 bg-red-900/20 text-red-400" },
];

// AI puzzle generation is a premium feature — locked by default.
// In production this would be driven by an auth/subscription context.
const AI_LOCKED = true;

export default function AIPuzzlePage() {
  const { puzzle, loading, error, loadPuzzle } = usePuzzleStore();
  const [started, setStarted] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>("medium");
  const [prompt, setPrompt] = useState("");

  async function handleGenerate() {
    const aiPrompt = prompt.trim() || "Create a tactical chess puzzle";
    await loadPuzzle("ai", selectedDifficulty, aiPrompt);
    setStarted(true);
  }

  async function handleNextPuzzle(difficulty: DifficultyLevel) {
    const aiPrompt = prompt.trim() || "Create a tactical chess puzzle";
    await loadPuzzle("ai", difficulty, aiPrompt);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)]">
      <Navbar />
      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div className="mx-auto max-w-md py-4 text-center animate-fadeIn">
            <p className="mb-3 text-sm text-red-400">{error}</p>
            <button
              onClick={() => setStarted(false)}
              className="text-xs text-[var(--accent-gold)] underline hover:text-[var(--text-primary)]"
            >
              Try again
            </button>
          </div>
        )}

        {!started && (
          <SubscriptionGate feature="AI Puzzle Generation" locked={AI_LOCKED}>
            <div className="mx-auto max-w-lg py-12 animate-fadeIn">
              {/* Header */}
              <div className="mb-10 text-center">
                <div className="mb-4 text-5xl animate-float">♛</div>
                <h1 className="font-serif text-3xl font-bold text-[var(--text-primary)]">AI Puzzles</h1>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Describe the puzzle you want and let AI generate it
                </p>
              </div>

              {/* Prompt input */}
              <div className="mb-6 rounded-xl border border-purple-800/30 bg-white/[0.02] backdrop-blur-sm p-5">
                <label className="mb-2 block font-serif text-sm font-medium text-purple-300">
                  Describe your puzzle
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. A puzzle with a knight fork in the middlegame..."
                  className="mb-4 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-purple-700/50"
                  rows={3}
                />

                {/* Difficulty */}
                <p className="mb-2 font-serif text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Difficulty
                </p>
                <div className="mb-5 flex gap-2">
                  {difficulties.map((d) => (
                    <button
                      key={d.level}
                      onClick={() => setSelectedDifficulty(d.level)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-all duration-200",
                        selectedDifficulty === d.level
                          ? d.active
                          : "border-white/[0.06] bg-white/[0.02] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={handleGenerate}
                  loading={loading}
                  variant="primary"
                  fullWidth
                  size="lg"
                >
                  ♛ Generate Puzzle
                </Button>
              </div>
            </div>
          </SubscriptionGate>
        )}

        {started && loading && !puzzle && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="mb-4 text-5xl animate-float">♛</div>
              <p className="font-serif text-lg text-[var(--text-muted)]">
                AI is crafting your puzzle...
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">’This may take a moment</p>
              <div className="mx-auto mt-4 h-1 w-32 overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-purple-600 to-transparent" />
              </div>
            </div>
          </div>
        )}

        {started && puzzle && (
          <PuzzleSolver
            source="ai"
            onNextPuzzle={handleNextPuzzle}
            onBack={() => setStarted(false)}
          />
        )}
      </div>
    </div>
  );
}
