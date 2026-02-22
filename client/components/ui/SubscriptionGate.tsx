"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useSubscription } from "@/lib/subscription";

interface SubscriptionGateProps {
  feature: string;
  children: React.ReactNode;
}

/**
 * Wraps content that requires a paid subscription.
 * If the user has AI access → renders children normally.
 * Otherwise → shows a blur overlay with an upgrade prompt linking to /pricing.
 */
export default function SubscriptionGate({ feature, children }: SubscriptionGateProps) {
  const { hasAIAccess } = useSubscription();
  const router = useRouter();

  if (hasAIAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Blurred content preview */}
      <div className="pointer-events-none select-none blur-sm opacity-50">
        {children}
      </div>

      {/* Lock overlay */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="rounded-2xl border border-purple-500/20 bg-[var(--bg-card)]/95 backdrop-blur-xl p-8 text-center shadow-2xl shadow-purple-900/20 max-w-sm mx-4">
          {/* Lock icon */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/10 border border-purple-500/20">
            <svg
              className="h-8 w-8 text-purple-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>

          <h3 className="font-serif text-lg font-bold text-[var(--text-primary)] mb-1">
            {feature}
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-5">
            Unlock AI-powered puzzle generation with a Pro subscription
          </p>

          {/* Pricing hint */}
          <div className="mb-4 rounded-lg bg-purple-500/[0.06] border border-purple-500/10 px-4 py-3">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-purple-400">$3.99</span>
              <span className="text-xs text-[var(--text-muted)]">/month</span>
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
              or $29.99/year (save 37%)
            </p>
          </div>

          <button
            onClick={() => router.push("/pricing")}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition-all hover:brightness-110 active:brightness-90"
          >
            View Plans & Upgrade
          </button>

          <p className="mt-3 text-[10px] text-[var(--text-muted)]">
            7-day free trial · Cancel anytime
          </p>
        </div>
      </motion.div>
    </div>
  );
}
