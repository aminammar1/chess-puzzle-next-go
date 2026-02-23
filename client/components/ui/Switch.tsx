"use client";

import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  size?: "sm" | "md";
  color?: "gold" | "green" | "red";
  className?: string;
}

const trackColors: Record<string, { on: string; off: string }> = {
  gold: { on: "bg-[var(--accent-gold)]", off: "bg-white/[0.08]" },
  green: { on: "bg-emerald-600", off: "bg-white/[0.08]" },
  red: { on: "bg-red-600", off: "bg-white/[0.08]" },
};

const sizes = {
  sm: { track: "h-5 w-9", thumb: "h-4 w-4", translate: "data-[state=checked]:translate-x-4" },
  md: { track: "h-6 w-11", thumb: "h-5 w-5", translate: "data-[state=checked]:translate-x-5" },
};

export default function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  size = "sm",
  color = "green",
  className,
}: SwitchProps) {
  const s = sizes[size];
  const c = trackColors[color];

  return (
    <label className={cn("inline-flex items-center gap-2.5", disabled && "opacity-40 pointer-events-none", className)}>
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer rounded-full border border-white/[0.06] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
          s.track,
          checked ? c.on : c.off,
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            "pointer-events-none block rounded-full bg-white shadow-sm transition-transform duration-200",
            s.thumb,
            s.translate,
            "translate-x-0.5 mt-px",
          )}
        />
      </RadixSwitch.Root>
      {label && <span className="text-xs text-[var(--text-secondary)] select-none">{label}</span>}
    </label>
  );
}
