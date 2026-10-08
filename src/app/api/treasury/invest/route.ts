// Knight FM — Treasury invest: OWNER or MANAGER moves PERSONAL funds into the CLUB
// treasury. Separate ledgers (invariant #5); deterministic daily idempotency key;
// 402 when short. Withdrawing club funds stays OWNER-only (user mandate).

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { currentGameDay } from "@/lib/engine/clock";
import { debitPersonal, creditClub, FinanceError } from "@/lib/engine/finance";
import { getClubAccess, squadManagementError } from "../../_lib/club-access";
import { financeErrorResponse } from "../../_lib/markets-lib";

const Body = z.object({
  clubId: z.string().min(10).max(64),
  amount: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "clubId and integer amount > 0 are required", 400);
  const { clubId, amount } = parsed.data;

  const access = await getClubAccess(auth.userId, clubId);
  const guard = squadManagementError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const day = await currentGameDay();
  const idem = `INV:${auth.userId}:${clubId}:${day}`;

  try {
    const result = await db.$transaction(async (tx) => {
      await debitPersonal(tx, auth.userId, amount, "INVEST", idem, `Investment into club ${clubId}`);
      await creditClub(tx, clubId, amount, "INVEST", `${idem}:CREDIT`, `Investment from owner ${auth.userId}`);
      const club = await tx.club.findUnique({ where: { id: clubId }, select: { operatingFund: true } });
      return club?.operatingFund ?? null;
    });

    await audit("TREASURY_INVEST", auth.userId, { clubId, amount, day });
    return ok({ clubId, amount, day, operatingFund: result });
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    if (e instanceof FinanceError && e.code === "INSUFFICIENT_PERSONAL_FUNDS") {
      return fail("INSUFFICIENT_FUNDS", e.message, 402);
    }
    throw e;
  }
}
