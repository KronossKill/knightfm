// Knight FM — Treasury withdraw: owner moves CLUB funds into their PERSONAL wallet.
// Blocked while the owner has ANY club in debt or this club carries debt (invariant #21).
// User mandate (Task 23-b): the withdrawal carries a TAX (gravamen, default 10%,
// configurable via economy.clubWithdrawTaxPct in the Control Center). The club is
// debited the GROSS amount, the owner's wallet receives the NET, and the tax goes
// to the SYSTEM fund (audited, reconciled ledger entries).

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, clientIp, readJson } from "@/lib/api";
import { verifyCaptcha } from "@/lib/auth";
import { currentGameDay } from "@/lib/engine/clock";
import { debitClub, creditPersonal, creditFund, ownerHasDebt, FinanceError } from "@/lib/engine/finance";
import { getInt } from "@/lib/config";
import { isClubOwner, financeErrorResponse } from "../../_lib/markets-lib";
import { CaptchaSchema } from "../../auth/_shared";

const Body = z.object({
  clubId: z.string().min(10).max(64),
  amount: z.number().int().positive(),
  // Optional so a missing token reaches verifyCaptcha and yields 402 CAPTCHA_INVALID.
  captchaToken: CaptchaSchema.optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "clubId and integer amount > 0 are required", 400);
  const { clubId, amount, captchaToken } = parsed.data;

  // Anti-bot gate (same provider as auth flows, D-004), before any ledger mutation.
  const captcha = await verifyCaptcha(captchaToken, clientIp(req));
  if (!captcha.ok) {
    await audit("TREASURY_WITHDRAW_CAPTCHA_FAILED", auth.userId, { reason: captcha.reason, provider: captcha.provider });
    return fail("CAPTCHA_INVALID", "Captcha verification failed", 402);
  }

  if (!(await isClubOwner(auth.userId, clubId))) {
    return fail("NOT_CLUB_OWNER", "Only the club owner can withdraw club funds", 403);
  }

  // Invariant #21: withdrawals blocked while any owned club (or this club) is in debt.
  const club = await db.club.findUnique({ where: { id: clubId }, select: { debt: true } });
  if (!club) return fail("CLUB_NOT_FOUND", "Club not found", 404);
  if (club.debt > 0 || (await ownerHasDebt(auth.userId))) {
    return fail("DEBT_BLOCK", "Withdrawals are blocked while any of your clubs carries debt", 403);
  }

  // User mandate (Task 23-b): tax on club→owner withdrawals (default 10%).
  const taxPct = await getInt("economy.clubWithdrawTaxPct", 10);
  const gross = amount;
  const tax = Math.floor((gross * Math.max(0, Math.min(100, taxPct))) / 100);
  const net = gross - tax;

  const day = await currentGameDay();
  const idem = `TWDR:${auth.userId}:${clubId}:${day}`;

  try {
    const result = await db.$transaction(async (tx) => {
      await debitClub(tx, clubId, gross, "WITHDRAW", idem, `Owner withdrawal to personal wallet (tax ${taxPct}%)`);
      await creditPersonal(
        tx,
        auth.userId,
        net,
        "WITHDRAW",
        `${idem}:CREDIT`,
        `Withdrawal from club ${clubId}`,
        tax > 0 ? { gross, levy: tax, net } : undefined,
      );
      if (tax > 0) {
        await creditFund(tx, "SYSTEM", tax, `${idem}:TAX`, "LEVY", `Owner-withdrawal tax (${taxPct}%) from club ${clubId}`);
      }
      const fresh = await tx.club.findUnique({ where: { id: clubId }, select: { operatingFund: true } });
      return fresh?.operatingFund ?? null;
    });

    await audit("TREASURY_WITHDRAW", auth.userId, { clubId, gross, tax, net, taxPct, day });
    return ok({ clubId, gross, tax, net, taxPct, day, operatingFund: result });
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    if (e instanceof FinanceError && e.code === "INSUFFICIENT_CLUB_FUNDS") {
      return fail("INSUFFICIENT_FUNDS", e.message, 402);
    }
    throw e;
  }
}
