"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export function useNavbarController(pathname: string) {
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = useCallback(
    (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href)),
    [pathname]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return {
    showThemeMenu,
    setShowThemeMenu,
    mobileOpen,
    setMobileOpen,
    menuRef,
    isActive,
  };
}
