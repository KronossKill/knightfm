// GET /api/matches/environment?id={fixtureId} — engine v3 match environment
// (Task 50-a). Authenticated. Returns the weather, pitch surface and box-office
// intake associated with a fixture:
//  · PLAYED matches: the persisted values when present; for historical matches
//    predating v3 the weather/pitch are derived on the fly from the SAME
//    deterministic seeds (KMIE-W / KMIE-P) — identical to what was applied —
//    while box office stays null (honest "not available", never fabricated).
//  · SCHEDULED matches: the deterministic forecast (identical derivation the
//    engine will use at kickoff).

import { NextRequest } from "next/server";
import { fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { derivePitch, deriveWeather } from "@/lib/engine/environment";
import { Weather } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("VALIDATION_ERROR", "Query parameter `id` (fixtureId) is required", 400);

  const fixture = await db.fixture.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      competition: true,
      homeId: true,
      match: { select: { weather: true, pitch: true, boxOfficeRevenue: true } },
    },
  });
  if (!fixture) return fail("FIXTURE_NOT_FOUND", "Fixture not found", 404);

  // Persisted values first; deterministic seed fallback for pre-v3 matches.
  const weather = (fixture.match?.weather as Weather | null | undefined) ?? deriveWeather(fixture.id);
  const stadium = await db.facility.findUnique({
    where: { clubId_type: { clubId: fixture.homeId, type: "STADIUM" } },
    select: { level: true },
  });
  const pitch = fixture.match?.pitch ?? derivePitch(stadium?.level ?? null, fixture.id, weather);
  const boxOfficeRevenue = fixture.match?.boxOfficeRevenue ?? null;

  return ok({
    fixtureId: fixture.id,
    status: fixture.status,
    competition: fixture.competition,
    weather,
    pitch,
    boxOfficeRevenue,
    played: fixture.status === "PLAYED",
  });
}
