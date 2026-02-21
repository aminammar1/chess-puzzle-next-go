"use client";

import { useEffect, useCallback } from "react";
import { usePuzzleStore } from "@/lib/store";
import ChessBoard from "@/components/board/ChessBoard";
import MoveHistory from "@/components/board/MoveHistory";
import VoiceButton from "@/components/voice/VoiceButton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatRating, getSourceLabel } from "@/lib/utils";
import type { DifficultyLevel, PuzzleSource } from "@/lib/types";

interface PuzzleSolverProps {
  source: PuzzleSource;
  onNextPuzzle: (difficulty: DifficultyLevel) => void;
  onBack: () => void;
  isDaily?: boolean;
  onDailySolved?: () => void;
}

export default function PuzzleSolver({ source, onNextPuzzle, onBack, isDaily, onDailySolved }: PuzzleSolverProps) {
  const {
    puzzle,
    orientation,
    solved,
    failed,
    loading,
    error,
    streak,
    totalAttempts,
    hintsUsed,
    moveIndex,
    getHint,
    navigateHistory,
    playerMovesLeft,
    waitingForOpponent,
    sessionId,
  } = usePuzzleStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateHistory("back");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateHistory("forward");
      }
    },
    [navigateHistory]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!puzzle) return null;

  const isPlayerWhite = orientation === "white";
  const turnColor = isPlayerWhite ? "White" : "Black";
  const movesLeft = playerMovesLeft();

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full max-w-[1100px] mx-auto animate-fadeIn px-2 sm:px-0">
      {/* ─── Left: Board column ──────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Status banner */}
        {!solved && !failed && !error && (
          <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md px-3 sm:px-4 py-2.5 shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div
                  className={`h-7 w-7 rounded-full border-2 shadow-inner ${isPlayerWhite
                    ? "border-white/40 bg-gradient-to-br from-gray-100 to-gray-300"
                    : "border-white/20 bg-gradient-to-br from-gray-700 to-gray-900"
                    }`}
                />
                {!waitingForOpponent && (
                  <div className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/40">
                    <div className="h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {waitingForOpponent ? "Opponent moving…" : `Your turn (${turnColor})`}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] hidden sm:block">
                  {waitingForOpponent ? "Wait for the response" : "Find the best move"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1">
                <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] hidden sm:inline">Moves</span>
                <span className="font-mono text-sm font-bold text-[var(--accent-gold)]">{movesLeft}</span>
              </div>
              <button
                onClick={() => getHint()}
                disabled={loading || waitingForOpponent}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-semibold text-[var(--accent-gold)] transition-all hover:bg-white/[0.06] active:bg-white/[0.08] disabled:opacity-40"
              >
                ✦ Hint
              </button>
            </div>
          </div>
        )}

        {/* Solved banner */}
        {solved && (
          <div className="flex items-center justify-between rounded-xl border border-green-500/30 bg-green-500/[0.08] backdrop-blur-md px-3 sm:px-4 py-2.5 shadow-inner animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-serif text-base font-bold text-green-400">
                  {isDaily
                    ? "Daily Challenge Complete!"
                    : totalAttempts === 1
                      ? "Brilliant!"
                      : "Puzzle Solved!"}
                </p>
                <p className="text-[10px] text-green-300/70">
                  {isDaily
                    ? "Come back tomorrow for a new challenge"
                    : totalAttempts === 1
                      ? "Perfect — first try!"
                      : `Solved in ${totalAttempts} attempts`}
                </p>
              </div>
            </div>
            {!isDaily && (
              <Button onClick={() => onNextPuzzle(puzzle.difficulty)} variant="primary" size="sm">
                Next →
              </Button>
            )}
            {isDaily && (
              <Button onClick={onBack} variant="primary" size="sm">
                ← Calendar
              </Button>
            )}
          </div>
        )}

        {/* Failed banner */}
        {failed && (
          <div className="flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/[0.08] backdrop-blur-md px-3 py-2.5 shadow-inner animate-fadeIn">
            <span className="text-lg mr-2">✕</span>
            <p className="text-sm font-medium text-red-400">Wrong move — retrying…</p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/[0.06] backdrop-blur-md px-3 py-2.5 shadow-inner animate-fadeIn">
            <p className="text-sm text-yellow-400 text-center">{error}</p>
          </div>
        )}

        {/* Board */}
        <div className="w-full max-w-[min(100%,560px)] mx-auto aspect-square">
          <ChessBoard />
        </div>

        {/* Voice + Nav bar (below board on all sizes) */}
        <div className="flex items-center gap-2 w-full max-w-[min(100%,560px)] mx-auto">
          <VoiceButton />
          {(solved || failed) && (
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] shrink-0">
              <button
                onClick={() => navigateHistory("back")}
                className="rounded px-1.5 py-1 hover:bg-white/[0.04] hover:text-[var(--text-secondary)] transition-colors"
              >
                ◀
              </button>
              <button
                onClick={() => navigateHistory("forward")}
                className="rounded px-1.5 py-1 hover:bg-white/[0.04] hover:text-[var(--text-secondary)] transition-colors"
              >
                ▶
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: Sidebar ──────────────────────────── */}
      <div className="w-full lg:w-[300px] xl:w-[320px] shrink-0 flex flex-col gap-3">
        {/* Puzzle info */}
        <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md p-4 shadow-inner">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
            <h3 className="font-serif text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
              Puzzle
            </h3>
            {puzzle.source === "lichess" && <Badge variant="green">{getSourceLabel(puzzle.source)}</Badge>}
            {puzzle.source === "huggingface-lichess" && <Badge variant="blue">{getSourceLabel(puzzle.source)}</Badge>}
            {puzzle.source === "ai-openrouter" && <Badge variant="purple">{getSourceLabel(puzzle.source)}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
            <div>
              <span className="text-[var(--text-muted)] text-[10px]">Rating</span>
              <p className="font-mono font-bold text-[var(--text-primary)]">{formatRating(puzzle.rating)}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)] text-[10px]">Difficulty</span>
              <div className="mt-0.5">
                {puzzle.difficulty === "easy" && <Badge variant="green">Easy</Badge>}
                {puzzle.difficulty === "medium" && <Badge variant="yellow">Medium</Badge>}
                {puzzle.difficulty === "hard" && <Badge variant="red">Hard</Badge>}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 pt-2 border-t border-white/[0.04]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[var(--text-muted)]">Progress</span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                {moveIndex}/{puzzle.moves.length}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full bg-[var(--accent-green)] transition-all duration-500"
                style={{ width: `${puzzle.moves.length > 0 ? (moveIndex / puzzle.moves.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Themes */}
          {puzzle.themes.length > 0 && (
            <div className="mt-3 pt-2 border-t border-white/[0.04]">
              <div className="flex flex-wrap gap-1">
                {puzzle.themes.map((theme) => (
                  <span
                    key={theme}
                    className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px]">
            {puzzle.gameUrl ? (
              <a
                href={puzzle.gameUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-gold)] hover:underline"
              >
                View on Lichess ↗
              </a>
            ) : (
              <span />
            )}
            {sessionId && (
              <span className="font-mono text-[var(--text-muted)] truncate max-w-[90px]">
                {sessionId.slice(0, 8)}…
              </span>
            )}
          </div>
        </div>

        {/* Move History */}
        <MoveHistory />

        {/* Session Stats */}
        <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md p-4 shadow-inner">
          <h3 className="font-serif text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)] mb-3 pb-2 border-b border-white/[0.06]">
            Session
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{totalAttempts}</p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)] mt-0.5">Attempts</p>
            </div>
            <div>
              <p className="font-mono text-xl font-bold text-green-400">{streak}</p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)] mt-0.5">Streak</p>
            </div>
            <div>
              <p className="font-mono text-xl font-bold text-[var(--accent-gold)]">{hintsUsed}</p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-muted)] mt-0.5">Hints</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <Button onClick={onBack} variant="ghost" className="flex-1" size="sm">
            ← Back
          </Button>
          {!isDaily && (
            <Button
              onClick={() => onNextPuzzle(puzzle.difficulty)}
              loading={loading}
              variant="primary"
              className="flex-[2]"
              size="sm"
            >
              Next Puzzle
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
