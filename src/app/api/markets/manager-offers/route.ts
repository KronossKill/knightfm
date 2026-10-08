// Knight FM — Manager market: open contract offers with full breakdown (public).

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { getInt } from "@/lib/config";
import { currentGameDay, resolveSeason } from "@/lib/engine/clock";
import { SEASON_TOTAL_DAYS } from "@/lib/types";
import { isClubOwner } from "../../_lib/markets-lib";

// GET — lazily expire stale offers, then list OPEN offers with contract breakdown.
export async function GET() {
  await db.managerOffer.updateMany({ where: { state: "OPEN", expiresAt: { lte: new Date() } }, data: { state: "EXPIRED" } });

  const rows = await db.managerOffer.findMany({
    where: { state: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      club: {
        select: {
          id: true, name: true, systemOwned: true, divisionId: true,
          region: { select: { id: true, nameKey: true } },
        },
      },
    },
  });

  return ok({
    items: rows.map((o) => ({
      id: o.id,
      club: { id: o.club.id, name: o.club.name, regionId: o.club.region.id, regionNameKey: o.club.region.nameKey, systemOwned: o.club.systemOwned },
      seasons: o.seasons,
      contract: { totalAmount: o.totalAmount, durationDays: o.durationDays, dailySalary: o.dailySalary },
      state: o.state,
      createdAt: o.createdAt,
      expiresAt: o.expiresAt,
    })),
  });
}

// POST — a club OWNER publishes a manager contract offer.
const Body = z.object({
  clubId: z.string().min(10).max(64),
  seasons: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  totalAmount: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "clubId, seasons (1|2|3) and integer totalAmount are required", 400);
  const { clubId, seasons, totalAmount } = parsed.data;

  if (!(await isClubOwner(auth.userId, clubId))) {
    return fail("NOT_CLUB_OWNER", "You do not own this club", 403);
  }

  // Real-day duration (user rule Task 21): the first season counts ONLY the days
  // remaining until its end (same semantics as the onboarding contract); every
  // additional requested season is a full 37-day term.
  const day = await currentGameDay();
  const season = await resolveSeason(day);
  const seasonEndEpochDay = season ? season.startEpochDay + SEASON_TOTAL_DAYS - 1 : day;
  const remainingCurrentSeason = Math.max(1, seasonEndEpochDay - day + 1);
  const durationDays = remainingCurrentSeason + (seasons - 1) * SEASON_TOTAL_DAYS;
  if (totalAmount < durationDays) {
    return fail("OFFER_TOO_LOW", `Total amount must be at least ${durationDays} (1 $Knight/day minimum)`, 400, { durationDays });
  }
  const dailySalary = Math.floor(totalAmount / durationDays); // derived once, never recomputed (invariant #6)

  const offerDays = await getInt("market.managerOfferDays", 7);
  const expiresAt = new Date(Date.now() + offerDays * 86400_000);

  // One live offer per club: withdraw previous open offers.
  await db.managerOffer.updateMany({ where: { clubId, state: "OPEN" }, data: { state: "WITHDRAWN" } });

  const offer = await db.managerOffer.create({
    data: { clubId, seasons, totalAmount, durationDays, dailySalary, state: "OPEN", expiresAt },
  });

  await audit("MANAGER_OFFER_CREATED", auth.userId, {
    offerId: offer.id, clubId, seasons, totalAmount, durationDays, dailySalary, expiresAt,
  });
  return ok({
    offer: { id: offer.id, clubId, seasons, contract: { totalAmount, durationDays, dailySalary }, expiresAt, state: "OPEN" },
  });
}
