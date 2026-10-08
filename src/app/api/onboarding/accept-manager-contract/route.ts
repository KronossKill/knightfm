// Knight FM — POST /api/onboarding/accept-manager-contract (spec §14, §44.6).
// Transactional acceptance of the 1-season manager contract:
//   re-checks club availability (systemOwned && managerId === null) and the
//   user's MANAGER path; a still-ACTIVE contract at a DIFFERENT club is
//   automatically resigned first (user mandate: taking a new club means
//   abandoning the current one — one club per manager, enforced atomically).
//   Creates the contract with dailySalary derived once (floor(total/days));
//   assigns club.managerId; grants the permission set ({tactics, training,
//   youth, transfers} true). User mandate: the manager runs the club's transfer
//   desk from day one (sell/auction/loan/clause buttons); an owner may still
//   deny transfers via PermissionGrant.
// Concurrent-safe: availability is re-checked and claimed inside the transaction.

import { NextRequest } from "next/server";
import { ok, fail, audit, clientIp, requireAuth, isResponse, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { currentGameDay, resolveSeason, upcomingSeason } from "@/lib/engine/clock";
import { SEASON_COMPETITIVE_DAYS, SEASON_PRESEASON_DAYS } from "@/lib/types";
import { resetClubSystemBaseline } from "@/lib/engine/club-baseline";
import { ApiTxError, z } from "@/app/api/auth/_shared";

export const runtime = "nodejs";

const BodySchema = z.object({ clubId: z.string().min(1).max(64) });

const MANAGER_PERMISSIONS = JSON.stringify({ tactics: true, training: true, youth: true, transfers: true });

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);

  const gameDay = await currentGameDay();
  // The ≥5-day post-reset PRE-SEASON has no ACTIVE season yet — the contract
  // still covers the UPCOMING Season 1 (its start day lives in the Season row).
  const season = await resolveSeason(gameDay);
  const upcoming = season ? null : await upcomingSeason(gameDay);
  if (!season && !upcoming) return fail("WORLD_NOT_INITIALIZED", "World calendar unavailable", 503);
  const seasonStart = season ? season.startEpochDay : upcoming!.startEpochDay;
  const seasonNumber = season ? season.number : upcoming!.number;

  const seasonEndEpochDay = seasonStart + SEASON_COMPETITIVE_DAYS + SEASON_PRESEASON_DAYS - 1;
  const durationDays = Math.max(1, seasonEndEpochDay - gameDay + 1);
  const totalAmount = await getInt("economy.managerBaseContract", 140);
  const dailySalary = Math.floor(totalAmount / durationDays);

  try {
    const contract = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: auth.userId }, select: { path: true } });
      if (!user) throw new ApiTxError("NOT_FOUND", 404);
      if (!user.path) throw new ApiTxError("PATH_REQUIRED", 409, "Choose your career path first");
      if (user.path !== "MANAGER") throw new ApiTxError("NOT_MANAGER", 403, "Only managers can accept contracts");

      // One club per manager: an ACTIVE contract at a different club is
      // auto-resigned (mandate); accepting for the SAME club stays a no-op error.
      const activeContracts = await tx.managerContract.findMany({
        where: { managerId: auth.userId, state: "ACTIVE" },
        select: { id: true, clubId: true },
      });
      const resignedFrom: { clubId: string; clubName: string }[] = [];
      for (const c of activeContracts) {
        if (c.clubId === parsed.data.clubId) {
          throw new ApiTxError("CONTRACT_EXISTS", 409, "You already manage this club");
        }
        const oldClub = await tx.club.findUnique({ where: { id: c.clubId }, select: { id: true, name: true, ownerId: true } });
        await tx.managerContract.update({
          where: { id: c.id },
          data: { state: "RESIGNED", endedAt: new Date(), settledAmount: 0 },
        });
        await tx.club.update({ where: { id: c.clubId }, data: { managerId: null } });
        await tx.permissionGrant.deleteMany({ where: { clubId: c.clubId, managerId: auth.userId } });
        if (oldClub?.ownerId && oldClub.ownerId !== auth.userId) {
          await tx.notification
            .create({
              data: {
                userId: oldClub.ownerId,
                typeKey: "notification.managerResigned",
                payload: JSON.stringify({ clubId: oldClub.id, clubName: oldClub.name, day: gameDay }),
              },
            })
            .catch(() => undefined);
        }
        resignedFrom.push({ clubId: oldClub?.id ?? c.clubId, clubName: oldClub?.name ?? "" });
      }

      // Task 30 — division gate: managers can only take charge of system clubs in
      // selectable divisions (world.pickMinDivisionIndex, default 5). This covers both
      // first picks and re-picks after abandoning/resigning a club.
      const targetClub = await tx.club.findUnique({
        where: { id: parsed.data.clubId },
        select: { id: true, systemOwned: true, division: { select: { index: true } } },
      });
      if (!targetClub || !targetClub.systemOwned) throw new ApiTxError("CLUB_UNAVAILABLE", 409, "Club is not available");
      const minDivisionIndex = await getInt("world.pickMinDivisionIndex", 5);
      if (targetClub.division.index < minDivisionIndex) {
        throw new ApiTxError("CLUB_DIVISION_LOCKED", 403, `Only divisions ${minDivisionIndex}+ are selectable`);
      }

      // Atomic claim: only succeeds while the club is still system-owned and unmanaged.
      const claimed = await tx.club.updateMany({
        where: { id: parsed.data.clubId, systemOwned: true, managerId: null },
        data: { managerId: auth.userId },
      });
      if (claimed.count === 0) throw new ApiTxError("CLUB_TAKEN", 409, "Club is no longer available");

      // User mandate: picking a system club means starting from the BARE-BONES
      // club — level-1 facilities and ZERO staff. Coaches/scouts/physios are
      // hired over time with the club's own funds; special training stays
      // locked until the first COACH joins.
      await resetClubSystemBaseline(tx, parsed.data.clubId);

      const created = await tx.managerContract.create({
        data: {
          clubId: parsed.data.clubId,
          managerId: auth.userId,
          totalAmount,
          durationDays,
          dailySalary,
          startDay: gameDay,
          endDay: gameDay + durationDays - 1,
          state: "ACTIVE",
        },
      });

      await tx.permissionGrant.upsert({
        where: { clubId_managerId: { clubId: parsed.data.clubId, managerId: auth.userId } },
        create: { clubId: parsed.data.clubId, managerId: auth.userId, permissions: MANAGER_PERMISSIONS },
        update: { permissions: MANAGER_PERMISSIONS },
      });

      return { created, resignedFrom };
    });

    await audit("MANAGER_CONTRACT_ACCEPTED", auth.userId, {
      contractId: contract.created.id,
      clubId: parsed.data.clubId,
      seasonNumber,
      totalAmount,
      durationDays,
      dailySalary,
      startDay: contract.created.startDay,
      endDay: contract.created.endDay,
      resignedFrom: contract.resignedFrom,
      ip: clientIp(req),
    });

    return ok({
      seasonNumber,
      contract: {
        id: contract.created.id,
        clubId: contract.created.clubId,
        totalAmount: contract.created.totalAmount,
        durationDays: contract.created.durationDays,
        dailySalary: contract.created.dailySalary,
        startDay: contract.created.startDay,
        endDay: contract.created.endDay,
        state: contract.created.state,
      },
      resignedFrom: contract.resignedFrom,
    });
  } catch (e) {
    if (e instanceof ApiTxError) return fail(e.code, e.message, e.status);
    throw e;
  }
}
