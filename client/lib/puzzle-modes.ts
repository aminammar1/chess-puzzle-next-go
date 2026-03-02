import type { DifficultyLevel } from "@/lib/types";

export interface PuzzleModeCard {
  href: string;
  icon: string;
  title: string;
  description: string;
  border: string;
  iconBg: string;
  tag: string;
  tagColor: string;
  premium?: boolean;
}

export interface DifficultyOption {
  level: DifficultyLevel;
  label: string;
  color: string;
  active: string;
}

const MODES: PuzzleModeCard[] = [
  {
    href: "/puzzles/lichess",
    icon: "♞",
    title: "Lichess Puzzles",
    description:
      "Real puzzles from Lichess rated games. Difficulty-filtered with unique deduplication.",
    border: "border-green-800/30 hover:border-green-600/50",
    iconBg: "bg-green-900/30 text-green-400",
    tag: "Popular",
    tagColor: "bg-green-900/30 text-green-400 border-green-700/30",
  },
  {
    href: "/puzzles/dataset",
    icon: "♜",
    title: "Dataset Puzzles",
    description:
      "Millions of rated puzzles from the Lichess puzzle database on HuggingFace.",
    border: "border-blue-800/30 hover:border-blue-600/50",
    iconBg: "bg-blue-900/30 text-blue-400",
    tag: "Huge Collection",
    tagColor: "bg-blue-900/30 text-blue-400 border-blue-700/30",
  },
  {
    href: "/puzzles/ai",
    icon: "♛",
    title: "AI Generated",
    description:
      "Custom puzzles created by AI. Describe the theme and difficulty you want.",
    border: "border-purple-800/30 hover:border-purple-600/50",
    iconBg: "bg-purple-900/30 text-purple-400",
    tag: "Pro",
    tagColor: "bg-purple-900/30 text-purple-400 border-purple-700/30",
    premium: true,
  },
];

export const AI_DIFFICULTIES: DifficultyOption[] = [
  {
    level: "easy",
    label: "Easy",
    color: "text-green-400",
    active: "border-green-600/50 bg-green-900/20 text-green-400",
  },
  {
    level: "medium",
    label: "Medium",
    color: "text-yellow-400",
    active: "border-yellow-600/50 bg-yellow-900/20 text-yellow-400",
  },
  {
    level: "hard",
    label: "Hard",
    color: "text-red-400",
    active: "border-red-600/50 bg-red-900/20 text-red-400",
  },
];

export function getPuzzleModes() {
  return MODES;
}
