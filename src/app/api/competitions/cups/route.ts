// GET /api/competitions/cups?regionId= — public regional cup picture for the
// active season: bracket fixtures per round (who plays, who advances and against
// whom — user mandate Task 21), champion, and elimination summary.
// CupRun stores only ids (no FK relations) — clubs are joined in-query; the
// bracket comes from the REGIONAL_CUP Fixture rows (home/away/score).

import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { getActiveSeason } from "@/app/api/_lib/active-season";

export const dynamic = "force-dynamic";

interface ClubInfo {
  id: string;
  name: string;
  brand: { initials: string | null; primaryColor: string | null; secondaryColor: string | null } | null;
}

const CLUB_SELECT = {
  id: true,
  name: true,
  brand: { select: { initials: true, primaryColor: true, secondaryColor: true } },
} as const;

export async function GET(req: NextRequest) {
  const regionId = req.nextUrl.searchParams.get("regionId");
  const season = await getActiveSeason();
  if (!season) return ok({ season: null, regions: [] });

  const regionWhere = regionId ? { regionId } : {};

  const [runs, fixtures] = await Promise.all([
    db.cupRun.findMany({ where: { seasonId: season.id, ...regionWhere } }),
    db.fixture.findMany({
      where: { seasonId: season.id, competition: "REGIONAL_CUP", ...regionWhere },
      orderBy: [{ round: "asc" }, { kickoffAt: "asc" }],
      include: {
        home: { select: CLUB_SELECT },
        away: { select: CLUB_SELECT },
        match: { select: { homeGoals: true, awayGoals: true } },
      },
    }),
  ]);

  // Join club display info for the CupRun rows (no relations in the schema).
  const clubIds = [...new Set(runs.map((r) => r.clubId))];
  const clubs = await db.club.findMany({ where: { id: { in: clubIds } }, select: CLUB_SELECT });
  const clubById = new Map<string, ClubInfo>(
    clubs.map((c) => [c.id, { id: c.id, name: c.name, brand: c.brand }])
  );

  // Bracket fixtures grouped by region → round (pairings + scores + status).
  // Winner: from the score; drawn matches (resolved by the engine's seeded
  // coin-flip) are resolved from CupRun.eliminatedRound — the eliminated club
  // of this round is the loser.
  const elimRoundByClub = new Map(runs.map((r) => [r.clubId, r.eliminatedRound]));
  const bracketByRegion = new Map<string, { round: number; stage: string | null; matches: {
    id: string; home: ClubInfo; away: ClubInfo; score: { home: number; away: number } | null; status: string; matchDay: number; winner: "home" | "away" | null;
  }[] }[]>();
  for (const f of fixtures) {
    const list = bracketByRegion.get(f.regionId ?? "") ?? [];
    let roundEntry = list.find((r) => r.round === (f.round ?? 0));
    if (!roundEntry) {
      roundEntry = { round: f.round ?? 0, stage: f.stage, matches: [] };
      list.push(roundEntry);
      list.sort((a, b) => a.round - b.round);
    }
    roundEntry.stage = f.stage ?? roundEntry.stage;
    let winner: "home" | "away" | null = null;
    if (f.match) {
      if (f.match.homeGoals > f.match.awayGoals) winner = "home";
      else if (f.match.awayGoals > f.match.homeGoals) winner = "away";
      else {
        const he = elimRoundByClub.get(f.homeId);
        const ae = elimRoundByClub.get(f.awayId);
        if (he === (f.round ?? 0) && ae !== (f.round ?? 0)) winner = "away";
        else if (ae === (f.round ?? 0) && he !== (f.round ?? 0)) winner = "home";
      }
    }
    roundEntry.matches.push({
      id: f.id,
      home: { id: f.home.id, name: f.home.name, brand: f.home.brand },
      away: { id: f.away.id, name: f.away.name, brand: f.away.brand },
      score: f.match ? { home: f.match.homeGoals, away: f.match.awayGoals } : null,
      status: f.status,
      matchDay: f.matchDay,
      winner,
    });
    bracketByRegion.set(f.regionId ?? "", list);
  }

  // Group the elimination summary by region.
  const byRegion = new Map<string, { club: ClubInfo; eliminatedRound: number | null; champion: boolean }[]>();
  for (const run of runs) {
    const club = clubById.get(run.clubId);
    if (!club) continue;
    const list = byRegion.get(run.regionId) ?? [];
    list.push({ club, eliminatedRound: run.eliminatedRound, champion: run.champion });
    byRegion.set(run.regionId, list);
  }

  const regions = [...byRegion.entries()].map(([rid, entries]) => {
    const maxRound = Math.max(0, ...entries.map((e) => e.eliminatedRound ?? 0));
    const championEntry = entries.find((e) => e.champion) ?? null;
    const rounds: { round: number; eliminated: ClubInfo[] }[] = [];
    for (let r = 1; r <= maxRound; r++) {
      const eliminated = entries.filter((e) => e.eliminatedRound === r);
      if (eliminated.length > 0) {
        rounds.push({ round: r, eliminated: eliminated.map((e) => e.club) });
      }
    }
    return {
      regionId: rid,
      champion: championEntry ? championEntry.club : null,
      rounds,
      bracket: (bracketByRegion.get(rid) ?? []).map((r) => ({ round: r.round, stage: r.stage, matches: r.matches })),
      alive: entries.filter((e) => e.eliminatedRound === null && !e.champion).map((e) => e.club),
      entrants: entries.length,
    };
  });

  // Regions with a bracket but no CupRun rows yet (cup drawn, nothing played).
  for (const [rid, bracket] of bracketByRegion) {
    if (!regions.some((r) => r.regionId === rid)) {
      regions.push({
        regionId: rid,
        champion: null,
        rounds: [],
        bracket: bracket.map((r) => ({ round: r.round, stage: r.stage, matches: r.matches })),
        alive: [],
        entrants: 0,
      });
    }
  }

  return ok({ season: { id: season.id, number: season.number }, regions });
}
