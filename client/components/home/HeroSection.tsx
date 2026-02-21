"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import Quote from "@/components/ui/Quote";
import AnimatedBoard from "@/components/home/AnimatedBoard";

export default function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient + grid pattern */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-deep)] via-[var(--bg-primary)] to-[var(--bg-primary)]" />
      <div className="absolute inset-0 grid-pattern opacity-50" />

      {/* Radial glow */}
      <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-gold)] opacity-[0.04] blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 md:pt-24">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-16">
          {/* Left — Text content */}
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                New: AI-generated puzzles now available
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-6 font-serif text-4xl font-bold leading-tight tracking-tight text-[var(--text-primary)] md:text-5xl lg:text-6xl"
            >
              Master the{" "}
              <span className="bg-gradient-to-r from-[var(--accent-gold)] to-amber-500 bg-clip-text text-transparent">
                Art
              </span>{" "}
              of Chess{" "}
              <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                Tactics
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-8 max-w-lg text-base leading-relaxed text-[var(--text-secondary)] md:text-lg lg:mx-0 mx-auto"
            >
              Sharpen your tactical vision with puzzles from Lichess, curated
              datasets, and AI-generated challenges. Join millions of players
              improving every day.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            >
              <Button onClick={() => router.push("/puzzles")} variant="gold" size="lg">
                ♔ Start Solving
              </Button>
              <Button onClick={() => router.push("/daily")} variant="primary" size="lg">
                📅 Daily Challenge
              </Button>
            </motion.div>

            {/* Quote */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-12 max-w-md lg:mx-0 mx-auto"
            >
              <Quote />
            </motion.div>
          </div>

          {/* Right — Animated chessboard */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full max-w-[400px] lg:max-w-[440px]"
          >
            <AnimatedBoard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
