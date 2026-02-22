import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatRating(rating: number): string {
  return rating.toString();
}

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case "easy":
      return "text-green-400";
    case "medium":
      return "text-yellow-400";
    case "hard":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}

export function getDifficultyBg(difficulty: string): string {
  switch (difficulty) {
    case "easy":
      return "bg-green-500/20 border-green-500/30";
    case "medium":
      return "bg-yellow-500/20 border-yellow-500/30";
    case "hard":
      return "bg-red-500/20 border-red-500/30";
    default:
      return "bg-gray-500/20 border-gray-500/30";
  }
}

export function getSourceLabel(source: string): string {
  switch (source) {
    case "lichess":
      return "Lichess";
    case "huggingface-lichess":
      return "Dataset";
    case "ai-openrouter":
    case "ai-rag":
      return "AI Generated";
    default:
      return source;
  }
}

export function getSourceColor(source: string): string {
  switch (source) {
    case "lichess":
      return "bg-[#629924]/20 text-[#81b64c] border-[#629924]/30";
    case "huggingface-lichess":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "ai-openrouter":
    case "ai-rag":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}
