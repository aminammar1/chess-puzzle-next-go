"use client";

import { quotes } from "@/lib/quotes";
import { useRotatingQuote } from "@/hooks/useRotatingQuote";

export default function Quote() {
  const { index, fade } = useRotatingQuote(quotes.length);

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
