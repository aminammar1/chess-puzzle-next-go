"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CarouselSlide {
  title: string;
  description: string;
  icon: string;
  gradient: string;
}

const slides: CarouselSlide[] = [
  {
    title: "Lichess Daily Puzzles",
    description:
      "Fresh puzzles every day from real Lichess games. Challenge yourself with difficulty-rated tactics.",
    icon: "♞",
    gradient: "from-green-600/20 to-emerald-900/20",
  },
  {
    title: "AI-Generated Challenges",
    description:
      "Describe the puzzle you want — queen sacrifice, fork, discovered attack — and AI creates it for you.",
    icon: "♛",
    gradient: "from-purple-600/20 to-violet-900/20",
  },
  {
    title: "Millions of Puzzles",
    description:
      "Access the entire Lichess puzzle database on HuggingFace. Every theme, every rating, every tactic.",
    icon: "♜",
    gradient: "from-blue-600/20 to-cyan-900/20",
  },
  {
    title: "Voice Control",
    description:
      'Say "e2 to e4" and watch pieces move. Hands-free puzzle solving with speech recognition.',
    icon: "🎤",
    gradient: "from-amber-600/20 to-orange-900/20",
  },
];

export default function FeatureCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.4 }}
          className={`bg-gradient-to-br ${slides[activeIndex].gradient} p-8 md:p-10`}
        >
          <div className="mb-4 text-5xl">{slides[activeIndex].icon}</div>
          <h3 className="mb-3 font-serif text-2xl font-bold text-[var(--text-primary)]">
            {slides[activeIndex].title}
          </h3>
          <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
            {slides[activeIndex].description}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 pb-5 pt-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === activeIndex
                ? "w-6 bg-[var(--accent-gold)]"
                : "w-2 bg-white/20 hover:bg-white/30"
              }`}
          />
        ))}
      </div>
    </div>
  );
}
