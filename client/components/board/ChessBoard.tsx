"use client";

import { Chessboard } from "react-chessboard";
import { usePuzzleStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { useChessBoardController } from "@/hooks/useChessBoardController";

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
  const { squareStyles, handleDrop, handleCanDrag, handleSquareClick, handlePieceClick } =
    useChessBoardController({
      game,
      fen,
      orientation,
      solved,
      failed,
      waitingForOpponent,
      hintSquare,
      lastMoveSquares,
      makeMove,
    });

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
