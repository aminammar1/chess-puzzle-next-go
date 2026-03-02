"use client";

import { Chessboard } from "react-chessboard";
import { useTheme } from "@/lib/theme";
import { useAnimatedBoardController } from "@/hooks/useAnimatedBoardController";

export default function AnimatedBoard() {
  const { colors } = useTheme();
  const { fen } = useAnimatedBoardController();

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
