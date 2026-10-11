// GET /api/competitions/preview/[id] — KMIE v3 PRE-MATCH CARD (user mandate:
// "las tarjetas [deben] identificar todas las características del próximo
// partido").
//
// For a SCHEDULED fixture this endpoint exposes EVERY well-defined engine
// characteristic, all deterministic from the fixture seed (KMIE-CTX stream —
// identical to what the simulation consumes at kickoff):
//   · fixture identity: competition / round / stage / matchDay / kickoff / region
//   · context: 11-state weather + 8-state home pitch + temperature/wind/humidity
//   · both clubs: brand, division, position/points, last-5 form, expected-XI
//     contextual OVR (attack/midfield/defense/GK), avg morale & confidence,
//     injuries, suspensions, top scorer, owner/manager connection countries
//   · stakes: per-win prize (division-scaled), knockout nature of the tie
//   · economics: seeded gate estimate (60–100 gross, 70% home / 30% region)
//   · forecast: exact Poisson W/D/L probabilities + expected goals + top
//     scorelines — a probabilistic model, honestly labelled, never a promise
// For a PLAYED fixture the stored context and the final score are returned
// instead of a forecast (preview and acta can never disagree).

import { NextRequest } from "next/server";
import { fail, ok, requireAuth, isResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { FORMATION_LAYOUTS, Formation, Position } from "@/lib/types";
import { autoCompleteLineup, AutoPlayer } from "@/lib/engine/tactics";
import { strengthFromPlayers } from "@/lib/engine/matches";
import type { TeamStrengthInput } from "@/lib/engine/kmie";
import { deriveMatchContext, contextEffects, matchOutcomes } from "@/lib/engine/match-context";
import { forecastLambdas } from "@/lib/engine/kmie";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  const { id } = await ctx.params;

  const fixture = await db.fixture.findUnique({
    where: { id },
    include: {
      season: { select: { number: true } },
      home: {
        include: {
          brand: true, lineups: true, division: { include: { region: { select: { nameKey: true } } } },
          players: true,
          owner: { select: { username: true, lastCountry: true } },
          manager: { select: { username: true, lastCountry: true } },
        },
      },
      away: {
        include: {
          brand: true, lineups: true, division: { select: { index: true } },
          players: true,
          owner: { select: { username: true, lastCountry: true } },
          manager: { select: { username: true, lastCountry: true } },
        },
      },
    },
  });
  if (!fixture) return fail("FIXTURE_NOT_FOUND", "Fixture not found", 404);

  const now = new Date();
  const seed = `KMIE:${fixture.season.number}:${fixture.competition}:${fixture.id}`;
  const playedMatch = await db.match.findUnique({ where: { fixtureId: fixture.id } });

  // ── Context: stored for played matches, pre-computed (same seed) otherwise ──
  const derived = deriveMatchContext(seed, fixture.kickoffAt);
  const context = {
    weather: playedMatch?.weather ?? derived.weather.id,
    pitch: playedMatch?.pitch ?? derived.pitch.id,
    temperatureC: derived.temperatureC,
    windKmh: derived.windKmh,
    humidityPct: derived.humidityPct,
  };

  const buildSide = (club: typeof fixture.home) => {
    const eligible = club.players.filter(
      (p) => !p.retired && !p.isYouth && (!p.injuredUntil || p.injuredUntil < now) && p.suspension === 0
    );
    const formation = (club.lineups?.formation ?? "4-4-2") as Formation;
    const auto: AutoPlayer[] = eligible.map((p) => ({
      id: p.id, position: p.position as Position, detailedPos: p.detailedPos, ovr: p.ovr,
      fatigue: p.fatigue, sharpness: p.sharpness, morale: p.morale, confidence: p.confidence,
      form: p.form, injuredUntil: p.injuredUntil, suspension: p.suspension,
    }));
    const saved = club.lineups ? (JSON.parse(club.lineups.slots || "{}") as Record<string, string>) : {};
    const chosen = new Map<string, string>();
    for (const s of FORMATION_LAYOUTS[formation]) if (saved[s.id]) chosen.set(s.id, saved[s.id]);
    for (const s of autoCompleteLineup(auto, formation, now)) {
      if (!chosen.has(s.slotId) && s.playerId) chosen.set(s.slotId, s.playerId);
    }
    const xiIds = [...chosen.values()];
    const xi = (xiIds.length >= 7 ? eligible.filter((p) => xiIds.includes(p.id)) : eligible.slice(0, 11)).map((p) => ({
      position: p.position as Position, ovr: p.ovr, fatigue: p.fatigue, sharpness: p.sharpness, morale: p.morale, confidence: p.confidence,
    }));
    // The EXACT strength object the simulation would build — no rounding drift.
    const strength: TeamStrengthInput = strengthFromPlayers(xi, formation);
    const overall = Math.round(strength.attackOvr * 0.3 + strength.midfieldOvr * 0.3 + strength.defenseOvr * 0.3 + strength.gkOvr * 0.1);

    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const squad = club.players.filter((p) => !p.retired && !p.isYouth);

    return {
      id: club.id,
      name: club.name,
      brand: club.brand
        ? { initials: club.brand.initials, primaryColor: club.brand.primaryColor, secondaryColor: club.brand.secondaryColor }
        : null,
      isSystem: club.systemOwned,
      divisionIndex: club.division.index,
      formation,
      strength, // exact (server-side only; not serialized raw — see pick below)
      expectedXI: {
        ovr: overall,
        attack: Math.round(strength.attackOvr),
        midfield: Math.round(strength.midfieldOvr),
        defense: Math.round(strength.defenseOvr),
        gk: Math.round(strength.gkOvr),
        fatiguePct: Math.round((1 - strength.fatigueFactor) * 100),
      },
      morale: Math.round(avg(xi.map((p) => p.morale))),
      confidence: Math.round(avg(xi.map((p) => p.confidence))),
      injured: squad.filter((p) => p.injuredUntil && p.injuredUntil >= now).length,
      suspended: squad.filter((p) => p.suspension > 0).length,
      owner: club.owner ? { username: club.owner.username, country: club.owner.lastCountry } : null,
      manager: club.manager ? { username: club.manager.username, country: club.manager.lastCountry } : null,
    };
  };

  const homeSide = buildSide(fixture.home);
  const awaySide = buildSide(fixture.away);
  const { strength: _h, ...home } = homeSide;
  const { strength: _a, ...away } = awaySide;

  // ── Standings + last-5 league form + top scorer (per club, this season) ──
  const standingFor = async (clubId: string) => {
    const s = await db.standing.findFirst({ where: { seasonId: fixture.seasonId, clubId } });
    if (!s) return null;
    const pos = await db.standing.count({
      where: {
        seasonId: fixture.seasonId, divisionId: s.divisionId,
        OR: [{ points: { gt: s.points } }, { points: s.points, gf: { gt: s.gf } }],
      },
    });
    return { position: pos + 1, points: s.points, played: s.played, won: s.won, drawn: s.drawn, lost: s.lost };
  };

  const formFor = async (clubId: string) => {
    const last = await db.fixture.findMany({
      where: { status: "PLAYED", seasonId: fixture.seasonId, OR: [{ homeId: clubId }, { awayId: clubId }], competition: "LEAGUE" },
      orderBy: { kickoffAt: "desc" },
      take: 5,
      include: { match: { select: { homeGoals: true, awayGoals: true } } },
    });
    return last
      .filter((f) => f.match)
      .map((f) => {
        const own = f.homeId === clubId ? f.match!.homeGoals : f.match!.awayGoals;
        const opp = f.homeId === clubId ? f.match!.awayGoals : f.match!.homeGoals;
        return own > opp ? "W" : own === opp ? "D" : "L";
      });
  };

  const topScorerFor = async (clubId: string) => {
    const goals = await db.matchEvent.groupBy({
      by: ["playerId"],
      where: { type: "GOAL", clubId, playerId: { not: null } },
      _count: { playerId: true },
      orderBy: { _count: { playerId: "desc" } },
      take: 1,
    });
    const top = goals[0];
    if (!top?.playerId) return null;
    const p = await db.player.findUnique({ where: { id: top.playerId }, select: { firstName: true, lastName: true } });
    return p ? { name: `${p.firstName} ${p.lastName}`, goals: top._count.playerId } : null;
  };

  const [homeStanding, awayStanding, homeForm, awayForm, homeTop, awayTop] = await Promise.all([
    standingFor(fixture.homeId),
    standingFor(fixture.awayId),
    formFor(fixture.homeId),
    formFor(fixture.awayId),
    topScorerFor(fixture.homeId),
    topScorerFor(fixture.awayId),
  ]);

  // ── Stakes + economics (config-driven, the same numbers matchday pays) ──
  const [winPrize, divisionStep] = await Promise.all([
    getInt("competition.winPrizeLeague", 80),
    getInt("competition.winPrizeDivisionStepPct", 10),
  ]);
  const isKnockout = fixture.competition !== "LEAGUE" && !!(fixture.round || fixture.stage);
  const prizeFactor = (divisionIndex: number) => Math.max(0.1, 1 - ((divisionIndex - 1) * divisionStep) / 100);

  // ── Forecast: exact Poisson grid over the SAME λ the simulation samples ──
  let prediction = null;
  if (!playedMatch) {
    const fx = contextEffects(derived);
    const { lambdaHome, lambdaAway } = forecastLambdas(homeSide.strength, awaySide.strength, fx);
    prediction = matchOutcomes(lambdaHome, lambdaAway);
  }

  return ok({
    fixture: {
      id: fixture.id,
      competition: fixture.competition,
      round: fixture.round,
      stage: fixture.stage,
      matchDay: fixture.matchDay,
      kickoffUtc: fixture.kickoffAt.toISOString(),
      status: fixture.status,
      seasonNumber: fixture.season.number,
      regionNameKey: fixture.home.division.region.nameKey,
      isKnockout,
    },
    context,
    home: { ...home, standings: homeStanding, form: homeForm, topScorer: homeTop },
    away: { ...away, standings: awayStanding, form: awayForm, topScorer: awayTop },
    stakes: {
      winPrizeHome: Math.floor(winPrize * prizeFactor(fixture.home.division.index)),
      winPrizeAway: Math.floor(winPrize * prizeFactor(fixture.away.division.index)),
      knockout: isKnockout,
      gateGross: [60, 100],
      gateHomeSharePct: 70,
      gateRegionSharePct: 30,
    },
    prediction,
  });
}
