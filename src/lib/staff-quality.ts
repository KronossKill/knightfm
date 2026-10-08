// Knight FM — staff quality scale shared by the staff APIs and the staff UI.
// Pure module (no server imports) so both sides stay in sync.
//
// Quality (20–92) maps to a 1–5 star scale:
//   ≥85 → 5★ · ≥70 → 4★ · ≥55 → 3★ · ≥40 → 2★ · else 1★
// An area's facility bounds the reachable quality ceiling (same physics as the
// candidate generator: ceiling = 47 + 4 × facilityLevel, capped at 92), so the
// selectable star levels are facility-gated.

export type StaffRoleStatic = "COACH" | "SCOUT" | "MEDIC" | "PHYSIO" | "ANALYST";

/** Quality band per star level. */
export const STAR_BANDS: Record<number, { min: number; max: number }> = {
  1: { min: 20, max: 39 },
  2: { min: 40, max: 54 },
  3: { min: 55, max: 69 },
  4: { min: 70, max: 84 },
  5: { min: 85, max: 92 },
};

/** Map a concrete quality value to its star level (1–5). */
export function starsFor(quality: number): number {
  if (quality >= 85) return 5;
  if (quality >= 70) return 4;
  if (quality >= 55) return 3;
  if (quality >= 40) return 2;
  return 1;
}

/** Best quality reachable with a facility at the given level. */
export function qualityCeilingFor(facilityLevel: number): number {
  return Math.min(92, 47 + facilityLevel * 4);
}

/** Highest star level a facility at the given level can provide candidates for. */
export function maxStarsForFacility(facilityLevel: number): number {
  const ceiling = qualityCeilingFor(facilityLevel);
  if (ceiling >= STAR_BANDS[5].min) return 5;
  if (ceiling >= STAR_BANDS[4].min) return 4;
  if (ceiling >= STAR_BANDS[3].min) return 3;
  if (ceiling >= STAR_BANDS[2].min) return 2;
  return 1;
}

/** Minimum facility level required before a star level becomes selectable. */
export function minFacilityLevelForStars(stars: number): number {
  const band = STAR_BANDS[stars] ?? STAR_BANDS[1];
  return Math.max(1, Math.ceil((band.min - 47) / 4));
}

/** Map of star level → required facility level (for UI hints). */
export function starRequirements(): Record<number, number> {
  return { 1: 1, 2: 1, 3: 2, 4: 6, 5: 10 };
}
