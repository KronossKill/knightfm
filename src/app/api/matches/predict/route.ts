// GET /api/matches/predict?id={fixtureId} — engine v3 pre-match prediction
// (Task 50-a). Authenticated. Builds the CURRENT strength of both squads with
// the exact same code path the simulation uses (buildClubStrength +
// applyMatchEnvironment), then runs the honest Poisson score-matrix model over
// the SAME λ formulas the engine uses — it NEVER reads the seeded result: a
// favourite simply gets the higher probability, nothing is revealed or rigged.

import { NextRequest } from "next/server";
import { fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { predictOutcome } from "@/lib/engine/kmie";
import { applyMatchEnvironment, buildClubStrength } from "@/lib/engine/matches";
import {
  computeBoxOffice, derivePitch, deriveWeather, stadiumCapacity,
} from "@/lib/engine/environment";
import { getInt } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("VALIDATION_ERROR", "Query parameter `id` (fixtureId) is required", 400);

  const fixture = await db.fixture.findUnique({
    where: { id },
    include: {
      season: { select: { number: true } },
      home: {
        include: {
          players: true,
          lineups: true,
          brand: { select: { initials: true, primaryColor: true, secondaryColor: true } },
        },
      },
      away: {
        include: {
          players: true,
          lineups: true,
          brand: { select: { initials: true, primaryColor: true, secondaryColor: true } },
        },
      },
    },
  });
  if (!fixture) return fail("FIXTURE_NOT_FOUND", "Fixture not found", 404);
  if (fixture.status !== "SCHEDULED") {
    return fail("MATCH_ALREADY_PLAYED", "Prediction is only available for SCHEDULED fixtures", 409);
  }

  const now = new Date();
  // Deterministic, PUBLIC environment (same derivation the engine will use).
  const weather = deriveWeather(fixture.id);
  const homeStadium = await db.facility.findUnique({
    where: { clubId_type: { clubId: fixture.homeId, type: "STADIUM" } },
    select: { level: true },
  });
  const pitch = derivePitch(homeStadium?.level ?? null, fixture.id, weather);

  // Current forces — identical path to simulateFixture (never the match seed).
  const homeXI = buildClubStrength(fixture.home, now);
  const awayXI = buildClubStrength(fixture.away, now);
  const { homeStrength, awayStrength, env } = applyMatchEnvironment(homeXI, awayXI, weather, pitch);
  const prediction = predictOutcome(homeStrength, awayStrength, env);

  // Predicted gate receipts for LEAGUE fixtures (same deterministic crowd model
  // the engine applies at kickoff — informative pre-match estimate).
  let boxOffice: { predictedAttendance: number; predictedRevenue: number; capacity: number } | null = null;
  if (fixture.competition === "LEAGUE") {
    try {
      const ticketPrice = await getInt("matches.ticketPriceBase", 12);
      const division = await db.division.findUnique({ where: { id: fixture.home.divisionId }, select: { index: true } });
      const table = await db.standing.findMany({
        where: { seasonId: fixture.seasonId, divisionId: fixture.home.divisionId },
        orderBy: [{ points: "desc" }, { gf: "desc" }, { ga: "asc" }],
        select: { clubId: true },
      });
      const homePosition = table.findIndex((s) => s.clubId === fixture.homeId) + 1;
      const box = computeBoxOffice({
        fixtureId: fixture.id,
        stadiumLevel: homeStadium?.level ?? null,
        divisionIndex: division?.index ?? 1,
        homePosition,
        tableSize: table.length || 16,
        weather,
        ticketPriceBase: ticketPrice,
      });
      boxOffice = {
        predictedAttendance: box.attendance,
        predictedRevenue: box.revenue,
        capacity: stadiumCapacity(homeStadium?.level ?? null),
      };
    } catch {
      boxOffice = null; // honest unavailability
    }
  }

  const pct = (p: number) => `${Math.round(p * 100)}%`;

  return ok({
    fixture: {
      id: fixture.id,
      competition: fixture.competition,
      round: fixture.round,
      stage: fixture.stage,
      matchDay: fixture.matchDay,
      kickoffUtc: fixture.kickoffAt.toISOString(),
      seasonNumber: fixture.season.number,
      home: { id: fixture.homeId, name: fixture.home.name, brand: fixture.home.brand },
      away: { id: fixture.awayId, name: fixture.away.name, brand: fixture.away.brand },
    },
    weather,
    pitch,
    prediction: {
      pHome: prediction.pHome,
      pDraw: prediction.pDraw,
      pAway: prediction.pAway,
      expHomeGoals: prediction.expHomeGoals,
      expAwayGoals: prediction.expAwayGoals,
      // Locale-neutral compact summary (numbers only — the UI composes the
      // localized sentence from its own dictionary; no hardcoded copy here).
      summary: `${pct(prediction.pHome)} / ${pct(prediction.pDraw)} / ${pct(prediction.pAway)}`,
    },
    boxOffice,
  });
}
