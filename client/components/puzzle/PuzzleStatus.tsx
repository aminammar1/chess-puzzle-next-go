"use client";

import { usePuzzleStore } from "@/lib/store";

export default function PuzzleStatus() {
  const { solved, failed, totalAttempts } = usePuzzleStore();

  if (!solved && !failed) return null;

  if (solved) {
    return (
      <div className="animate-fadeIn rounded-xl border border-green-500/20 bg-green-500/[0.06] backdrop-blur-sm p-4 text-center">
        <div className="mb-1 text-2xl">♔</div>
        <p className="font-serif text-lg font-bold text-green-400">
          Brilliant!
        </p>
        <p className="text-xs text-green-300/60">
          {totalAttempts === 1
            ? "Perfect — first try!"
            : `Solved in ${totalAttempts} attempts`}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn rounded-xl border border-red-500/20 bg-red-500/[0.06] backdrop-blur-sm p-4 text-center">
      <div className="mb-1 text-2xl">♚</div>
      <p className="font-serif text-lg font-bold text-red-400">
        Incorrect
      </p>
      <p className="text-xs text-red-300/60">
        That&apos;s not the best move. Try again!
      </p>
    </div>
  );
}
