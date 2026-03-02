"use client";

import { useRef, useEffect, useMemo } from "react";

interface MovePair {
  num: number;
  white: { san: string; idx: number };
  black: { san: string; idx: number } | null;
}

export function useMoveHistoryController(sanMoves: string[], moveIndex: number) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moveIndex]);

  const pairs = useMemo<MovePair[]>(() => {
    const grouped: MovePair[] = [];
    for (let i = 0; i < sanMoves.length; i += 2) {
      grouped.push({
        num: Math.floor(i / 2) + 1,
        white: { san: sanMoves[i], idx: i },
        black: i + 1 < sanMoves.length ? { san: sanMoves[i + 1], idx: i + 1 } : null,
      });
    }
    return grouped;
  }, [sanMoves]);

  return {
    scrollRef,
    pairs,
  };
}
