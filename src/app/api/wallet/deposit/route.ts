// Knight FM — Deposit $Knight via verified Solana transfer (spec §24, invariant #11).
// HONESTY: ≥10 server-side on-chain validation checks must all pass before any credit;
// without a configured RPC the endpoint answers 503 DEPOSIT_UNAVAILABLE and fakes nothing.

import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, rateLimit, readJson } from "@/lib/api";
import { creditPersonal } from "@/lib/engine/finance";
import { getSolanaConfig, verifyDepositTransaction } from "@/lib/solana/solana-verify";

// POLICY (user decision): deposits / investments into the platform are LEVY-FREE.
// Only withdrawals (economy.withdrawalLevyPct) and platform incomes
// (economy.userFundsLevyPct) are taxed.

const Body = z.object({ signature: z.string().min(64).max(88) });

// States used on DepositRequest: PENDING → CREDITED | REJECTED (task-mandated vocabulary;
// the schema comment predates this decision — documented in worklog).

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const rl = rateLimit(`dep:${auth.userId}`, 10, 10 * 60_000);
  if (!rl.allowed) return fail("RATE_LIMITED", `Too many deposit attempts. Retry in ${rl.retryAfterSec}s`, 429);

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "signature (base58, 64–88 chars) is required", 400);
  const { signature } = parsed.data;

  const cfg = await getSolanaConfig();
  if (!cfg) {
    return fail("DEPOSIT_UNAVAILABLE", "Deposit infrastructure is not configured (RPC, mint or system wallet missing). Nothing was verified or credited.", 503);
  }

  // Anti-replay: a signature belongs to whoever submitted it first.
  const anyHolder = await db.depositRequest.findFirst({ where: { signature }, select: { userId: true, state: true, id: true } });
  if (anyHolder && anyHolder.userId !== auth.userId) {
    return fail("DUPLICATE_DEPOSIT", "This deposit signature was already submitted by another account", 409);
  }

  let request = anyHolder;
  if (!request) {
    try {
      request = await db.depositRequest.create({ data: { userId: auth.userId, signature, state: "PENDING" } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return fail("DUPLICATE_DEPOSIT", "Deposit signature already submitted", 409);
      }
      throw e;
    }
  } else if (request.state === "CREDITED") {
    return fail("DUPLICATE_DEPOSIT", "This deposit was already credited", 409);
  }

  const alreadyCredited = await db.depositRequest.findFirst({ where: { signature, state: "CREDITED" }, select: { id: true } }) !== null;

  const verification = await verifyDepositTransaction(cfg, signature, alreadyCredited);

  await db.depositRequest
    .update({ where: { id: request.id }, data: { checksJson: JSON.stringify(verification.checks) } })
    .catch(() => undefined);

  if (!verification.ok) {
    // Transient/not-yet-finalized → honest PENDING (user may retry the same signature).
    const transient = verification.failureReason === "TX_NOT_FOUND" || verification.failureReason?.startsWith("RPC_UNREACHABLE") || verification.failureReason === "FINALIZED";
    if (transient) {
      await db.depositRequest.update({ where: { id: request.id }, data: { state: "PENDING" } }).catch(() => undefined);
      return ok({ status: "PENDING", gross: 0, levy: 0, net: 0, note: "up to 1 hour", reason: verification.failureReason, checks: verification.checks });
    }
    await db.depositRequest.update({ where: { id: request.id }, data: { state: "REJECTED" } }).catch(() => undefined);
    await audit("DEPOSIT_REJECTED", auth.userId, { signature: `${signature.slice(0, 8)}…`, reason: verification.failureReason });
    return fail("DEPOSIT_REJECTED", `Deposit failed verification: ${verification.failureReason}. Nothing was credited.`, 400, { reason: verification.failureReason, checks: verification.checks });
  }

  const gross = verification.amount as number;
  // Deposits are investments: no levy applies (the full gross is credited).
  const levy = 0;
  const net = gross;
  const idem = `DEP:${signature}`;

  await db.$transaction(async (tx) => {
    await creditPersonal(tx, auth.userId, net, "DEPOSIT", idem, `Deposit ${signature.slice(0, 12)}…`, { gross, levy, net });
    await tx.depositRequest.update({
      where: { id: request!.id },
      data: { state: "CREDITED", creditedGross: gross, creditedLevy: levy, creditedNet: net, checksJson: JSON.stringify(verification.checks) },
    });
    await tx.blockchainTransaction.create({
      data: { refType: "DEPOSIT", refId: request!.id, signature, status: "CREDITED" },
    });
  });

  await audit("DEPOSIT_CREDITED", auth.userId, { gross, levy, net, signature: `${signature.slice(0, 8)}…` });
  return ok({ status: "CREDITED", gross, levy, net, note: "up to 1 hour" });
}
