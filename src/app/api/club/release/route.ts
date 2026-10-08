// Knight FM — POST /api/club/release (Task 24-a: "devolver el club al sistema").
// The OWNER gives the club back to the system pool: ownership is cleared, the
// club reverts to its immutable founding name (Club.originalName), the rename
// window resets (nameChangeDay null) and every PermissionGrant at the club is
// removed. Blocked while a manager holds an ACTIVE contract (MANAGER_ACTIVE).
// Audited CLUB_RELEASED with the reverted name + game day.

import { NextRequest } from "next/server";
import { z } from "zod";
import { audit, clientIp, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { currentGameDay } from "@/lib/engine/clock";
import { resetClubSystemBaseline } from "@/lib/engine/club-baseline";
import { getClubAccess, ownerOnlyError } from "@/app/api/_lib/club-access";
import { ApiTxError } from "@/app/api/auth/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const releaseSchema = z.object({
  clubId: z.string().min(1, "clubId is required"),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = releaseSchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const { clubId } = parsed.data;

  const access = await getClubAccess(auth.userId, clubId);
  const guard = ownerOnlyError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const gameDay = await currentGameDay();

  try {
    const result = await db.$transaction(async (tx) => {
      // Re-read inside the transaction for a race-free ownership check.
      const club = await tx.club.findUnique({
        where: { id: clubId },
        select: { id: true, name: true, originalName: true, ownerId: true, systemOwned: true },
      });
      if (!club) throw new ApiTxError("CLUB_NOT_FOUND", 404);
      if (club.ownerId !== auth.userId) {
        throw new ApiTxError("FORBIDDEN", 403, "Club owner role required");
      }
      if (club.systemOwned) {
        throw new ApiTxError("ALREADY_SYSTEM", 409, "Club already belongs to the system");
      }

      const activeContract = await tx.managerContract.findFirst({
        where: { clubId: club.id, state: "ACTIVE" },
        select: { id: true },
      });
      if (activeContract) {
        throw new ApiTxError("MANAGER_ACTIVE", 409, "A manager with an active contract runs this club");
      }

      const revertedTo = club.originalName || club.name;
      await tx.club.update({
        where: { id: club.id },
        data: {
          systemOwned: true,
          ownerId: null,
          managerId: null,
          name: revertedTo,
          nameChangeDay: null,
        },
      });
      await tx.permissionGrant.deleteMany({ where: { clubId: club.id } });

      // User mandate: a club RETURNING to the system pool goes back to the
      // bare-bones baseline (level-1 facilities, no staff, no pending upgrade
      // timers) — the next picker starts from scratch and nothing is inherited.
      await resetClubSystemBaseline(tx, club.id);

      return { clubId: club.id, revertedTo };
    });

    await audit("CLUB_RELEASED", auth.userId, {
      clubId: result.clubId,
      revertedTo: result.revertedTo,
      day: gameDay,
      ip: clientIp(req),
    });

    return ok({ released: true, clubId: result.clubId, name: result.revertedTo });
  } catch (e) {
    if (e instanceof ApiTxError) return fail(e.code, e.message, e.status);
    throw e;
  }
}
