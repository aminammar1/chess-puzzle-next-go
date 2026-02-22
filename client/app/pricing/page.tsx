"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import { plans, useSubscription, type PlanId } from "@/lib/subscription";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const router = useRouter();
  const { plan: currentPlan, upgrade } = useSubscription();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [processing, setProcessing] = useState<PlanId | null>(null);
  const [justUpgraded, setJustUpgraded] = useState<PlanId | null>(null);

  async function handleSelect(planId: PlanId) {
    if (planId === currentPlan) return;
    if (planId === "free") {
      upgrade("free");
      return;
    }

    // Simulate payment processing
    setProcessing(planId);
    await new Promise((r) => setTimeout(r, 1800));
    upgrade(planId);
    setProcessing(null);
    setJustUpgraded(planId);

    // Redirect to AI page after a moment
    setTimeout(() => router.push("/puzzles/ai"), 1500);
  }

  const accentByPlan: Record<PlanId, { border: string; bg: string; text: string; glow: string; btn: string }> = {
    free: {
      border: "border-white/[0.08]",
      bg: "bg-white/[0.02]",
      text: "text-[var(--text-secondary)]",
      glow: "",
      btn: "border border-white/[0.1] bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08]",
    },
    pro: {
      border: "border-purple-500/30",
      bg: "bg-purple-500/[0.04]",
      text: "text-purple-400",
      glow: "shadow-lg shadow-purple-900/20",
      btn: "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-900/30 hover:brightness-110",
    },
    elite: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/[0.04]",
      text: "text-amber-400",
      glow: "shadow-lg shadow-amber-900/20",
      btn: "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-900/30 hover:brightness-110",
    },
  };

  return (
    <div className="min-h-screen bg-[var(--bg-deep)]">
      <Navbar />

      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <div className="mb-4 text-5xl">♛</div>
          <h1 className="font-serif text-4xl font-bold text-[var(--text-primary)]">
            Upgrade Your Game
          </h1>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            Unlock AI-powered puzzle generation and more
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all",
                billing === "monthly"
                  ? "bg-white/[0.1] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all",
                billing === "yearly"
                  ? "bg-white/[0.1] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              Yearly
              <span className="ml-2 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                Save 37%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Success banner */}
        {justUpgraded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto mb-8 max-w-md rounded-xl border border-green-500/30 bg-green-500/[0.06] p-4 text-center"
          >
            <div className="mb-1 text-2xl">🎉</div>
            <p className="text-sm font-semibold text-green-400">
              Welcome to {plans.find((p) => p.id === justUpgraded)?.name}!
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Redirecting to AI Puzzles...
            </p>
          </motion.div>
        )}

        {/* Plans grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, i) => {
            const accent = accentByPlan[plan.id];
            const isCurrent = plan.id === currentPlan;
            const price = billing === "monthly" ? plan.price : plan.yearlyPrice;
            const isPopular = plan.id === "pro";

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={cn(
                  "relative rounded-2xl border p-6 transition-all",
                  accent.border,
                  accent.bg,
                  accent.glow,
                  isPopular && "md:scale-105 md:z-10"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-purple-600 px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Most Popular
                  </div>
                )}

                {/* Plan name */}
                <div className="mb-6">
                  <h3 className={cn("font-serif text-xl font-bold", accent.text)}>
                    {plan.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-[var(--text-primary)]">
                      {price === 0 ? "Free" : `$${price}`}
                    </span>
                    {price > 0 && (
                      <span className="text-sm text-[var(--text-muted)]">
                        /{billing === "monthly" ? "mo" : "yr"}
                      </span>
                    )}
                  </div>
                  {billing === "yearly" && plan.price > 0 && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      ${(plan.yearlyPrice / 12).toFixed(2)}/mo billed annually
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="mb-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="mt-0.5 text-green-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                <button
                  onClick={() => handleSelect(plan.id)}
                  disabled={isCurrent || processing !== null}
                  className={cn(
                    "w-full rounded-xl px-6 py-3 text-sm font-semibold transition-all active:brightness-90 disabled:opacity-60 disabled:cursor-not-allowed",
                    isCurrent
                      ? "border border-white/[0.1] bg-white/[0.04] text-[var(--text-muted)]"
                      : accent.btn
                  )}
                >
                  {processing === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Processing...
                    </span>
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : plan.price === 0 ? (
                    "Downgrade"
                  ) : (
                    `Get ${plan.name}`
                  )}
                </button>

                {plan.price > 0 && !isCurrent && (
                  <p className="mt-3 text-center text-[10px] text-[var(--text-muted)]">
                    7-day free trial · Cancel anytime
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* FAQ hint */}
        <div className="mt-16 text-center">
          <p className="text-xs text-[var(--text-muted)]">
            This is a demo subscription flow. No real payment is processed.
          </p>
        </div>
      </div>
    </div>
  );
}
