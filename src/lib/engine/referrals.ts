// Knight FM — referral engine (referral-commission-1).
// Welcome-bonus settlement: REFERIDO receives the FULL bonus (no levy, no
// commission — the welcome bonus is the only levy/commission-exempt income in
// the platform); REFERENTE receives the bonus net of the income levy via
// creditUserIncome with commissionExempt (the bonus NEVER generates commission).
// Idempotent by user.referralCredited + deterministic ledger keys.

import { db } from "@/lib/db";
import { audit } from "@/lib/api";
import { getInt } from "@/lib/config";
import { creditUserIncome, creditPersonal, type Tx } from "@/lib/engine/finance";

export async function settleReferralForUser(refereeId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: refereeId },
    select: { id: true, username: true, referredById: true, referralCredited: true },
  });
  if (!user?.referredById || user.referralCredited) return false;

  const bonus = await getInt("referral.bonus", 100);
  if (bonus <= 0) {
    await db.user.update({ where: { id: user.id }, data: { referralCredited: true } });
    return false;
  }

  const referrerId = user.referredById;
  await db.$transaction(async (tx: Tx) => {
    // REFERIDO: the full bonus — the ONLY exempt income (no levy, no commission).
    await creditPersonal(
      tx, user.id, bonus, "REFERRAL", `REFERRAL_BONUS:${user.id}`,
      "Bono de bienvenida por referido (exento de gravamen)", { gross: bonus, levy: 0, net: bonus }
    );
    // REFERENTE: bonus net of the income levy; commissionExempt — the bonus never
    // generates commission (a commission on a commission would recurse).
    await creditUserIncome(tx, referrerId, bonus, {
      category: "REFERRAL",
      idemBase: `REFERRAL_BONUS:${user.id}:REFERRER`,
      memo: `Bono por referir a ${user.username} (neto tras gravamen)`,
      commissionExempt: true,
    });
    await tx.user.update({ where: { id: user.id }, data: { referralCredited: true } });
  });
  await audit("REFERRAL_GRANTED", referrerId, { refereeId: user.id, bonus });
  return true;
}
