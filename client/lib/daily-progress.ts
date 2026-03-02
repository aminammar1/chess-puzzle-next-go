const STORAGE_KEY = "daily-puzzles-completed";

export function dailyProgressKey(year: number, month: number, day: number) {
  return `${year}-${month}-${day}`;
}

export function getCompletedDays(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function markDayCompleted(year: number, month: number, day: number) {
  const map = getCompletedDays();
  map[dailyProgressKey(year, month, day)] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
