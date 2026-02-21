"use client";

import { Chessboard } from "react-chessboard";
import { usePuzzleStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { useState, useEffect, useMemo, useCallback } from "react";
import type { Square } from "chess.js";

export default function ChessBoard() {
  const fen = usePuzzleStore((s) => s.fen);
  const orientation = usePuzzleStore((s) => s.orientation);
  const game = usePuzzleStore((s) => s.game);
  const solved = usePuzzleStore((s) => s.solved);
  const failed = usePuzzleStore((s) => s.failed);
  const hintSquare = usePuzzleStore((s) => s.hintSquare);
  const lastMoveSquares = usePuzzleStore((s) => s.lastMoveSquares);
  const makeMove = usePuzzleStore((s) => s.makeMove);
  const waitingForOpponent = usePuzzleStore((s) => s.waitingForOpponent);

  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);

  const playerColor = orientation === "white" ? "w" : "b";
  const interactive = !solved && !failed && !waitingForOpponent && !!game;

  // Clear selection whenever position changes
  useEffect(() => {
    setSelected(null);
    setTargets([]);
  }, [fen]);

  // ── Helpers ───────────────────────────────────────────────

  const getLegalTargets = useCallback(
    (sq: string): string[] => {
      if (!game) return [];
      try {
        return game.moves({ square: sq as Square, verbose: true }).map((m) => m.to);
      } catch {
        return [];
      }
    },
    [game],
  );

  function autoPromotion(from: string, to: string): string | undefined {
    if (!game) return undefined;
    const piece = game.get(from as Square);
    if (!piece || piece.type !== "p") return undefined;
    if (piece.color === "w" && to[1] === "8") return "q";
    if (piece.color === "b" && to[1] === "1") return "q";
    return undefined;
  }

  function isOwnPiece(sq: string): boolean {
    if (!game) return false;
    const p = game.get(sq as Square);
    return !!p && p.color === playerColor;
  }

  function tryMove(from: string, to: string): boolean {
    const promo = autoPromotion(from, to);
    return makeMove(from, to, promo);
  }

  // ── Drag & Drop (react-chessboard v5) ────────────────────

  function handleDrop({
    sourceSquare,
    targetSquare,
  }: {
    piece: { pieceType: string };
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    if (!interactive || !targetSquare) return false;
    return tryMove(sourceSquare, targetSquare);
  }

  function handleCanDrag({
    piece,
  }: {
    isSparePiece: boolean;
    piece: { pieceType: string };
    square: string | null;
  }): boolean {
    if (!interactive) return false;
    const pt = piece?.pieceType || "";
    return pt.length >= 2 && pt[0] === playerColor;
  }

  // ── Click-to-move ────────────────────────────────────────

  function handleSquareClick({ square }: { piece: unknown; square: string }) {
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
  }

  function handlePieceClick({
    square,
  }: {
    isSparePiece: boolean;
    piece: { pieceType: string };
    square: string | null;
  }) {
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
  }

  // ── Square styles ────────────────────────────────────────

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};

    if (lastMoveSquares) {
      s[lastMoveSquares.from] = { backgroundColor: "rgba(194,154,88,0.35)" };
      s[lastMoveSquares.to] = { backgroundColor: "rgba(194,154,88,0.45)" };
    }

    if (selected) {
      s[selected] = {
        backgroundColor: "rgba(230,145,46,0.4)",
        boxShadow: "inset 0 0 0 3px rgba(230,145,46,0.6)",
      };
    }

    targets.forEach((sq) => {
      s[sq] = {
        ...(s[sq] || {}),
        backgroundImage:
          "radial-gradient(circle, rgba(0,0,0,0.25) 22%, transparent 23%)",
      };
    });

    if (hintSquare) {
      s[hintSquare] = {
        backgroundColor: "rgba(230,145,46,0.5)",
        borderRadius: "50%",
        boxShadow: "inset 0 0 18px rgba(230,145,46,0.6)",
      };
    }

    return s;
  }, [lastMoveSquares, selected, targets, hintSquare]);

  // ── Render ───────────────────────────────────────────────

  const ring = solved
    ? "ring-2 ring-green-500/50"
    : failed
      ? "ring-2 ring-red-500/50"
      : "";

  return (
    <div
      className={`chess-board-wrapper ${ring} overflow-hidden rounded-lg shadow-2xl shadow-black/50 transition-all duration-500`}
    >
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          onPieceDrop: handleDrop,
          canDragPiece: handleCanDrag,
          onSquareClick: handleSquareClick,
          onPieceClick: handlePieceClick,
          animationDurationInMs: 200,
          boardStyle: { borderRadius: "8px" },
          darkSquareStyle: { backgroundColor: colors.boardDark },
          lightSquareStyle: { backgroundColor: colors.boardLight },
          squareStyles,
        }}
      />
    </div>
  );
}
