// Knight FM — financial core (spec §20, §44).
// Integer-safe, atomic, idempotent, audited ledger operations.
// Club treasury and personal wallet are SEPARATE ledgers.

import { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";

export type Tx = Prisma.TransactionClient | PrismaClient;

export class FinanceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Apply the user-funds income levy (configurable, default 10%). Returns gross/levy/net/pct. */
export async function applyUserFundsLevy(gross: number): Promise<{ gross: number; levy: number; net: number; pct: number }> {
  const pct = Math.max(0, Math.min(100, await getInt("economy.userFundsLevyPct", 10)));
  const levy = Math.floor((gross * pct) / 100);
  return { gross, levy, net: gross - levy, pct };
}

/** Revenue allocations: 5% regional + 5% system (configurable) recorded as separate reconciled entries. */
export async function allocateRevenue(
  tx: Tx,
  opts: { clubId?: string; regionId: string; gross: number; idemBase: string; memo: string }
): Promise<void> {
  const regionalPct = await getInt("economy.revenueRegionalPct", 5);
  const systemPct = await getInt("economy.revenueSystemPct", 5);
  const regional = Math.floor((opts.gross * regionalPct) / 100);
  const system = Math.floor((opts.gross * systemPct) / 100);
  if (regional > 0) {
    await creditFund(tx, `REGION:${opts.regionId}`, regional, `${opts.idemBase}:REGION`, `ALLOCATION_REGIONAL`, `${opts.memo} (5% regional)`);
  }
  if (system > 0) {
    await creditFund(tx, `SYSTEM`, system, `${opts.idemBase}:SYSTEM`, `ALLOCATION_SYSTEM`, `${opts.memo} (5% system)`);
  }
}

async function ledgerExists(tx: Tx, idemKey: string): Promise<boolean> {
  const found = await tx.ledgerEntry.findUnique({ where: { idemKey } });
  return !!found;
}

// Task 25-b: club-income categories subject to the SYSTEM-fund gravamen
// (economy.clubIncomeTaxPct, default 10). INVEST (owner deposits), auction
// refunds (TRANSFER_IN) and admin grants are exempt — club income only.
const TAXABLE_INCOME = new Set(["PRIZE", "PLAYER_SALE", "MATCH_REVENUE", "LOAN_IN", "AUCTION_SALE"]);

export async function creditClub(
  tx: Tx, clubId: string, amount: number, category: string, idemKey: string, memo = "", meta: { gross?: number; levy?: number; net?: number } = {}
): Promise<boolean> {
  if (amount <= 0) return false;
  if (await ledgerExists(tx, idemKey)) return false;
  const club = await tx.club.findUnique({ where: { id: clubId }, select: { operatingFund: true } });
  if (!club) throw new FinanceError("CLUB_NOT_FOUND", "Club not found");

  // Task 25-b: gravamen on club income — the club receives the NET and the levy
  // goes to the SYSTEM fund INSIDE the same transaction, under the derived
  // idempotency key `${idemKey}:LEVY` (repeating the idemKey never duplicates
  // either entry; a pre-existing LEVY row is skipped by creditFund itself).
  let credited = amount;
  if (TAXABLE_INCOME.has(category)) {
    const rawPct = await getInt("economy.clubIncomeTaxPct", 10);
    const pct = Math.max(0, Math.min(100, rawPct));
    const levy = Math.floor((amount * pct) / 100);
    if (levy > 0) {
      credited = amount - levy; // may reach 0 (pct ≥ 100 edge); allowed
      await creditFund(tx, "SYSTEM", levy, `${idemKey}:LEVY`, "INCOME_LEVY", `Club income levy (${pct}%) on ${category}${memo ? ` — ${memo}` : ""}`);
      if (meta.gross === undefined && meta.levy === undefined && meta.net === undefined) {
        meta = { gross: amount, levy, net: credited };
      }
      memo = `${memo} (gravamen ${pct}% incluido)`.trim();
    }
  }

  const balanceAfter = club.operatingFund + credited;
  await tx.club.update({ where: { id: clubId }, data: { operatingFund: { increment: credited } } });
  await tx.ledgerEntry.create({
    data: {
      account: "CLUB", clubId, amount: credited, balanceAfter, category, idemKey, memo,
      grossAmount: meta.gross ?? null, levyAmount: meta.levy ?? null, netAmount: meta.net ?? null,
    },
  });
  return true;
}

export async function debitClub(
  tx: Tx, clubId: string, amount: number, category: string, idemKey: string, memo = "", opts: { allowNegative?: boolean } = {}
): Promise<boolean> {
  if (amount <= 0) return false;
  if (await ledgerExists(tx, idemKey)) return false;
  const club = await tx.club.findUnique({ where: { id: clubId }, select: { operatingFund: true } });
  if (!club) throw new FinanceError("CLUB_NOT_FOUND", "Club not found");
  if (!opts.allowNegative && club.operatingFund < amount) {
    throw new FinanceError("INSUFFICIENT_CLUB_FUNDS", `Insufficient club funds (need ${amount}, have ${club.operatingFund})`);
  }
  const newBalance = club.operatingFund - amount;
  await tx.club.update({ where: { id: clubId }, data: { operatingFund: newBalance } });
  await tx.ledgerEntry.create({ data: { account: "CLUB", clubId, amount: -amount, balanceAfter: newBalance, category, idemKey, memo } });
  return true;
}

export async function creditPersonal(
  tx: Tx, userId: string, amount: number, category: string, idemKey: string, memo = "", meta: { gross?: number; levy?: number; net?: number } = {}
): Promise<boolean> {
  if (amount <= 0) return false;
  if (await ledgerExists(tx, idemKey)) return false;
  let wallet = await tx.personalWallet.findUnique({ where: { userId } });
  if (!wallet) wallet = await tx.personalWallet.create({ data: { userId, balance: 0 } });
  const balanceAfter = wallet.balance + amount;
  await tx.personalWallet.update({ where: { userId }, data: { balance: balanceAfter } });
  await tx.ledgerEntry.create({
    data: {
      account: "PERSONAL", userId, amount, balanceAfter, category, idemKey, memo,
      grossAmount: meta.gross ?? null, levyAmount: meta.levy ?? null, netAmount: meta.net ?? null,
    },
  });
  return true;
}

export async function debitPersonal(
  tx: Tx, userId: string, amount: number, category: string, idemKey: string, memo = ""
): Promise<boolean> {
  if (amount <= 0) return false;
  if (await ledgerExists(tx, idemKey)) return false;
  const wallet = await tx.personalWallet.findUnique({ where: { userId } });
  const balance = wallet?.balance ?? 0;
  if (balance < amount) {
    throw new FinanceError("INSUFFICIENT_PERSONAL_FUNDS", `Insufficient personal funds (need ${amount}, have ${balance})`);
  }
  const balanceAfter = balance - amount;
  await tx.personalWallet.update({ where: { userId }, data: { balance: balanceAfter } });
  await tx.ledgerEntry.create({ data: { account: "PERSONAL", userId, amount: -amount, balanceAfter, category, idemKey, memo } });
  return true;
}

export async function creditFund(tx: Tx, scope: string, amount: number, idemKey: string, category: string, memo = ""): Promise<boolean> {
  if (amount <= 0) return false;
  if (await ledgerExists(tx, idemKey)) return false;
  const fund = await tx.fundBalance.upsert({ where: { scope }, create: { scope, balance: amount }, update: { balance: { increment: amount } } });
  await tx.ledgerEntry.create({ data: { account: scope.startsWith("REGION") ? "REGION_FUND" : "SYSTEM_FUND", amount, balanceAfter: fund.balance, category, idemKey, memo } });
  return true;
}

/** Personal platform withdrawal blocked while any owned club carries debt (spec §22). */
export async function ownerHasDebt(userId: string): Promise<boolean> {
  const clubs = await db.club.findMany({ where: { ownerId: userId, debt: { gt: 0 } }, select: { id: true } });
  return clubs.length > 0;
}
