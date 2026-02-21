"use client";

import { useState, useEffect } from "react";

const quotes = [
  {
    text: "You need to be decisive in chess, just like in life.",
    author: "Magnus Carlsen",
  },
  {
    text: "Some people think that if their opponent plays a beautiful game, it's okay to lose. I don't.",
    author: "Magnus Carlsen",
  },
  {
    text: "Every chess master was once a beginner.",
    author: "Irving Chernev",
  },
  {
    text: "I am trying to beat the guy sitting across from me and trying to choose the moves that are most uncomfortable for him.",
    author: "Magnus Carlsen",
  },
  {
    text: "Without the element of enjoyment, it is not worth trying to excel at anything.",
    author: "Magnus Carlsen",
  },
  {
    text: "Chess is life in miniature. Chess is a struggle, chess is battles.",
    author: "Garry Kasparov",
  },
  {
    text: "I don't study; I create.",
    author: "Magnus Carlsen",
  },
  {
    text: "The beauty of chess is it can be whatever you want it to be.",
    author: "Simon Williams",
  },
  {
    text: "If you want to get to the top, there's always the risk that it will isolate you from other people.",
    author: "Magnus Carlsen",
  },
  {
    text: "Tactics is knowing what to do when there is something to do. Strategy is knowing what to do when there is nothing to do.",
    author: "Savielly Tartakower",
  },
];

export default function Quote() {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    setIndex(Math.floor(Math.random() * quotes.length));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % quotes.length);
        setFade(true);
      }, 500);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const q = quotes[index];

  return (
    <div
      className={`transition-opacity duration-500 ${fade ? "opacity-100" : "opacity-0"}`}
    >
      <p className="font-serif text-base italic leading-relaxed text-[var(--text-secondary)]">
        &ldquo;{q.text}&rdquo;
      </p>
      <p className="mt-2 text-xs font-medium tracking-wide text-[var(--text-muted)]">
        &mdash; {q.author}
      </p>
    </div>
  );
}
