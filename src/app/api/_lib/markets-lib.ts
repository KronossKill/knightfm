// Knight FM — Markets shared library (Task 3-b).
// Auction lazy-close, atomic player transfers, ownership/capacity checks.
// All money integer $Knight. All finance via engine/finance (idempotent ledger).
// Task 78 consolidation: the transfer core and the auction closer now live in
// engine/auctions.ts (single source of truth — the scheduler tick uses the SAME
// implementations); this module re-exports them for the market endpoints.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { fail } from "@/lib/api";
import { FinanceError } from "@/lib/engine/finance";
import { computeCapacity } from "@/lib/engine/capacity";
import { FACILITY_TYPES } from "@/lib/types";

// Single settlement path (engine) — re-exported so every existing import from
// "markets-lib" keeps working unchanged.
export { closeDueAuctions, executePlayerTransfer } from "@/lib/engine/auctions";
export type { TransferOpts, AuctionCloseResult } from "@/lib/engine/auctions";

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

// ─── FinanceError → HTTP mapping (402 insufficient / 403 frozen·capacity / 409 conflicts) ──

export function financeErrorResponse(e: unknown): NextResponse | null {
  if (!(e instanceof FinanceError)) return null;
  if (e.code === "INSUFFICIENT_CLUB_FUNDS" || e.code === "INSUFFICIENT_PERSONAL_FUNDS") {
    return fail("INSUFFICIENT_FUNDS", e.message, 402);
  }
  // Task 78 (user mandate): frozen system clubs cannot move money.
  if (e.code === "CLUB_FROZEN") {
    return fail("CLUB_FROZEN", e.message, 403);
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
