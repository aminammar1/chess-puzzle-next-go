"use client";

import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import HeroSection from "@/components/home/HeroSection";
import SourceCard from "@/components/home/SourceCard";
import FeatureCard from "@/components/home/FeatureCard";
import FeatureCarousel from "@/components/home/FeatureCarousel";
import StatsMarquee from "@/components/home/StatsMarquee";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Navbar />
      <HeroSection />

      {/* Stats Marquee */}
      <StatsMarquee />

      {/* Three Puzzle Sources */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="font-serif text-3xl font-bold text-[var(--text-primary)]">
            Choose Your Challenge
          </h2>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Three unique puzzle sources to sharpen every aspect of your game
          </p>
          <div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-[var(--accent-gold)]/30 to-transparent" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <SourceCard
            icon="♞"
            title="Lichess Puzzles"
            description="Real puzzles from Lichess rated games. Difficulty-filtered with unique deduplication."
            accent="green"
            tag="Popular"
            index={0}
            onClick={() => router.push("/puzzles/lichess")}
          />
          <SourceCard
            icon="♜"
            title="Dataset Puzzles"
            description="From the Lichess puzzle database on HuggingFace. Millions of rated puzzles."
            accent="blue"
            tag="4M+ Puzzles"
            index={1}
            onClick={() => router.push("/puzzles/dataset")}
          />
          <SourceCard
            icon="♛"
            title="AI Generated"
            description="Custom puzzles created by AI. Describe the theme and difficulty you want."
            accent="purple"
            tag="Pro"
            index={2}
            onClick={() => router.push("/puzzles/ai")}
          />
        </div>
      </section>

      {/* Feature Carousel + Cards Grid */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="mb-12 text-center">
          <h2 className="font-serif text-3xl font-bold text-[var(--text-primary)]">
            Everything You Need
          </h2>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            A complete toolkit for chess improvement
          </p>
          <div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-[var(--accent-gold)]/30 to-transparent" />
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Carousel */}
          <FeatureCarousel />

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-4">
            <FeatureCard
              icon="♟"
              title="Drag & Click"
              description="Intuitive piece movement — drag pieces or click to move"
              index={0}
            />
            <FeatureCard
              icon="🎤"
              title="Voice Control"
              description='Say "e2 to e4" to move pieces hands-free'
              index={1}
            />
            <FeatureCard
              icon="✦"
              title="Smart Hints"
              description="Visual hints that highlight the source square"
              index={2}
            />
            <FeatureCard
              icon="♔"
              title="Daily Challenge"
              description="New Lichess puzzle every day with calendar view"
              index={3}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] py-8 text-center">
        <p className="text-xs text-[var(--text-muted)]">
          Built with ♔ — Puzzles from Lichess, HuggingFace & AI
        </p>
      </footer>
    </div>
  );
}
