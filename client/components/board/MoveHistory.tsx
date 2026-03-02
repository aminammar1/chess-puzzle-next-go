"use client";

import { usePuzzleStore } from "@/lib/store";
import { useMoveHistoryController } from "@/hooks/useMoveHistoryController";

export default function MoveHistory() {
  const { puzzle, sanMoves, moveIndex, solved } = usePuzzleStore();
  const { scrollRef, pairs } = useMoveHistoryController(sanMoves, moveIndex);

  if (!puzzle || sanMoves.length === 0) return null;

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
            const bPlayed = pair.black ? pair.black.idx < moveIndex : false;
            const currentPlayedIdx = Math.max(0, moveIndex - 1);
            const wCurrent = pair.white.idx === currentPlayedIdx && wPlayed;
            const bCurrent = pair.black ? pair.black.idx === currentPlayedIdx && bPlayed : false;

            return (
              <div key={pair.num} className="flex items-center text-[13px] font-mono gap-1">
                {/* Move number */}
                <span className="w-7 text-right text-[11px] text-white/20 select-none shrink-0">
                  {pair.num}.
                </span>

                {/* White move */}
                <span
                  className={`flex-1 text-center rounded px-2 py-1 transition-all duration-200 ${wCurrent
                    ? "bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-bold ring-1 ring-[var(--accent-gold)]/40"
                    : wPlayed || solved
                      ? "text-[var(--text-primary)]"
                      : "text-white/15"
                    }`}
                >
                  {wPlayed || solved ? pair.white.san : "···"}
                </span>

                {/* Black move */}
                {pair.black ? (
                  <span
                    className={`flex-1 text-center rounded px-2 py-1 transition-all duration-200 ${bCurrent
                      ? "bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-bold ring-1 ring-[var(--accent-gold)]/40"
                      : bPlayed || solved
                        ? "text-[var(--text-primary)]"
                        : "text-white/15"
                      }`}
                  >
                    {bPlayed || solved ? pair.black.san : "···"}
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
