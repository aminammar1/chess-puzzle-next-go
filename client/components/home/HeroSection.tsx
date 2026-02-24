"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import Quote from "@/components/ui/Quote";
import AnimatedBoard from "@/components/home/AnimatedBoard";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
});

export default function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative overflow-hidden">
      {/* Layered background: deep → primary with wood-like warmth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-deep)] via-[var(--bg-primary)] to-[var(--bg-primary)]" />

      {/* Subtle grid — evokes a chessboard without being literal */}
      <div className="absolute inset-0 grid-pattern opacity-30" />

      {/* Warm radial glow — centered behind the board */}
      <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-gold)] opacity-[0.035] blur-[140px]" />
      <div className="absolute right-[15%] top-[20%] h-[250px] w-[250px] rounded-full bg-amber-600 opacity-[0.02] blur-[100px]" />

      {/* Grain overlay for handcrafted feel */}
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")" }} />

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 md:pt-28">
        <div className="flex flex-col items-center gap-16 lg:flex-row lg:items-center lg:gap-20">
          {/* Left — Text content */}
          <div className="flex-1 text-center lg:text-left">
            {/* Pill badge — refined, no generic "AI" vibe */}
            <motion.div {...fadeUp(0)}>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-gold)]/15 bg-[var(--accent-gold)]/[0.06] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-gold)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
                Voice-Powered Puzzles
              </span>
            </motion.div>

            {/* Heading — Playfair Display serif for classical chess feel */}
            <motion.h1
              {...fadeUp(0.12)}
              className="mt-6 font-serif text-4xl font-bold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-[3.5rem]"
            >
              Master the{" "}
              <span className="relative">
                <span className="bg-gradient-to-r from-[var(--accent-gold)] via-amber-400 to-[var(--accent-gold)] bg-clip-text text-transparent">
                  Art
                </span>
                {/* Decorative underline — subtle gold stroke */}
                <svg className="absolute -bottom-1 left-0 w-full" height="6" viewBox="0 0 100 6" preserveAspectRatio="none">
                  <path d="M0 5 Q25 0 50 3 T100 1" stroke="var(--accent-gold)" strokeWidth="1.5" fill="none" opacity="0.4" />
                </svg>
              </span>{" "}
              of
              <br className="hidden sm:block" />
              Chess{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
                Tactics
              </span>
            </motion.h1>

            {/* Subtitle — Inter sans-serif for readability */}
            <motion.p
              {...fadeUp(0.2)}
              className="mt-5 max-w-lg text-[15px] leading-[1.7] text-[var(--text-secondary)] lg:mx-0 mx-auto"
            >
              Sharpen your tactical vision with puzzles from Lichess, curated
              datasets, and AI-generated challenges. Speak your moves, track
              your progress, and join millions of players improving every day.
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              {...fadeUp(0.28)}
              className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            >
              <Button variant="gold" size="lg" onClick={() => router.push("/puzzles")}>
                <span className="mr-1 font-serif">♔</span> Start Solving
              </Button>
              <Button variant="secondary" size="lg" onClick={() => router.push("/daily")}>
                <span className="mr-1">📅</span> Daily Challenge
              </Button>
            </motion.div>

            {/* Trust indicators — subtle stats instead of chip badges */}
            <motion.div
              {...fadeUp(0.35)}
              className="mt-8 flex items-center justify-center gap-6 lg:justify-start"
            >
              {[
                { value: "4M+", label: "Puzzles" },
                { value: "60+", label: "Themes" },
                { value: "Free", label: "No account" },
              ].map((stat) => (
                <div key={stat.label} className="text-center lg:text-left">
                  <p className="font-mono text-sm font-bold text-[var(--accent-gold)]">{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{stat.label}</p>
                </div>
              ))}
            </motion.div>

            {/* Quote */}
            <motion.div
              {...fadeUp(0.45)}
              className="mt-10 max-w-md lg:mx-0 mx-auto border-l-2 border-[var(--accent-gold)]/20 pl-4"
            >
              <Quote />
            </motion.div>
          </div>

          {/* Right — Animated chessboard with refined frame */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, rotateY: -4 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[420px] lg:max-w-[460px]"
          >
            {/* Board frame — simulating a wooden chess board border */}
            <div className="relative rounded-2xl p-[6px] bg-gradient-to-br from-[#5a3e24] via-[#4a3018] to-[#3a2210] shadow-2xl shadow-black/50">
              {/* Inner glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--accent-gold)]/5 to-transparent" />
              <div className="relative rounded-xl overflow-hidden">
                <AnimatedBoard />
              </div>
            </div>
            {/* Reflection shadow */}
            <div className="mx-auto mt-4 h-2 w-[85%] rounded-full bg-black/20 blur-md" />
          </motion.div>
        </div>
      </div>

      {/* Bottom divider — subtle gold line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/15 to-transparent" />
    </section>
  );
}
