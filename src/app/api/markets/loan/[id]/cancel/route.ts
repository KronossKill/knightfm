// Knight FM — Cancel an open LOAN listing (origin club OWNER only).

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit } from "@/lib/api";
import { isClubOwner } from "../../../../_lib/markets-lib";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const { id } = await ctx.params;
  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing || listing.type !== "LOAN") return fail("LISTING_NOT_FOUND", "Loan listing not found", 404);
  if (listing.state !== "OPEN") return fail("NOT_AVAILABLE", "This loan listing is no longer open", 409);
  if (!listing.clubId || !(await isClubOwner(auth.userId, listing.clubId))) {
    return fail("NOT_CLUB_OWNER", "Only the origin club owner can cancel this loan listing", 403);
  }

  await db.listing.update({ where: { id: listing.id }, data: { state: "CANCELLED" } });
  await audit("LOAN_CANCELLED", auth.userId, { listingId: listing.id, playerId: listing.playerId });
  return ok({ id: listing.id, state: "CANCELLED" });
}
