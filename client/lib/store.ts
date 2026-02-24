import { create } from "zustand";
import { Chess, type Square } from "chess.js";
import type { Puzzle, PuzzleSource, DifficultyLevel, PuzzleAttempt } from "./types";
import {
  getPuzzleByDifficulty,
  getDailyPuzzle,
  generateAIPuzzle,
  getDatasetPuzzle,
  createSession,
  updateSession,
  deleteSession,
} from "./api";
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playSolvedSound,
  playFailedSound,
  playIllegalSound,
} from "./sounds";

interface PuzzleState {
  puzzle: Puzzle | null;
  source: PuzzleSource;
  loading: boolean;
  error: string | null;

  game: Chess | null;
  fen: string;
  orientation: "white" | "black";
  moveIndex: number;

  solved: boolean;
  failed: boolean;
  attempts: PuzzleAttempt[];
  totalAttempts: number;
  hintsUsed: number;

  hintSquare: string | null;
  lastMoveSquares: { from: string; to: string } | null;

  voiceListening: boolean;
  voiceTranscript: string;

  puzzlesSolved: number;
  puzzlesFailed: number;
  streak: number;

  waitingForOpponent: boolean;
  sessionId: string | null;

  /** SAN notation for each puzzle move (pre-computed) */
  sanMoves: string[];

  moveHistory: { fen: string; from: string; to: string; san: string }[];
  historyViewIndex: number;

  remainingMoves: () => number;
  totalPuzzleMoves: () => number;
  playerMovesLeft: () => number;

  loadPuzzle: (source: PuzzleSource, difficulty?: DifficultyLevel, aiPrompt?: string) => Promise<void>;
  loadDailyPuzzle: () => Promise<void>;
  setPuzzle: (puzzle: Puzzle) => void;
  makeMove: (from: string, to: string, promotion?: string) => boolean;
  makeComputerMove: () => void;
  getHint: () => string | null;
  clearHint: () => void;
  resetPuzzle: () => void;
  setVoiceListening: (listening: boolean) => void;
  setVoiceTranscript: (transcript: string) => void;
  processVoiceMove: (transcript: string, from?: string, to?: string, promotion?: string) => boolean;
  navigateHistory: (direction: "back" | "forward") => void;
}

function getOrientation(fen: string): "white" | "black" {
  const parts = fen.split(" ");
  const sideToMove = parts[1];
  return sideToMove === "w" ? "black" : "white";
}

function uciToSquares(uci: string): { from: Square; to: Square; promotion?: string } {
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.length > 4 ? uci[4] : undefined;
  return { from, to, promotion };
}

/** Pre-compute SAN notation for all puzzle moves. */
function computeSanMoves(fen: string, uciMoves: string[]): string[] {
  const sans: string[] = [];
  try {
    const g = new Chess(fen);
    for (const uci of uciMoves) {
      const { from, to, promotion } = uciToSquares(uci);
      try {
        const result = g.move({ from, to, promotion });
        sans.push(result ? result.san : uci);
      } catch {
        sans.push(uci);
      }
    }
  } catch {
    return uciMoves.map((u) => u);
  }
  return sans;
}

/** Play the appropriate sound for a move that was just made on the game. */
function playMoveAudio(game: Chess, captured: boolean) {
  if (game.isCheck()) {
    playCheckSound();
  } else if (captured) {
    playCaptureSound();
  } else {
    playMoveSound();
  }
}

