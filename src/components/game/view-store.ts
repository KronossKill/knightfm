"use client";
// Knight FM — active view store (Task 4-a composition contract).
// The shell renders the active view from here; any component (sidebar, cards,
// assistant actions…) can navigate by calling setView.
//
// depositEscape (Task 16): reactive flag for the deposit escape hatch — a
// club-less user who came from the "Fondos insuficientes" dialog ("Ir a
// depositar ahora") and is temporarily allowed into a wallet-only GameShell.
// Zustand makes AuthedGate switch views IMMEDIATELY on change (a query
// invalidation alone cannot: structural sharing keeps the same data reference
// when /api/onboarding/state returns identical content). sessionStorage keeps
// the mode across reloads.

import { create } from "zustand";

export type GameView =
  | "dashboard"
  | "squad"
  | "tactics"
  | "training"
  | "facilities"
  | "staff"
  | "youth"
  | "competitions"
  | "markets"
  | "treasury"
  | "wallet"
  | "inbox"
  | "assistant"
  | "settings"
  | "control-center";

interface ViewState {
  view: GameView;
  setView: (v: GameView) => void;
  /** Actively selected club (top-bar switcher); views fall back to their first club. */
  activeClubId: string | null;
  setActiveClub: (clubId: string | null) => void;
  /** Club-less user temporarily funding their wallet (deposit escape hatch). */
  depositEscape: boolean;
  setDepositEscape: (v: boolean) => void;
}

const initialDepositEscape =
  typeof window !== "undefined" && window.sessionStorage.getItem("kfm.onb.wallet") === "1";

const ALL_VIEWS: GameView[] = [
  "dashboard", "squad", "tactics", "training", "facilities", "staff", "youth",
  "competitions", "markets", "treasury", "wallet", "inbox", "assistant",
  "settings", "control-center",
];

// Master UI/UX v2.0 — deep linking: every screen has a unique URL (?view=…).
// Priority: URL param (shareable/deep link) → last visited screen
// (sessionStorage) → dashboard.
function initialView(): GameView {
  if (typeof window === "undefined") return "dashboard";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("view");
    if (fromUrl && ALL_VIEWS.includes(fromUrl as GameView)) return fromUrl as GameView;
    const last = window.sessionStorage.getItem("kfm.view");
    if (last && ALL_VIEWS.includes(last as GameView)) return last as GameView;
  } catch {}
  return "dashboard";
}

function syncUrl(view: GameView) {
  try {
    window.sessionStorage.setItem("kfm.view", view);
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState(null, "", url.toString());
  } catch {}
}

export const useViewStore = create<ViewState>((set) => ({
  view: initialView(),
  setView: (view) => {
    set({ view });
    if (typeof window !== "undefined") syncUrl(view);
  },
  activeClubId: null,
  setActiveClub: (activeClubId) => set({ activeClubId }),
  depositEscape: initialDepositEscape,
  setDepositEscape: (depositEscape) => set({ depositEscape }),
}));
