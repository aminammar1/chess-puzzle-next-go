"use client";

import { cn } from "@/lib/utils";

interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export default function Divider({ orientation = "horizontal", className }: DividerProps) {
  return (
    <div
      role="separator"
      className={cn(
        "shrink-0 bg-white/[0.06]",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}
