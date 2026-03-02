"use client";

import { useState, useEffect } from "react";

export function useFeatureCarouselController(slidesLength: number, intervalMs = 5000) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slidesLength);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [slidesLength, intervalMs]);

  return { activeIndex, setActiveIndex };
}
