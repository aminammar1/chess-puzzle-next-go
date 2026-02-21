export type DifficultyLevel = "easy" | "medium" | "hard";

export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  initialPly: number;
  rating: number;
  ratingDeviation: number;
  popularity: number;
  nbPlays: number;
  themes: string[];
  gameUrl?: string;
  difficulty: DifficultyLevel;
  source: string;
}

export interface AIPuzzleRequest {
  prompt: string;
  difficulty: DifficultyLevel;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}

export type PuzzleSource = "lichess" | "dataset" | "ai";

export interface PuzzleAttempt {
  moveIndex: number;
  move: string;
  correct: boolean;
  timestamp: number;
}
