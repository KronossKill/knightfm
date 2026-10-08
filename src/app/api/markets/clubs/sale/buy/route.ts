// Knight FM — POST /api/markets/clubs/sale/buy — buy a club listed by ANOTHER owner.
// Secondary-market purchase rules (mirrors /api/onboarding/purchase-club):
//   • Club must be owner-owned (systemOwned=false) with salePrice set — the asking
//     price was chosen freely by the seller (system clubs keep the fixed price and
//     the world.pickMinDivisionIndex division gate; resale is exempt: those clubs
//     reached their division on sporting merit).
//   • MANAGER path may buy; buying any club OTHER than the one they currently
//     manage auto-resigns the current contract (one club per manager mandate).
//   • §44.8 limits for the buyer: max 10 owned clubs, never two in the same region.
//   • Money: buyer pays the FULL asking price from their personal wallet; the
//     seller receives the NET after the platform income levy
//     (economy.userFundsLevyPct, default 10% — admin-configurable), which is
//     credited to the SYSTEM fund. Gross/levy/net are reconciled on the seller's
//     ledger entry (invariant #10). Atomic claim (salePrice not null + seller
//     unchanged) before any movement, OwnershipRecord + audit + notifications.
//   • Contracts on the sold club: a HIRED manager (not the seller, not the buyer)
//     keeps the ACTIVE contract and is notified of the ownership change; a
//     seller acting as owner-operator sees their contract resigned with the sale.

import { NextRequest } from "next/server";
import { ok, fail, audit, clientIp, requireAuth, isResponse, readJson } from "@/lib/api";
import { z } from "@/app/api/auth/_shared";
import { db } from "@/lib/db";
import { currentGameDay } from "@/lib/engine/clock";
import { applyUserFundsLevy, creditFund, creditPersonal, debitPersonal, FinanceError } from "@/lib/engine/finance";
import { ApiTxError } from "@/app/api/auth/_shared";

export const runtime = "nodejs";

