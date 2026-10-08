// Knight FM — Season-change promotion & relegation (Task 22, user mandate).
//
// EXACT RULE (user's words — must never fail):
//   • The TOP 3 league teams of EVERY division FROM THE 2ND onwards promote to
//     the division immediately above theirs.
//   • The WORST 3 league teams of EVERY division FROM THE 1ST onwards relegate
//     to the division immediately below theirs. The LAST division has no lower
//     division, so its bottom teams stay where they are.
//   • Division-1 top teams do NOT move by promotion — they qualify for the
//     Club World Cup instead (see qualifyWorldCup, season day 30).
//   • Everything is applied at the SEASON CHANGE (seasonTransition).
//
// Design guarantees ("eso no puede fallar"):
//   1. Selection is PURE and deterministic — no DB writes, fully testable.
//   2. Tie-breaks are IDENTICAL to the official league table
//      (points → goal difference → goals for → club name).
//   3. The last-division index is derived per region from the real Division
//      rows (never hardcoded), so the bottom division never relegates.
//   4. Promotions and relegations can never overlap: when a division has fewer
//      standings rows than the slots demand, the relegation count is clamped,
//      and a club can only ever move once.
//   5. Application runs in ONE database transaction — either every club moves
//      or none does — and every movement is audited (PROMOTIONS_RELEGATIONS).

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface StandingRowLike {
  clubId: string;
  points: number;
  gf: number;
  ga: number;
  clubName?: string;
}

export interface DivisionLike {
  id: string;
  regionId: string;
  index: number;
}

export type MovementDirection = "PROMOTED" | "RELEGATED";

export interface Movement {
  clubId: string;
  clubName?: string;
  regionId: string;
  direction: MovementDirection;
  fromDivisionId: string;
  fromIndex: number;
  toDivisionId: string;
  toIndex: number;
  /** 1-based position in the final league table of the origin division. */
  position: number;
  points: number;
  gd: number;
  gf: number;
}

/** Official league-table comparator — identical to GET /api/competitions/standings:
 *  points desc → goal difference desc → goals for desc → club name asc. */
export function compareStandings(a: StandingRowLike, b: StandingRowLike): number {
  return (
    b.points - a.points ||
    b.gf - b.ga - (a.gf - a.ga) ||
    b.gf - a.gf ||
    (a.clubName ?? "").localeCompare(b.clubName ?? "")
  );
}

/** Sort a division table exactly like the official standings endpoint. */
export function sortTable<T extends StandingRowLike>(rows: T[]): T[] {
  return [...rows].sort(compareStandings);
}

/** PURE selection of season-change movements. No DB access — safe to test.
 *
 * @param divisions every division of the world (any order)
 * @param tables   map divisionId → raw standings rows of the closing season
 * @param promoSlots    competition.promotionSlots (user rule: 3)
 * @param relegaSlots   competition.relegationSlots (user rule: 3)
 */
