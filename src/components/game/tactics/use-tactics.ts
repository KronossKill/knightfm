"use client";
// Knight FM — tactical board data layer (Task 4-b, spec §12).
// TanStack Query hooks for GET /api/players + GET /api/tactics and mutations for
// PUT /api/tactics + POST /api/tactics/auto. Local optimistic selection happens
// in tactics-view; the server stays the authority on save.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/components/auth/store";
import { FORMATION_LAYOUTS, Formation, Position } from "@/lib/types";
import { positionFit } from "@/lib/engine/ovr";

// ─── Types (mirrors of the actual API contracts) ──────────────────

/** Squad row from GET /api/players?clubId= (rich: includes form/fatigue/trends). */
export interface SquadPlayer {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  position: Position;
  detailedPos: string;
  ovr: number;
  potential: number;
  stars: number;
  marketValue: number;
  salary: number;
  releaseClause: number;
  /** 0..100 — higher is better. */
  form: number;
  /** 0..100 — higher means more tired. */
  fatigue: number;
  /** 0..100. */
  sharpness: number;
  /** 0..100. */
  morale: number;
  /** 0..100. */
  confidence: number;
  injuredUntil: string | null;
  suspension: number;
  /** Per-attribute trend vs latest snapshot (≤14d): "up" | "down" | "flat". */
  trendPerAttribute: Record<string, string>;
}

export interface PlayersResponse {
  clubId: string;
  players: SquadPlayer[];
  count: number;
}

export interface AvailabilitySummary {
  total: number;
  available: number;
  injured: number;
  suspended: number;
  byPosition: Record<string, { total: number; available: number }>;
}

/** Response of GET /api/tactics?clubId= */
export interface LineupResponse {
  clubId: string;
  formation: string;
  slots: Record<string, string | null>;
  inPossession: string;
  outOfPossession: string;
  updatedAt: string | null;
  availability: AvailabilitySummary;
  squad: Array<{
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    detailedPos: string;
    ovr: number;
    stars: number;
    available: boolean;
    injuredUntil: string | null;
    suspension: number;
  }>;
}

/** Response of PUT /api/tactics and POST /api/tactics/auto. */
export interface SaveResult {
  saved?: boolean;
  formation: string;
  slots: Record<string, string | null>;
  filled: number;
  total: number;
  completeness: number;
}

// ─── Queries ──────────────────────────────────────────────────────

export function useSquad(clubId: string | undefined) {
  return useQuery({
    queryKey: ["players", clubId],
    queryFn: () => apiFetch<PlayersResponse>(`/api/players?clubId=${encodeURIComponent(clubId as string)}`),
    enabled: !!clubId,
    staleTime: 30_000,
  });
}

export function useLineup(clubId: string | undefined) {
  return useQuery({
    queryKey: ["tactics", clubId],
    queryFn: () => apiFetch<LineupResponse>(`/api/tactics?clubId=${encodeURIComponent(clubId as string)}`),
    enabled: !!clubId,
    staleTime: 15_000,
  });
}

/** Shape of GET /api/club/mine (only the fields the board needs). */
export interface ClubMineResponse {
  clubs: Array<{ id: string; name: string } & Record<string, unknown>>;
  season: { id: string; number: number } | null;
}

/**
 * Fallback club resolution — used only when the shell renders the view without
 * an explicit `club` prop: the first club the user owns or manages.
 */
export function useClubFallback(enabled: boolean) {
  return useQuery({
    queryKey: ["club-mine"],
    queryFn: () => apiFetch<ClubMineResponse>("/api/club/mine"),
    enabled,
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────

export function useSaveLineup(clubId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { formation: Formation; slots: Record<string, string | null> }) =>
      apiFetch<SaveResult>("/api/tactics", { method: "PUT", body: { clubId, ...body } }),
    onSuccess: (data) => {
      qc.setQueryData<LineupResponse>(["tactics", clubId], (prev) =>
        prev ? { ...prev, formation: data.formation, slots: data.slots } : prev
      );
    },
  });
}

export function useAutoLineup(clubId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { formation: Formation }) =>
      apiFetch<SaveResult>("/api/tactics/auto", { method: "POST", body: { clubId, ...body } }),
    onSuccess: (data) => {
      qc.setQueryData<LineupResponse>(["tactics", clubId], (prev) =>
        prev ? { ...prev, formation: data.formation, slots: data.slots } : prev
      );
    },
  });
}

// ─── Domain helpers (client-side, engine-consistent) ──────────────

/**
 * Availability — same semantics as `isAvailable` in src/lib/engine/tactics.ts,
 * evaluated against ISO date strings coming from the JSON API.
 */
export function isPlayerAvailable(
  p: { injuredUntil: string | null; suspension: number },
  now: Date = new Date()
): boolean {
  if (p.suspension > 0) return false;
  if (p.injuredUntil && new Date(p.injuredUntil) > now) return false;
  return true;
}

/** Position suitability % for a slot (engine positionFit × 100, rounded). */
export function fitPct(player: { position: Position }, slotPos: Position): number {
  return Math.round(positionFit(player.position, slotPos) * 100);
}

/** Rebuild a full slots map for a formation, keeping matching ids from `raw`. */
export function normalizeSlots(
  raw: Record<string, string | null> | null | undefined,
  formation: Formation
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const s of FORMATION_LAYOUTS[formation]) out[s.id] = raw?.[s.id] ?? null;
  return out;
}

/** Short display surname for tiles. */
export function shortName(p: { firstName: string; lastName: string }): string {
  return (p.lastName?.trim() || p.firstName || "").slice(0, 12);
}
