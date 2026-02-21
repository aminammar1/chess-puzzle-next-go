"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type ThemeMode = "wood" | "dark" | "midnight" | "emerald";

interface ThemeColors {
  bgDeep: string;
  bgPrimary: string;
  bgCard: string;
  bgCardHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentGold: string;
  accentGreen: string;
  borderSubtle: string;
  borderMedium: string;
  boardLight: string;
  boardDark: string;
  navBg: string;
}

const themes: Record<ThemeMode, ThemeColors> = {
  wood: {
    bgDeep: "#1a0f08",
    bgPrimary: "#2c1e10",
    bgCard: "#3a2a1a",
    bgCardHover: "#4a3828",
    textPrimary: "#e8d5b5",
    textSecondary: "#a08060",
    textMuted: "#6b5540",
    accentGold: "#d4a43a",
    accentGreen: "#7bae3e",
    borderSubtle: "rgba(194, 154, 88, 0.15)",
    borderMedium: "rgba(194, 154, 88, 0.25)",
    boardLight: "#e8c99b",
    boardDark: "#a67b5b",
    navBg: "rgba(26, 15, 8, 0.95)",
  },
  dark: {
    bgDeep: "#0a0a0f",
    bgPrimary: "#13131a",
    bgCard: "#1c1c26",
    bgCardHover: "#252532",
    textPrimary: "#e2e2f0",
    textSecondary: "#8888a0",
    textMuted: "#55556a",
    accentGold: "#6c9bff",
    accentGreen: "#7bae3e",
    borderSubtle: "rgba(100, 100, 180, 0.15)",
    borderMedium: "rgba(100, 100, 180, 0.25)",
    boardLight: "#dee3e6",
    boardDark: "#8ca2ad",
    navBg: "rgba(10, 10, 15, 0.95)",
  },
  midnight: {
    bgDeep: "#0d1117",
    bgPrimary: "#161b22",
    bgCard: "#1e252e",
    bgCardHover: "#28313c",
    textPrimary: "#e6edf3",
    textSecondary: "#8b949e",
    textMuted: "#484f58",
    accentGold: "#f0b840",
    accentGreen: "#3fb950",
    borderSubtle: "rgba(48, 54, 61, 0.6)",
    borderMedium: "rgba(48, 54, 61, 0.9)",
    boardLight: "#eeeed2",
    boardDark: "#769656",
    navBg: "rgba(13, 17, 23, 0.95)",
  },
  emerald: {
    bgDeep: "#052e16",
    bgPrimary: "#0a3a1f",
    bgCard: "#134e2a",
    bgCardHover: "#1a6334",
    textPrimary: "#dcfce7",
    textSecondary: "#86efac",
    textMuted: "#4ade80",
    accentGold: "#fbbf24",
    accentGreen: "#34d399",
    borderSubtle: "rgba(52, 211, 153, 0.15)",
    borderMedium: "rgba(52, 211, 153, 0.25)",
    boardLight: "#f0d9b5",
    boardDark: "#b58863",
    navBg: "rgba(5, 46, 22, 0.95)",
  },
};

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "wood",
  setTheme: () => { },
  colors: themes.wood,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("wood");

  useEffect(() => {
    const saved = localStorage.getItem("chess-theme") as ThemeMode | null;
    if (saved && themes[saved]) {
      setThemeState(saved);
    }
  }, []);

  function setTheme(t: ThemeMode) {
    setThemeState(t);
    localStorage.setItem("chess-theme", t);
  }

  const colors = themes[theme];

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--bg-deep", colors.bgDeep);
    root.style.setProperty("--bg-primary", colors.bgPrimary);
    root.style.setProperty("--bg-card", colors.bgCard);
    root.style.setProperty("--bg-card-hover", colors.bgCardHover);
    root.style.setProperty("--text-primary", colors.textPrimary);
    root.style.setProperty("--text-secondary", colors.textSecondary);
    root.style.setProperty("--text-muted", colors.textMuted);
    root.style.setProperty("--accent-gold", colors.accentGold);
    root.style.setProperty("--accent-green", colors.accentGreen);
    root.style.setProperty("--border-subtle", colors.borderSubtle);
    root.style.setProperty("--border-medium", colors.borderMedium);
    root.style.setProperty("--board-light", colors.boardLight);
    root.style.setProperty("--board-dark", colors.boardDark);
    root.style.setProperty("--nav-bg", colors.navBg);
  }, [colors]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { themes };
