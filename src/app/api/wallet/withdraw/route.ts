// Knight FM — Personal wallet → Solana withdrawal request (spec §24, invariant #21).
// HONESTY: the sandbox holds NO signing key, so nothing is ever broadcast here.
// With RPC configured → NEEDS_SIGNING ("queued for manual signing infrastructure").
// Without any RPC → 503 WITHDRAWAL_UNAVAILABLE and the reservation is released.

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, rateLimit, readJson } from "@/lib/api";
import { getConfig, getInt } from "@/lib/config";
import { currentGameDay } from "@/lib/engine/clock";
import { debitPersonal, creditPersonal, ownerHasDebt, FinanceError } from "@/lib/engine/finance";
import { isValidSolanaAddress } from "@/lib/solana/solana-verify";
import { financeErrorResponse } from "../../_lib/markets-lib";

const Body = z.object({
  address: z.string().min(32).max(44),
  amount: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const rl = rateLimit(`wdr:${auth.userId}`, 10, 10 * 60_000);
  if (!rl.allowed) return fail("RATE_LIMITED", `Too many withdrawal attempts. Retry in ${rl.retryAfterSec}s`, 429);

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "address and integer amount are required", 400);
  const { address, amount } = parsed.data;

  // [1] Minimum withdrawal amount (config-driven with honest fallback).
  const minWithdraw = await getInt("solana.minWithdraw", 50);
  if (amount < minWithdraw) {
    return fail("BELOW_MIN_WITHDRAW", `Minimum withdrawal is ${minWithdraw} $Knight`, 400, { minWithdraw });
  }

  // [2] Cryptographic Solana address validation (base58 → exactly 32 bytes / ed25519 pubkey).
  if (!isValidSolanaAddress(address)) {
    return fail("INVALID_SOLANA_ADDRESS", "Destination is not a valid Solana public key", 400);
  }

  // [3] Invariant #21 — no withdrawals while any owned club carries debt.
  if (await ownerHasDebt(auth.userId)) {
    return fail("DEBT_BLOCK", "Withdrawals are blocked while any of your clubs carries debt", 403);
  }

  const day = await currentGameDay();
  const idem = `WDR:${auth.userId}:${day}`;
  const rpcConfigured = !!(await getConfig("solana.rpc.url"));

  try {
    // Reserve the funds immediately (deterministic daily key → one request per day per user).
    await db.$transaction(async (tx) => {
      await debitPersonal(tx, auth.userId, amount, "WITHDRAWAL_CRYPTO", idem, "Withdrawal reserve");
      const wr = await tx.withdrawalRequest.create({
        data: { userId: auth.userId, destWallet: address, amount, state: "RESERVED", idemKey: idem },
      });
      await tx.blockchainTransaction.create({
        data: { refType: "WITHDRAWAL", refId: wr.id, signature: "", status: "RESERVED" },
      });
    });
  } catch (e) {
    // SECURITY (pentest hardening): a parallel duplicate (same user/day) used to
    // surface as an unhandled Prisma P2002 → raw 500. Return a clean conflict.
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      return fail("WITHDRAWAL_ALREADY_REQUESTED", "A withdrawal was already requested today. One request per game day.", 409);
    }
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    if (e instanceof FinanceError && e.code === "INSUFFICIENT_PERSONAL_FUNDS") {
      return fail("INSUFFICIENT_FUNDS", e.message, 402);
    }
    throw e;
  }

  const wr = await db.withdrawalRequest.findUnique({ where: { idemKey: idem } });
  if (!wr) return fail("INTERNAL", "Withdrawal request missing after reserve", 500);

  if (!rpcConfigured) {
    // Honest failure: no RPC → cannot even verify/broadcast → release the reservation.
    await db.$transaction(async (tx) => {
      await creditPersonal(tx, auth.userId, amount, "WITHDRAWAL_CRYPTO", `${idem}:RELEASE`, "Withdrawal released — RPC not configured");
      await tx.withdrawalRequest.update({ where: { id: wr.id }, data: { state: "RELEASED" } });
      await tx.blockchainTransaction.create({
        data: { refType: "WITHDRAWAL", refId: wr.id, signature: "", status: "RELEASED" },
      });
    });
    await audit("WITHDRAWAL_REQUESTED", auth.userId, { withdrawalId: wr.id, amount, released: true, reason: "RPC_NOT_CONFIGURED" });
    return fail("WITHDRAWAL_UNAVAILABLE", "Withdrawal infrastructure is not configured. Your reservation was released and nothing was charged.", 503);
  }

  // RPC configured — broadcast is OUT OF SCOPE in this sandbox (no signing key available).
  // Withdrawal levy (user decision): the cash-out is taxed; deposits/investments are levy-free.
  // The levy is charged from the reserved amount at broadcast time; the net below is what
  // will actually reach the destination wallet.
  const levyPct = await getInt("economy.withdrawalLevyPct", 10);
  const levy = Math.floor((amount * levyPct) / 100);
  const net = amount - levy;

  await db.withdrawalRequest.update({ where: { id: wr.id }, data: { state: "NEEDS_SIGNING" } });
  await db.blockchainTransaction.create({
    data: { refType: "WITHDRAWAL", refId: wr.id, signature: "", status: "NEEDS_SIGNING" },
  });
  await audit("WITHDRAWAL_REQUESTED", auth.userId, { withdrawalId: wr.id, amount, levy, net, levyPct, destWallet: address, state: "NEEDS_SIGNING" });
  return ok({
    withdrawalId: wr.id,
    amount,
    levy,
    net,
    levyPct,
    status: "NEEDS_SIGNING",
    message: "queued for manual signing infrastructure",
  });
}
