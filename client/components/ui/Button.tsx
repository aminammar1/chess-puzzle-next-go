"use client";

import { cn } from "@/lib/utils";
import type { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-[var(--accent-green)] to-[color-mix(in_srgb,var(--accent-green),black_20%)] text-white shadow-lg shadow-green-900/30 hover:brightness-110 active:brightness-90",
  secondary:
    "border border-white/[0.08] bg-white/[0.03] text-[var(--text-secondary)] hover:border-white/[0.15] hover:text-[var(--text-primary)] active:bg-white/[0.06]",
  ghost:
    "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04] active:bg-white/[0.06]",
  danger:
    "border border-red-900/40 bg-red-900/20 text-red-300 hover:bg-red-900/30 active:bg-red-900/40",
  gold:
    "bg-gradient-to-b from-[var(--accent-gold)] to-[color-mix(in_srgb,var(--accent-gold),black_20%)] text-[var(--bg-deep)] font-semibold shadow-lg hover:brightness-110 active:brightness-90",
};

const sizes: Record<string, string> = {
  sm: "rounded-lg px-3 py-1.5 text-xs",
  md: "rounded-xl px-4 py-2.5 text-sm",
  lg: "rounded-xl px-6 py-3 text-base",
};

export default function Button({
  children,
  variant = "secondary",
  size = "md",
  fullWidth,
  loading,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
