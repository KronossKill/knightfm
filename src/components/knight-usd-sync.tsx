"use client";
// Knight FM — syncs the effective $Knight→USD rate into the global client store.
// Reads the public /api/world/state snapshot (same TanStack cache key as the game
// shell, so inside the game this costs ZERO extra requests) and writes it to
// useKnightUsd, which drives the USD equivalents appended by formatCurrency.
// Mounted once in AppRoot so landing, onboarding and every game view are covered.

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchWorldState, qk } from "@/components/game/api";
import { useKnightUsd } from "@/lib/knight-usd";

export function KnightUsdSync() {
  const world = useQuery({
    queryKey: qk.world,
    queryFn: fetchWorldState,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const cents = world.data?.knightUsd?.cents ?? null;
  const source = world.data?.knightUsd?.source ?? null;

  useEffect(() => {
    useKnightUsd.getState().set(cents, source);
  }, [cents, source]);

  return null;
}
