"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import HeroSection from "@/components/home/HeroSection";
import StatsMarquee from "@/components/home/StatsMarquee";
import FeatureCarousel from "@/components/home/FeatureCarousel";
import Card, { CardBody, CardFooter } from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import Divider from "@/components/ui/Divider";
import Tooltip from "@/components/ui/Tooltip";
import Button from "@/components/ui/Button";

/* ─── fade-up helper ─── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
});

function SectionHeading({ title, subtitle }: { title: React.ReactNode; subtitle: string }) {
  return (
    <div className="mb-14 text-center">
      <motion.h2
        {...fadeUp()}
        className="font-serif text-3xl font-bold text-[var(--text-primary)] md:text-4xl"
      >
        {title}
      </motion.h2>
      <motion.p {...fadeUp(0.08)} className="mt-3 text-sm text-[var(--text-muted)] md:text-base">
        {subtitle}
      </motion.p>
      <motion.div
        {...fadeUp(0.14)}
        className="mx-auto mt-5 h-[1px] w-24 bg-gradient-to-r from-transparent via-[var(--accent-gold)]/40 to-transparent"
      />
    </div>
  );
}

/* ─── accent palettes ─── */
const sourceAccents = {
  green: { border: "border-green-500/15 hover:border-green-500/40", icon: "bg-green-500/10 text-green-400", chipColor: "green" as const, glow: "hover:shadow-green-500/10" },
  blue: { border: "border-blue-500/15 hover:border-blue-500/40", icon: "bg-blue-500/10 text-blue-400", chipColor: "blue" as const, glow: "hover:shadow-blue-500/10" },
  purple: { border: "border-purple-500/15 hover:border-purple-500/40", icon: "bg-purple-500/10 text-purple-400", chipColor: "purple" as const, glow: "hover:shadow-purple-500/10" },
};

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Navbar />
      <HeroSection />

      {/* Stats Marquee */}
      <StatsMarquee />

      {/* ═══════════ Choose Your Challenge ═══════════ */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading
          title={
            <>
              Choose Your{" "}
              <span className="bg-gradient-to-r from-[var(--accent-gold)] to-amber-400 bg-clip-text text-transparent">
                Challenge
              </span>
            </>
          }
          subtitle="Three unique puzzle sources to sharpen every aspect of your game"
        />
        <div className="grid gap-6 md:grid-cols-3">
          {([
            { icon: "♞", title: "Lichess Puzzles", description: "Real puzzles from Lichess rated games. Difficulty-filtered with unique deduplication.", accent: "green" as const, tag: "Popular", href: "/puzzles/lichess" },
            { icon: "♜", title: "Dataset Puzzles", description: "From the Lichess puzzle database on HuggingFace. Millions of rated puzzles.", accent: "blue" as const, tag: "4M+ Puzzles", href: "/puzzles/dataset" },
            { icon: "♛", title: "AI Generated", description: "Custom puzzles created by AI. Describe the theme and difficulty you want.", accent: "purple" as const, tag: "Pro", href: "/puzzles/ai" },
          ]).map((src, i) => {
            const a = sourceAccents[src.accent];
            return (
              <motion.div key={src.title} {...fadeUp(i * 0.08)}>
                <Card
                  hover
                  onClick={() => router.push(src.href)}
                  className={`group h-full transition-all duration-300 hover:bg-white/[0.05] hover:shadow-xl ${a.border} ${a.glow}`}
                >
                  <CardBody className="gap-3">
                    <div className="flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-all duration-300 group-hover:scale-110 ${a.icon}`}>
                        {src.icon}
                      </div>
                      <Chip size="xs" variant="flat" color={a.chipColor} className="font-semibold uppercase">
                        {src.tag}
                      </Chip>
                    </div>
                    <h3 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
                      {src.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-[var(--text-muted)]">{src.description}</p>
                  </CardBody>
                  <CardFooter>
                    <span className="text-xs font-semibold opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100 text-[var(--accent-gold)]">
                      Play now →
                    </span>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ═══════════ Everything You Need ═══════════ */}
      <section className="relative mx-auto max-w-7xl px-6 pb-24">
        {/* Background accent glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[var(--accent-gold)] opacity-[0.02] blur-[140px]" />

        <SectionHeading
          title={
            <>
              Everything{" "}
              <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                You Need
              </span>
            </>
          }
          subtitle="A complete toolkit for chess improvement"
        />

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Carousel */}
          <motion.div {...fadeUp(0.05)}>
            <FeatureCarousel />
          </motion.div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-4">
            {([
              { icon: "♟", title: "Drag & Click", description: "Intuitive piece movement — drag or click to move", href: "" },
              { icon: "🎤", title: "Voice Control", description: 'Say "e2 to e4" — try the Voice Lab!', href: "/voice-test" },
              { icon: "✦", title: "Smart Hints", description: "Visual hints that highlight the source square", href: "" },
              { icon: "♔", title: "Daily Challenge", description: "New Lichess puzzle every day with calendar view", href: "/daily" },
            ]).map((f, i) => (
              <motion.div key={f.title} {...fadeUp(i * 0.06)}>
                <Tooltip content={f.href ? "Try it" : f.title} side="top">
                  <div>
                    <Card
                      hover={!!f.href}
                      onClick={f.href ? () => router.push(f.href) : undefined}
                      className="group h-full text-center transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.05] hover:shadow-lg hover:shadow-black/10"
                    >
                      <CardBody className="items-center gap-2">
                        <span className="text-2xl transition-transform duration-300 group-hover:scale-110">
                          {f.icon}
                        </span>
                        <h4 className="font-serif text-sm font-semibold text-[var(--text-primary)]">{f.title}</h4>
                        <p className="text-xs leading-relaxed text-[var(--text-muted)]">{f.description}</p>
                      </CardBody>
                    </Card>
                  </div>
                </Tooltip>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ How It Works ═══════════ */}
      <section className="border-y border-white/[0.04] bg-white/[0.01]">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <SectionHeading
            title="How It Works"
            subtitle="Three simple steps to sharper tactics"
          />
          <div className="grid gap-8 md:grid-cols-3">
            {([
              { step: "01", title: "Pick a Source", desc: "Choose Lichess, Dataset, or AI-generated puzzles. Filter by difficulty or theme.", icon: "🎯" },
              { step: "02", title: "Solve & Learn", desc: "Drag, click, or speak your moves. Get instant feedback with hints when stuck.", icon: "🧩" },
              { step: "03", title: "Track Progress", desc: "Review your solving history, improve your rating, and tackle daily challenges.", icon: "📈" },
            ]).map((item, i) => (
              <motion.div key={item.step} {...fadeUp(i * 0.1)}>
                <Card className="group relative h-full text-center transition-all duration-300 hover:border-white/[0.1] hover:bg-white/[0.04]">
                  {/* Step badge */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <Chip size="sm" variant="bordered" color="gold" className="bg-[var(--bg-primary)] font-bold uppercase tracking-widest">
                      Step {item.step}
                    </Chip>
                  </div>
                  <CardBody className="items-center gap-2 pt-8">
                    <span className="text-3xl">{item.icon}</span>
                    <h4 className="font-serif text-base font-semibold text-[var(--text-primary)]">{item.title}</h4>
                    <p className="text-xs leading-relaxed text-[var(--text-muted)]">{item.desc}</p>
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA Banner ═══════════ */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <motion.div {...fadeUp()}>
          <Card className="relative overflow-hidden border-white/[0.06] bg-gradient-to-br from-[var(--accent-gold)]/10 via-transparent to-[var(--accent-green)]/5 shadow-none">
            {/* Decorative blurs */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[var(--accent-gold)] opacity-[0.06] blur-[80px]" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-green-500 opacity-[0.04] blur-[80px]" />

            <CardBody className="relative items-center gap-4 p-10 text-center md:p-14">
              <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)] md:text-3xl">
                Ready to sharpen your <span className="bg-gradient-to-r from-[var(--accent-gold)] to-amber-400 bg-clip-text text-transparent">tactics</span>?
              </h2>
              <p className="text-sm text-[var(--text-muted)] md:text-base">
                Start solving puzzles now — it&apos;s free, no account required.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Button variant="gold" size="lg" onClick={() => router.push("/puzzles")}>
                  ♔ Start Solving
                </Button>
                <Button variant="secondary" size="lg" onClick={() => router.push("/voice-test")}>
                  🎤 Try Voice Lab
                </Button>
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </section>

      {/* ═══════════ Footer ═══════════ */}
      <footer className="border-t border-white/[0.04]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 py-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="font-serif text-sm text-[var(--accent-gold)]">♔</span>
            <span>Chess Puzzles</span>
            <Divider orientation="vertical" className="mx-1 h-3" />
            <span>Built with passion</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
            <Chip size="sm" variant="flat" className="bg-white/[0.03] text-[var(--text-muted)]">Lichess</Chip>
            <Chip size="sm" variant="flat" className="bg-white/[0.03] text-[var(--text-muted)]">HuggingFace</Chip>
            <Chip size="sm" variant="flat" className="bg-white/[0.03] text-[var(--text-muted)]">AI</Chip>
          </div>
        </div>
      </footer>
    </div>
  );
}
