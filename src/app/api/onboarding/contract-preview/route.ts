// Knight FM — POST /api/onboarding/contract-preview (spec §14).
// Manager path only. Breakdown of the 1-season fixed contract the club offers:
//   seasons = 1; totalAmount = economy.managerBaseContract;
//   durationDays = remaining real days until the season's final day (inclusive, min 1);
//   dailySalary = floor(total / days) — derived once, never recomputed (§44.6).
// Displayed for acceptance; nothing is persisted here.
// Task 30: the preview refuses clubs in protected divisions (index <
// world.pickMinDivisionIndex, default 5) with CLUB_DIVISION_LOCKED.

import { NextRequest } from "next/server";
import { ok, fail, requireAuth, isResponse, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { currentGameDay, resolveSeason, upcomingSeason } from "@/lib/engine/clock";
import { SEASON_COMPETITIVE_DAYS, SEASON_PRESEASON_DAYS } from "@/lib/types";
import { z } from "@/app/api/auth/_shared";

export const runtime = "nodejs";

const BodySchema = z.object({ clubId: z.string().min(1).max(64) });

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);

  const user = await db.user.findUnique({ where: { id: auth.userId }, select: { path: true } });
  if (!user) return fail("NOT_FOUND", "User not found", 404);
  if (!user.path) return fail("PATH_REQUIRED", "Choose your career path first", 409);
  if (user.path !== "MANAGER") return fail("NOT_MANAGER", "Only managers can preview contracts", 403);

  const club = await db.club.findUnique({
    where: { id: parsed.data.clubId },
    select: {
      id: true,
      name: true,
      systemOwned: true,
      managerId: true,
      brand: { select: { primaryColor: true, secondaryColor: true, badgeShape: true, initials: true } },
      region: { select: { index: true, nameKey: true } },
      division: { select: { index: true } },
    },
  });
  if (!club || !club.systemOwned || club.managerId) {
    return fail("CLUB_UNAVAILABLE", "Club is not available", 409);
  }

  // Task 30 — division gate mirrors accept-manager-contract.
  const minDivisionIndex = await getInt("world.pickMinDivisionIndex", 5);
  if (club.division.index < minDivisionIndex) {
    return fail("CLUB_DIVISION_LOCKED", `Only divisions ${minDivisionIndex}+ are selectable`, 403);
  }

  const existing = await db.managerContract.findFirst({
    where: { managerId: auth.userId, state: "ACTIVE" },
    select: { id: true },
  });
  if (existing) return fail("CONTRACT_EXISTS", "You already manage a club", 409);

  const gameDay = await currentGameDay();
  // ≥5-day post-reset pre-season: preview against the UPCOMING Season 1.
  const season = await resolveSeason(gameDay);
  const upcoming = season ? null : await upcomingSeason(gameDay);
  if (!season && !upcoming) return fail("WORLD_NOT_INITIALIZED", "World calendar unavailable", 503);
  const seasonStart = season ? season.startEpochDay : upcoming!.startEpochDay;

  const seasonEndEpochDay = seasonStart + SEASON_COMPETITIVE_DAYS + SEASON_PRESEASON_DAYS - 1;
  const durationDays = Math.max(1, seasonEndEpochDay - gameDay + 1);
  const totalAmount = await getInt("economy.managerBaseContract", 140);
  const dailySalary = Math.floor(totalAmount / durationDays);

  return ok({
    club: {
      id: club.id,
      name: club.name,
      brand: club.brand,
      regionIndex: club.region.index,
      regionNameKey: club.region.nameKey,
      divisionIndex: club.division.index,
    },
    seasons: 1,
    seasonNumber: season ? season.number : upcoming!.number,
    totalAmount,
    durationDays,
    dailySalary,
    startDay: gameDay,
    endDay: gameDay + durationDays - 1,
  });
}
