"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Chess } from "chess.js";
import type { Square } from "chess.js";

interface BoardMovePayload {
  piece: { pieceType: string };
  sourceSquare: string;
  targetSquare: string | null;
}

interface BoardDragPayload {
  isSparePiece: boolean;
  piece: { pieceType: string };
  square: string | null;
}

interface BoardSquarePayload {
  piece: unknown;
  square: string;
}

interface BoardPiecePayload {
  isSparePiece: boolean;
  piece: { pieceType: string };
  square: string | null;
}

interface LastMoveSquares {
  from: string;
  to: string;
}

interface UseChessBoardControllerArgs {
  game: Chess | null;
  fen: string;
  orientation: "white" | "black";
  solved: boolean;
  failed: boolean;
  waitingForOpponent: boolean;
  hintSquare: string | null;
  lastMoveSquares: LastMoveSquares | null;
  makeMove: (from: string, to: string, promotion?: string) => boolean;
}

export function useChessBoardController({
  game,
  fen,
  orientation,
  solved,
  failed,
  waitingForOpponent,
  hintSquare,
  lastMoveSquares,
  makeMove,
}: UseChessBoardControllerArgs) {
  const [selected, setSelected] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);

  const playerColor = orientation === "white" ? "w" : "b";
  const interactive = !solved && !failed && !waitingForOpponent && !!game;

  useEffect(() => {
    setSelected(null);
    setTargets([]);
  }, [fen]);

  const getLegalTargets = useCallback(
    (sq: string): string[] => {
      if (!game) return [];
      try {
        return game.moves({ square: sq as Square, verbose: true }).map((m) => m.to);
      } catch {
        return [];
      }
    },
    [game]
  );

  const autoPromotion = useCallback(
    (from: string, to: string): string | undefined => {
      if (!game) return undefined;
      const piece = game.get(from as Square);
      if (!piece || piece.type !== "p") return undefined;
      if (piece.color === "w" && to[1] === "8") return "q";
      if (piece.color === "b" && to[1] === "1") return "q";
      return undefined;
    },
    [game]
  );

  const isOwnPiece = useCallback(
    (sq: string): boolean => {
      if (!game) return false;
      const piece = game.get(sq as Square);
      return !!piece && piece.color === playerColor;
    },
    [game, playerColor]
  );

  const tryMove = useCallback(
    (from: string, to: string): boolean => {
      const promotion = autoPromotion(from, to);
      return makeMove(from, to, promotion);
    },
    [autoPromotion, makeMove]
  );

  const handleDrop = useCallback(
    ({ sourceSquare, targetSquare }: BoardMovePayload): boolean => {
      if (!interactive || !targetSquare) return false;
      return tryMove(sourceSquare, targetSquare);
    },
    [interactive, tryMove]
  );

  const handleCanDrag = useCallback(
    ({ piece }: BoardDragPayload): boolean => {
      if (!interactive) return false;
      const pieceType = piece?.pieceType || "";
      return pieceType.length >= 2 && pieceType[0] === playerColor;
    },
    [interactive, playerColor]
  );

  const handleSquareClick = useCallback(
    ({ square }: BoardSquarePayload) => {
      if (!interactive || !square) return;

      if (selected && targets.includes(square)) {
        tryMove(selected, square);
        return;
      }

      if (selected === square) {
        setSelected(null);
        setTargets([]);
        return;
      }

      if (isOwnPiece(square)) {
        setSelected(square);
        setTargets(getLegalTargets(square));
      } else {
        setSelected(null);
        setTargets([]);
      }
    },
    [interactive, selected, targets, tryMove, isOwnPiece, getLegalTargets]
  );

  const handlePieceClick = useCallback(
    ({ square }: BoardPiecePayload) => {
      if (!interactive || !square) return;

      if (selected && targets.includes(square)) {
        tryMove(selected, square);
        return;
      }

      if (isOwnPiece(square)) {
        if (selected === square) {
          setSelected(null);
          setTargets([]);
        } else {
          setSelected(square);
          setTargets(getLegalTargets(square));
        }
      } else {
        setSelected(null);
        setTargets([]);
      }
    },
    [interactive, selected, targets, tryMove, isOwnPiece, getLegalTargets]
  );

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (lastMoveSquares) {
      styles[lastMoveSquares.from] = { backgroundColor: "rgba(194,154,88,0.35)" };
      styles[lastMoveSquares.to] = { backgroundColor: "rgba(194,154,88,0.45)" };
    }

    if (selected) {
      styles[selected] = {
        backgroundColor: "rgba(230,145,46,0.4)",
        boxShadow: "inset 0 0 0 3px rgba(230,145,46,0.6)",
      };
    }

    targets.forEach((square) => {
      styles[square] = {
        ...(styles[square] || {}),
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.25) 22%, transparent 23%)",
      };
    });

    if (hintSquare) {
      styles[hintSquare] = {
        backgroundColor: "rgba(230,145,46,0.5)",
        borderRadius: "50%",
        boxShadow: "inset 0 0 18px rgba(230,145,46,0.6)",
      };
    }

    return styles;
  }, [lastMoveSquares, selected, targets, hintSquare]);

  return {
    squareStyles,
    handleDrop,
    handleCanDrag,
    handleSquareClick,
    handlePieceClick,
  };
}
