"use client";

import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";
import Quote from "@/components/ui/Quote";
import PuzzleSolver from "@/components/puzzle/PuzzleSolver";
import { usePuzzleStore } from "@/lib/store";
import { getDaysInMonth, getFirstDayOfMonth } from "@/lib/utils";
import type { DifficultyLevel } from "@/lib/types";

/* ─── localStorage helpers for solved-day tracking ────────────── */
const STORAGE_KEY = "daily-puzzles-completed";

function getCompletedDays(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function markDayCompleted(year: number, month: number, day: number) {
  const map = getCompletedDays();
  map[`${year}-${month}-${day}`] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function isDayCompleted(year: number, month: number, day: number): boolean {
  return !!getCompletedDays()[`${year}-${month}-${day}`];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DailyPage() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const { puzzle, solved, loadDailyPuzzle, loadPuzzle, loading, error } = usePuzzleStore();
  const [solving, setSolving] = useState(false);
  const [activeSource, setActiveSource] = useState<"lichess" | "dataset">("lichess");
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [completedDays, setCompletedDays] = useState<Record<string, boolean>>({});

  // Load completed days from localStorage AFTER hydration
  useEffect(() => {
    setCompletedDays(getCompletedDays());
  }, []);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayDate = today.getDate();
  const isCurrentMonth =
    currentMonth === today.getMonth() && currentYear === today.getFullYear();

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  async function handleDayClick(day: number) {
    setActiveDay(day);
    if (isCurrentMonth && day === todayDate) {
      await loadDailyPuzzle();
      setActiveSource("lichess");
    } else {
      const difficulties = ["easy", "medium", "hard"] as const;
      const diff = difficulties[day % 3];
      await loadPuzzle("dataset", diff);
      setActiveSource("dataset");
    }
    setSolving(true);
  }

  /** Called when the current daily puzzle is solved */
  const handleDailySolved = useCallback(() => {
    if (activeDay !== null) {
      markDayCompleted(currentYear, currentMonth, activeDay);
      setCompletedDays(getCompletedDays());
    }
  }, [activeDay, currentYear, currentMonth]);

  /** Watch the store's solved flag to auto-mark completion */
  useEffect(() => {
    if (solved && solving && activeDay !== null) {
      handleDailySolved();
    }
  }, [solved, solving, activeDay, handleDailySolved]);

  async function handleNextPuzzle(difficulty: DifficultyLevel) {
    await loadPuzzle(activeSource, difficulty);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="min-h-screen bg-[var(--bg-deep)]">
      <Navbar />

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Puzzle Solving Mode */}
        {solving && puzzle && (
          <PuzzleSolver
            source={activeSource}
            onNextPuzzle={handleNextPuzzle}
            onBack={() => setSolving(false)}
            isDaily
            onDailySolved={handleDailySolved}
          />
        )}

        {/* Error state */}
        {solving && !puzzle && error && (
          <div className="mx-auto max-w-lg text-center py-20">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={() => setSolving(false)} variant="secondary" size="sm">
              ← Back to Calendar
            </Button>
          </div>
        )}

        {/* Calendar Mode */}
        {!solving && (
          <div className="mx-auto max-w-2xl">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mb-3 text-4xl">♜</div>
              <h1 className="font-serif text-3xl font-bold text-[var(--text-primary)]">
                Daily Puzzles
              </h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Today&apos;s puzzle comes from <span className="text-green-400 font-medium">Lichess</span>.
                Past days draw from the <span className="text-blue-400 font-medium">puzzle dataset</span>.
              </p>
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                  <span className="h-2 w-2 rounded-full bg-green-500" /> Lichess daily
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Dataset casual
                </span>
              </div>
            </div>

            {/* Calendar Navigation */}
            <div className="mb-4 flex items-center justify-between">
              <Button onClick={prevMonth} variant="ghost" size="sm">
                ← Prev
              </Button>
              <h2 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
              <Button onClick={nextMonth} variant="ghost" size="sm">
                Next →
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm shadow-xl shadow-black/10">
              {/* Day names header */}
              <div className="grid grid-cols-7 border-b border-white/[0.06] bg-white/[0.02]">
                {DAY_NAMES.map((name) => (
                  <div
                    key={name}
                    className="px-2 py-3 text-center font-serif text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]"
                  >
                    {name}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7">
                {cells.map((day, idx) => {
                  const isToday = isCurrentMonth && day === todayDate;
                  const isPast =
                    day !== null &&
                    (currentYear < today.getFullYear() ||
                      (currentYear === today.getFullYear() &&
                        currentMonth < today.getMonth()) ||
                      (isCurrentMonth && day < todayDate));
                  const isFuture =
                    day !== null &&
                    (currentYear > today.getFullYear() ||
                      (currentYear === today.getFullYear() &&
                        currentMonth > today.getMonth()) ||
                      (isCurrentMonth && day > todayDate));
                  const completed =
                    day !== null && !!completedDays[`${currentYear}-${currentMonth}-${day}`];

                  return (
                    <button
                      key={idx}
                      onClick={() => day && !isFuture && handleDayClick(day)}
                      disabled={day === null || isFuture || loading}
                      className={`relative flex h-16 items-center justify-center border-b border-r border-white/[0.04] text-sm font-medium transition-all duration-200 ${day === null
                        ? "cursor-default"
                        : isFuture
                          ? "cursor-not-allowed text-[var(--text-muted)]"
                          : isToday
                            ? "bg-green-500/10 text-green-400 hover:bg-green-500/20 cursor-pointer"
                            : isPast
                              ? "text-[var(--text-secondary)] hover:bg-white/[0.04] cursor-pointer"
                              : "text-[var(--text-secondary)] hover:bg-white/[0.04] cursor-pointer"
                        }`}
                    >
                      {day && (
                        <>
                          <span className={isToday ? "font-bold" : ""}>{day}</span>
                          {/* ✅ Solved checkmark */}
                          {completed && (
                            <span className="absolute right-1 top-1 text-green-400 text-xs drop-shadow-[0_0_4px_rgba(74,222,128,0.6)]">
                              ✓
                            </span>
                          )}
                          {isToday && !completed && (
                            <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-green-500 shadow-lg shadow-green-500/40" />
                          )}
                          {isToday && completed && (
                            <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-green-500 shadow-lg shadow-green-500/40" />
                          )}
                          {isPast && !completed && (
                            <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-500/60" />
                          )}
                          {isPast && completed && (
                            <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-green-500/80" />
                          )}
                          {isToday && !completed && (
                            <span className="absolute left-1 top-1 text-[8px] font-semibold text-green-400">LIVE</span>
                          )}
                          {isToday && completed && (
                            <span className="absolute left-1 top-1 text-[8px] font-semibold text-green-400">DONE</span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Today's Puzzle Highlight */}
            <div className="mt-8 rounded-xl border border-green-500/20 bg-green-500/[0.04] p-8 text-center">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /> Lichess Daily
              </div>
              <div className="mb-3 text-3xl">♔</div>
              <h3 className="font-serif text-lg font-semibold text-green-400">
                Today&apos;s Challenge
              </h3>
              <p className="mt-1 mb-5 text-sm text-[var(--text-muted)]">
                A fresh puzzle from Lichess every day. Can you solve it?
              </p>
              <Button
                onClick={async () => {
                  await loadDailyPuzzle();
                  setActiveSource("lichess");
                  setSolving(true);
                }}
                loading={loading}
                variant="gold"
                size="lg"
              >
                ♔ Solve Today&apos;s Puzzle
              </Button>
            </div>

            {/* Casual note */}
            <div className="mt-4 rounded-lg border border-blue-500/10 bg-blue-500/[0.03] px-4 py-3 text-center text-xs text-blue-300/80">
              Click any past day to practice with a <span className="font-semibold">casual puzzle</span> from our dataset — no time pressure.
            </div>

            {/* Quote */}
            <div className="mt-10 text-center">
              <Quote />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