export function planMovements(
  divisions: DivisionLike[],
  tables: Map<string, StandingRowLike[]>,
  promoSlots: number,
  relegaSlots: number
): Movement[] {
  // 1. Last division index per region, derived from real data (never hardcoded).
  const lastIndex = new Map<string, number>();
  for (const d of divisions) {
    const cur = lastIndex.get(d.regionId);
    if (cur === undefined || d.index > cur) lastIndex.set(d.regionId, d.index);
  }

  const movements: Movement[] = [];
  const moved = new Set<string>(); // a club can only ever move once

  for (const div of divisions) {
    const rows = sortTable(tables.get(div.id) ?? []);
    const last = lastIndex.get(div.regionId) ?? div.index;

    // Promote: every division FROM THE 2ND onwards (division 1 top → World Cup).
    const upper =
      div.index > 1 && promoSlots > 0
        ? divisions.find((d) => d.regionId === div.regionId && d.index === div.index - 1)
        : undefined;
    const promoCount = upper ? Math.min(promoSlots, rows.length) : 0;

    // Relegate: every division FROM THE 1ST onwards, EXCEPT the last one.
    const lower =
      div.index < last && relegaSlots > 0
        ? divisions.find((d) => d.regionId === div.regionId && d.index === div.index + 1)
        : undefined;
    // Overlap guard: the relegation zone can never reach into the promoted one.
    const roomForRelegation = Math.max(0, rows.length - promoCount);
    const relegCount = lower ? Math.min(relegaSlots, roomForRelegation) : 0;

    for (let i = 0; i < promoCount; i++) {
      const s = rows[i];
      if (!s || moved.has(s.clubId)) continue;
      moved.add(s.clubId);
      movements.push({
        clubId: s.clubId,
        clubName: s.clubName,
        regionId: div.regionId,
        direction: "PROMOTED",
        fromDivisionId: div.id,
        fromIndex: div.index,
        toDivisionId: upper!.id,
        toIndex: upper!.index,
        position: i + 1,
        points: s.points,
        gd: s.gf - s.ga,
        gf: s.gf,
      });
    }
    for (let i = 0; i < relegCount; i++) {
      const s = rows[rows.length - relegCount + i];
      if (!s || moved.has(s.clubId)) continue; // overlap guard (belt & braces)
      moved.add(s.clubId);
      movements.push({
        clubId: s.clubId,
        clubName: s.clubName,
        regionId: div.regionId,
        direction: "RELEGATED",
        fromDivisionId: div.id,
        fromIndex: div.index,
        toDivisionId: lower!.id,
        toIndex: lower!.index,
        position: rows.length - relegCount + i + 1,
        points: s.points,
        gd: s.gf - s.ga,
        gf: s.gf,
      });
    }
  }
  return movements;
}

/** Apply the movements inside the caller's transaction (atomic with the audit). */
export async function applyMovementsInTx(tx: Prisma.TransactionClient, movements: Movement[]): Promise<void> {
  for (const m of movements) {
    await tx.club.update({ where: { id: m.clubId }, data: { divisionId: m.toDivisionId } });
  }
}

/** Read the closing season's tables and plan the movements (no writes). */
export async function planSeasonMovements(
  seasonId: string,
  promoSlots: number,
  relegaSlots: number
): Promise<{ divisions: DivisionLike[]; movements: Movement[] }> {
  const divisions = await db.division.findMany({
    orderBy: [{ regionId: "asc" }, { index: "asc" }],
    select: { id: true, regionId: true, index: true },
  });
  const rows = await db.standing.findMany({
    where: { seasonId },
    select: { clubId: true, divisionId: true, points: true, gf: true, ga: true, club: { select: { name: true } } },
  });
  const tables = new Map<string, StandingRowLike[]>();
  for (const r of rows) {
    const list = tables.get(r.divisionId) ?? [];
    list.push({ clubId: r.clubId, points: r.points, gf: r.gf, ga: r.ga, clubName: r.club?.name ?? undefined });
    tables.set(r.divisionId, list);
  }
  return { divisions, movements: planMovements(divisions, tables, promoSlots, relegaSlots) };
}

/** Season-change entry point: plan + apply atomically + audit every movement. */
export async function runSeasonMovements(seasonId: string, promoSlots: number, relegaSlots: number): Promise<Movement[]> {
  const { movements } = await planSeasonMovements(seasonId, promoSlots, relegaSlots);
  if (movements.length === 0) return [];
  await db.$transaction(async (tx) => {
    await applyMovementsInTx(tx, movements);
    await tx.auditEvent.create({
      data: {
        type: "PROMOTIONS_RELEGATIONS",
        payload: JSON.stringify({
          seasonId,
          promoted: movements.filter((m) => m.direction === "PROMOTED").length,
          relegated: movements.filter((m) => m.direction === "RELEGATED").length,
          movements,
        }),
      },
    });
  });
  return movements;
}
