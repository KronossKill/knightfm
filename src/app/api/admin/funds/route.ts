// Knight FM — POST /api/admin/funds (ADMIN only).
// Credits funds to a specific user from the Control Center:
//   target PERSONAL → personal wallet (levy-free; an admin grant is neither an
//   investment nor a platform income, it is an explicit admin operation).
//   target CLUB     → operating fund of a club the user OWNS or MANAGES.
// Every grant moves through the same audited ledger primitives
// (creditPersonal / creditClub, idem key ADMIN-FUND:<uuid>) and is audited as
// ADMIN_FUNDS with before/after balances. Amount must be positive — the admin
// grants money, it never silently takes it (use normal game flows for debits).

import { NextRequest } from "next/server";
import { z } from "zod";
import { audit, clientIp, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { creditClub, creditPersonal, FinanceError } from "@/lib/engine/finance";

export const runtime = "nodejs";

const fundsSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(254),
  amount: z.number().int().min(1, "amount must be at least 1").max(10_000_000),
  target: z.enum(["PERSONAL", "CLUB"]),
  clubId: z.string().min(1).max(64).optional(),
  memo: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const parsed = fundsSchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const { email, amount, target, clubId, memo } = parsed.data;

  const user = await db.user.findFirst({
    where: { email: { contains: email } },
    select: { id: true, email: true, username: true, role: true },
  });
  const exact = user && user.email.toLowerCase() === email ? user : null;
  if (!exact) return fail("USER_NOT_FOUND", "No account matches that email", 404);

  if (target === "CLUB" && !clubId) {
    return fail("CLUB_REQUIRED", "clubId is required for CLUB target", 400);
  }

  try {
    const result = await db.$transaction(async (tx) => {
      if (target === "PERSONAL") {
        const before = (await tx.personalWallet.findUnique({ where: { userId: exact.id } }))?.balance ?? 0;
        await creditPersonal(
          tx,
          exact.id,
          amount,
          "ADMIN_GRANT",
          `ADMIN-FUND:${crypto.randomUUID()}`,
          memo || "Concesión administrativa de fondos"
        );
        const after = (await tx.personalWallet.findUnique({ where: { userId: exact.id } }))?.balance ?? 0;
        return { walletBalance: after, clubFund: null as number | null, before, club: null as { id: string; name: string } | null };
      }

      if (!clubId) throw Object.assign(new Error("clubId required"), { code: "CLUB_REQUIRED" });
      const club = await tx.club.findUnique({
        where: { id: clubId },
        select: { id: true, name: true, ownerId: true, managerId: true, operatingFund: true },
      });
      if (!club) throw Object.assign(new Error("Club not found"), { code: "CLUB_NOT_FOUND" });
      if (club.ownerId !== exact.id && club.managerId !== exact.id) {
        throw Object.assign(new Error("User neither owns nor manages that club"), { code: "CLUB_NOT_LINKED" });
      }
      const before = club.operatingFund;
      await creditClub(
        tx,
        club.id,
        amount,
        "ADMIN_GRANT",
        `ADMIN-FUND:${crypto.randomUUID()}`,
        memo || "Concesión administrativa de fondos"
      );
      const after = (await tx.club.findUnique({ where: { id: club.id }, select: { operatingFund: true } }))?.operatingFund ?? before;
      return { walletBalance: null as number | null, clubFund: after, before, club: { id: club.id, name: club.name } };
    });

    await audit("ADMIN_FUNDS", auth.userId, {
      targetEmail: exact.email,
      targetUserId: exact.id,
      amount,
      target,
      clubId: result.club?.id ?? null,
      balanceBefore: result.before,
      balanceAfter: result.clubFund ?? result.walletBalance,
      memo: memo ?? null,
      ip: clientIp(req),
    });

    return ok({
      email: exact.email,
      username: exact.username,
      amount,
      target,
      club: result.club,
      walletBalance: result.walletBalance,
      clubFund: result.clubFund,
    });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "CLUB_REQUIRED") return fail("CLUB_REQUIRED", "clubId is required for CLUB target", 400);
    if (code === "CLUB_NOT_FOUND") return fail("CLUB_NOT_FOUND", "Club not found", 404);
    if (code === "CLUB_NOT_LINKED") return fail("CLUB_NOT_LINKED", "User neither owns nor manages that club", 409);
    if (e instanceof FinanceError) return fail("FUNDS_ERROR", e.message, 409);
    throw e;
  }
}