const BodySchema = z.object({ clubId: z.string().min(1).max(64) });

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);

  const gameDay = await currentGameDay();
  const saleRef = crypto.randomUUID(); // unique per attempted sale → idempotency keys cannot collide across re-listings

  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { path: true, wallet: { select: { balance: true } } },
      });
      if (!user) throw new ApiTxError("NOT_FOUND", 404);
      if (!user.path) throw new ApiTxError("PATH_REQUIRED", 409, "Choose your career path first");

      const club = await tx.club.findUnique({
        where: { id: parsed.data.clubId },
        select: {
          id: true,
          name: true,
          systemOwned: true,
          ownerId: true,
          managerId: true,
          regionId: true,
          salePrice: true,
        },
      });
      if (!club || club.systemOwned || club.salePrice == null || !club.ownerId) {
        throw new ApiTxError("CLUB_NOT_FOR_SALE", 409, "Club is not listed for sale");
      }
      if (club.ownerId === auth.userId) {
        throw new ApiTxError("OWN_CLUB_PURCHASE", 409, "You cannot buy your own club");
      }
      const sellerId: string = club.ownerId;
      const price = club.salePrice;

      // Manager rule (same mandate as system purchases): taking a NEW club while
      // managing another automatically resigns the current contract. Buying the
      // very club they manage keeps the contract (owner-operator transition).
      const resignedFrom: { clubId: string; clubName: string }[] = [];
      if (user.path === "MANAGER") {
        const activeContracts = await tx.managerContract.findMany({
          where: { managerId: auth.userId, state: "ACTIVE" },
          select: { id: true, clubId: true },
        });
        for (const c of activeContracts) {
          if (c.clubId === club.id) continue;
          const oldClub = await tx.club.findUnique({
            where: { id: c.clubId },
            select: { id: true, name: true, ownerId: true },
          });
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

      // §44.8 — DB + server enforced ownership limits for the buyer.
      const [ownedCount, sameRegion] = await Promise.all([
        tx.club.count({ where: { ownerId: auth.userId } }),
        tx.club.findFirst({ where: { ownerId: auth.userId, regionId: club.regionId }, select: { id: true } }),
      ]);
      if (ownedCount >= 10) throw new ApiTxError("OWNER_CLUB_LIMIT", 409, "Maximum of 10 owned clubs reached");
      if (sameRegion) throw new ApiTxError("OWNER_REGION_LIMIT", 409, "You already own a club in this region");

      // Atomic claim before any money moves: only succeeds while the club is still
      // listed by the same seller (rolls back together with the transfers).
      const claimed = await tx.club.updateMany({
        where: { id: club.id, ownerId: sellerId, salePrice: { not: null } },
        data: { ownerId: auth.userId, salePrice: null, saleListedDay: null, nameChangeDay: null },
      });
      if (claimed.count === 0) throw new ApiTxError("CLUB_NOT_FOR_SALE", 409, "Club is no longer listed for sale");

      const balance = user.wallet?.balance ?? 0;
      if (balance < price) throw new ApiTxError("INSUFFICIENT_FUNDS", 402, `Insufficient funds (need ${price}, have ${balance})`);

      // Platform income levy (user rule): the seller receives the NET and the levy
      // goes to the SYSTEM fund inside the same transaction. Buyer always pays the
      // full asking price.
      const levyInfo = await applyUserFundsLevy(price);

      // Buyer personal debit (gross) → seller personal credit (net) + SYSTEM levy.
      await debitPersonal(tx, auth.userId, price, "PURCHASE_CLUB", `CLUB-SALE-BUY:${saleRef}`, `Compra del club ${club.name} (reventa)`);
      await creditPersonal(
        tx,
        sellerId,
        levyInfo.net,
        "CLUB_SALE",
        `CLUB-SALE-SELL:${saleRef}`,
        `Venta del club ${club.name} (neto tras gravamen del ${levyInfo.pct}%)`,
        { gross: levyInfo.gross, levy: levyInfo.levy, net: levyInfo.net }
      );
      if (levyInfo.levy > 0) {
        await creditFund(tx, "SYSTEM", levyInfo.levy, `CLUB-SALE-SELL:${saleRef}:LEVY`, "INCOME_LEVY", `Income levy on club sale — ${club.name}`);
      }

      await tx.ownershipRecord.create({
        data: { clubId: club.id, fromOwner: sellerId, toOwner: auth.userId, amount: price, day: gameDay },
      });

      // Contracts on the sold club:
      //  • seller was owner-operator → their contract ends with the sale;
      //  • hired third-party manager (not buyer) → keeps the contract, notified after tx;
      //  • buyer already managed the club → contract untouched (owner-operator).
      let hiredManagerId: string | null = null;
      if (club.managerId && club.managerId !== auth.userId) {
        if (club.managerId === sellerId) {
          const sellerContract = await tx.managerContract.findFirst({
            where: { managerId: sellerId, clubId: club.id, state: "ACTIVE" },
            select: { id: true },
          });
          if (sellerContract) {
            await tx.managerContract.update({
              where: { id: sellerContract.id },
              data: { state: "RESIGNED", endedAt: new Date(), settledAmount: 0 },
            });
          }
          await tx.permissionGrant.deleteMany({ where: { clubId: club.id, managerId: sellerId } });
          await tx.club.update({ where: { id: club.id }, data: { managerId: null } });
        } else {
          hiredManagerId = club.managerId;
        }
      }

      const walletAfter = await tx.personalWallet.findUnique({ where: { userId: auth.userId }, select: { balance: true } });
      return { club, sellerId, price, levy: levyInfo.levy, net: levyInfo.net, levyPct: levyInfo.pct, hiredManagerId, balanceAfter: walletAfter?.balance ?? 0, resignedFrom };
    });

    // Post-transaction notifications (non-critical).
    await db.notification
      .create({
        data: {
          userId: result.sellerId,
          typeKey: "notification.clubSold",
          payload: JSON.stringify({
            clubId: result.club.id,
            clubName: result.club.name,
            amount: result.price,
            net: result.net,
            levyPct: result.levyPct,
            day: gameDay,
          }),
        },
      })
      .catch(() => undefined);
    if (result.hiredManagerId) {
      await db.notification
        .create({
          data: {
            userId: result.hiredManagerId,
            typeKey: "notification.clubNewOwner",
            payload: JSON.stringify({ clubId: result.club.id, clubName: result.club.name, day: gameDay }),
          },
        })
        .catch(() => undefined);
    }

    await audit("CLUB_SOLD", auth.userId, {
      clubId: result.club.id,
      clubName: result.club.name,
      sellerId: result.sellerId,
      price: result.price,
      levy: result.levy,
      net: result.net,
      day: gameDay,
      buyerOperator: result.hiredManagerId === auth.userId,
      resignedFrom: result.resignedFrom,
      ip: clientIp(req),
    });

    return ok({
      clubId: result.club.id,
      price: result.price,
      levy: result.levy,
      netToSeller: result.net,
      balanceAfter: result.balanceAfter,
      resignedFrom: result.resignedFrom,
    });
  } catch (e) {
    if (e instanceof ApiTxError) return fail(e.code, e.message, e.status);
    if (e instanceof FinanceError) return fail("INSUFFICIENT_FUNDS", e.message, 402);
    throw e;
  }
}
