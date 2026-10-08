// Knight FM — Task 27 one-time backfill: player VALUE = system calculation × 3.
// - Multiplies stored marketValue ×3 (the pre-multiplier values) and
//   releaseClause ×3 (keeps the clause/value ratio equal to the configured
//   multiplier). SALARIES ARE LEFT UNTOUCHED — they derive from the base value
//   so wage bills remain sustainable.
// - Cancels OPEN market listings (DIRECT / AUCTION / LOAN) because their
//   prices/floors were computed from the old (un-multiplied) values.
// Idempotent: guarded by a SystemState marker (backfill.task27.valueMultiplier).
//
// Usage: bun scripts/task27-backfill.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const GUARD_KEY = "backfill.task27.valueMultiplier";

async function main() {
  const marker = await prisma.systemState.findUnique({ where: { key: GUARD_KEY } });
  if (marker) {
    console.log(`[task27-backfill] already applied (${marker.value}) — nothing to do.`);
    return;
  }

  const players = await prisma.player.findMany({ select: { id: true, marketValue: true, releaseClause: true, salary: true } });
  let updatedPlayers = 0;
  for (const p of players) {
    const newMV = p.marketValue * 3;
    const newClause = p.releaseClause * 3;
    if (newMV === p.marketValue && newClause === p.releaseClause) continue;
    await prisma.player.update({
      where: { id: p.id },
      data: { marketValue: newMV, releaseClause: newClause },
    });
    updatedPlayers++;
  }

  const openListings = await prisma.listing.updateMany({
    where: { state: "OPEN", type: { in: ["DIRECT", "AUCTION", "LOAN"] } },
    data: { state: "CANCELLED" },
  });

  await prisma.systemState.create({
    data: { key: GUARD_KEY, value: `players=${updatedPlayers};listingsCancelled=${openListings.count};at=${new Date().toISOString()}` },
  });

  console.log(`[task27-backfill] players revalued ×3: ${updatedPlayers}/${players.length}`);
  console.log(`[task27-backfill] open listings cancelled: ${openListings.count}`);
  console.log(`[task27-backfill] salaries untouched (base-value derived) ✓`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
