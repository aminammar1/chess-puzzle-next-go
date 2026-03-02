"use client";

import { useState, useEffect, useCallback } from "react";
import { Chess } from "chess.js";
import { FAMOUS_GAMES } from "@/lib/animated-board-content";

export function useAnimatedBoardController() {
  const [game] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [gameIdx] = useState(() => Math.floor(Math.random() * FAMOUS_GAMES.length));
  const [moveIdx, setMoveIdx] = useState(0);

  const playNextMove = useCallback(() => {
    const moves = FAMOUS_GAMES[gameIdx];
    if (moveIdx >= moves.length) {
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
      setMoveIdx((prev) => prev + 1);
    }
  }, [game, gameIdx, moveIdx]);

  useEffect(() => {
    const interval = setInterval(playNextMove, 1800);
    return () => clearInterval(interval);
  }, [playNextMove]);

  return { fen };
}
