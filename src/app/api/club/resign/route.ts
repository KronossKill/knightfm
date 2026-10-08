// Knight FM — POST /api/club/resign.
// A MANAGER resigns from the club they currently manage: the ACTIVE contract
// becomes RESIGNED (settledAmount 0 — resignation is voluntary, no settlement),
// the club's managerId is cleared, the PermissionGrant is removed and the owner
// (if any) receives a notification. Audited MANAGER_RESIGNED.

import { NextRequest } from "next/server";
import { z } from "zod";
import { audit, clientIp, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { currentGameDay } from "@/lib/engine/clock";
import { resetClubSystemBaseline } from "@/lib/engine/club-baseline";
import { ApiTxError } from "@/app/api/auth/_shared";

export const runtime = "nodejs";

const resignSchema = z.object({
  clubId: z.string().min(1, "clubId is required"),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = resignSchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const { clubId } = parsed.data;
  const gameDay = await currentGameDay();

  try {
    const result = await db.$transaction(async (tx) => {
      const club = await tx.club.findUnique({
        where: { id: clubId },
        select: { id: true, name: true, managerId: true, ownerId: true, systemOwned: true },
      });
      if (!club) throw new ApiTxError("CLUB_NOT_FOUND", 404);
      if (club.managerId !== auth.userId) {
        throw new ApiTxError("NOT_MANAGING", 403, "You do not manage this club");
      }

      const contract = await tx.managerContract.findFirst({
        where: { clubId: club.id, managerId: auth.userId, state: "ACTIVE" },
        orderBy: { startDay: "desc" },
      });
      if (contract) {
        await tx.managerContract.update({
          where: { id: contract.id },
          data: { state: "RESIGNED", endedAt: new Date(), settledAmount: 0 },
        });
      }

      await tx.club.update({ where: { id: club.id }, data: { managerId: null } });
      await tx.permissionGrant.deleteMany({ where: { clubId: club.id, managerId: auth.userId } });

      // When the departing manager leaves a SYSTEM club behind, the club goes
      // back to the pickable pool at the bare-bones baseline (level-1
      // facilities, no staff) so the next picker inherits nothing (user
      // mandate). Owner-backed clubs keep their owner's improvements.
      if (club.systemOwned && !club.ownerId) {
        await resetClubSystemBaseline(tx, club.id);
      }

      if (club.ownerId) {
        await tx.notification
          .create({
            data: {
              userId: club.ownerId,
              typeKey: "notification.managerResigned",
              payload: JSON.stringify({ clubId: club.id, clubName: club.name, day: gameDay }),
            },
          })
          .catch(() => undefined);
      }

      return { club };
    });

    await audit("MANAGER_RESIGNED", auth.userId, {
      clubId: result.club.id,
      clubName: result.club.name,
      day: gameDay,
      ip: clientIp(req),
    });

    return ok({ resigned: true, clubId: result.club.id });
  } catch (e) {
    if (e instanceof ApiTxError) return fail(e.code, e.message, e.status);
    throw e;
  }
}
