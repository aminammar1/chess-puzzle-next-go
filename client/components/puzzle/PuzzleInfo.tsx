"use client";

import { usePuzzleStore } from "@/lib/store";
import Badge from "@/components/ui/Badge";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import { formatRating, getSourceLabel } from "@/lib/utils";

function difficultyBadge(d: string) {
  switch (d) {
    case "easy":
      return <Badge variant="green">{d}</Badge>;
    case "medium":
      return <Badge variant="yellow">{d}</Badge>;
    case "hard":
      return <Badge variant="red">{d}</Badge>;
    default:
      return <Badge>{d}</Badge>;
  }
}

function sourceBadge(s: string) {
  switch (s) {
    case "lichess":
      return <Badge variant="green">{getSourceLabel(s)}</Badge>;
    case "huggingface-lichess":
      return <Badge variant="blue">{getSourceLabel(s)}</Badge>;
    case "ai-openrouter":
      return <Badge variant="purple">{getSourceLabel(s)}</Badge>;
    default:
      return <Badge>{s}</Badge>;
  }
}

export default function PuzzleInfo() {
  const { puzzle, streak, totalAttempts, hintsUsed } = usePuzzleStore();

  if (!puzzle) return null;

  return (
    <div className="space-y-3">
      {/* Puzzle Details */}
      <Card>
        <CardHeader>
          <CardTitle>Puzzle Info</CardTitle>
          {sourceBadge(puzzle.source)}
        </CardHeader>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">Rating</span>
            <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
              {formatRating(puzzle.rating)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">Difficulty</span>
            {difficultyBadge(puzzle.difficulty)}
          </div>

          {puzzle.themes.length > 0 && (
            <div>
              <span className="text-xs text-[var(--text-muted)]">Themes</span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {puzzle.themes.map((theme) => (
                  <span
                    key={theme}
                    className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {puzzle.gameUrl && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">Game</span>
              <a
                href={puzzle.gameUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-[var(--accent-gold)] transition-colors hover:text-[var(--text-primary)] hover:underline"
              >
                View on Lichess ↗
              </a>
            </div>
          )}
        </div>
      </Card>

      {/* Session Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{totalAttempts}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Attempts
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono text-xl font-bold text-green-400">{streak}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Streak
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono text-xl font-bold text-[var(--accent-gold)]">{hintsUsed}</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Hints
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
