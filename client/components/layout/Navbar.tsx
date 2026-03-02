"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { navItems, themeOptions } from "@/lib/navbar-config";
import { useNavbarController } from "@/hooks/useNavbarController";

export default function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const {
    showThemeMenu,
    setShowThemeMenu,
    mobileOpen,
    setMobileOpen,
    menuRef,
    isActive,
  } = useNavbarController(pathname);

  return (
    <nav className="sticky top-0 z-50 nav-glass">
      {/* Accent line at top — uses theme accent */}
      <div
        className="h-[2px] w-full transition-colors duration-300"
        style={{ background: `linear-gradient(90deg, transparent, var(--accent-gold), transparent)` }}
      />

      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* ─── Logo ─── */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-gold)] to-amber-700 text-sm shadow-md shadow-[var(--accent-gold)]/20 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-[var(--accent-gold)]/30 group-hover:scale-105">
            <span className="drop-shadow-sm">♔</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-serif text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
              Chess Puzzles
            </span>
            <span className="hidden text-[9px] font-medium uppercase tracking-[0.2em] text-[var(--text-muted)] sm:block">
              Train Your Tactics
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
                  "relative flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-all duration-200",
                  active
                    ? "text-[var(--accent-gold)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                )}
              >
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--accent-gold)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="text-[12px]">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* ─── Right actions ─── */}
        <div className="flex items-center gap-1.5">
          {/* Theme picker */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowThemeMenu((v) => !v)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm transition-all duration-200",
                showThemeMenu
                  ? "bg-[var(--accent-gold)]/15 text-[var(--text-primary)] ring-1 ring-[var(--accent-gold)]/25"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-secondary)]",
              )}
              title="Change theme"
              aria-label="Theme selector"
            >
              {themeOptions.find((t) => t.mode === theme)?.icon ?? "🎨"}
            </button>

            <AnimatePresence>
              {showThemeMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2.5 w-48 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl shadow-black/40 backdrop-blur-2xl"
                >
                  <div className="p-1.5">
                    <div className="mb-1 px-2.5 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                      Theme
                    </div>
                    {themeOptions.map((opt) => (
                      <button
                        key={opt.mode}
                        onClick={() => {
                          setTheme(opt.mode);
                          setShowThemeMenu(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-all duration-150",
                          theme === opt.mode
                            ? "bg-[var(--accent-gold)]/10 text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] hover:bg-white/[0.04]",
                        )}
                      >
                        <span className="text-base">{opt.icon}</span>
                        <span className="flex-1">{opt.label}</span>
                        {theme === opt.mode && (
                          <motion.span
                            layoutId="theme-check"
                            className="text-[var(--accent-gold)]"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </motion.span>
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
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-secondary)] transition-all md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {mobileOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </>
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
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-[var(--border-subtle)] md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-[var(--accent-gold)]/10 text-[var(--text-primary)] border border-[var(--accent-gold)]/15"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.03]",
                    )}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent-gold)]" />
                    )}
                  </Link>
                );
              })}

              {/* Mobile theme switcher */}
              <div className="mt-2 border-t border-[var(--border-subtle)] pt-3">
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  Theme
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.mode}
                      onClick={() => {
                        setTheme(opt.mode);
                        setMobileOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-all",
                        theme === opt.mode
                          ? "bg-[var(--accent-gold)]/10 text-[var(--text-primary)] ring-1 ring-[var(--accent-gold)]/20"
                          : "text-[var(--text-muted)] hover:bg-white/[0.04]",
                      )}
                    >
                      <span>{opt.icon}</span>
                      <span className="truncate">{opt.label.split(" ").pop()}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
