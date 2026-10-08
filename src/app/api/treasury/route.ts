// Knight FM — Club treasury view (spec §23). Accessible to the OWNER or the MANAGER of the club.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse } from "@/lib/api";
import { getInt } from "@/lib/config";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const clubId = new URL(req.url).searchParams.get("clubId");
  if (!clubId) return fail("CLUB_REQUIRED", "clubId query parameter is required", 400);

  const club = await db.club.findUnique({ where: { id: clubId }, select: { ownerId: true, managerId: true } });
  if (!club) return fail("CLUB_NOT_FOUND", "Club not found", 404);
  if (club.ownerId !== auth.userId && club.managerId !== auth.userId && auth.role !== "ADMIN") {
    return fail("FORBIDDEN", "Only the owner or manager of this club can view its treasury", 403);
  }

  const [state, ledger, withdrawTaxPct, incomeTaxPct] = await Promise.all([
    db.club.findUnique({
      where: { id: clubId },
      select: { operatingFund: true, debt: true, finState: true, unpaidDays: true },
    }),
    db.ledgerEntry.findMany({
      where: { clubId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, category: true, amount: true, balanceAfter: true, memo: true, createdAt: true },
    }),
    // Task 23-b: the UI shows the withdrawal tax before confirming.
    getInt("economy.clubWithdrawTaxPct", 10),
    // Task 25-b: the UI informs about the gravamen on club income (prizes, sales, gate receipts, loans).
    getInt("economy.clubIncomeTaxPct", 10),
  ]);

  return ok({ clubId, ...state, withdrawTaxPct, incomeTaxPct, ledger });
}
