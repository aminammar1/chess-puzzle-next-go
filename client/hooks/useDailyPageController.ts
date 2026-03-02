"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePuzzleStore } from "@/lib/store";
import { getDaysInMonth, getFirstDayOfMonth } from "@/lib/utils";
import { getCompletedDays, markDayCompleted, dailyProgressKey } from "@/lib/daily-progress";
import type { DifficultyLevel } from "@/lib/types";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function useDailyPageController() {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const { puzzle, solved, loadDailyPuzzle, loadPuzzle, loading, error } = usePuzzleStore();
  const [solving, setSolving] = useState(false);
  const [activeSource, setActiveSource] = useState<"lichess" | "dataset">("lichess");
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [completedDays, setCompletedDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCompletedDays(getCompletedDays());
  }, []);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayDate = today.getDate();
  const isCurrentMonth =
    currentMonth === today.getMonth() && currentYear === today.getFullYear();

  const prevMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
      return;
    }
    setCurrentMonth(currentMonth - 1);
  }, [currentMonth, currentYear]);

  const nextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
      return;
    }
    setCurrentMonth(currentMonth + 1);
  }, [currentMonth, currentYear]);

  const handleDayClick = useCallback(
    async (day: number) => {
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
    },
    [isCurrentMonth, todayDate, loadDailyPuzzle, loadPuzzle]
  );

  const handleDailySolved = useCallback(() => {
    if (activeDay !== null) {
      markDayCompleted(currentYear, currentMonth, activeDay);
      setCompletedDays(getCompletedDays());
    }
  }, [activeDay, currentYear, currentMonth]);

  useEffect(() => {
    if (solved && solving && activeDay !== null) {
      handleDailySolved();
    }
  }, [solved, solving, activeDay, handleDailySolved]);

  const handleNextPuzzle = useCallback(
    async (difficulty: DifficultyLevel) => {
      await loadPuzzle(activeSource, difficulty);
    },
    [loadPuzzle, activeSource]
  );

  const handleSolveToday = useCallback(async () => {
    await loadDailyPuzzle();
    setActiveSource("lichess");
    setSolving(true);
  }, [loadDailyPuzzle]);

  const cells: (number | null)[] = useMemo(() => {
    const items: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) items.push(null);
    for (let d = 1; d <= daysInMonth; d++) items.push(d);
    return items;
  }, [firstDay, daysInMonth]);

  const isDayCompleted = useCallback(
    (day: number | null) => {
      if (day === null) return false;
      return !!completedDays[dailyProgressKey(currentYear, currentMonth, day)];
    },
    [completedDays, currentYear, currentMonth]
  );

  return {
    puzzle,
    loading,
    error,
    solved,
    solving,
    setSolving,
    activeSource,
    activeDay,
    completedDays,
    currentMonth,
    currentYear,
    today,
    todayDate,
    isCurrentMonth,
    cells,
    prevMonth,
    nextMonth,
    handleDayClick,
    handleDailySolved,
    handleNextPuzzle,
    handleSolveToday,
    isDayCompleted,
  };
}