export const usePuzzleStore = create<PuzzleState>((set, get) => ({
  puzzle: null,
  source: "lichess",
  loading: false,
  error: null,
  game: null,
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  orientation: "white",
  moveIndex: 0,
  solved: false,
  failed: false,
  attempts: [],
  totalAttempts: 0,
  hintsUsed: 0,
  hintSquare: null,
  lastMoveSquares: null,
  voiceListening: false,
  voiceTranscript: "",
  puzzlesSolved: 0,
  puzzlesFailed: 0,
  streak: 0,
  sanMoves: [],
  moveHistory: [],
  historyViewIndex: -1,
  waitingForOpponent: false,
  sessionId: null,

  remainingMoves: () => {
    const { puzzle, moveIndex } = get();
    if (!puzzle) return 0;
    return Math.ceil((puzzle.moves.length - moveIndex) / 2);
  },

  totalPuzzleMoves: () => {
    const { puzzle } = get();
    if (!puzzle) return 0;
    return Math.ceil(puzzle.moves.length / 2);
  },

  playerMovesLeft: () => {
    const { puzzle, moveIndex } = get();
    if (!puzzle) return 0;
    let count = 0;
    for (let i = moveIndex; i < puzzle.moves.length; i += 2) count++;
    return count;
  },

  // ─── Load helpers ────────────────────────────────────────────

  loadPuzzle: async (source, difficulty = "medium", aiPrompt) => {
    set({ loading: true, error: null });
    try {
      let puzzle: Puzzle;
      switch (source) {
        case "lichess":
          puzzle = await getPuzzleByDifficulty(difficulty);
          break;
        case "dataset":
          puzzle = await getDatasetPuzzle(difficulty);
          break;
        case "ai":
          puzzle = await generateAIPuzzle({
            prompt: aiPrompt || "Create a tactical chess puzzle",
            difficulty,
          });
          break;
        default:
          throw new Error("Unknown source");
      }
      get().setPuzzle(puzzle);
      set({ source, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load puzzle";
      set({ loading: false, error: message });
    }
  },

  loadDailyPuzzle: async () => {
    set({ loading: true, error: null });
    try {
      const puzzle = await getDailyPuzzle();
      get().setPuzzle(puzzle);
      set({ source: "lichess", loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load daily puzzle";
      set({ loading: false, error: message });
    }
  },

  // ─── Core puzzle setup ───────────────────────────────────────

  setPuzzle: (puzzle) => {
    const prevSession = get().sessionId;
    if (prevSession) deleteSession(prevSession);

    if (!puzzle.fen || puzzle.fen.trim() === "") {
      set({
        puzzle, game: null,
        error: "Puzzle has no FEN position. Try another puzzle.",
        solved: false, failed: false,
        attempts: [], totalAttempts: 0, hintsUsed: 0,
        hintSquare: null, lastMoveSquares: null,
        moveIndex: 0, sanMoves: [],
        moveHistory: [], historyViewIndex: -1,
        waitingForOpponent: false, sessionId: null,
      });
      return;
    }

    if (!puzzle.moves || puzzle.moves.length === 0) {
      set({
        puzzle, game: null,
        error: "Puzzle has no solution moves. Try another puzzle.",
        solved: false, failed: false,
        attempts: [], totalAttempts: 0, hintsUsed: 0,
        hintSquare: null, lastMoveSquares: null,
        moveIndex: 0, sanMoves: [],
        moveHistory: [], historyViewIndex: -1,
        waitingForOpponent: false, sessionId: null,
      });
      return;
    }

    let game: Chess;
    try {
      game = new Chess(puzzle.fen);
    } catch (e) {
      set({
        puzzle, game: null,
        error: `Invalid FEN: ${e instanceof Error ? e.message : "unknown"}`,
        solved: false, failed: false,
        waitingForOpponent: false, sessionId: null,
      });
      return;
    }

    const orientation = getOrientation(puzzle.fen);
    const sanMoves = computeSanMoves(puzzle.fen, puzzle.moves);

    set({
      puzzle, game, fen: puzzle.fen, orientation,
      moveIndex: 0,
      solved: false, failed: false,
      attempts: [], totalAttempts: 0, hintsUsed: 0,
      hintSquare: null, lastMoveSquares: null,
      error: null,
      sanMoves,
      moveHistory: [{ fen: puzzle.fen, from: "", to: "", san: "" }],
      historyViewIndex: -1,
      waitingForOpponent: true,
      sessionId: null,
    });

    createSession({
      puzzle_id: puzzle.id,
      source: puzzle.source,
      difficulty: puzzle.difficulty,
      fen: puzzle.fen,
      moves: puzzle.moves,
    }).then((session) => {
      if (session) set({ sessionId: session.id });
    });

    // Play the computer's setup move
    setTimeout(() => get().makeComputerMove(), 600);
  },

  // ─── Player move ─────────────────────────────────────────────

  makeMove: (from, to, promotion) => {
    const { game, puzzle, moveIndex, solved, failed, waitingForOpponent } = get();
    if (!game || !puzzle || solved || failed || waitingForOpponent) return false;
    if (moveIndex >= puzzle.moves.length) return false;

    const expectedUCI = puzzle.moves[moveIndex];
    const attemptUCI = from + to + (promotion || "");

    const attempt: PuzzleAttempt = {
      moveIndex, move: attemptUCI,
      correct: attemptUCI === expectedUCI,
      timestamp: Date.now(),
    };

    if (attemptUCI === expectedUCI) {
      let captured = false;
      try {
        const result = game.move({ from: from as Square, to: to as Square, promotion });
        captured = !!result?.captured;
      } catch {
        return false;
      }

      const newMoveIndex = moveIndex + 1;
      const san = get().sanMoves[moveIndex] || attemptUCI;
      const newHistory = [...get().moveHistory, { fen: game.fen(), from, to, san }];
      const newAttempts = [...get().attempts, attempt];

      if (newMoveIndex >= puzzle.moves.length) {
        // Play move sound, then solved chime
        playMoveAudio(game, captured);
        setTimeout(() => playSolvedSound(), 300);
        set({
          fen: game.fen(), moveIndex: newMoveIndex,
          solved: true, waitingForOpponent: false,
          attempts: newAttempts,
          totalAttempts: get().totalAttempts + 1,
          puzzlesSolved: get().puzzlesSolved + 1,
          streak: get().streak + 1,
          hintSquare: null,
          lastMoveSquares: { from, to },
          moveHistory: newHistory, historyViewIndex: -1,
        });
        const sid = get().sessionId;
        if (sid) updateSession(sid, { move_index: newMoveIndex, solved: true, failed: false, hints_used: get().hintsUsed });
      } else {
        playMoveAudio(game, captured);
        set({
          fen: game.fen(), moveIndex: newMoveIndex,
          attempts: newAttempts,
          totalAttempts: get().totalAttempts + 1,
          hintSquare: null,
          lastMoveSquares: { from, to },
          moveHistory: newHistory, historyViewIndex: -1,
          waitingForOpponent: true,
        });
        setTimeout(() => get().makeComputerMove(), 400);
      }
      return true;
    } else {
      // Wrong move — flash error then auto-retry
      playIllegalSound();
      playFailedSound();
      set({
        attempts: [...get().attempts, attempt],
        totalAttempts: get().totalAttempts + 1,
        failed: true, waitingForOpponent: false,
        puzzlesFailed: get().puzzlesFailed + 1,
        streak: 0, hintSquare: null,
      });
      const sid = get().sessionId;
      if (sid) updateSession(sid, { move_index: moveIndex, solved: false, failed: true, hints_used: get().hintsUsed });

      setTimeout(() => {
        const { failed: stillFailed, puzzle: p } = get();
        if (stillFailed && p) get().setPuzzle(p);
      }, 1500);

      return false;
    }
  },

  // ─── Computer move ───────────────────────────────────────────

  makeComputerMove: () => {
    const { game, puzzle, moveIndex } = get();
    if (!game || !puzzle || moveIndex >= puzzle.moves.length) {
      set({ waitingForOpponent: false });
      return;
    }

    const uci = puzzle.moves[moveIndex];
    const { from, to, promotion } = uciToSquares(uci);
    const san = get().sanMoves[moveIndex] || uci;

    // Check if the target square has a piece (i.e. capture)
    const targetPiece = game.get(to);
    const isCapture = !!targetPiece;

    try {
      game.move({ from, to, promotion });
    } catch {
      try {
        const rebuilt = new Chess(game.fen());
        rebuilt.move({ from, to, promotion });
        playMoveAudio(rebuilt, isCapture);
        const newHistory = [...get().moveHistory, { fen: rebuilt.fen(), from, to, san }];
        set({
          game: rebuilt, fen: rebuilt.fen(),
          moveIndex: moveIndex + 1,
          lastMoveSquares: { from, to },
          moveHistory: newHistory, historyViewIndex: -1,
          waitingForOpponent: false,
        });
        return;
      } catch {
        console.error("Invalid computer move:", uci, "FEN:", game.fen());
        set({
          waitingForOpponent: false,
          error: `Puzzle data error — move ${uci} is invalid. Try another puzzle.`,
        });
        return;
      }
    }

    playMoveAudio(game, isCapture);
    const newHistory = [...get().moveHistory, { fen: game.fen(), from, to, san }];
    set({
      fen: game.fen(),
      moveIndex: moveIndex + 1,
      lastMoveSquares: { from, to },
      moveHistory: newHistory, historyViewIndex: -1,
      waitingForOpponent: false,
    });
  },

  // ─── Hints ───────────────────────────────────────────────────

  getHint: () => {
    const { puzzle, moveIndex } = get();
    if (!puzzle || moveIndex >= puzzle.moves.length) return null;
    const fromSquare = puzzle.moves[moveIndex].slice(0, 2);
    set({ hintsUsed: get().hintsUsed + 1, hintSquare: fromSquare });
    setTimeout(() => {
      if (get().hintSquare === fromSquare) set({ hintSquare: null });
    }, 3000);
    return fromSquare;
  },

  clearHint: () => set({ hintSquare: null }),

  resetPuzzle: () => {
    const { puzzle } = get();
    if (puzzle) get().setPuzzle(puzzle);
  },

  // ─── Voice ───────────────────────────────────────────────────

  setVoiceListening: (listening) => set({ voiceListening: listening }),
  setVoiceTranscript: (transcript) => set({ voiceTranscript: transcript }),

  processVoiceMove: (transcript: string, from?: string, to?: string, promotion?: string) => {
    // If explicit from/to provided (from voice service parsing), use them directly
    if (from && to) {
      return get().makeMove(from, to, promotion);
    }

    // ── Local fallback — parse common spoken patterns using chess.js ──
    const { game } = get();
    if (!game) return false;

    const raw = transcript.toLowerCase().trim();

    // Remove filler words
    const cleaned = raw
      .replace(/\b(um|uh|like|please|move|play|the|my|go|put)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Piece word → SAN letter
    const pieceMap: Record<string, string> = {
      king: "K", knight: "N", horse: "N", night: "N", nite: "N",
      bishop: "B", rook: "R", tower: "R", castle: "R", queen: "Q",
    };

    // File word → letter
    const fileMap: Record<string, string> = {
      alpha: "a", a: "a", eh: "a",
      bravo: "b", b: "b", bee: "b",
      charlie: "c", c: "c", see: "c", sea: "c",
      delta: "d", d: "d", dee: "d",
      echo: "e", e: "e",
      foxtrot: "f", f: "f", ef: "f",
      golf: "g", g: "g", gee: "g",
      hotel: "h", h: "h",
    };

    // Number word → digit
    const numMap: Record<string, string> = {
      one: "1", two: "2", three: "3", four: "4",
      five: "5", six: "6", seven: "7", eight: "8",
      won: "1", to: "2", too: "2", tree: "3", for: "4",
      ate: "8",
    };

    // Normalize file/number words into square notation
    const normalize = (s: string): string => {
      let r = s;
      for (const [word, letter] of Object.entries(fileMap)) {
        r = r.replace(new RegExp(`\\b${word}\\b`, "g"), letter);
      }
      for (const [word, digit] of Object.entries(numMap)) {
        r = r.replace(new RegExp(`\\b${word}\\b`, "g"), digit);
      }
      return r.replace(/\s+/g, " ").trim();
    };

    const norm = normalize(cleaned);

    // Get all legal moves in verbose format
    const legalMoves = game.moves({ verbose: true });

    // 1) Castling
    if (/castle\s*(king|short)|short\s*castle|king\s*side\s*castle|o-o(?!-o)/i.test(norm)) {
      const castleMove = legalMoves.find((m) => m.san === "O-O");
      if (castleMove) return get().makeMove(castleMove.from, castleMove.to);
    }
    if (/castle\s*(queen|long)|long\s*castle|queen\s*side\s*castle|o-o-o/i.test(norm)) {
      const castleMove = legalMoves.find((m) => m.san === "O-O-O");
      if (castleMove) return get().makeMove(castleMove.from, castleMove.to);
    }

    // 2) Square to square: "e2 to e4", "e2 e4"
    const sqToSq = norm.match(/([a-h][1-8])\s*(?:to)?\s*([a-h][1-8])/);
    if (sqToSq) {
      const [, f, t] = sqToSq;
      const legal = legalMoves.find((m) => m.from === f && m.to === t);
      if (legal) return get().makeMove(f, t);
    }

    // 3) Piece to square: "knight f3", "bishop to d5", "rook takes a8"
    for (const [word, san] of Object.entries(pieceMap)) {
      const pattern = new RegExp(
        `\\b${word}\\s+(?:to\\s+|takes?\\s+|captures?\\s+)?([a-h][1-8])`,
        "i",
      );
      const m = norm.match(pattern);
      if (m) {
        const target = m[1];
        const candidates = legalMoves.filter(
          (mv) => mv.piece.toUpperCase() === san.toLowerCase() && mv.to === target,
        );
        // chess.js uses lowercase piece letters
        const cands = legalMoves.filter(
          (mv) => mv.piece === san.toLowerCase() && mv.to === target,
        );
        const found = cands[0] || candidates[0];
        if (found) return get().makeMove(found.from, found.to);
      }
    }

    // 4) Pawn capture: "a takes b4", "e takes d5"
    const pawnCap = norm.match(/([a-h])\s*(?:takes?|captures?|x)\s*([a-h][1-8])/);
    if (pawnCap) {
      const [, file, target] = pawnCap;
      const found = legalMoves.find(
        (m) => m.piece === "p" && m.from[0] === file && m.to === target,
      );
      if (found) return get().makeMove(found.from, found.to);
    }

    // 5) Single square (pawn push): "e4"
    const singleSq = norm.match(/\b([a-h][1-8])\b/);
    if (singleSq) {
      const target = singleSq[1];
      const found = legalMoves.find(
        (m) => m.piece === "p" && m.to === target && !m.captured,
      );
      if (found) return get().makeMove(found.from, found.to);
    }

    return false;
  },

  // ─── History navigation ──────────────────────────────────────

  navigateHistory: (direction) => {
    const { moveHistory, historyViewIndex, solved, failed } = get();
    if (moveHistory.length === 0 || (!solved && !failed)) return;

    const currentIdx = historyViewIndex === -1 ? moveHistory.length - 1 : historyViewIndex;
    const newIdx = direction === "back"
      ? Math.max(0, currentIdx - 1)
      : Math.min(moveHistory.length - 1, currentIdx + 1);

    const entry = moveHistory[newIdx];
    if (entry) {
      set({
        fen: entry.fen,
        historyViewIndex: newIdx,
        lastMoveSquares: entry.from && entry.to ? { from: entry.from, to: entry.to } : null,
      });
    }
  },
}));
