"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5 shadow-lg shadow-black/10",
        hover &&
        "cursor-pointer transition-all duration-300 hover:border-white/[0.12] hover:shadow-xl hover:-translate-y-0.5",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3
      className={cn(
        "font-serif text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]",
        className
      )}
    >
      {children}
    </h3>
  );
}
