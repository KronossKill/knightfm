// Knight FM — Sign a free agent. Fee = player marketValue, debited from the club treasury.
// Capacity enforced server-side via ICP entitlement (invariant #9).

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { currentGameDay } from "@/lib/engine/clock";
import { debitClub, FinanceError } from "@/lib/engine/finance";
import { resolveActingClub, assertCapacity, financeErrorResponse } from "../../../../_lib/markets-lib";

const Body = z.object({ clubId: z.string().min(10).max(64).optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  const { id } = await params;

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "Invalid body", 400);

  const club = await resolveActingClub(auth.userId, parsed.data.clubId ?? null);
  if (!club) {
    return fail(parsed.data.clubId ? "NOT_CLUB_OWNER" : "CLUB_REQUIRED", parsed.data.clubId ? "You do not own that club" : "You must own a club to sign players", parsed.data.clubId ? 403 : 400);
  }

  const player = await db.player.findUnique({ where: { id }, select: { id: true, clubId: true, isFreeAgent: true, retired: true, marketValue: true } });
  if (!player) return fail("PLAYER_NOT_FOUND", "Player not found", 404);
  if (player.retired) return fail("PLAYER_RETIRED", "Retired players cannot be signed", 409);
  if (!player.isFreeAgent || player.clubId) return fail("NOT_FREE_AGENT", "Player is not a free agent", 409);

  try {
    await assertCapacity(club.id);
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }

  const day = await currentGameDay();
  const seasons = await db.season.findMany({ orderBy: { number: "desc" }, take: 1 });
  const seasonId = seasons[0]?.id ?? "season-0";
  const fee = player.marketValue;

  try {
    await db.$transaction(async (tx) => {
      // SECURITY (pentest fix — double-sign race): the player state was previously
      // read OUTSIDE the transaction and the update was unconditional, so two
      // concurrent signers could both claim the same free agent (the second one
      // paid nothing due to the reused `FASIGN:<id>` idem key). The claim is now
      // atomic and per-occurrence: only the first caller that flips
      // isFreeAgent/clubId proceeds; everyone else aborts with nothing charged.
      const claimed = await tx.player.updateMany({
        where: { id, isFreeAgent: true, clubId: null, retired: false },
        data: { clubId: club.id, isFreeAgent: false },
      });
      if (claimed.count === 0) {
        throw new FinanceError("NOT_FREE_AGENT", "Player is no longer a free agent");
      }
      await debitClub(tx, club.id, fee, "PURCHASE", `FASIGN:${id}:${randomUUID()}`, `Free agent signing ${id}`);
      await tx.transferRecord.create({
        data: { playerId: id, clubFromId: null, clubToId: club.id, amount: fee, fee: 0, levy: 0, type: "FREE_AGENT", seasonId, day },
      });
    });
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    if (e instanceof FinanceError && e.code === "NOT_FREE_AGENT") {
      return fail("NOT_FREE_AGENT", "Player is not a free agent", 409);
    }
    throw e;
  }

  await audit("FREE_AGENT_SIGNED", auth.userId, { playerId: id, clubId: club.id, fee });
  return ok({ playerId: id, clubId: club.id, fee, state: "SIGNED" });
}
