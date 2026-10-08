"use client";
// Knight FM — theme provider (spec §32). Five themes, WCAG AA, theme switch never changes game state.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_THEME, isValidTheme, ThemeId, THEMES } from "@/lib/themes";

interface ThemeCtx {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Client-only tree (page renders with ssr:false), so a lazy initializer is safe
  // and avoids a synchronous setState inside an effect.
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    const stored = window.localStorage.getItem("knightfm.theme");
    return stored && isValidTheme(stored) ? (stored as ThemeId) : DEFAULT_THEME;
  });

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    try {
      window.localStorage.setItem("knightfm.theme", t);
    } catch {}
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = theme;
    el.classList.add("dark");
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export { THEMES };
