// Knight FM — Apply to a manager offer (MANAGER path, email verified).
// Manager replacement decision (documented in worklog): direct replacement — the club's
// previous ACTIVE contract is TERMINATED with settledAmount 0 and no compensation payout;
// the new contract starts on the current game day. Dismissal-with-settlement belongs to a
// dedicated owner flow and is intentionally out of scope here.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit } from "@/lib/api";
import { currentGameDay } from "@/lib/engine/clock";

const DEFAULT_MANAGER_PERMISSIONS = {
  training: true,
  tactics: true,
  youth: true,
  transfers: true,
  finance: false,
  facilities: false,
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  const { id } = await params;

  const user = await db.user.findUnique({ where: { id: auth.userId }, select: { path: true, emailVerified: true } });
  if (!user) return fail("UNAUTHORIZED", "User not found", 401);
  if (user.path !== "MANAGER") return fail("MANAGER_PATH_REQUIRED", "Only users on the MANAGER path can apply for contracts", 403);
  if (!user.emailVerified) return fail("EMAIL_NOT_VERIFIED", "Verify your email before applying", 403);

  const offer = await db.managerOffer.findUnique({ where: { id }, include: { club: { select: { id: true, managerId: true } } } });
  if (!offer) return fail("OFFER_NOT_FOUND", "Offer not found", 404);
  if (offer.state !== "OPEN") return fail("OFFER_NOT_OPEN", `Offer state is ${offer.state}`, 409);
  if (offer.expiresAt <= new Date()) {
    await db.managerOffer.update({ where: { id }, data: { state: "EXPIRED" } }).catch(() => undefined);
    return fail("OFFER_EXPIRED", "Offer has expired", 409);
  }

  const activeOwn = await db.managerContract.findFirst({ where: { managerId: auth.userId, state: "ACTIVE" }, select: { id: true } });
  if (activeOwn) {
    return fail("ACTIVE_CONTRACT", "You already hold an active contract. Resignation flow is handled separately.", 409);
  }

  const startDay = await currentGameDay();
  const endDay = startDay + offer.durationDays - 1;

  const result = await db.$transaction(async (tx) => {
    // Re-check offer state inside the tx (race with another applicant).
    const fresh = await tx.managerOffer.findUnique({ where: { id }, select: { state: true } });
    if (!fresh || fresh.state !== "OPEN") throw new Error("OFFER_TAKEN");

    // Direct replacement: terminate the club's previous ACTIVE contract without settlement.
    await tx.managerContract.updateMany({
      where: { clubId: offer.clubId, state: "ACTIVE" },
      data: { state: "TERMINATED", settledAmount: 0, endedAt: new Date() },
    });

    const contract = await tx.managerContract.create({
      data: {
        clubId: offer.clubId,
        managerId: auth.userId,
        totalAmount: offer.totalAmount,
        durationDays: offer.durationDays,
        dailySalary: offer.dailySalary,
        startDay,
        endDay,
        state: "ACTIVE",
      },
    });

    await tx.club.update({ where: { id: offer.clubId }, data: { managerId: auth.userId } });

    await tx.permissionGrant.upsert({
      where: { clubId_managerId: { clubId: offer.clubId, managerId: auth.userId } },
      create: { clubId: offer.clubId, managerId: auth.userId, permissions: JSON.stringify(DEFAULT_MANAGER_PERMISSIONS) },
      update: { permissions: JSON.stringify(DEFAULT_MANAGER_PERMISSIONS) },
    });

    await tx.managerOffer.update({ where: { id }, data: { state: "ACCEPTED" } });
    return contract;
  }).catch((e) => {
    if (String(e).includes("OFFER_TAKEN")) return null;
    throw e;
  });

  if (!result) return fail("OFFER_NOT_OPEN", "Offer was just taken or withdrawn", 409);

  await audit("MANAGER_HIRED", auth.userId, {
    contractId: result.id, offerId: id, clubId: offer.clubId,
    totalAmount: offer.totalAmount, durationDays: offer.durationDays, dailySalary: offer.dailySalary,
    startDay, endDay,
  });
  return ok({
    contract: {
      id: result.id, clubId: offer.clubId, totalAmount: offer.totalAmount,
      durationDays: offer.durationDays, dailySalary: offer.dailySalary, startDay, endDay, state: "ACTIVE",
    },
  });
}
