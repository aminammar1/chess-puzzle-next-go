"use client";

import { usePuzzleStore } from "@/lib/store";
import { useRef, useEffect } from "react";

export default function MoveHistory() {
  const { puzzle, sanMoves, moveIndex, solved } = usePuzzleStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the current move
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moveIndex]);

  if (!puzzle || sanMoves.length === 0) return null;

  // Group moves into pairs (White move, Black move)
  const pairs: {
    num: number;
    white: { san: string; idx: number };
    black: { san: string; idx: number } | null;
  }[] = [];

  for (let i = 0; i < sanMoves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: { san: sanMoves[i], idx: i },
      black: i + 1 < sanMoves.length ? { san: sanMoves[i + 1], idx: i + 1 } : null,
    });
  }

  return (
    <div className="w-full rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md shadow-inner overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 bg-white/[0.02]">
        <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent-gold)] shadow-[0_0_6px_var(--accent-gold)]" />
        <span className="font-serif text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
          Moves
        </span>
        <span className="ml-auto text-[10px] text-[var(--text-muted)] font-mono">
          {moveIndex}/{sanMoves.length}
        </span>
      </div>

      {/* Move list */}
      <div ref={scrollRef} className="max-h-[200px] overflow-y-auto p-2 custom-scrollbar">
        <div className="space-y-0.5">
          {pairs.map((pair) => {
            const wPlayed = pair.white.idx < moveIndex;
            const wCurrent = pair.white.idx === moveIndex;
            const bPlayed = pair.black ? pair.black.idx < moveIndex : false;
            const bCurrent = pair.black ? pair.black.idx === moveIndex : false;

            return (
              <div key={pair.num} className="flex items-center text-[13px] font-mono gap-1">
                {/* Move number */}
                <span className="w-7 text-right text-[11px] text-white/20 select-none shrink-0">
                  {pair.num}.
                </span>

                {/* White move */}
                <span
                  className={`flex-1 text-center rounded px-2 py-1 transition-all duration-200 ${
                    wCurrent
                      ? "bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-bold ring-1 ring-[var(--accent-gold)]/40"
                      : wPlayed || solved
                        ? "text-[var(--text-primary)]"
                        : "text-white/15"
                  }`}
                >
                  {wPlayed || wCurrent || solved ? pair.white.san : "···"}
                </span>

                {/* Black move */}
                {pair.black ? (
                  <span
                    className={`flex-1 text-center rounded px-2 py-1 transition-all duration-200 ${
                      bCurrent
                        ? "bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-bold ring-1 ring-[var(--accent-gold)]/40"
                        : bPlayed || solved
                          ? "text-[var(--text-primary)]"
                          : "text-white/15"
                    }`}
                  >
                    {bPlayed || bCurrent || solved ? pair.black.san : "···"}
                  </span>
                ) : (
                  <span className="flex-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
