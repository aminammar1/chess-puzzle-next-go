"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ─── Plan definitions ───────────────────────────────────────────────
export type PlanId = "free" | "pro" | "elite";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;          // monthly, 0 = free
  yearlyPrice: number;    // annual (0 = free)
  features: string[];
  aiAccess: boolean;
}

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    yearlyPrice: 0,
    features: [
      "Lichess puzzles",
      "Dataset puzzles (4M+)",
      "Daily challenge",
      "Voice control",
      "4 board themes",
    ],
    aiAccess: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 3.99,
    yearlyPrice: 29.99,
    features: [
      "Everything in Free",
      "AI puzzle generation",
      "Custom puzzle prompts",
      "Priority generation",
      "Advanced analytics (soon)",
    ],
    aiAccess: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: 7.99,
    yearlyPrice: 59.99,
    features: [
      "Everything in Pro",
      "Unlimited AI puzzles",
      "Opening trainer (soon)",
      "Endgame drills (soon)",
      "Personal coach AI (soon)",
    ],
    aiAccess: true,
  },
];

// ─── Context ────────────────────────────────────────────────────────
interface SubscriptionState {
  plan: PlanId;
  hasAIAccess: boolean;
  /** Simulated upgrade — persists in localStorage. */
  upgrade: (plan: PlanId) => void;
  /** Reset back to free. */
  downgrade: () => void;
}

const SubscriptionContext = createContext<SubscriptionState>({
  plan: "free",
  hasAIAccess: false,
  upgrade: () => { },
  downgrade: () => { },
});

const STORAGE_KEY = "chess-puzzles-plan";

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<PlanId>("free");

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as PlanId | null;
      if (saved && ["free", "pro", "elite"].includes(saved)) {
        setPlan(saved);
      }
    } catch {
      // SSR or storage unavailable
    }
  }, []);

  const upgrade = useCallback((newPlan: PlanId) => {
    setPlan(newPlan);
    try {
      localStorage.setItem(STORAGE_KEY, newPlan);
    } catch { }
  }, []);

  const downgrade = useCallback(() => {
    setPlan("free");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { }
  }, []);

  const hasAIAccess = plan === "pro" || plan === "elite";

  return (
    <SubscriptionContext.Provider value={{ plan, hasAIAccess, upgrade, downgrade }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
