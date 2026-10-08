// Task 28 — rewrite the kickoffs of FUTURE league/cup fixtures with the new
// regional stagger + deterministic per-fixture jitter, so the scheduler no
// longer simulates a whole matchday at the same instant. Idempotent:
//   - SystemState marker "task28.kickoffBackfill" (run once),
//   - per-fixture guard: only EXACT-HOUR kickoffs (UTC min==0 && sec==0) are
//     rewritten and only when the computed delta > 0 — already-shifted and
//     PLAYED fixtures are never touched.
// Run: bun scripts/task28-backfill.ts
// The seed keys are IDENTICAL to the ones used at fixture generation time
// (engine/fixtures.ts), so the result matches what future seasons will get.

import { PrismaClient } from "@prisma/client";

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const { invalidateConfig, getInt } = await import("../src/lib/config");
  const { regionKickoffOffsetMs, kickoffJitterMs } = await import("../src/lib/engine/fixtures");

  try {
    invalidateConfig();
    const marker = await prisma.systemState.findUnique({ where: { key: "task28.kickoffBackfill" } });
    if (marker) {
      console.log("Backfill already applied (task28.kickoffBackfill) — nothing to do.");
      return;
    }

    const stagger = Math.max(0, await getInt("competition.kickoffRegionStaggerMinutes", 90));
    const jitter = Math.max(0, await getInt("competition.kickoffMinuteJitter", 20));
    console.log(`Config: stagger=${stagger} min/region, jitter=${jitter} min/fixture`);

    // Regions ordered by index — RANK (position) is used, never the raw index.
    const regions = await prisma.region.findMany({ select: { id: true, index: true }, orderBy: { index: "asc" } });
    const rankById = new Map(regions.map((r, i) => [r.id, i]));
    console.log(`Regions ranked: ${regions.map((r) => r.index).join(",")}`);

    const now = new Date();
    const fixtures = await prisma.fixture.findMany({
      where: { status: "SCHEDULED", kickoffAt: { gt: now }, competition: { in: ["LEAGUE", "REGIONAL_CUP"] } },
      select: { id: true, competition: true, seasonId: true, round: true, kickoffAt: true, homeId: true, regionId: true, home: { select: { regionId: true } } },
      orderBy: { kickoffAt: "asc" },
    });
    console.log(`Future SCHEDULED league/cup fixtures: ${fixtures.length}`);

    let updated = 0;
    let skippedShifted = 0;
    let skippedZeroDelta = 0;
    const updates: { id: string; kickoffAt: Date }[] = [];
    for (const f of fixtures) {
      // Guard: only old-style exact-hour kickoffs are rewritten.
      if (f.kickoffAt.getUTCMinutes() !== 0 || f.kickoffAt.getUTCSeconds() !== 0) {
        skippedShifted++;
        continue;
      }
      const regionId = f.regionId ?? f.home.regionId;
      const offset = await regionKickoffOffsetMs(regionId ?? undefined);
      const jit = kickoffJitterMs(`${f.competition}:${f.seasonId}:R${f.round ?? 1}:${f.homeId}`, jitter);
      const delta = offset + jit;
      if (delta <= 0) {
        skippedZeroDelta++;
        continue;
      }
      updates.push({ id: f.id, kickoffAt: new Date(f.kickoffAt.getTime() + delta) });
    }

    const CHUNK = 250;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK);
      await prisma.$transaction(
        chunk.map((u) => prisma.fixture.update({ where: { id: u.id }, data: { kickoffAt: u.kickoffAt } }))
      );
      updated += chunk.length;
      if ((i / CHUNK) % 20 === 0) console.log(`  … ${updated}/${updates.length}`);
    }

    // Distribution preview over the next 3 matchdays.
    const preview = await prisma.fixture.findMany({
      where: { status: "SCHEDULED", competition: "LEAGUE", kickoffAt: { gt: new Date() } },
      select: { kickoffAt: true, matchDay: true },
      orderBy: { kickoffAt: "asc" },
      take: 2000,
    });
    const byDay = new Map<number, Set<string>>();
    for (const f of preview) {
      const key = f.kickoffAt.toISOString().slice(0, 16);
      const set = byDay.get(f.matchDay) ?? new Set<string>();
      set.add(key);
      byDay.set(f.matchDay, set);
    }
    for (const [day, slots] of [...byDay.entries()].sort((a, b) => a[0] - b[0]).slice(0, 3)) {
      const sorted = [...slots].sort();
      console.log(`Matchday ${day}: ${slots.size} distinct kickoff slots — first "${sorted[0]}", last "${sorted[sorted.length - 1]}"`);
    }

    await prisma.systemState.create({ data: { key: "task28.kickoffBackfill", value: new Date().toISOString() } });
    console.log(`DONE updated=${updated} skippedAlreadyShifted=${skippedShifted} skippedZeroDelta=${skippedZeroDelta}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
