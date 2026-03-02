"use client";

import { useState, useEffect } from "react";

export function useRotatingQuote(total: number) {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * total));
  }, [total]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % total);
        setFade(true);
      }, 500);
    }, 12000);
    return () => clearInterval(interval);
  }, [total]);

  return { index, fade };
}
