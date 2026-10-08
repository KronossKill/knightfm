// Knight FM — Edit a player's release clause (OWNER/MANAGER of the player's club).
// INVARIANT: the clause can never be set below marketValue × economy.releaseClauseMultiplier (default 5×).

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { getInt } from "@/lib/config";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

const Body = z.object({
  value: z.number().int().min(1).max(2_000_000_000),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const { id } = await ctx.params;
  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "An integer clause value ≥ 1 is required", 400);
  const { value } = parsed.data;

  const player = await db.player.findUnique({
    where: { id },
    select: { id: true, clubId: true, retired: true, marketValue: true, loanedUntilDay: true, releaseClause: true },
  });
  if (!player) return fail("PLAYER_NOT_FOUND", "Player not found", 404);
  if (player.retired) return fail("PLAYER_RETIRED", "Retired players cannot have their clause edited", 409);
  if (!player.clubId) return fail("PLAYER_NOT_OWNED", "Player is not owned by a club", 409);
  if (player.loanedUntilDay) return fail("PLAYER_ON_LOAN", "The clause cannot be edited while the player is on loan", 409);

  const access = await getClubAccess(auth.userId, player.clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  // Invariant: clause ≥ marketValue × multiplier (never below 5× by default).
  const mult = await getInt("economy.releaseClauseMultiplier", 5);
  const minValue = player.marketValue * mult;
  if (value < minValue) {
    return fail("CLAUSE_TOO_LOW", `The clause cannot be lower than ${minValue} (market value × ${mult})`, 400, { minValue });
  }

  await db.player.update({ where: { id: player.id }, data: { releaseClause: value } });
  await audit("CLAUSE_CHANGED", auth.userId, {
    playerId: player.id, previousValue: player.releaseClause, value, minValue,
  });
  return ok({ playerId: player.id, releaseClause: value, minValue });
}
