// Knight FM — Markets shared library (Task 3-b).
// Auction lazy-close, atomic player transfers, ownership/capacity checks.
// All money integer $Knight. All finance via engine/finance (idempotent ledger).

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { fail } from "@/lib/api";
import { currentGameDay } from "@/lib/engine/clock";
import {
  creditClub, creditFund, debitClub, allocateRevenue, FinanceError,
} from "@/lib/engine/finance";
import { computeCapacity } from "@/lib/engine/capacity";
import { FACILITY_TYPES } from "@/lib/types";

// ─── Ownership helpers ─────────────────────────────────────────────

export async function ownedClubsOf(userId: string) {
  return db.club.findMany({ where: { ownerId: userId }, select: { id: true, name: true, regionId: true, operatingFund: true } });
}

export async function isClubOwner(userId: string, clubId: string): Promise<boolean> {
  const club = await db.club.findUnique({ where: { id: clubId }, select: { ownerId: true } });
  return !!club && club.ownerId === userId;
}

/** Resolve the acting club for a user: the single owned club, or the one named in the payload. */
export async function resolveActingClub(userId: string, clubId?: string | null): Promise<{ id: string; regionId: string; name: string } | null> {
  const clubs = await ownedClubsOf(userId);
  if (clubs.length === 0) return null;
  if (clubId) {
    const found = clubs.find((c) => c.id === clubId);
    return found ?? null;
  }
  return clubs.length === 1 ? clubs[0] : null; // ambiguous when multiple → caller asks for clubId
}

// ─── Squad capacity (invariant #9 — computed server-side) ─────────

export async function squadCount(clubId: string): Promise<number> {
  return db.player.count({ where: { clubId, retired: false } });
}

export async function capacityForClub(clubId: string): Promise<{ capacity: number; current: number }> {
  const club = await db.club.findUnique({ where: { id: clubId }, select: { baseCapacity: true } });
  if (!club) throw new FinanceError("CLUB_NOT_FOUND", "Club not found");
  const facilities = await db.facility.findMany({ where: { clubId }, select: { type: true, level: true } });
  const levels = Object.fromEntries(FACILITY_TYPES.map((t) => [t, 0])) as Record<string, number>;
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
  const current = await squadCount(clubId);
  return { capacity, current };
}

/** Throws FinanceError("CAPACITY_FULL") if the receiving club has no free squad slot. */
export async function assertCapacity(clubId: string): Promise<void> {
  const { capacity, current } = await capacityForClub(clubId);
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

// ─── FinanceError → HTTP mapping (402 insufficient / 403 capacity / 409 conflicts) ──

export function financeErrorResponse(e: unknown): NextResponse | null {
  if (!(e instanceof FinanceError)) return null;
  if (e.code === "INSUFFICIENT_CLUB_FUNDS" || e.code === "INSUFFICIENT_PERSONAL_FUNDS") {
    return fail("INSUFFICIENT_FUNDS", e.message, 402);
  }
  if (e.code === "CAPACITY_FULL") {
    return fail("CAPACITY_FULL", e.message, 403);
  }
  if (e.code === "CLUB_NOT_FOUND") {
    return fail("CLUB_NOT_FOUND", e.message, 404);
  }
  return fail("FINANCE_ERROR", e.message, 409);
}

export function parsePage(url: URL, defaultSize = 20): { page: number; size: number; skip: number } {
  const raw = parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return { page, size: defaultSize, skip: (page - 1) * defaultSize };
}

// ─── Auction lazy close (spec §25, decision in worklog) ────────────

export interface AuctionCloseResult { closed: number; sold: number; expired: number; skipped: number }

/**
 * Lazy-close every AUCTION listing past expiry. Called opportunistically from
 * market read/write endpoints AND by /api/scheduler/tick.
 * Settlement honesty: bids are NOT escrowed at bid time (documented decision) — at
 * settlement the closing handler walks bids from highest to lowest and completes the
 * transfer with the first bidder whose club can actually cover the amount; insolvent
 * or capacity-blocked bidders are skipped (bid marked refunded, club never charged).
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
      const bids = await db.bid.findMany({ where: { auctionId: listing.id }, orderBy: [{ amount: "desc" }, { createdAt: "asc" }] });

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
        const bidderClub = await db.club.findUnique({ where: { id: bid.clubId }, select: { operatingFund: true } });
        if (!bidderClub) { await db.bid.update({ where: { id: bid.id }, data: { refunded: true } }); continue; }
        const { capacity, current } = await capacityForClub(bid.clubId);
        const insolvent = bidderClub.operatingFund < bid.amount;
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

// ─── Player projection ─────────────────────────────────────────────

export function playerCard(p: {
  id: string; firstName: string; lastName: string; position: string; ovr: number; stars: number; age: number; marketValue: number;
}) {
  return { id: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position, ovr: p.ovr, stars: p.stars, age: p.age, marketValue: p.marketValue };
}

/** Cancel any open listings for a player that is no longer at the listing club. */
export async function cancelStaleListings(playerId: string, currentClubId: string | null): Promise<void> {
  const open = await db.listing.findMany({ where: { playerId, state: "OPEN", type: { in: ["DIRECT", "AUCTION"] } } });
  for (const l of open) {
    if (l.clubId !== currentClubId) {
      await db.listing.update({ where: { id: l.id }, data: { state: "CANCELLED" } });
    }
  }
}
