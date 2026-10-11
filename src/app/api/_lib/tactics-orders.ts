// Knight FM — shared KMIE v3 manager-orders helpers (used by /api/tactics,
// /api/tactics/briefing and mirrored client-side in use-tactics.ts).
// The 8 tunables the engine reads from the Lineup row every simulated minute
// (see src/lib/engine/matches.ts buildTeamInput).

import { z } from "zod";

export const ORDERS_ENUMS = {
  mentality: ["defensive", "cautious", "balanced", "offensive", "all_out"] as const,
  pressing: ["low", "medium", "high"] as const,
  tempo: ["slow", "normal", "fast"] as const,
  width: ["narrow", "normal", "wide"] as const,
  defensiveLine: ["deep", "medium", "high"] as const,
};

export const ORDERS_DEFAULTS = {
  mentality: "balanced",
  pressing: "medium",
  tempo: "normal",
  width: "normal",
  defensiveLine: "medium",
  counterAttack: false,
  offsideTrap: false,
  timeWasting: false,
} as const;

export const ordersSchema = z.object({
  mentality: z.enum(ORDERS_ENUMS.mentality).optional(),
  pressing: z.enum(ORDERS_ENUMS.pressing).optional(),
  tempo: z.enum(ORDERS_ENUMS.tempo).optional(),
  width: z.enum(ORDERS_ENUMS.width).optional(),
  defensiveLine: z.enum(ORDERS_ENUMS.defensiveLine).optional(),
  counterAttack: z.boolean().optional(),
  offsideTrap: z.boolean().optional(),
  timeWasting: z.boolean().optional(),
});

export type OrdersShape = z.infer<typeof ordersSchema>;
export type ManagerOrdersFull = Required<OrdersShape>;

/** Normalize a stored/legacy orders value into the full 8-field shape. */
export function normalizeOrdersRaw(raw: {
  mentality?: string | null; pressing?: string | null; tempo?: string | null;
  width?: string | null; defensiveLine?: string | null;
  counterAttack?: boolean | null; offsideTrap?: boolean | null; timeWasting?: boolean | null;
} | null | undefined): ManagerOrdersFull {
  const pick = <T extends string>(v: string | null | undefined, allowed: readonly T[], fallback: T): T =>
    (allowed as readonly string[]).includes(v as T) ? (v as T) : fallback;
  return {
    mentality: pick(raw?.mentality, ORDERS_ENUMS.mentality, ORDERS_DEFAULTS.mentality),
    pressing: pick(raw?.pressing, ORDERS_ENUMS.pressing, ORDERS_DEFAULTS.pressing),
    tempo: pick(raw?.tempo, ORDERS_ENUMS.tempo, ORDERS_DEFAULTS.tempo),
    width: pick(raw?.width, ORDERS_ENUMS.width, ORDERS_DEFAULTS.width),
    defensiveLine: pick(raw?.defensiveLine, ORDERS_ENUMS.defensiveLine, ORDERS_DEFAULTS.defensiveLine),
    counterAttack: raw?.counterAttack ?? ORDERS_DEFAULTS.counterAttack,
    offsideTrap: raw?.offsideTrap ?? ORDERS_DEFAULTS.offsideTrap,
    timeWasting: raw?.timeWasting ?? ORDERS_DEFAULTS.timeWasting,
  };
}
