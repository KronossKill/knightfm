// Knight FM — GET /api/wallet/referrals
// Referral program status for the wallet screen: welcome-bonus state, the
// commission the user's own earnings pay to THEIR referrer, and the commission
// the user EARNS from their referred users (REFERRAL_COMMISSION ledger entries).

import { NextRequest } from "next/server";
import { ok, fail, requireAuth, isResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  try {
    const me = await db.user.findUnique({
      where: { id: auth.userId },
      select: {
        referredById: true,
        referralCredited: true,
        referrer: { select: { username: true } },
      },
    });
    if (!me) return fail("NOT_FOUND", "User not found", 404);

    const [bonusAmount, commissionPct] = await Promise.all([
      getInt("referral.bonus", 100),
      getInt("referral.commissionPct", 5),
    ]);

    const [commissionAgg, referredCount, recent] = await Promise.all([
      db.ledgerEntry.aggregate({
        where: { account: "PERSONAL", userId: auth.userId, category: "REFERRAL_COMMISSION" },
        _sum: { amount: true },
      }),
      db.user.count({ where: { referredById: auth.userId } }),
      db.ledgerEntry.findMany({
        where: { account: "PERSONAL", userId: auth.userId, category: { in: ["REFERRAL", "REFERRAL_COMMISSION"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { createdAt: true, category: true, amount: true, memo: true, grossAmount: true, levyAmount: true },
      }),
    ]);

    return ok({
      referrer: me.referredById ? { username: me.referrer?.username ?? null } : null,
      bonus: { amount: bonusAmount, credited: me.referralCredited },
      myCommissionPct: commissionPct, // what MY incomes pay to MY referrer
      earnCommissionPct: commissionPct, // what MY referred users pay me
      totalCommissionEarned: commissionAgg._sum.amount ?? 0,
      referredCount,
      recent: recent.map((r) => ({
        at: r.createdAt,
        category: r.category,
        amount: r.amount,
        gross: r.grossAmount,
        levy: r.levyAmount,
        memo: r.memo,
      })),
    });
  } catch (e) {
    return fail("INTERNAL", String(e), 500);
  }
}
