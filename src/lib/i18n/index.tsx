"use client";
// Knight FM — multilingual platform core (spec §33).
// Four languages with full parity (ES primary). No translatable strings are hardcoded anywhere.
// Changing language never changes game state.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANGUAGE, isValidLanguage, Language } from "@/lib/themes";
import { useKnightUsd } from "@/lib/knight-usd";

import { dict as commonEs } from "./dict/common/es";
import { dict as commonEn } from "./dict/common/en";
import { dict as commonFr } from "./dict/common/fr";
import { dict as commonPt } from "./dict/common/pt";

export type Dict = Record<string, string>;

const DICTIONARIES: Record<Language, Dict> = {
  es: { ...commonEs },
  en: { ...commonEn },
  fr: { ...commonFr },
  pt: { ...commonPt },
};

// Namespaces registered by feature modules at runtime (landing, auth, game, admin)
const EXTRA: Record<Language, Dict> = { es: {}, en: {}, fr: {}, pt: {} };

export function registerNamespace(lang: Language, dict: Dict) {
  EXTRA[lang] = { ...EXTRA[lang], ...dict };
}

export function registerNamespaces(dicts: Partial<Record<Language, Dict>>) {
  for (const lang of ["es", "en", "fr", "pt"] as Language[]) {
    if (dicts[lang]) registerNamespace(lang, dicts[lang] as Dict);
  }
}

export function getDictionary(lang: Language): Dict {
  return { ...DICTIONARIES[lang], ...EXTRA[lang] };
}

interface I18nCtx {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string;
  formatCurrency: (n: number) => string;
  /** USD value of 1 $Knight in US cents, or null when no rate is available. */
  knightUsdCents: number | null;
  /** Formats an absolute USD amount as currency text in the active language. */
  formatUsd: (usd: number) => string;
  /** Converts a $Knight amount to USD, or null when no rate is available. */
  knightToUsd: (kn: number) => number | null;
  formatDate: (d: Date | string, opts?: Intl.DateTimeFormatOptions) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Game views render client-only (ssr:false), so reading localStorage in a lazy
  // initializer is safe and avoids a synchronous setState inside an effect.
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    const stored = window.localStorage.getItem("knightfm.lang");
    return stored && isValidLanguage(stored) ? (stored as Language) : DEFAULT_LANGUAGE;
  });

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try {
      window.localStorage.setItem("knightfm.lang", l);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = getDictionary(lang)[key] ?? getDictionary("es")[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      }
      return s;
    },
    [lang]
  );

  const formatNumber = useCallback(
    (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(lang, opts).format(n),
    [lang]
  );

  // Effective $Knight→USD rate (fed by <KnightUsdSync/> from the public world snapshot).
  // When a rate exists, EVERY price and value formatted through formatCurrency carries
  // its USD equivalent; when it does not, nothing extra is shown (no fabrication).
  const knightUsdCents = useKnightUsd((s) => s.cents);

  const formatUsd = useCallback(
    (usd: number) =>
      new Intl.NumberFormat(lang, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(usd),
    [lang]
  );

  const knightToUsd = useCallback(
    (kn: number) => (knightUsdCents != null && knightUsdCents > 0 ? (kn * knightUsdCents) / 100 : null),
    [knightUsdCents]
  );

  const formatCurrency = useCallback(
    (n: number) => {
      const base = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(n) + " $Knight";
      const usd = knightToUsd(n);
      return usd != null ? `${base} ≈ ${formatUsd(usd)}` : base;
    },
    [lang, knightToUsd, formatUsd]
  );
  const formatDate = useCallback(
    (d: Date | string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) =>
      new Intl.DateTimeFormat(lang, opts).format(typeof d === "string" ? new Date(d) : d),
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, t, formatNumber, formatCurrency, knightUsdCents, formatUsd, knightToUsd, formatDate }),
    [lang, setLang, t, formatNumber, formatCurrency, knightUsdCents, formatUsd, knightToUsd, formatDate]
  );

  // Keep <html lang> in sync for accessibility/AT (initial doc lang is set by layout).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
