// Knight FM — Buy a DIRECT listing. Atomic: buyer debit → seller credit → 5%+5% revenue
// allocation → TransferRecord → player reassignment → listing SOLD (idempotent ledger keys).

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { currentGameDay } from "@/lib/engine/clock";
import {
  resolveActingClub, assertCapacity, executePlayerTransfer, cancelStaleListings,
  financeErrorResponse,
} from "../../../../_lib/markets-lib";
import { FinanceError } from "@/lib/engine/finance";

const Body = z.object({ clubId: z.string().min(10).max(64).optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  const { id } = await params;

  const body = (await readJson(req)) ?? {};
  const parsed = Body.safeParse(body);
  if (!parsed.success) return fail("BAD_REQUEST", "Invalid body", 400);
  const { clubId } = parsed.data;

  const buyerClub = await resolveActingClub(auth.userId, clubId ?? null);
  if (!buyerClub) {
    return fail(clubId ? "NOT_CLUB_OWNER" : "CLUB_REQUIRED", clubId ? "You do not own that club" : "You must own a club to buy (pass clubId if you own several)", clubId ? 403 : 400);
  }

  const listing = await db.listing.findUnique({ where: { id }, include: { player: true } });
  if (!listing) return fail("LISTING_NOT_FOUND", "Listing not found", 404);
  if (listing.type !== "DIRECT") return fail("WRONG_LISTING_TYPE", "Not a direct listing", 409);
  if (listing.state !== "OPEN") return fail("LISTING_NOT_OPEN", `Listing state is ${listing.state}`, 409);

  const player = listing.player;
  if (!player || player.retired) {
    await db.listing.update({ where: { id }, data: { state: "CANCELLED" } }).catch(() => undefined);
    return fail("PLAYER_UNAVAILABLE", "Player is no longer available", 409);
  }
  if (!player.clubId || player.clubId !== listing.clubId) {
    await db.listing.update({ where: { id }, data: { state: "CANCELLED" } }).catch(() => undefined);
    return fail("PLAYER_NO_LONGER_AVAILABLE", "Player changed club since listing; listing cancelled", 409);
  }
  const sellerClubId = player.clubId;
  if (sellerClubId === buyerClub.id) return fail("OWN_CLUB", "You cannot buy your own listing", 400);

  try {
    await assertCapacity(buyerClub.id); // invariant #9 — server-side ICP capacity
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }

  const day = await currentGameDay();
  const seasons = await db.season.findMany({ orderBy: { number: "desc" }, take: 1 });
  const seasonId = seasons[0]?.id ?? "season-0";

  try {
    const sold = await db.$transaction(async (tx) => {
      const fresh = await tx.listing.findUnique({ where: { id }, select: { state: true } });
      if (!fresh || fresh.state !== "OPEN") throw new FinanceError("LISTING_NOT_OPEN", "Listing was just taken");
      // SECURITY (pentest fix — stale player): re-read the player INSIDE the tx.
      // The outer read could be stale (player loaned/moved concurrently), which
      // previously credited the OLD seller while the buyer paid. The conditional
      // move in executePlayerTransfer now aborts on any concurrent change.
      const freshPlayer = await tx.player.findUnique({ where: { id: player.id }, select: { clubId: true, retired: true } });
      if (!freshPlayer || freshPlayer.retired || !freshPlayer.clubId || freshPlayer.clubId !== sellerClubId) {
        throw new FinanceError("PLAYER_MOVED", "Player changed club since listing");
      }
      await executePlayerTransfer(tx, {
        player: { id: player.id, clubId: freshPlayer.clubId },
        toClubId: buyerClub.id,
        amount: listing.price,
        type: "DIRECT",
        idemBase: `TX:${id}`,
        buyKey: `TXBUY:${id}`,
        sellKey: `TXSELL:${id}`,
        allocBase: `TXALLOC:${id}`,
        memo: `Direct transfer ${id}`,
        seasonId,
        day,
      });
      await tx.listing.updateMany({ where: { id, state: "OPEN" }, data: { state: "SOLD", buyerId: buyerClub.id } });
      return true;
    });
    if (!sold) return fail("LISTING_NOT_OPEN", "Listing was just taken", 409);

    await cancelStaleListings(player.id, buyerClub.id);
    await audit("TRANSFER_COMPLETED", auth.userId, {
      listingId: id, playerId: player.id, buyerClubId: buyerClub.id, sellerClubId, amount: listing.price, type: "DIRECT",
    });
    return ok({ listingId: id, playerId: player.id, buyerClubId: buyerClub.id, amount: listing.price, state: "SOLD" });
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    if (e instanceof FinanceError && (e.code === "LISTING_NOT_OPEN" || e.code === "PLAYER_MOVED" || e.code === "SELF_TRANSFER")) {
      return fail(e.code === "LISTING_NOT_OPEN" ? "LISTING_NOT_OPEN" : "PLAYER_NO_LONGER_AVAILABLE", e.message, 409);
    }
    throw e;
  }
}
