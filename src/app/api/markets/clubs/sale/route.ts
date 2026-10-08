// Knight FM — club secondary market (owner resale).
// GET    → listings of clubs owned by OTHER users with salePrice set (buyer feed).
//          System clubs are NOT here: they keep the fixed economy.systemClubPrice
//          (marked with the fixed-price notice in the UI). Division restrictions
//          (world.pickMinDivisionIndex) only apply to SYSTEM club picking — resale
//          clubs reached their division on sporting merit and the owner sets the price.
// POST   → the session owner lists (or updates the asking price of) one of their
//          clubs: { clubId, price } with 1 ≤ price ≤ 2_000_000_000 (int32-safe).
// DELETE → the session owner withdraws the listing: ?clubId=…
// Money only moves at purchase time (POST …/buy): the buyer pays the full asking
// price, the seller receives the net after the income levy (economy.userFundsLevyPct)
// and the levy goes to the SYSTEM fund. Listing itself is free and reversible.

import { NextRequest } from "next/server";
import { ok, fail, audit, requireAuth, isResponse, readJson } from "@/lib/api";
import { z } from "@/app/api/auth/_shared";
import { db } from "@/lib/db";
import { currentGameDay } from "@/lib/engine/clock";
import { getInt } from "@/lib/config";

export const runtime = "nodejs";

export const CLUB_SALE_MAX_PRICE = 2_000_000_000; // int32-safe upper bound

const BodySchema = z.object({
  clubId: z.string().min(1).max(64),
  price: z.number().int().min(1).max(CLUB_SALE_MAX_PRICE),
});

// ─── GET: buyer feed of owner-listed clubs ─────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const clubs = await db.club.findMany({
    where: { systemOwned: false, salePrice: { not: null }, ownerId: { not: auth.userId } },
    orderBy: [{ saleListedDay: "desc" }, { name: "asc" }],
    take: 120,
    select: {
      id: true,
      name: true,
      operatingFund: true,
      salePrice: true,
      saleListedDay: true,
      createdAt: true,
      brand: { select: { primaryColor: true, secondaryColor: true, badgeShape: true, initials: true } },
      region: { select: { index: true, nameKey: true } },
      division: { select: { index: true } },
      owner: { select: { username: true } },
      managerId: true,
      players: { where: { retired: false, isYouth: false }, select: { ovr: true } },
      _count: { select: { facilities: true, players: { where: { retired: false, isYouth: false } } } },
    },
  });

  // The income levy pct is surfaced so the UI can show the honest net breakdown
  // before the buyer confirms (server recomputes authoritatively at buy time).
  const levyPct = await getInt("economy.userFundsLevyPct", 10);

  return ok({
    total: clubs.length,
    levyPct,
    listings: clubs.map((c) => {
      const squadSize = c._count.players;
      const avgOvr =
        squadSize > 0 ? Math.round(c.players.reduce((acc, p) => acc + p.ovr, 0) / squadSize) : null;
      return {
        clubId: c.id,
        name: c.name,
        brand: c.brand,
        regionIndex: c.region.index,
        regionNameKey: c.region.nameKey,
        divisionIndex: c.division.index,
        squadSize,
        avgOvr,
        facilitiesCount: c._count.facilities,
        operatingFund: c.operatingFund,
        salePrice: c.salePrice,
        saleListedDay: c.saleListedDay,
        hasManager: c.managerId !== null,
        sellerUsername: c.owner?.username ?? null,
      };
    }),
  });
}

// ─── POST: list / update asking price ──────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("PRICE_OUT_OF_RANGE", "Price must be an integer between 1 and 2000000000", 400);

  const gameDay = await currentGameDay();

  const club = await db.club.findUnique({
    where: { id: parsed.data.clubId },
    select: { id: true, name: true, systemOwned: true, ownerId: true },
  });
  if (!club || club.systemOwned) return fail("CLUB_UNAVAILABLE", "Club is not resalable", 404);
  if (club.ownerId !== auth.userId) return fail("NOT_CLUB_OWNER", "You do not own this club", 403);

  const updated = await db.club.updateMany({
    where: { id: club.id, ownerId: auth.userId, systemOwned: false },
    data: { salePrice: parsed.data.price, saleListedDay: gameDay },
  });
  if (updated.count === 0) return fail("CLUB_UNAVAILABLE", "Club is not resalable", 409);

  await audit("CLUB_SALE_LISTED", auth.userId, {
    clubId: club.id,
    clubName: club.name,
    price: parsed.data.price,
    day: gameDay,
  });

  return ok({ clubId: club.id, salePrice: parsed.data.price, saleListedDay: gameDay });
}

// ─── DELETE: withdraw the listing ──────────────────────────────────

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const clubId = new URL(req.url).searchParams.get("clubId")?.slice(0, 64);
  if (!clubId) return fail("VALIDATION", "clubId is required", 400);

  const club = await db.club.findUnique({
    where: { id: clubId },
    select: { id: true, name: true, systemOwned: true, ownerId: true },
  });
  if (!club || club.systemOwned) return fail("CLUB_UNAVAILABLE", "Club is not resalable", 404);
  if (club.ownerId !== auth.userId) return fail("NOT_CLUB_OWNER", "You do not own this club", 403);

  await db.club.updateMany({
    where: { id: club.id, ownerId: auth.userId },
    data: { salePrice: null, saleListedDay: null },
  });

  await audit("CLUB_SALE_UNLISTED", auth.userId, { clubId: club.id, clubName: club.name });

  return ok({ clubId: club.id, salePrice: null, saleListedDay: null });
}
