// GET /api/competitions/worldcup — public Club World Championship table
// (WorldCupSlot) plus knockout fixtures grouped by stage.
// NOTE: WorldCupSlot stores only ids (no FK relations) — clubs joined in-query.
// USER MANDATE: the Club World Cup is not played in Season 1 (no qualified
// clubs exist yet); `worldCupActive=false` lets the UI state it honestly.

import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { getActiveSeason } from "@/app/api/_lib/active-season";

export const dynamic = "force-dynamic";

const STAGE_ORDER = ["R16", "QF", "SF", "F"] as const;

export async function GET(_req: NextRequest) {
  const season = await getActiveSeason();
  if (!season) return ok({ season: null, table: [], knockout: [] });

  const slots = await db.worldCupSlot.findMany({ where: { seasonId: season.id } });

  // Join club display info (WorldCupSlot has no relations in the schema).
  const clubIds = [...new Set(slots.map((s) => s.clubId))];
  const clubs = await db.club.findMany({
    where: { id: { in: clubIds } },
    select: {
      id: true,
      name: true,
      brand: { select: { initials: true, primaryColor: true, secondaryColor: true } },
    },
  });
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  const table = slots
    .map((s) => ({ slot: s, club: clubById.get(s.clubId) ?? null }))
    .filter((r) => r.club !== null)
    .sort((a, b) => {
      const aClub = a.club!;
      const bClub = b.club!;
      return (
        b.slot.points - a.slot.points ||
        b.slot.gf - b.slot.ga - (a.slot.gf - a.slot.ga) ||
        b.slot.gf - a.slot.gf ||
        aClub.name.localeCompare(bClub.name)
      );
    })
    .map(({ slot, club }) => ({
      club: { id: club!.id, name: club!.name, brand: club!.brand },
      source: slot.source,
      points: slot.points,
      played: slot.played,
      gf: slot.gf,
      ga: slot.ga,
      gd: slot.gf - slot.ga,
      eliminatedStage: slot.eliminatedStage,
    }));

  const knockout = await db.fixture.findMany({
    where: { seasonId: season.id, competition: "WORLD_CHAMPIONSHIP", stage: { not: null } },
    orderBy: [{ kickoffAt: "asc" }],
    include: {
      home: {
        select: {
          id: true, name: true,
          brand: { select: { initials: true, primaryColor: true, secondaryColor: true } },
        },
      },
      away: {
        select: {
          id: true, name: true,
          brand: { select: { initials: true, primaryColor: true, secondaryColor: true } },
        },
      },
      match: { select: { homeGoals: true, awayGoals: true } },
    },
  });

  // Drawn knockout matches (engine coin-flip): the slot eliminated at this
  // stage is the loser — used to highlight the true winner in the bracket.
  const elimStageByClub = new Map(slots.map((s) => [s.clubId, s.eliminatedStage]));

  const stageIdx = (stage: string) => {
    const idx = (STAGE_ORDER as readonly string[]).indexOf(stage);
    return idx >= 0 ? idx : 99;
  };

  return ok({
    season: { id: season.id, number: season.number },
    worldCupActive: season.number >= 2,
    table,
    knockout: knockout
      .sort((a, b) => stageIdx(a.stage ?? "") - stageIdx(b.stage ?? "") || a.kickoffAt.getTime() - b.kickoffAt.getTime())
      .map((f) => {
        let winner: "home" | "away" | null = null;
        if (f.match) {
          if (f.match.homeGoals > f.match.awayGoals) winner = "home";
          else if (f.match.awayGoals > f.match.homeGoals) winner = "away";
          else {
            const he = elimStageByClub.get(f.homeId);
            const ae = elimStageByClub.get(f.awayId);
            if (he === f.stage && ae !== f.stage) winner = "away";
            else if (ae === f.stage && he !== f.stage) winner = "home";
          }
        }
        return {
          id: f.id,
          stage: f.stage,
          round: f.round,
          kickoffUtc: f.kickoffAt.toISOString(),
          status: f.status,
          home: { id: f.home.id, name: f.home.name, brand: f.home.brand },
          away: { id: f.away.id, name: f.away.name, brand: f.away.brand },
          score: f.match ? { home: f.match.homeGoals, away: f.match.awayGoals } : null,
          winner,
        };
      }),
  });
}
