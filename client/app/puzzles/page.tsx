"use client";

import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { useSubscription } from "@/lib/subscription";
import { cn } from "@/lib/utils";

const modes = [
  {
    href: "/puzzles/lichess",
    icon: "♞",
    title: "Lichess Puzzles",
    description:
      "Real puzzles from Lichess rated games. Difficulty-filtered with unique deduplication.",
    color: "green",
    border: "border-green-800/30 hover:border-green-600/50",
    iconBg: "bg-green-900/30 text-green-400",
    tag: "Popular",
    tagColor: "bg-green-900/30 text-green-400 border-green-700/30",
  },
  {
    href: "/puzzles/dataset",
    icon: "♜",
    title: "Dataset Puzzles",
    description:
      "Millions of rated puzzles from the Lichess puzzle database on HuggingFace.",
    color: "blue",
    border: "border-blue-800/30 hover:border-blue-600/50",
    iconBg: "bg-blue-900/30 text-blue-400",
    tag: "Huge Collection",
    tagColor: "bg-blue-900/30 text-blue-400 border-blue-700/30",
  },
  {
    href: "/puzzles/ai",
    icon: "♛",
    title: "AI Generated",
    description:
      "Custom puzzles created by AI. Describe the theme and difficulty you want.",
    color: "purple",
    border: "border-purple-800/30 hover:border-purple-600/50",
    iconBg: "bg-purple-900/30 text-purple-400",
    tag: "Pro",
    tagColor: "bg-purple-900/30 text-purple-400 border-purple-700/30",
    premium: true,
  },
];

export default function PuzzlesPage() {
  const router = useRouter();
  const { hasAIAccess } = useSubscription();

  return (
    <div className="min-h-screen bg-[var(--bg-deep)]">
      <Navbar />

      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10 text-center animate-fadeIn">
          <div className="mb-4 text-5xl">♔</div>
          <h1 className="font-serif text-3xl font-bold text-[var(--text-primary)]">
            Choose Your Mode
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Select a puzzle source to start solving
          </p>
        </div>

        <div className="space-y-4 animate-fadeIn">
          {modes.map((mode) => (
            <button
              key={mode.href}
              onClick={() => router.push(mode.href)}
              className={cn(
                "group flex w-full items-center gap-5 rounded-xl border bg-white/[0.02] backdrop-blur-sm p-6 text-left shadow-lg shadow-black/10 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5",
                mode.border
              )}
            >
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl transition-transform duration-300 group-hover:scale-110",
                  mode.iconBg
                )}
              >
                {mode.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
                    {mode.title}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      mode.tagColor
                    )}
                  >
                    {(mode as any).premium && !hasAIAccess ? "🔒 " : ""}{mode.tag}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{mode.description}</p>
              </div>
              <span className="text-xl text-[var(--text-muted)] transition-all group-hover:translate-x-1 group-hover:text-[var(--text-secondary)]">
                →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
