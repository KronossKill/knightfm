// POST /api/players/[id]/release — OWNER-only squad dismissal.
// Settlement = remaining season salary (salary × days left in season), debited
// atomically with the squad removal; honest 402 when funds are insufficient.

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { audit, fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { currentGameDay } from "@/lib/engine/clock";
import { debitClub, creditFund, FinanceError } from "@/lib/engine/finance";
import { SEASON_TOTAL_DAYS } from "@/lib/types";
import { getActiveSeason } from "@/app/api/_lib/active-season";
import { getClubAccess } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const { id } = await ctx.params;
  const player = await db.player.findUnique({ where: { id } });
  if (!player || player.retired) return fail("PLAYER_NOT_FOUND", "Player not found", 404);
  if (!player.clubId) return fail("NOT_IN_CLUB", "Player is not attached to any club", 400);

  const access = await getClubAccess(auth.userId, player.clubId);
  if (!access.club) return fail("CLUB_NOT_FOUND", "Club not found", 404);
  if (access.role !== "OWNER") return fail("FORBIDDEN", "Club owner role required", 403);

  const gameDay = await currentGameDay();
  const season = await getActiveSeason();
  const endEpochDay = season ? season.startEpochDay + SEASON_TOTAL_DAYS - 1 : gameDay - 1;
  const daysRemaining = Math.max(0, endEpochDay - gameDay + 1);
  const settlement = player.salary * daysRemaining;

  try {
    await db.$transaction(async (tx) => {
      // SECURITY (pentest fix — money printer): the settlement idem keys were
      // `RELEASE:<playerId>` (entity-scoped, not occurrence-scoped), so every
      // release AFTER the first silently skipped the debit AND the fund credit
      // while the player still became a free agent. Each release is a distinct
      // economic event — key it per occurrence. The conditional claim below
      // guarantees single execution.
      const claimed = await tx.player.updateMany({
        where: { id: player.id, clubId: player.clubId, retired: false },
        data: { isFreeAgent: true, clubId: null },
      });
      if (claimed.count === 0) {
        throw new FinanceError("PLAYER_MOVED", "Player state changed concurrently; operation aborted");
      }
      const occ = randomUUID();
      if (settlement > 0) {
        await debitClub(
          tx,
          player.clubId!,
          settlement,
          "RELEASE_SETTLEMENT",
          `RELEASE:${player.id}:${occ}`,
          `Release settlement: ${player.firstName} ${player.lastName} (${daysRemaining} days remaining)`
        );
        // Task 26: contract-settlement funds go to the SYSTEM fund (never to
        // another user) — same transaction, derived idempotency key.
        await creditFund(
          tx,
          "SYSTEM",
          settlement,
          `RELEASE:${player.id}:${occ}:SYSTEM`,
          "RELEASE_SETTLEMENT",
          `Release settlement routed to the system fund: ${player.firstName} ${player.lastName}`
        );
      }
    });
  } catch (e) {
    if (e instanceof FinanceError) {
      if (e.code === "PLAYER_MOVED") return fail("PLAYER_NO_LONGER_AVAILABLE", "Player state changed; try again", 409);
      return fail(e.code, e.message, 402);
    }
    throw e;
  }

  await audit("PLAYER_RELEASED", auth.userId, {
    playerId: player.id,
    clubId: player.clubId,
    settlement,
    daysRemaining,
    gameDay,
  });

  return ok({
    released: true,
    playerId: player.id,
    settlement,
    daysRemaining,
  });
}
