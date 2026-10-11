// Knight FM — auction settlement + squad-capacity (single source of truth).
// Task 78 consolidation: this engine module now hosts the ONLY implementations
// of the atomic transfer core and the lazy auction closer; src/app/api/_lib/
// markets-lib.ts re-exports them for the market endpoints, and the scheduler
// tick calls closeDueAuctions() from here (the old legacy scheduler closer that
// credited sellers and "refunded" losing bids without ever debiting the winner
// — money from nothing — is gone for good).
// All money integer $Knight. All finance via engine/finance (idempotent ledger).

import { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { currentGameDay } from "@/lib/engine/clock";
import {
  creditClub, creditFund, debitClub, allocateRevenue, FinanceError, clubEconomyIsFrozen,
} from "@/lib/engine/finance";
import { computeCapacity } from "@/lib/engine/capacity";
import { FACILITY_TYPES } from "@/lib/types";

type DbClient = Prisma.TransactionClient | PrismaClient;

// ─── Squad capacity (invariant #9 — computed server-side) ─────────

export async function squadCount(clubId: string, client: DbClient = db): Promise<number> {
  return client.player.count({ where: { clubId, retired: false } });
}

export async function capacityForClub(clubId: string, client: DbClient = db): Promise<{ capacity: number; current: number }> {
  const club = await client.club.findUnique({ where: { id: clubId }, select: { baseCapacity: true } });
  if (!club) throw new FinanceError("CLUB_NOT_FOUND", "Club not found");
  const facilities = await client.facility.findMany({ where: { clubId }, select: { type: true, level: true } });
  const levels = Object.fromEntries(FACILITY_TYPES.map((t) => [t, 0])) as Record<string, string | number>;
  for (const f of facilities) levels[f.type] = f.level;
  const [training, medical, youth, science, maxLevel, maxBonus] = await Promise.all([
    getInt("squad.icpTrainingWeight", 30),
    getInt("squad.icpMedicalWeight", 25),
    getInt("squad.icpYouthWeight", 25),
    getInt("squad.icpScienceWeight", 20),
    getInt("facilities.maxLevel", 10),
    getInt("squad.maxBonusSlots", 20),
  ]);
  const { capacity } = computeCapacity({
    baseCapacity: club.baseCapacity,
    maxBonusSlots: maxBonus,
    levels: levels as Parameters<typeof computeCapacity>[0]["levels"],
    weights: { training, medical, youth, science },
    maxLevel,
  });
  const current = await client.player.count({ where: { clubId, retired: false } });
  return { capacity, current };
}

/**
 * Throws FinanceError("CAPACITY_FULL") if the receiving club has no free squad slot.
 * AUDIT MKT-4: pass the TRANSACTION client when called inside db.$transaction —
 * the pre-transaction check was a TOCTOU (two concurrent signings passed the same
 * 1-free-slot check). Inside the tx, SQLite's serialized writers close the race.
 */
export async function assertCapacity(clubId: string, client?: DbClient): Promise<void> {
  const { capacity, current } = await capacityForClub(clubId, client);
  if (current >= capacity) {
    throw new FinanceError("CAPACITY_FULL", `Squad capacity reached (${current}/${capacity})`);
  }
}

// ─── Atomic player transfer core ───────────────────────────────────

export interface TransferOpts {
  player: { id: string; clubId: string | null };
  toClubId: string;
  amount: number;
  fee?: number;
  type: "DIRECT" | "AUCTION" | "FREE_AGENT" | "RELEASE_CLAUSE";
  idemBase: string; // unique per economic operation
  /** Explicit ledger idem keys (spec-mandated, e.g. TXBUY:<listingId>). Defaults derive from idemBase. */
  buyKey?: string;
  sellKey?: string;
  allocBase?: string;
  memo: string;
  seasonId: string;
  day: number;
}

/**
 * Execute an atomic player transfer inside a transaction:
 * buyer debit → seller credit (SYSTEM fund if system-owned) → 5%+5% revenue allocation →
 * TransferRecord → player reassignment. Idempotent via deterministic ledger keys.
 */
export async function executePlayerTransfer(
  tx: Prisma.TransactionClient,
  opts: TransferOpts
): Promise<void> {
  const sellerClubId = opts.player.clubId;
  // SECURITY (pentest fix — money printer): a transfer whose seller equals the
  // buyer skipped the debit but STILL credited the seller, minting `amount`
  // out of thin air (live-verified attack path via auction self-bids).
  // Self-transfers are now impossible.
  if (sellerClubId === opts.toClubId) {
    throw new FinanceError("SELF_TRANSFER", "A player cannot be transferred to the selling club");
  }
  if (sellerClubId !== null) {
    await debitClub(tx, opts.toClubId, opts.amount, "PURCHASE", opts.buyKey ?? `${opts.idemBase}:BUY`, `${opts.memo} (purchase)`);
  }

  if (sellerClubId) {
    const seller = await tx.club.findUnique({ where: { id: sellerClubId }, select: { regionId: true, systemOwned: true } });
    if (seller) {
      if (seller.systemOwned) {
        // System-club proceeds flow to the SYSTEM fund, never enrich the virtual club (documented decision).
        await creditFund(tx, "SYSTEM", opts.amount, opts.sellKey ?? `${opts.idemBase}:SELL`, "TRANSFER_IN", `${opts.memo} (system club sale)`);
      } else {
        await creditClub(tx, sellerClubId, opts.amount, "PLAYER_SALE", opts.sellKey ?? `${opts.idemBase}:SELL`, `${opts.memo} (sale)`); // Task 25-b: taxable club income (was TRANSFER_IN)
        if (opts.amount > 0 && sellerClubId !== opts.toClubId) {
          await allocateRevenue(tx, {
            clubId: sellerClubId, regionId: seller.regionId, gross: opts.amount,
            idemBase: opts.allocBase ?? `${opts.idemBase}:ALLOC`, memo: opts.memo,
          });
        }
      }
    }
  }

  await tx.transferRecord.create({
    data: {
      playerId: opts.player.id,
      clubFromId: sellerClubId,
      clubToId: opts.toClubId,
      amount: opts.amount,
      fee: opts.fee ?? 0,
      levy: 0,
      type: opts.type,
      seasonId: opts.seasonId,
      day: opts.day,
    },
  });

  // SECURITY (pentest fix — stale-player race): the reassignment is CONDITIONAL
  // on the player still being at the seller club. If a concurrent transaction
  // already moved him, count===0 and the whole transfer rolls back — the buyer
  // can never pay for a player who left, and the old seller can never be
  // credited twice for the same departure.
  const moved = await tx.player.updateMany({
    where: { id: opts.player.id, clubId: sellerClubId, retired: false },
    data: { clubId: opts.toClubId, isFreeAgent: false, loanedUntilDay: null, loanOriginClubId: null },
  });
  if (moved.count === 0) {
    throw new FinanceError("PLAYER_MOVED", "Player changed club concurrently; transfer aborted");
  }
}

// ─── Auction lazy close (spec §25, decision in worklog) ────────────

export interface AuctionCloseResult { closed: number; sold: number; expired: number; skipped: number }

/**
 * Lazy-close every AUCTION listing past expiry. Called opportunistically from
 * the market endpoints (via markets-lib re-export) AND by the scheduler tick —
 * ONE settlement path.
 * Settlement honesty: bids are NOT escrowed at bid time (documented decision) — at
 * settlement the closing handler walks bids from highest to lowest and completes the
 * transfer with the first bidder whose club can actually cover the amount; insolvent,
 * capacity-blocked, self-dealing or FROZEN bidders are skipped (bid marked refunded,
 * club never charged).
 * AUDIT AU-1: only bids submitted BEFORE the listing expiry participate — a bid
 * accepted in the [expiry, settlement] race window can no longer win the auction.
 */
export async function closeDueAuctions(): Promise<AuctionCloseResult> {
  const now = new Date();
  const expired = await db.listing.findMany({
    where: { type: "AUCTION", state: "OPEN", expiresAt: { lte: now } },
    orderBy: { expiresAt: "asc" },
    take: 50,
  });
  const result: AuctionCloseResult = { closed: 0, sold: 0, expired: 0, skipped: 0 };

  for (const listing of expired) {
    // Claim the listing exclusively (idempotent guard): only the closer that flips OPEN→SETTLING proceeds.
    const claimed = await db.listing.updateMany({ where: { id: listing.id, state: "OPEN" }, data: { state: "SETTLING" } });
    if (claimed.count === 0) continue;
    try {
      const player = listing.playerId ? await db.player.findUnique({ where: { id: listing.playerId } }) : null;
      if (!player || !player.clubId) {
        // Player gone or no longer attached to a club → nothing to settle.
        await db.listing.update({ where: { id: listing.id }, data: { state: "CANCELLED" } });
        result.closed++; result.skipped++;
        continue;
      }
      const bids = await db.bid.findMany({
        where: { auctionId: listing.id, createdAt: { lte: listing.expiresAt ?? new Date(0) } }, // AU-1: no post-expiry sniping
        orderBy: [{ amount: "desc" }, { createdAt: "asc" }],
      });

      const day = await currentGameDay();
      const seasons = await db.season.findMany({ orderBy: { number: "desc" }, take: 1 });
      const seasonId = seasons[0]?.id ?? "season-0";

      let settled = false;
      for (const bid of bids) {
        // SECURITY (pentest fix — money printer): bids from the player's own
        // club must never settle. executePlayerTransfer now throws on
        // self-transfers, so refund these proactively instead of failing the
        // whole close (which would leave the auction stuck in SETTLING).
        if (player.clubId && bid.clubId === player.clubId) {
          await db.bid.update({ where: { id: bid.id }, data: { refunded: true } });
          result.skipped++;
          continue;
        }
        // Task 78 (user mandate): a FROZEN system club (no owner, no manager)
        // can never win an auction — its economy is immobile. No money ever
        // moved (bids are not escrowed), so marking the bid refunded is honest.
        const bidderCtl = await db.club.findUnique({ where: { id: bid.clubId }, select: { operatingFund: true, ownerId: true, managerId: true } });
        if (!bidderCtl) { await db.bid.update({ where: { id: bid.id }, data: { refunded: true } }); continue; }
        if (clubEconomyIsFrozen(bidderCtl)) {
          await db.bid.update({ where: { id: bid.id }, data: { refunded: true } });
          await db.auditEvent.create({
            data: {
              type: "AUCTION_BID_SKIPPED", actorId: null,
              payload: JSON.stringify({ listingId: listing.id, bidId: bid.id, clubId: bid.clubId, amount: bid.amount, reason: "CLUB_FROZEN" }),
            },
          }).catch(() => undefined);
          result.skipped++;
          continue;
        }
        const { capacity, current } = await capacityForClub(bid.clubId);
        const insolvent = bidderCtl.operatingFund < bid.amount;
        const full = current >= capacity;
        if (insolvent || full) {
          // Honest settlement: skip bidder who cannot pay or cannot register the player.
          await db.bid.update({ where: { id: bid.id }, data: { refunded: true } });
          await db.auditEvent.create({
            data: {
              type: "AUCTION_BID_SKIPPED", actorId: null,
              payload: JSON.stringify({ listingId: listing.id, bidId: bid.id, clubId: bid.clubId, amount: bid.amount, reason: insolvent ? "INSUFFICIENT_FUNDS" : "CAPACITY_FULL" }),
            },
          });
          result.skipped++;
          continue;
        }
        await db.$transaction(async (tx) => {
          await executePlayerTransfer(tx, {
            player: { id: player.id, clubId: player.clubId },
            toClubId: bid.clubId,
            amount: bid.amount,
            type: "AUCTION",
            idemBase: `AUCTION:${listing.id}`,
            memo: `Auction settlement ${listing.id}`,
            seasonId,
            day,
          });
          await tx.listing.update({ where: { id: listing.id }, data: { state: "SOLD", buyerId: bid.clubId, price: bid.amount } });
          await tx.bid.update({ where: { id: bid.id }, data: { refunded: false } });
        });
        await db.bid.updateMany({ where: { auctionId: listing.id, id: { not: bid.id }, refunded: false }, data: { refunded: true } });
        await db.auditEvent.create({
          data: {
            type: "AUCTION_SETTLED", actorId: null,
            payload: JSON.stringify({ listingId: listing.id, playerId: player.id, buyerClubId: bid.clubId, amount: bid.amount }),
          },
        });
        settled = true;
        result.sold++;
        break;
      }
      if (!settled) {
        await db.listing.update({ where: { id: listing.id }, data: { state: "EXPIRED" } });
        result.expired++;
      }
      result.closed++;
    } catch (e) {
      // Roll the claim back so a transient failure can be retried by the next tick.
      await db.listing.updateMany({ where: { id: listing.id, state: "SETTLING" }, data: { state: "OPEN" } }).catch(() => undefined);
      await db.auditEvent.create({
        data: { type: "AUCTION_CLOSE_FAILED", actorId: null, payload: JSON.stringify({ listingId: listing.id, error: String(e) }) },
      }).catch(() => undefined);
    }
  }
  return result;
}
