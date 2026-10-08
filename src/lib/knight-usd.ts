"use client";
// Knight FM — global store for the effective $Knight→USD rate (client side).
// Fed by <KnightUsdSync/> from the public /api/world/state snapshot and consumed by
// the shared money formatter (useI18n().formatCurrency) so every price and value in
// the game shows its USD equivalent. cents === null → USD display is hidden (honest).

import { create } from "zustand";

interface KnightUsdState {
  /** USD value of 1 $Knight in US cents (25 = $0.25); null = unavailable/disabled. */
  cents: number | null;
  /** "oracle" (auto-detected price source) | "manual" (admin config) | null. */
  source: string | null;
  set: (cents: number | null, source: string | null) => void;
}

export const useKnightUsd = create<KnightUsdState>((set) => ({
  cents: null,
  source: null,
  set: (cents, source) => set({ cents, source }),
}));
