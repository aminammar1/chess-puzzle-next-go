import axios from "axios";
import type { Puzzle, DifficultyLevel, AIPuzzleRequest } from "./types";

// In the browser the Next.js rewrite proxies /api/* to the Go backend.
// NEXT_PUBLIC_API_URL is only needed when calling the backend directly
// (e.g. from a non-Next environment or in production without the proxy).
const baseURL =
  typeof window !== "undefined"
    ? "/api/v1" // always use the proxy in the browser
    : process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const api = axios.create({
  baseURL,
  timeout: 120000,
  headers: { "Content-Type": "application/json" },
});

export async function getPuzzleByDifficulty(
  difficulty: DifficultyLevel = "medium"
): Promise<Puzzle> {
  const { data } = await api.get<Puzzle>("/puzzle", {
    params: { difficulty },
  });
  return data;
}

export async function getDailyPuzzle(): Promise<Puzzle> {
  const { data } = await api.get<Puzzle>("/puzzle/daily");
  return data;
}

export async function getPuzzleById(id: string): Promise<Puzzle> {
  const { data } = await api.get<Puzzle>(`/puzzle/${id}`);
  return data;
}

export async function generateAIPuzzle(req: AIPuzzleRequest): Promise<Puzzle> {
  const { data } = await api.post<Puzzle>("/puzzle/ai", req);
  return data;
}

export async function getDatasetPuzzle(
  difficulty: DifficultyLevel = "medium"
): Promise<Puzzle> {
  const { data } = await api.get<Puzzle>("/puzzle/dataset", {
    params: { difficulty },
  });
  return data;
}

// ---------- Session API (PlayPuzzle service via Redis) ----------

export interface SessionData {
  id: string;
  puzzle_id: string;
  source: string;
  difficulty: string;
  fen: string;
  moves: string[];
  move_index: number;
  solved: boolean;
  failed: boolean;
  hints_used: number;
  started_at: string;
  updated_at: string;
}

export async function createSession(body: {
  puzzle_id: string;
  source: string;
  difficulty: string;
  fen: string;
  moves: string[];
}): Promise<SessionData | null> {
  try {
    const { data } = await api.post<SessionData>("/session", body);
    return data;
  } catch {
    return null; // Redis may be down – don't block the game
  }
}

export async function updateSession(
  id: string,
  body: { move_index: number; solved: boolean; failed: boolean; hints_used: number }
): Promise<void> {
  try {
    await api.put(`/session/${id}`, body);
  } catch {
    // silently ignore
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await api.delete(`/session/${id}`);
  } catch {
    // silently ignore
  }
}

export default api;
