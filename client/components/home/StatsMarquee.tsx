"use client";

const stats = [
  { label: "Lichess Puzzles", value: "4M+" },
  { label: "Active Players", value: "10M+" },
  { label: "AI Models", value: "5+" },
  { label: "Puzzle Themes", value: "60+" },
  { label: "Rating Range", value: "400-3000" },
];

export default function StatsMarquee() {
  return (
    <div className="relative overflow-hidden border-y border-white/[0.05] bg-white/[0.01] py-4">
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[var(--bg-primary)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[var(--bg-primary)] to-transparent" />

      <div className="animate-marquee flex w-max gap-12">
        {[...stats, ...stats].map((stat, i) => (
          <div key={i} className="flex items-center gap-3 whitespace-nowrap">
            <span className="font-mono text-lg font-bold text-[var(--accent-gold)]">
              {stat.value}
            </span>
            <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
