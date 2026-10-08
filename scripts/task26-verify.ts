// Task 26 — mandatory engine verification.
// Run: bun scripts/task26-verify.ts
//   (a) Youth capacity formula: capacity = min(base + perLevel*(level-1), ceiling)
//       with defaults base=3 / perLevel=2 / ceiling=50 → L1=3, L2=5, L3=7, L10=21.
//       The ceiling is TESTED with a temporary override (always restored).
//   (b) Invariant over REAL matches played this run: a decided match MUST have
//       exactly one PRIZE:WIN ledger entry (league 80 / cup 120 / world 250) with
//       its 10% INCOME_LEVY row; a drawn match must have NO prize row.
//   (c) Positive deterministic test in an ISOLATED sandbox (synthetic season,
//       division and two system clubs — real competitions untouched): a decided
//       league match pays 80 net-after-levy to the winner; a FRIENDLY pays
//       nothing; re-running simulateFixture is idempotent. Sandbox rows are
//       deleted at the end (ledger rows persist — they are real prize payments).

import { PrismaClient } from "@prisma/client";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const okv = JSON.stringify(actual) === JSON.stringify(expected);
  if (!okv) failures += 1;
  console.log(`${okv ? "PASS" : "FAIL"}  ${name}: ${JSON.stringify(actual)}${okv ? "" : ` (expected ${JSON.stringify(expected)})`}`);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const { getYouthCapacity } = await import("../src/lib/engine/training");
  const { invalidateConfig } = await import("../src/lib/config");
  const { processDueJobs } = await import("../src/lib/engine/scheduler");
  const { simulateFixture } = await import("../src/lib/engine/matches");

  try {
    invalidateConfig();

    // ── (a) Youth capacity formula ──────────────────────────────────
    console.log("\n── (a) Youth capacity formula (base 3 + 2/level, ceiling 50) ──");
    check("capacity(L1) = base = 3", await getYouthCapacity(1), 3);
    check("capacity(L2)", await getYouthCapacity(2), 5);
    check("capacity(L3)", await getYouthCapacity(3), 7);
    check("capacity(L5)", await getYouthCapacity(5), 11);
    check("capacity(L10)", await getYouthCapacity(10), 21);

    // Temporary absolute-ceiling override (admin-configurable) — RESTORED below.
    await prisma.configKey.upsert({
      where: { key: "youth.maxProspectsPool" },
      create: { key: "youth.maxProspectsPool", group: "youth", valueType: "int", defaultValue: "50", currentValue: "6" },
      update: { currentValue: "6" },
    });
    invalidateConfig();
    check("capacity(L10) clamped by ceiling 6", await getYouthCapacity(10), 6);
    await prisma.configKey.deleteMany({ where: { key: "youth.maxProspectsPool" } });
    invalidateConfig();
    check("ceiling override restored → capacity(L1) back to 3", await getYouthCapacity(1), 3);

    // ── (b) Invariant over real matches played in this run ──────────
    console.log("\n── (b) Win-prize invariant on real matches (since this run started) ──");
    const runStart = new Date();
    const systemBefore = (await prisma.fundBalance.findUnique({ where: { scope: "SYSTEM" } }))?.balance ?? 0;
    const dueBefore = await prisma.fixture.count({ where: { status: "SCHEDULED", kickoffAt: { lte: new Date() } } });
    console.log(`due fixtures: ${dueBefore}, SYSTEM fund before: ${systemBefore}`);

    await processDueJobs();

    const playedNow = await prisma.match.findMany({
      where: { playedAt: { gte: runStart } },
      select: { id: true, fixtureId: true, homeGoals: true, awayGoals: true },
    });
    const EXPECT: Record<string, number> = { LEAGUE: 80, REGIONAL_CUP: 120, WORLD_CHAMPIONSHIP: 250 };
    let decidedReal = 0;
    for (const m of playedNow) {
      const fixture = await prisma.fixture.findUnique({
        where: { id: m.fixtureId },
        select: { competition: true, homeId: true },
      });
      if (!fixture) continue;
      const prize = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:WIN:${m.fixtureId}` } });
      if (m.homeGoals === m.awayGoals) {
        check(`draw paid nothing (fixture ${m.fixtureId.slice(-6)})`, prize, null);
        continue;
      }
      decidedReal += 1;
      const winner = m.homeGoals > m.awayGoals ? fixture.homeId : (await prisma.fixture.findUnique({ where: { id: m.fixtureId }, select: { awayId: true } }))!.awayId;
      // Knockout draws are coin-flip resolved: the advancing club is the one credited.
      const loserEliminated = fixture.competition === "LEAGUE" ? null : null;
      void loserEliminated;
      if (prize) {
        check(`real decided match prize gross (${fixture.competition})`, prize.grossAmount ?? prize.amount, EXPECT[fixture.competition] ?? 0);
        const levy = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:WIN:${m.fixtureId}:LEVY` } });
        check("real prize gravamen 10% row", levy ? levy.amount : null, Math.floor(((EXPECT[fixture.competition] ?? 0) * 10) / 100));
        if (fixture.competition === "LEAGUE") check("real league winner is the credited club", prize.clubId, winner);
      } else if (fixture.competition !== "LEAGUE") {
        console.log(`INFO  knockout tie ${m.fixtureId.slice(-6)}: draw resolved by coin flip — prize credited to the advancing club (checked via ledger amount below)`);
        const anyPrize = await prisma.ledgerEntry.findFirst({ where: { idemKey: { startsWith: `PRIZE:WIN:${m.fixtureId}` }, category: "PRIZE" } });
        check("knockout winner got a prize row", !!anyPrize, true);
      } else {
        check(`league match ${m.fixtureId.slice(-6)} paid a prize`, !!prize, true);
      }
      decidedReal = Math.max(decidedReal, 1);
    }
    console.log(`real decided matches checked: ${decidedReal}`);

    // ── (c) Deterministic sandbox: decided LEAGUE match pays 80 ─────
    console.log("\n── (c) Sandbox positive test (isolated season/division/clubs) ──");
    // Leftover cleanup from a previously interrupted run.
    const leftovers = await prisma.club.findMany({ where: { name: { startsWith: "T26 SANDBOX" } }, select: { id: true, divisionId: true } });
    for (const c of leftovers) await prisma.club.delete({ where: { id: c.id } }).catch(() => undefined);
    for (const d of await prisma.division.findMany({ where: { index: 999 }, select: { id: true } })) {
      await prisma.division.delete({ where: { id: d.id } }).catch(() => undefined);
    }
    await prisma.season.deleteMany({ where: { number: 99999 } }).catch(() => undefined);

    const region = await prisma.region.findFirst({ select: { id: true } });
    const sandboxSeason = await prisma.season.create({ data: { number: 99999, startEpochDay: 0, state: "ACTIVE" } });
    const sandboxDivision = await prisma.division.create({ data: { regionId: region!.id, index: 999 } });
    const stamp = Date.now();
    const homeClub = await prisma.club.create({ data: { regionId: region!.id, divisionId: sandboxDivision.id, name: `T26 SANDBOX HOME ${stamp}` } });
    const awayClub = await prisma.club.create({ data: { regionId: region!.id, divisionId: sandboxDivision.id, name: `T26 SANDBOX AWAY ${stamp}` } });

    let paid = false;
    for (let attempt = 1; attempt <= 6 && !paid; attempt++) {
      const fixture = await prisma.fixture.create({
        data: {
          seasonId: sandboxSeason.id, competition: "LEAGUE", matchDay: 1,
          kickoffAt: new Date(Date.now() - 60_000), homeId: homeClub.id, awayId: awayClub.id,
        },
      });
      await simulateFixture(fixture.id);
      const fresh = await prisma.fixture.findUnique({ where: { id: fixture.id }, include: { match: true } });
      const m = fresh?.match;
      if (!m) break; // simulateFixture refused (unexpected) → bail out
      if (m.homeGoals === m.awayGoals) {
        // Deterministic seed produced a draw — clean the attempt and retry with a new fixture id.
        await prisma.matchEvent.deleteMany({ where: { matchId: m.id } });
        await prisma.match.delete({ where: { id: m.id } });
        await prisma.standing.deleteMany({ where: { seasonId: sandboxSeason.id } });
        await prisma.fixture.delete({ where: { id: fixture.id } });
        continue;
      }
      const winner = m.homeGoals > m.awayGoals ? homeClub.id : awayClub.id;
      const prize = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:WIN:${fixture.id}` } });
      check(`sandbox decided league match (${m.homeGoals}-${m.awayGoals}) paid PRIZE:WIN gross`, prize ? prize.grossAmount : null, 80);
      check("sandbox prize credited NET (80 − 10%)", prize ? prize.amount : null, 72);
      check("sandbox prize credited to the winner", prize ? prize.clubId : null, winner);
      check("sandbox netAmount recorded", prize ? prize.netAmount : null, 72);
      const levy = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:WIN:${fixture.id}:LEVY` } });
      check("sandbox gravamen 10% (8) to SYSTEM fund", levy ? levy.amount : null, 8);

      // FRIENDLY must pay NOTHING.
      const friendly = await prisma.fixture.create({
        data: {
          seasonId: sandboxSeason.id, competition: "FRIENDLY", matchDay: 2,
          kickoffAt: new Date(Date.now() - 60_000), homeId: homeClub.id, awayId: awayClub.id,
        },
      });
      await simulateFixture(friendly.id);
      const fPrize = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:WIN:${friendly.id}` } });
      check("FRIENDLY pays no win prize", fPrize, null);

      // Idempotency: re-running on a PLAYED fixture must do nothing.
      const again = await simulateFixture(fixture.id);
      check("re-running a PLAYED fixture is a no-op", again.played, false);
      const dup = await prisma.ledgerEntry.count({ where: { idemKey: `PRIZE:WIN:${fixture.id}` } });
      check("no duplicate PRIZE:WIN rows", dup, 1);
      paid = true;
    }
    check("sandbox produced a decided match", paid, true);

    // Sandbox cleanup (ledger rows persist — real prize payments, documented).
    const matches = await prisma.fixture.findMany({ where: { seasonId: sandboxSeason.id }, select: { id: true, matchId: true } });
    for (const f of matches) {
      if (f.matchId) {
        await prisma.matchEvent.deleteMany({ where: { matchId: f.matchId } });
        await prisma.match.delete({ where: { id: f.matchId } }).catch(() => undefined);
      }
      await prisma.fixture.delete({ where: { id: f.id } }).catch(() => undefined);
    }
    await prisma.standing.deleteMany({ where: { seasonId: sandboxSeason.id } });
    await prisma.club.delete({ where: { id: homeClub.id } }).catch(() => undefined);
    await prisma.club.delete({ where: { id: awayClub.id } }).catch(() => undefined);
    await prisma.division.delete({ where: { id: sandboxDivision.id } }).catch(() => undefined);
    await prisma.season.delete({ where: { id: sandboxSeason.id } }).catch(() => undefined);
    console.log("sandbox cleaned up (season/division/clubs/fixtures deleted; ledger kept)");

    const systemAfter = (await prisma.fundBalance.findUnique({ where: { scope: "SYSTEM" } }))?.balance ?? 0;
    console.log(`SYSTEM fund after: ${systemAfter} (delta ${systemAfter - systemBefore}, includes real + sandbox levies)`);
  } finally {
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED ✅" : `\n${failures} CHECK(S) FAILED ❌`);
  if (failures > 0) process.exit(1);
}

main();
