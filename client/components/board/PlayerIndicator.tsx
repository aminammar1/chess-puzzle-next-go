"use client";

import { usePuzzleStore } from "@/lib/store";

export default function PlayerIndicator() {
  const { orientation, solved, failed, loading } = usePuzzleStore();

  const isWhite = orientation === "white";

  return (
    <div className="flex w-full items-center justify-between px-1">
      {/* Player color indicator */}
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <div
            className={`h-5 w-5 rounded-full border-2 shadow-inner ${isWhite
              ? "border-white/40 bg-gradient-to-br from-gray-100 to-gray-300"
              : "border-white/20 bg-gradient-to-br from-gray-700 to-gray-900"
              }`}
          />
          {!solved && !failed && (
            <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/40">
              <div className="h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Play as {isWhite ? "White" : "Black"}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
            {solved ? "Solved!" : failed ? "Incorrect" : "Your turn to move"}
          </p>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent-gold)] [animation-delay:0ms]" />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent-gold)] [animation-delay:150ms]" />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent-gold)] [animation-delay:300ms]" />
        </div>
      )}
    </div>
  );
}
