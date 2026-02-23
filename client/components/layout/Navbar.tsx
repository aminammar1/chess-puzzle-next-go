"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeMode } from "@/lib/theme";

const navItems = [
  { href: "/", label: "Home", icon: "♚" },
  { href: "/puzzles", label: "Puzzles", icon: "♞" },
  { href: "/daily", label: "Daily", icon: "♜" },
  { href: "/voice-test", label: "Voice", icon: "🎤" },
  { href: "/pricing", label: "Pro", icon: "♛" },
];

const themeOptions: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: "wood", label: "Classic", icon: "🪵" },
  { mode: "dark", label: "Steel", icon: "🌑" },
  { mode: "midnight", label: "Midnight", icon: "🌙" },
  { mode: "emerald", label: "Emerald", icon: "💎" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 nav-glass">
      <div className="mx-auto flex h-[56px] max-w-7xl items-center justify-between px-5 lg:px-8">
        {/* ─── Logo ─── */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-gold)] to-amber-700 text-sm shadow-md shadow-[var(--accent-gold)]/15 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-[var(--accent-gold)]/25 group-hover:scale-105">
            ♔
            <div className="absolute inset-0 rounded-lg bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-[15px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">
              Chess Puzzles
            </span>
            <span className="hidden text-[9px] font-medium uppercase tracking-[0.15em] text-[var(--text-muted)] sm:block">
              Sharpen Your Tactics
            </span>
          </div>
        </Link>

        {/* ─── Desktop nav ─── */}
        <div className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "nav-item relative flex items-center gap-1.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-all duration-200",
                  active
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                )}
              >
                <span className="text-[13px]">{item.icon}</span>
                <span>{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-white/[0.07]"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* ─── Right actions ─── */}
        <div className="flex items-center gap-2">
          {/* Theme */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-all duration-200",
                showThemeMenu
                  ? "bg-white/[0.1] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-secondary)]"
              )}
              title="Theme"
            >
              {themeOptions.find((t) => t.mode === theme)?.icon ?? "🎨"}
            </button>
            <AnimatePresence>
              {showThemeMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--bg-card)]/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
                >
                  <div className="p-1">
                    {themeOptions.map((opt) => (
                      <button
                        key={opt.mode}
                        onClick={() => { setTheme(opt.mode); setShowThemeMenu(false); }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-all duration-150",
                          theme === opt.mode
                            ? "bg-white/[0.08] text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] hover:bg-white/[0.04]"
                        )}
                      >
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                        {theme === opt.mode && (
                          <span className="ml-auto text-xs text-[var(--accent-gold)]">●</span>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-white/[0.06] md:hidden"
            aria-label="Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? (
                <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              ) : (
                <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Mobile menu ─── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/[0.04] md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-white/[0.07] text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
