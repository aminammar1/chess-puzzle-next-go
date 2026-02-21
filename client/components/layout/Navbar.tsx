"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeMode } from "@/lib/theme";

const navItems = [
  { href: "/", label: "Home", icon: "♚" },
  { href: "/puzzles", label: "Puzzles", icon: "♞" },
  { href: "/daily", label: "Daily", icon: "♜" },
];

const themeOptions: { mode: ThemeMode; label: string; preview: string }[] = [
  { mode: "wood", label: "Classic Wood", preview: "🪵" },
  { mode: "dark", label: "Dark Steel", preview: "🌑" },
  { mode: "midnight", label: "Midnight", preview: "🌙" },
  { mode: "emerald", label: "Emerald", preview: "💎" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  // Close theme menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06]" style={{ backgroundColor: "var(--nav-bg)", backdropFilter: "blur(16px)" }}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent-gold)] to-amber-700 text-base shadow-inner transition-transform group-hover:scale-105">
            ♔
          </div>
          <span className="font-serif text-base font-bold tracking-tight text-[var(--text-primary)]">
            Chess Puzzles
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                isActive(item.href)
                  ? "bg-white/[0.06] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-secondary)]"
              )}
            >
              <span className="text-base">{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
              {isActive(item.href) && (
                <span className="absolute -bottom-[1px] left-3 right-3 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[var(--accent-gold)] to-transparent" />
              )}
            </Link>
          ))}

          {/* Theme switcher */}
          <div className="relative ml-2" ref={menuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-sm transition-all hover:bg-white/[0.06]"
              title="Change theme"
            >
              🎨
            </button>
            {showThemeMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--bg-card)] shadow-xl shadow-black/30 animate-scaleIn">
                <div className="p-1">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.mode}
                      onClick={() => {
                        setTheme(opt.mode);
                        setShowThemeMenu(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all",
                        theme === opt.mode
                          ? "bg-white/[0.08] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-white/[0.04]"
                      )}
                    >
                      <span>{opt.preview}</span>
                      <span>{opt.label}</span>
                      {theme === opt.mode && (
                        <span className="ml-auto text-[var(--accent-green)]">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
