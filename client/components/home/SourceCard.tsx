"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SourceCardProps {
  icon: string;
  title: string;
  description: string;
  accent: "green" | "blue" | "purple";
  onClick: () => void;
  tag?: string;
  index?: number;
}

const accentStyles = {
  green: {
    border: "border-green-500/10 hover:border-green-500/30",
    icon: "bg-green-500/10 text-green-400 group-hover:bg-green-500/20",
    tag: "text-green-400",
    glow: "group-hover:shadow-green-500/10",
  },
  blue: {
    border: "border-blue-500/10 hover:border-blue-500/30",
    icon: "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20",
    tag: "text-blue-400",
    glow: "group-hover:shadow-blue-500/10",
  },
  purple: {
    border: "border-purple-500/10 hover:border-purple-500/30",
    icon: "bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20",
    tag: "text-purple-400",
    glow: "group-hover:shadow-purple-500/10",
  },
};

export default function SourceCard({
  icon,
  title,
  description,
  accent,
  onClick,
  tag,
  index = 0,
}: SourceCardProps) {
  const s = accentStyles[accent];

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={cn(
        "group relative rounded-2xl border bg-white/[0.02] backdrop-blur-sm p-6 text-left",
        "shadow-lg shadow-black/10 transition-all duration-300",
        "hover:bg-white/[0.04] hover:shadow-xl",
        s.border,
        s.glow
      )}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-all duration-300",
              s.icon
            )}
          >
            {icon}
          </div>
          {tag && (
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider opacity-60", s.tag)}>
              {tag}
            </span>
          )}
        </div>
        <h3 className="mb-2 font-serif text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
        <div
          className={cn(
            "mt-4 flex items-center gap-1 text-xs font-semibold opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1",
            s.tag
          )}
        >
          Play now <span>→</span>
        </div>
      </div>
    </motion.button>
  );
}
