// Knight FM — tactical board logic (spec §12). Auto-complete uses a configurable
// multi-factor objective — never "best current form" alone. Suspended/unavailable
// players can never be selected.

import { computeContextualOvr, positionFit } from "@/lib/engine/ovr";
import { FORMATION_LAYOUTS, Formation, Position } from "@/lib/types";

export interface AutoPlayer {
  id: string;
  position: Position;
  detailedPos: string;
  ovr: number;
  fatigue: number;
  sharpness: number;
  morale: number;
  confidence: number;
  form: number;
  injuredUntil: Date | null;
  suspension: number;
}

export interface SlotResult { slotId: string; playerId: string | null }

export function isAvailable(p: AutoPlayer, now: Date = new Date()): boolean {
  if (p.injuredUntil && p.injuredUntil > now) return false;
  if (p.suspension > 0) return false;
  return true;
}

/**
 * Configurable objective: roleFit + contextual OVR + fitness − fatigue + sharpness + morale.
 * Weights are defaults; admin can tune via Control Center (training/tactics keys).
 */
export function playerSlotScore(p: AutoPlayer, slotPos: Position): number {
  const roleFit = positionFit(p.position, slotPos);
  const ctx = computeContextualOvr({
    rawOvr: p.ovr,
    fatigue: p.fatigue,
    sharpness: p.sharpness,
    morale: p.morale,
    confidence: p.confidence,
    roleFit,
    tacticalFit: 1,
  });
  return roleFit * 30 + ctx * 1.0 + p.sharpness * 0.15 + p.morale * 0.1 - p.fatigue * 0.12;
}

/** Greedy multi-factor auto-complete over all formation slots. */
export function autoCompleteLineup(players: AutoPlayer[], formation: Formation, now: Date = new Date()): SlotResult[] {
  const slots = FORMATION_LAYOUTS[formation];
  const available = players.filter((p) => isAvailable(p, now));
  const used = new Set<string>();
  const result: SlotResult[] = [];
  // Assign GK first, then DF, MF, FW to maximize fit quality
  const ordered = [...slots].sort((a, b) => {
    const rank: Record<string, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };
    return rank[a.pos] - rank[b.pos];
  });
  for (const slot of ordered) {
    const candidates = available
      .filter((p) => !used.has(p.id))
      .map((p) => ({ p, score: playerSlotScore(p, slot.pos) }))
      .sort((a, b) => b.score - a.score);
    if (candidates.length > 0 && candidates[0].score > 5) {
      used.add(candidates[0].p.id);
      result.push({ slotId: slot.id, playerId: candidates[0].p.id });
    } else {
      result.push({ slotId: slot.id, playerId: null });
    }
  }
  return result;
}
