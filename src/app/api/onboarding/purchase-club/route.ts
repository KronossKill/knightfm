// Knight FM — POST /api/onboarding/purchase-club (spec §13, §20, D-010 + manager-purchase rules).
// Buyers: OWNER path, and MANAGER path under these rules:
//   - A manager may buy the very club they currently manage (if system-owned)
//     and keeps the manager contract (owner-operator model).
//   - To buy ANY OTHER club, the manager's current contract is automatically
//     resigned (user mandate: taking a new club means abandoning the current
//     one — the system enforces it atomically, no manual step needed).
// Server-enforced limits inside the transaction (§44.8): max 10 clubs per owner,
// never two clubs in the same region. Task 30: purchases are restricted to divisions
// with index >= world.pickMinDivisionIndex (default 5) — EXCEPTION: a manager buying
// the very club they currently manage (owner-operator) keeps that right, since they
// already run the club (no free pick involved). Personal wallet must cover the fixed price
// economy.systemClubPrice — no free money. debitPersonal (idem
// OWNER-CLUB:<userId>:<clubId>) → creditFund SYSTEM; atomic club claim +
// OwnershipRecord + full audit trail.

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { ok, fail, audit, clientIp, requireAuth, isResponse, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { currentGameDay } from "@/lib/engine/clock";
import { debitPersonal, creditFund, FinanceError } from "@/lib/engine/finance";
import { resetClubSystemBaseline } from "@/lib/engine/club-baseline";
import { ApiTxError, z } from "@/app/api/auth/_shared";

/** Owner-operator exception: the buyer is the club's current manager. */
function resultIsOwnerOperator(managerId: string | null, userId: string): boolean {
  return managerId === userId;
}

export const runtime = "nodejs";

const BodySchema = z.object({ clubId: z.string().min(1).max(64) });

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);

  const gameDay = await currentGameDay();
  const price = await getInt("economy.systemClubPrice", 100);

  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { path: true, wallet: { select: { balance: true } } },
      });
      if (!user) throw new ApiTxError("NOT_FOUND", 404);
      if (!user.path) throw new ApiTxError("PATH_REQUIRED", 409, "Choose your career path first");
      if (user.path !== "OWNER" && user.path !== "MANAGER") {
        throw new ApiTxError("NOT_OWNER", 403, "Only owners or managers can purchase clubs");
      }

      const club = await tx.club.findUnique({
        where: { id: parsed.data.clubId },
        select: {
          id: true,
          name: true,
          systemOwned: true,
          regionId: true,
          managerId: true,
          division: { select: { index: true } },
        },
      });
      if (!club || !club.systemOwned) throw new ApiTxError("CLUB_UNAVAILABLE", 409, "Club is not available");

      // Task 30 — division gate: system clubs in protected (top) divisions cannot be
      // purchased. Owner-operator exception: a manager buying the club they already
      // manage is not making a free pick (they already run it).
      if (club.managerId !== auth.userId) {
        const minDivisionIndex = await getInt("world.pickMinDivisionIndex", 5);
        if (club.division.index < minDivisionIndex) {
          throw new ApiTxError("CLUB_DIVISION_LOCKED", 403, `Only divisions ${minDivisionIndex}+ are selectable`);
        }
      }

      // Manager rule: taking a NEW club while managing another automatically
      // resigns the current contract (mandate: one club per manager; the old
      // club is abandoned atomically with the purchase).
      const resignedFrom: { clubId: string; clubName: string }[] = [];
      if (user.path === "MANAGER") {
        const activeContracts = await tx.managerContract.findMany({
          where: { managerId: auth.userId, state: "ACTIVE" },
          select: { id: true, clubId: true },
        });
        for (const c of activeContracts) {
          if (c.clubId === club.id) continue; // owner-operator: keeps managing the bought club
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
      }

      // §44.8 — DB + server enforced ownership limits.
      const [ownedCount, sameRegion] = await Promise.all([
        tx.club.count({ where: { ownerId: auth.userId } }),
        tx.club.findFirst({ where: { ownerId: auth.userId, regionId: club.regionId }, select: { id: true } }),
      ]);
      if (ownedCount >= 10) throw new ApiTxError("OWNER_CLUB_LIMIT", 409, "Maximum of 10 owned clubs reached");
      if (sameRegion) throw new ApiTxError("OWNER_REGION_LIMIT", 409, "You already own a club in this region");

      // Atomic claim before any money moves (rolls back together if it fails).
      // Task 24-a: the new owner starts with a clean rename window.
      const claimed = await tx.club.updateMany({
        where: { id: club.id, systemOwned: true },
        data: { ownerId: auth.userId, systemOwned: false, nameChangeDay: null },
      });
      if (claimed.count === 0) throw new ApiTxError("CLUB_TAKEN", 409, "Club is no longer available");

      // User mandate: picking a system club hands over the BARE-BONES club —
      // level-1 facilities and NO staff. Exception: the owner-operator (manager
      // buying the very club they already run) keeps their earned progress —
      // their "pick" already happened when they signed the manager contract.
      if (!resultIsOwnerOperator(club.managerId, auth.userId)) {
        await resetClubSystemBaseline(tx, club.id);
      }

      const balance = user.wallet?.balance ?? 0;
      if (balance < price) throw new ApiTxError("INSUFFICIENT_FUNDS", 402, `Insufficient funds (need ${price}, have ${balance})`);

      // Personal debit (idempotent, audited via LedgerEntry) → system fund credit.
      // SECURITY (pentest fix — money printer): the idem key was
      // `OWNER-CLUB:<userId>:<clubId>` (no time component), so releasing the
      // club and re-buying it executed the WHOLE purchase with the debit and
      // the fund credit silently skipped — a free club. Per-occurrence key:
      // the atomic claim above already guarantees single execution.
      const occ = randomUUID();
      await debitPersonal(tx, auth.userId, price, "PURCHASE_CLUB", `OWNER-CLUB:${auth.userId}:${club.id}:${occ}`, `Compra del club ${club.name}`);
      await creditFund(tx, "SYSTEM", price, `OWNER-CLUB:${auth.userId}:${club.id}:${occ}:SYSTEM`, "PURCHASE_CLUB", `Fondo del sistema: compra del club ${club.name}`);

      await tx.ownershipRecord.create({
        data: { clubId: club.id, fromOwner: null, toOwner: auth.userId, amount: price, day: gameDay },
      });

      const walletAfter = await tx.personalWallet.findUnique({ where: { userId: auth.userId }, select: { balance: true } });
      return { club, balanceAfter: walletAfter?.balance ?? 0, becameOwnerOperator: club.managerId === auth.userId, resignedFrom };
    });

    await audit("CLUB_PURCHASED", auth.userId, {
      clubId: result.club.id,
      clubName: result.club.name,
      price,
      day: gameDay,
      ownerOperator: result.becameOwnerOperator,
      resignedFrom: result.resignedFrom,
      ip: clientIp(req),
    });

    return ok({
      clubId: result.club.id,
      price,
      balanceAfter: result.balanceAfter,
      ownerOperator: result.becameOwnerOperator,
      resignedFrom: result.resignedFrom,
    });
  } catch (e) {
    if (e instanceof ApiTxError) return fail(e.code, e.message, e.status);
    if (e instanceof FinanceError) return fail("INSUFFICIENT_FUNDS", e.message, 402);
    throw e;
  }
}
