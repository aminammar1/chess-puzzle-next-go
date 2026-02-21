"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import DifficultyPicker from "@/components/puzzle/DifficultyPicker";
import PuzzleSolver from "@/components/puzzle/PuzzleSolver";
import { usePuzzleStore } from "@/lib/store";
import type { DifficultyLevel } from "@/lib/types";

export default function DatasetPuzzlePage() {
  const { puzzle, loading, error, loadPuzzle } = usePuzzleStore();
  const [started, setStarted] = useState(false);

  async function handleSelectDifficulty(difficulty: DifficultyLevel) {
    await loadPuzzle("dataset", difficulty);
    setStarted(true);
  }

  async function handleNextPuzzle(difficulty: DifficultyLevel) {
    await loadPuzzle("dataset", difficulty);
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
          <div className="py-12">
            <DifficultyPicker
              source="dataset"
              onSelect={handleSelectDifficulty}
              loading={loading}
            />
          </div>
        )}

        {started && loading && !puzzle && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="mb-4 text-5xl animate-float">♜</div>
              <p className="font-serif text-lg text-[var(--text-muted)]">
                Fetching dataset puzzle...
              </p>
              <div className="mx-auto mt-4 h-1 w-32 overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-blue-600 to-transparent" />
              </div>
            </div>
          </div>
        )}

        {started && puzzle && (
          <PuzzleSolver
            source="dataset"
            onNextPuzzle={handleNextPuzzle}
            onBack={() => setStarted(false)}
          />
        )}
      </div>
    </div>
  );
}
