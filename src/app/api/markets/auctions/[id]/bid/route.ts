// Knight FM — Place a bid on an active auction.
// HONEST SETTLEMENT DESIGN (documented): bids are stored WITHOUT escrowing club funds;
// solvency is verified at settlement by closeDueAuctions() which skips bidders whose club
// cannot cover the amount (or whose squad is full). This keeps bidding non-blocking while
// guaranteeing no club is ever debited without receiving the player.

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { resolveActingClub, closeDueAuctions } from "../../../../_lib/markets-lib";

const Body = z.object({
  amount: z.number().int().positive(),
  clubId: z.string().min(10).max(64).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  const { id } = await params;

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "Integer amount is required", 400);
  const { amount, clubId } = parsed.data;

  const bidderClub = await resolveActingClub(auth.userId, clubId ?? null);
  if (!bidderClub) {
    return fail(clubId ? "NOT_CLUB_OWNER" : "CLUB_REQUIRED", clubId ? "You do not own that club" : "You must own a club to bid (pass clubId if you own several)", clubId ? 403 : 400);
  }

  // Settle anything already due first, so bidders never bid on a dead auction.
  await closeDueAuctions();

  const listing = await db.listing.findUnique({ where: { id }, include: { player: { select: { id: true, clubId: true } } } });
  if (!listing) return fail("LISTING_NOT_FOUND", "Auction not found", 404);
  if (listing.type !== "AUCTION") return fail("WRONG_LISTING_TYPE", "Not an auction listing", 409);
  if (listing.state !== "OPEN" || !listing.expiresAt || listing.expiresAt <= new Date()) {
    return fail("AUCTION_CLOSED", "Auction is no longer open", 409);
  }
  if (listing.player?.clubId && listing.player.clubId === bidderClub.id) {
    return fail("OWN_AUCTION", "You cannot bid on your own auction", 400);
  }

  const highest = await db.bid.findFirst({ where: { auctionId: id }, orderBy: { amount: "desc" }, select: { amount: true } });
  const current = highest?.amount ?? listing.price;
  const minAccepted = Math.ceil(current * 1.05); // minimum increment 5%
  if (amount < minAccepted) {
    return fail("BID_TOO_LOW", `Bid must be at least ${minAccepted} (current highest ${current} + 5% increment)`, 400, { minAccepted, currentHighest: current });
  }

  const bid = await db.bid.create({ data: { auctionId: id, clubId: bidderClub.id, amount } });
  await audit("BID_PLACED", auth.userId, { listingId: id, bidId: bid.id, clubId: bidderClub.id, amount });
  return ok({ bidId: bid.id, amount, currentHighest: amount, note: "Funds are verified at settlement; ensure your club treasury covers this bid." });
}
