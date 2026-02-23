"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ChipVariant = "flat" | "bordered" | "dot";
type ChipColor = "default" | "gold" | "green" | "red" | "blue" | "purple" | "amber";
type ChipSize = "xs" | "sm" | "md";

interface ChipProps {
  children: ReactNode;
  variant?: ChipVariant;
  color?: ChipColor;
  size?: ChipSize;
  startContent?: ReactNode;
  className?: string;
}

const colorMap: Record<ChipColor, { flat: string; bordered: string; dot: string }> = {
  default: {
    flat: "bg-white/[0.05] text-[var(--text-secondary)]",
    bordered: "border-white/[0.08] text-[var(--text-secondary)]",
    dot: "border-white/[0.08] text-[var(--text-secondary)] before:bg-white/40",
  },
  gold: {
    flat: "bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]",
    bordered: "border-[var(--accent-gold)]/30 text-[var(--accent-gold)]",
    dot: "border-[var(--accent-gold)]/20 text-[var(--accent-gold)] before:bg-[var(--accent-gold)]",
  },
  green: {
    flat: "bg-emerald-500/10 text-emerald-400",
    bordered: "border-emerald-500/30 text-emerald-400",
    dot: "border-emerald-500/20 text-emerald-400 before:bg-emerald-500",
  },
  red: {
    flat: "bg-red-500/10 text-red-400",
    bordered: "border-red-500/30 text-red-400",
    dot: "border-red-500/20 text-red-400 before:bg-red-500",
  },
  blue: {
    flat: "bg-blue-500/10 text-blue-400",
    bordered: "border-blue-500/30 text-blue-400",
    dot: "border-blue-500/20 text-blue-400 before:bg-blue-500",
  },
  purple: {
    flat: "bg-purple-500/10 text-purple-400",
    bordered: "border-purple-500/30 text-purple-400",
    dot: "border-purple-500/20 text-purple-400 before:bg-purple-500",
  },
  amber: {
    flat: "bg-amber-500/10 text-amber-300",
    bordered: "border-amber-500/30 text-amber-300",
    dot: "border-amber-500/20 text-amber-300 before:bg-amber-500",
  },
};

const sizeMap: Record<ChipSize, string> = {
  xs: "gap-1 px-1.5 py-px text-[10px]",
  sm: "gap-1 px-2 py-0.5 text-[11px]",
  md: "gap-1.5 px-2.5 py-1 text-xs",
};

export default function Chip({
  children,
  variant = "flat",
  color = "default",
  size = "sm",
  startContent,
  className,
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap",
        variant === "bordered" && "border bg-transparent",
        variant === "dot" && "border bg-transparent pl-4 relative before:absolute before:left-1.5 before:h-1.5 before:w-1.5 before:rounded-full",
        variant === "flat" && "border-none",
        colorMap[color][variant],
        sizeMap[size],
        className,
      )}
    >
      {startContent && <span className="flex-shrink-0">{startContent}</span>}
      {children}
    </span>
  );
}
