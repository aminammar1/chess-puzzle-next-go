import type { ThemeMode } from "@/lib/theme";

export const navItems = [
  { href: "/", label: "Home", icon: "♚" },
  { href: "/puzzles", label: "Puzzles", icon: "♞" },
  { href: "/daily", label: "Daily", icon: "♜" },
  { href: "/voice-test", label: "Voice Lab", icon: "🎤" },
  { href: "/pricing", label: "Pro", icon: "♛" },
];

export const themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: "wood", label: "Classic Wood", icon: "🪵" },
  { mode: "dark", label: "Dark Steel", icon: "🌑" },
  { mode: "midnight", label: "Midnight", icon: "🌙" },
  { mode: "emerald", label: "Emerald", icon: "💎" },
];
