// Knight FM — Take a LOAN listing: the borrower club pays the loan fee from its
// treasury, registers the player until the END OF THE CURRENT SEASON (user mandate
// Task 23-f) and the scheduler returns him to the origin club automatically
// (LOAN_RETURN daily job).

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { currentGameDay, seasonEndDay } from "@/lib/engine/clock";
import { creditClub, creditFund, debitClub, FinanceError } from "@/lib/engine/finance";
import { resolveActingClub, assertCapacity, financeErrorResponse } from "../../../../_lib/markets-lib";

const Body = z.object({
  clubId: z.string().min(10).max(64).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const { id } = await ctx.params;
  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "Invalid body", 400);
  const { clubId } = parsed.data;

  const borrower = await resolveActingClub(auth.userId, clubId ?? null);
  if (!borrower) {
    return fail(clubId ? "NOT_CLUB_OWNER" : "CLUB_REQUIRED", clubId ? "You do not own that club" : "You must own a club", clubId ? 403 : 400);
  }

  const listing = await db.listing.findUnique({ where: { id } });
  if (!listing || listing.type !== "LOAN") return fail("LISTING_NOT_FOUND", "Loan listing not found", 404);
  if (listing.state !== "OPEN") return fail("NOT_AVAILABLE", "This loan listing is no longer available", 409);
  if (listing.clubId === borrower.id) return fail("SAME_CLUB", "The player already belongs to your club", 400);

  const player = listing.playerId ? await db.player.findUnique({ where: { id: listing.playerId } }) : null;
  if (!player || player.retired || !player.clubId || player.loanedUntilDay) {
    await db.listing.update({ where: { id: listing.id }, data: { state: "CANCELLED" } }).catch(() => undefined);
    return fail("NOT_AVAILABLE", "This loan listing is no longer available", 409);
  }
  const originClubId = player.clubId;
  if (originClubId !== listing.clubId) {
    return fail("NOT_AVAILABLE", "This loan listing is no longer available", 409);
  }

  try {
    await assertCapacity(borrower.id);
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }

  const day = await currentGameDay();
  // User mandate (Task 23-f): the loan ALWAYS runs until the last day of the
  // current season (falling back to the listing duration when no season exists).
  const seasonEnd = await seasonEndDay();
  const untilDay = seasonEnd ?? day + (listing.duration ?? 7);
  const seasons = await db.season.findMany({ orderBy: { number: "desc" }, take: 1 });
  const seasonId = seasons[0]?.id ?? "season-0";

  try {
    await db.$transaction(async (tx) => {
      // SECURITY (pentest fix — double-take race): the listing was previously
      // read outside the tx and updated unconditionally, so two concurrent
      // takes could both register the player (the loser paying nothing via the
      // reused `LOANFEE:<listingId>` idem keys). The listing is now CLAIMED
      // atomically inside the tx: only the first caller flips OPEN→SOLD.
      const claimedListing = await tx.listing.updateMany({
        where: { id: listing.id, state: "OPEN" },
        data: { state: "SOLD", buyerId: borrower.id },
      });
      if (claimedListing.count === 0) {
        throw new FinanceError("NOT_AVAILABLE", "This loan listing is no longer available");
      }
      // SECURITY (pentest fix — stale player): re-verify the player INSIDE the tx.
      const fresh = await tx.player.findUnique({ where: { id: player.id }, select: { clubId: true, retired: true, loanedUntilDay: true } });
      if (!fresh || fresh.retired || !fresh.clubId || fresh.loanedUntilDay || fresh.clubId !== originClubId) {
        throw new FinanceError("PLAYER_MOVED", "Player state changed concurrently; operation aborted");
      }
      // Loan fee: borrower pays, origin club collects (system-owned origin → SYSTEM fund).
      if (listing.price > 0) {
        await debitClub(tx, borrower.id, listing.price, "LOAN_FEE", `LOANFEE:${listing.id}:${randomUUID()}`, `Loan fee for player ${player.id} until season end (day ${untilDay})`);
        const origin = await tx.club.findUnique({ where: { id: originClubId }, select: { systemOwned: true } });
        if (origin?.systemOwned) {
          await creditFund(tx, "SYSTEM", listing.price, `LOANIN:${listing.id}:${randomUUID()}`, "TRANSFER_IN", `Loan fee (system club) ${listing.id}`);
        } else {
          await creditClub(tx, originClubId, listing.price, "LOAN_IN", `LOANIN:${listing.id}:${randomUUID()}`, `Loan fee received for player ${player.id}`);
        }
      }

      // Register the player at the borrower until the configured day.
      await tx.player.update({
        where: { id: player.id },
        data: { clubId: borrower.id, loanOriginClubId: originClubId, loanedUntilDay: untilDay },
      });
      await tx.transferRecord.create({
        data: {
          playerId: player.id,
          clubFromId: originClubId,
          clubToId: borrower.id,
          amount: listing.price,
          type: "LOAN",
          seasonId,
          day,
        },
      });

      // The origin club's lineup cannot keep fielding the loaned player.
      const lineup = await tx.lineup.findUnique({ where: { clubId: originClubId } });
      if (lineup) {
        const slots = JSON.parse(lineup.slots || "{}") as Record<string, string | null>;
        let changed = false;
        for (const k of Object.keys(slots)) {
          if (slots[k] === player.id) {
            slots[k] = null;
            changed = true;
          }
        }
        if (changed) await tx.lineup.update({ where: { clubId: originClubId }, data: { slots: JSON.stringify(slots) } });
      }
    });
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    if (e instanceof FinanceError && (e.code === "NOT_AVAILABLE" || e.code === "PLAYER_MOVED")) {
      return fail("NOT_AVAILABLE", "This loan listing is no longer available", 409);
    }
    throw e;
  }

  const originOwner = (await db.club.findUnique({ where: { id: originClubId }, select: { ownerId: true } }))?.ownerId;
  if (originOwner) {
    await db.notification
      .create({
        data: {
          userId: originOwner,
          typeKey: "notification.loanTaken",
          payload: JSON.stringify({ playerId: player.id, name: `${player.firstName} ${player.lastName}`, borrower: borrower.name, untilDay }),
        },
      })
      .catch(() => undefined);
  }

  await audit("LOAN_TAKEN", auth.userId, {
    listingId: listing.id, playerId: player.id, originClubId, borrowerClubId: borrower.id, price: listing.price, untilDay,
  });
  return ok({ playerId: player.id, borrowerClubId: borrower.id, originClubId, untilDay, price: listing.price });
}
