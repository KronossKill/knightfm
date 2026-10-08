// Knight FM — Exercise a release clause on any eligible player (any owned club, including
// system-owned sellers whose proceeds flow to the SYSTEM fund).

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { getInt } from "@/lib/config";
import { currentGameDay } from "@/lib/engine/clock";
import { FinanceError } from "@/lib/engine/finance";
import {
  resolveActingClub, assertCapacity, executePlayerTransfer, cancelStaleListings, financeErrorResponse,
} from "../../_lib/markets-lib";

const Body = z.object({
  playerId: z.string().min(10).max(64),
  clubId: z.string().min(10).max(64).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "playerId is required", 400);
  const { playerId, clubId } = parsed.data;

  const buyerClub = await resolveActingClub(auth.userId, clubId ?? null);
  if (!buyerClub) {
    return fail(clubId ? "NOT_CLUB_OWNER" : "CLUB_REQUIRED", clubId ? "You do not own that club" : "You must own a club", clubId ? 403 : 400);
  }

  const player = await db.player.findUnique({ where: { id: playerId }, select: { id: true, clubId: true, retired: true, releaseClause: true, marketValue: true, loanedUntilDay: true } });
  if (!player) return fail("PLAYER_NOT_FOUND", "Player not found", 404);
  if (player.retired) return fail("PLAYER_RETIRED", "Retired players cannot be bought out", 409);
  if (!player.clubId) return fail("NOT_ELIGIBLE", "Player has no club (free agents are signed, not bought out)", 409);
  if (player.loanedUntilDay) return fail("PLAYER_ON_LOAN", "The clause cannot be exercised while the player is on loan", 409);
  if (player.clubId === buyerClub.id) return fail("OWN_CLUB", "Cannot exercise a release clause on your own player", 400);

  try {
    await assertCapacity(buyerClub.id);
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }

  // Cost: stored releaseClause, or computed 5× market value when 0.
  const cost = player.releaseClause > 0 ? player.releaseClause : player.marketValue * (await getInt("economy.releaseClauseMultiplier", 5));

  const day = await currentGameDay();
  const seasons = await db.season.findMany({ orderBy: { number: "desc" }, take: 1 });
  const seasonId = seasons[0]?.id ?? "season-0";
  const sellerClubId = player.clubId;

  try {
    await db.$transaction(async (tx) => {
      // SECURITY (pentest fix — stale player): re-read and re-validate INSIDE the
      // transaction; the outside read was only for UX errors.
      const fresh = await tx.player.findUnique({ where: { id: playerId }, select: { id: true, clubId: true, retired: true, loanedUntilDay: true } });
      if (!fresh || fresh.retired || !fresh.clubId || fresh.loanedUntilDay || fresh.clubId !== player.clubId) {
        throw new FinanceError("PLAYER_MOVED", "Player state changed concurrently; operation aborted");
      }
      // SECURITY (pentest fix — money printer): idempotency keys are now UNIQUE
      // PER OCCURRENCE. The old keys (`RCLS:<playerId>`) made every SECOND
      // clause exercise on the same player (later re-bought by another club)
      // execute a free transfer — the debit/credit silently skipped. Each
      // exercise is a distinct economic event; the atomic player move above
      // guarantees no double-execution, so per-occurrence keys are safe.
      const occ = randomUUID();
      await executePlayerTransfer(tx, {
        player: { id: player.id, clubId: player.clubId },
        toClubId: buyerClub.id,
        amount: cost,
        type: "RELEASE_CLAUSE",
        idemBase: `RCLS:${playerId}:${occ}`,
        buyKey: `RCLS:${playerId}:${occ}`,
        sellKey: `RCLS:${playerId}:${occ}:SELL`,
        allocBase: `RCLS:${playerId}:${occ}:ALLOC`,
        memo: `Release clause exercised on ${playerId}`,
        seasonId,
        day,
      });
    });
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    if (e instanceof FinanceError && (e.code === "PLAYER_MOVED" || e.code === "SELF_TRANSFER")) {
      return fail("PLAYER_NO_LONGER_AVAILABLE", "Player state changed; try again", 409);
    }
    throw e;
  }

  // The player moved clubs — any open market listing he had is now stale.
  await cancelStaleListings(playerId, buyerClub.id);
  await audit("RELEASE_CLAUSE_EXERCISED", auth.userId, {
    playerId, buyerClubId: buyerClub.id, sellerClubId, cost,
  });
  return ok({ playerId, buyerClubId: buyerClub.id, sellerClubId, cost, state: "TRANSFERRED" });
}
