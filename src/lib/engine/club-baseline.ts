// Knight FM — system-club baseline (user mandate).
//
// A system club is ALWAYS bare-bones: every facility at the BASIC level (1),
// no pending upgrade timers and ZERO staff members. When a user PICKS a system
// club (owner purchase or manager contract) the club starts exactly like that;
// whenever a club RETURNS to the system pool (owner release, manager
// resignation at a system club, account teardown) it is stripped back to the
// baseline so no user can inherit another user's improvements.
//
// Staff and facility levels are acquired OVER TIME with the club's OWN funds.
// Without at least one COACH only GENERAL training sessions are available —
// special sessions require technical staff (enforced in /api/training).

import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClientLike;

/** Minimal structural type so the helper also accepts `db` itself. */
interface PrismaClientLike {
  staffMember: { deleteMany(args: { where: { clubId: string } }): Promise<unknown> };
  facilityUpgrade: { deleteMany(args: { where: { clubId: string } }): Promise<unknown> };
  facility: {
    updateMany(args: {
      where: { clubId: string };
      data: { level: number; upgradeStartedAt: null; upgradeCompletesAt: null };
    }): Promise<unknown>;
  };
}

/**
 * Strip a club back to the system baseline. Idempotent, FK-safe, and cheap —
 * call it inside any transaction that hands a club to or from the system pool.
 */
export async function resetClubSystemBaseline(tx: Tx, clubId: string): Promise<void> {
  // Technical staff (coaches, scouts, physios, medics, analysts…) — all gone.
  await tx.staffMember.deleteMany({ where: { clubId } });
  // Pending facility-upgrade timers: a half-done upgrade is cancelled, the
  // building lands on level 1 (no refund — improvements belonged to the
  // previous regime, and the next picker starts from the mandate's baseline).
  await tx.facilityUpgrade.deleteMany({ where: { clubId } });
  await tx.facility.updateMany({
    where: { clubId },
    data: { level: 1, upgradeStartedAt: null, upgradeCompletesAt: null },
  });
}
