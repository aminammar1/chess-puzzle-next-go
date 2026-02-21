"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "green" | "yellow" | "red" | "blue" | "purple" | "amber";
  className?: string;
}

const badgeVariants = {
  green: "bg-green-900/30 text-green-400 border-green-700/30",
  yellow: "bg-yellow-900/30 text-yellow-400 border-yellow-700/30",
  red: "bg-red-900/30 text-red-400 border-red-700/30",
  blue: "bg-blue-900/30 text-blue-400 border-blue-700/30",
  purple: "bg-purple-900/30 text-purple-400 border-purple-700/30",
  amber: "bg-amber-900/30 text-amber-300 border-amber-700/30",
};

export default function Badge({ children, variant = "amber", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
