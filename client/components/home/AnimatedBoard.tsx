"use client";

import { useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { useTheme } from "@/lib/theme";

// Famous games to play through
const FAMOUS_GAMES = [
  // Kasparov vs Topalov (1999) — "Kasparov's Immortal"
  [
    "e2e4", "d7d6", "d2d4", "g8f6", "b1c3", "g7g6", "c1e3", "f8g7",
    "d1d2", "c7c6", "f2f3", "b7b5", "g1e2", "b8d7", "e3h6", "g7h6",
    "d2h6", "c8b7", "a2a3", "e7e5", "e1c1", "d8e7",
  ],
  // Opera Game (Morphy vs Duke + Count)
  [
    "e2e4", "e7e5", "g1f3", "d7d6", "d2d4", "c8g4", "d4e5", "g4f3",
    "d1f3", "d6e5", "f1c4", "g8f6", "f3b3", "d8e7", "b1c3", "c7c6",
  ],
];

export default function AnimatedBoard() {
  const { colors } = useTheme();
  const [game] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [gameIdx] = useState(() => Math.floor(Math.random() * FAMOUS_GAMES.length));
  const [moveIdx, setMoveIdx] = useState(0);

  const playNextMove = useCallback(() => {
    const moves = FAMOUS_GAMES[gameIdx];
    if (moveIdx >= moves.length) {
      // Reset and play again
      game.reset();
      setFen(game.fen());
      setMoveIdx(0);
      return;
    }

    const uci = moves[moveIdx];
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    try {
      game.move({ from, to, promotion });
      setFen(game.fen());
      setMoveIdx((prev) => prev + 1);
    } catch {
      // Skip invalid move
      setMoveIdx((prev) => prev + 1);
    }
  }, [game, gameIdx, moveIdx]);

  useEffect(() => {
    const interval = setInterval(playNextMove, 1800);
    return () => clearInterval(interval);
  }, [playNextMove]);

  return (
    <div className="animate-board-float pointer-events-none select-none">
      <div className="chess-board-wrapper opacity-90 shadow-2xl shadow-black/40">
        <Chessboard
          options={{
            position: fen,
            boardOrientation: "white",
            allowDragging: false,
            showNotation: false,
            animationDurationInMs: 500,
            boardStyle: {
              borderRadius: "12px",
              cursor: "default",
            },
            darkSquareStyle: {
              backgroundColor: colors.boardDark,
            },
            lightSquareStyle: {
              backgroundColor: colors.boardLight,
            },
          }}
        />
      </div>
    </div>
  );
}
