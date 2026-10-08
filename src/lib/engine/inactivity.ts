// Knight FM — account lifecycle engine (Task 25-a, spec §36 security keys).
// Daily 00:20 job: accounts without access for users.inactiveAfterDays are marked
// INACTIVE; accounts without access for users.deleteAfterDays are HARD-DELETED and
// everything they owned returns to the system:
//   - owned clubs revert (systemOwned=true, original founding name restored — the
//     exact same semantics as a manual release, Task 24-a) and go back on the market;
//   - managed clubs lose the manager, their permission grants and the ACTIVE contract
//     is terminated;
//   - personal data (sessions, wallet, notifications, assistant log, presence,
//     messages, remaining contracts/permission grants) is erased;
//   - referral links pointing at the deleted account are cleared.
// ADMIN accounts NEVER expire and are NEVER deleted. Everything is audited.

import { createHash } from "crypto";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { resetClubSystemBaseline } from "@/lib/engine/club-baseline";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Privacy: audit trails never contain the raw email, only an 8-char sha256 prefix. */
function emailHash8(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 8);
}

export interface InactivityResult {
  markedInactive: number;
  deleted: number;
}

/** Summary returned by deleteUserAccount (Task 27-b). */
export interface UserDeleteResult {
  clubsReverted: string[];
}

/** Main entry — daily INACTIVITY job (idempotent by construction: cutoff-based). */
export async function runInactivity(day: number): Promise<InactivityResult> {
  const now = new Date();
  const inactiveAfterDays = await getInt("users.inactiveAfterDays", 40);
  const deleteAfterDays = await getInt("users.deleteAfterDays", 60);

  // 1) Mark INACTIVE (ADMIN never): no access for inactiveAfterDays.
  const inactiveCutoff = new Date(now.getTime() - inactiveAfterDays * DAY_MS);
  const marked = await db.user.updateMany({
    where: { role: { not: "ADMIN" }, status: "ACTIVE", lastActiveAt: { lt: inactiveCutoff } },
    data: { status: "INACTIVE" },
  });
  if (marked.count > 0) {
    await db.auditEvent.create({
      data: {
        type: "USERS_MARKED_INACTIVE",
        actorId: null,
        payload: JSON.stringify({ count: marked.count, cutoffDays: inactiveAfterDays, day }),
      },
    });
  }

  // 2) Hard-delete (ADMIN never): no access for deleteAfterDays, whatever the status.
  const deleteCutoff = new Date(now.getTime() - deleteAfterDays * DAY_MS);
  const doomed = await db.user.findMany({
    where: { role: { not: "ADMIN" }, lastActiveAt: { lt: deleteCutoff } },
    select: { id: true, email: true },
  });
  let deleted = 0;
  for (const user of doomed) {
    // One poisoned account must not block the rest of the sweep; failures are audited.
    try {
      await deleteUserAccount(user.id, user.email, day);
      deleted++;
    } catch (e) {
      await db.auditEvent
        .create({
          data: {
            type: "USER_DELETE_FAILED",
            actorId: null,
            payload: JSON.stringify({ userId: user.id, day, error: String(e) }),
          },
        })
        .catch(() => undefined);
    }
  }

  return { markedInactive: marked.count, deleted };
}

/**
 * Atomic per-account teardown. Order matters: every FK pointing at the user is
 * released or erased BEFORE db.user.delete (SQLite enforces Prisma relations).
 * ManagerOffer has no user reference (club-scoped only) — nothing to clean there.
 * Shared by the daily INACTIVITY job (system, actorId null) and the manual
 * admin deletion route (Task 27-b, actorId = the deleting ADMIN).
 */
export async function deleteUserAccount(
  userId: string,
  email: string,
  day: number,
  actorId: string | null = null
): Promise<UserDeleteResult> {
  const now = new Date();
  const clubsReverted: string[] = [];

  await db.$transaction(async (tx) => {
    // (a) Owned clubs return to the system with their ORIGINAL founding name
    //     (Task 24-a coherence) and their rename lock is cleared for the next owner.
    const owned = await tx.club.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true, originalName: true },
    });
    for (const club of owned) {
      const original = club.originalName || club.name;
      await tx.club.update({
        where: { id: club.id },
        data: { systemOwned: true, ownerId: null, name: original, nameChangeDay: null },
      });
      // Same semantics as a manual release (user mandate): the reverted club
      // goes back on the system pool at the bare-bones baseline — level-1
      // facilities, no staff, no pending upgrades.
      await resetClubSystemBaseline(tx, club.id);
      clubsReverted.push(original);
    }

    // (b) Managed clubs: release the manager, clear permissions, terminate the
    //     ACTIVE contract exactly like a resignation.
    const managed = await tx.club.findMany({ where: { managerId: userId }, select: { id: true } });
    for (const club of managed) {
      await tx.club.update({ where: { id: club.id }, data: { managerId: null } });
      await tx.permissionGrant.deleteMany({ where: { clubId: club.id, managerId: userId } });
      await tx.managerContract.updateMany({
        where: { clubId: club.id, managerId: userId, state: "ACTIVE" },
        data: { state: "TERMINATED", endedAt: now },
      });
    }

    // (c) Personal data + remaining FK-bound rows.
    await tx.session.deleteMany({ where: { userId } });
    await tx.personalWallet.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.assistantEntry.deleteMany({ where: { userId } });
    await tx.presence.deleteMany({ where: { userId } });
    await tx.message.deleteMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] } });
    await tx.permissionGrant.deleteMany({ where: { managerId: userId } });
    await tx.managerContract.deleteMany({ where: { managerId: userId } });

    // (d) Referrals: the referrer keeps their (already settled) bonus history.
    await tx.user.updateMany({ where: { referredById: userId }, data: { referredById: null } });

    // (e) The account itself.
    await tx.user.delete({ where: { id: userId } });
  });

  await db.auditEvent.create({
    data: {
      type: "USER_DELETED",
      actorId,
      payload: JSON.stringify({ userId, emailHash: emailHash8(email), clubsReverted, day }),
    },
  });

  return { clubsReverted };
}
