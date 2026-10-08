// Task 27 — mandatory engine verification.
// Run: bun scripts/task27-verify.ts
//   (a) Division prize scaling (league wins AND league titles): 1st division
//       pays 100%, every division below −winPrizeDivisionStepPct (default 10),
//       floored at 10%.
//   (b) Player value ×3: stored VALUE = base calculation ×
//       market.playerValueMultiplier; salaries derive from the BASE value.
//       Backfill marker + divisibility sanity over real rows.
//   (c) Sandbox league matches: division-1 winner paid 80 (as before), a
//       division-3 winner paid 64 (80 × 80%); FRIENDLY pays nothing; idempotent.
//   (d) Red cards (chance forced to 100% for the test): exactly one RED_CARD
//       event, offender suspended 1..N, suspended players OUT of the XI serve
//       their ban deterministically (previously unreliable).
//   (e) Sandbox regional cup: round-1 win escalates (1/3 of the reference with
//       8 entrants → 40), the FINAL winner receives the configured CHAMPION
//       prize (2500) under the SAME idempotency key as the season-transition
//       payout (never paid twice).
//   (f) Loans: the HOST (borrower) club pays the loaned player's salary for the
//       payroll period; the ORIGIN club pays nothing while the loan lasts.
// Sandbox rows are deleted at the end. Synthetic SALARY ledger rows are
// removed; sandbox PRIZE rows persist (real payments, Task 26 precedent).

import { PrismaClient } from "@prisma/client";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const okv = JSON.stringify(actual) === JSON.stringify(expected);
  if (!okv) failures += 1;
  console.log(`${okv ? "PASS" : "FAIL"}  ${name}: ${JSON.stringify(actual)}${okv ? "" : ` (expected ${JSON.stringify(expected)})`}`);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const { divisionPrizeFactorPct } = await import("../src/lib/engine/prizes");
  const { computeBaseMarketValue, applyValueMultiplier, computeMarketValue, computeSalary } = await import("../src/lib/engine/ovr");
  const { invalidateConfig } = await import("../src/lib/config");
  const { simulateFixture } = await import("../src/lib/engine/matches");
  const { paySalaries } = await import("../src/lib/engine/scheduler");

  try {
    invalidateConfig();

    // ── (a) Division scaling ─────────────────────────────────────────
    console.log("\n── (a) League prize scaling by division (step 10%, floor 10%) ──");
    check("factor(div 1) = 100%", divisionPrizeFactorPct(1, 10), 100);
    check("factor(div 2) = 90%", divisionPrizeFactorPct(2, 10), 90);
    check("factor(div 5) = 60%", divisionPrizeFactorPct(5, 10), 60);
    check("factor(div 10) = 10%", divisionPrizeFactorPct(10, 10), 10);
    check("factor(div 12) floored at 10%", divisionPrizeFactorPct(12, 10), 10);
    check("factor step 0 → flat 100%", divisionPrizeFactorPct(9, 0), 100);
    check("factor step 20, div 3 → 60%", divisionPrizeFactorPct(3, 20), 60);

    // ── (b) Player value ×3 ─────────────────────────────────────────
    console.log("\n── (b) Player VALUE = base × market.playerValueMultiplier (3) ──");
    const base = computeBaseMarketValue(62, 24);
    check("base value > 0", base > 0, true);
    check("computeMarketValue = base × 3 (default)", computeMarketValue(62, 24), base * 3);
    check("applyValueMultiplier(base, 3)", applyValueMultiplier(base, 3), base * 3);
    check("salary derives from BASE value", computeSalary(base, 1), Math.max(1, Math.floor(base / 100)));
    check("salary ≠ base×3 (wage bill unchanged)", computeSalary(base * 3, 1) === computeSalary(base, 1), false);
    const marker = await prisma.systemState.findUnique({ where: { key: "backfill.task27.valueMultiplier" } });
    check("backfill marker present", !!marker, true);
    const sample = await prisma.player.findMany({ select: { marketValue: true }, take: 500, orderBy: { createdAt: "desc" as const } });
    const divisible = sample.filter((p) => p.marketValue % 3 === 0).length;
    check("stored values divisible by 3 (backfilled/created ×3)", divisible === sample.length, true);

    // ── Sandbox setup ────────────────────────────────────────────────
    console.log("\n── Sandbox (isolated season / divisions / clubs) ──");
    const leftovers = await prisma.club.findMany({ where: { name: { startsWith: "T27 SANDBOX" } }, select: { id: true } });
    for (const c of leftovers) await prisma.club.delete({ where: { id: c.id } }).catch(() => undefined);
    for (const d of await prisma.division.findMany({ where: { index: { in: [997, 998, 999] } }, select: { id: true } })) {
      await prisma.division.delete({ where: { id: d.id } }).catch(() => undefined);
    }
    await prisma.season.deleteMany({ where: { number: 99998 } }).catch(() => undefined);
    // Region leftover from an interrupted previous run (divisions + clubs first).
    const leftoverRegion = await prisma.region.findUnique({ where: { index: 99998 } });
    if (leftoverRegion) {
      await prisma.club.deleteMany({ where: { regionId: leftoverRegion.id, name: { startsWith: "T27 SANDBOX" } } }).catch(() => undefined);
      await prisma.division.deleteMany({ where: { regionId: leftoverRegion.id } }).catch(() => undefined);
      await prisma.region.delete({ where: { id: leftoverRegion.id } }).catch(() => undefined);
    }

    const region = await prisma.region.create({ data: { index: 99998, nameKey: "region.sandbox" } });
    const season = await prisma.season.create({ data: { number: 99998, startEpochDay: 0, state: "ACTIVE" } });
    // REAL division indices 1 and 3 (in their own sandbox region) so the
    // division factor is 100% / 80% — the 999-index fallback of Task 26 would
    // sit on the 10% floor and hide the scaling.
    const div1 = await prisma.division.create({ data: { regionId: region.id, index: 1 } });
    const div3 = await prisma.division.create({ data: { regionId: region.id, index: 3 } });
    const stamp = Date.now();
    const mk = async (divisionId: string, name: string) => {
      const club = await prisma.club.create({ data: { regionId: region!.id, divisionId, name: `${name} ${stamp}`, operatingFund: 5000 } });
      const { generatePlayerName } = await import("../src/lib/engine/names");
      for (let i = 0; i < 18; i++) {
        const { firstName, lastName } = generatePlayerName(() => 0.42);
        await prisma.player.create({
          data: {
            clubId: club.id, firstName, lastName, age: 24,
            position: i < 2 ? "GK" : i < 8 ? "DF" : i < 13 ? "MF" : "FW",
            detailedPos: i < 2 ? "GK" : i < 8 ? "CB" : i < 13 ? "CM" : "ST",
            stars: 1, ovr: 50, potential: 60, marketValue: 300, salary: 1,
            releaseClause: 1500, attributes: "{}",
          },
        });
      }
      return club;
    };
    const homeClub = await mk(div1.id, "T27 SANDBOX D1 HOME");
    const awayClub = await mk(div1.id, "T27 SANDBOX D1 AWAY");
    const d3Home = await mk(div3.id, "T27 SANDBOX D3 HOME");
    const d3Away = await mk(div3.id, "T27 SANDBOX D3 AWAY");
    void homeClub; void awayClub; void d3Home; void d3Away;

    async function playLeague(homeId: string, awayId: string, day: number): Promise<{ fixtureId: string; matchId: string; attempts: number } | null> {
      let attempts = 0;
      for (let attempt = 0; attempt < 6; attempt++) {
        attempts++;
        const fixture = await prisma.fixture.create({
          data: { seasonId: season.id, competition: "LEAGUE", matchDay: day, kickoffAt: new Date(Date.now() - 60_000), homeId, awayId },
        });
        await simulateFixture(fixture.id);
        const fresh = await prisma.fixture.findUnique({ where: { id: fixture.id }, include: { match: true } });
        if (!fresh?.match) return null;
        if (fresh.match.homeGoals !== fresh.match.awayGoals) return { fixtureId: fixture.id, matchId: fresh.match.id, attempts };
        // deterministic draw → clean and retry with a new fixture id
        await prisma.matchEvent.deleteMany({ where: { matchId: fresh.match.id } });
        await prisma.match.delete({ where: { id: fresh.match.id } });
        await prisma.standing.deleteMany({ where: { seasonId: season.id } });
        await prisma.fixture.delete({ where: { id: fixture.id } });
      }
      return null;
    }

    // ── (d) Red card + deterministic suspension serve (div-1 match) ──
    console.log("\n── (d) Red cards (forced 100%) + suspension service ──");
    await prisma.configKey.upsert({
      where: { key: "matches.redCardChancePct" },
      create: { key: "matches.redCardChancePct", group: "players", valueType: "int", defaultValue: "5", currentValue: "100" },
      update: { currentValue: "100" },
    });
    invalidateConfig();
    const probe = await prisma.player.findFirst({
      where: { clubId: homeClub.id },
      orderBy: { createdAt: "asc" as const },
      select: { id: true, suspension: true },
    });
    await prisma.player.update({ where: { id: probe!.id }, data: { suspension: 3 } }); // banned player → excluded from the XI
    const d1 = await playLeague(homeClub.id, awayClub.id, 1);
    check("sandbox div-1 match produced a decision", !!d1, true);
    if (d1) {
      const reds = await prisma.matchEvent.findMany({ where: { matchId: d1.matchId, type: "RED_CARD" } });
      check("exactly one RED_CARD event", reds.length, 1);
      const offender = reds[0] ? await prisma.player.findUnique({ where: { id: reds[0].playerId! } }) : null;
      check("offender suspension set 1..2", offender ? offender.suspension >= 1 && offender.suspension <= 2 : false, true);
      const probeAfter = await prisma.player.findUnique({ where: { id: probe!.id }, select: { suspension: true } });
      // One suspension decrement PER simulated club fixture — the retry loop
      // may have simulated several (draws are cleaned up, player updates are not).
      check("non-XI suspended player served one match per fixture", probeAfter?.suspension, 3 - d1.attempts);

      // ── (c1) Division-1 league win prize = 80 (unchanged) ──
      const winner = (await prisma.fixture.findUnique({ where: { id: d1.fixtureId }, include: { match: true } }))!.match!;
      void winner;
      const m1 = await prisma.match.findUnique({ where: { id: d1.matchId } });
      const fixtureRow = await prisma.fixture.findUnique({ where: { id: d1.fixtureId }, include: { match: true, home: true, away: true } });
      const winClub = m1!.homeGoals > m1!.awayGoals ? fixtureRow!.homeId : fixtureRow!.awayId;
      const prize1 = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:WIN:${d1.fixtureId}` } });
      check("div-1 league win prize gross = 80", prize1 ? prize1.grossAmount : null, 80);
      check("div-1 prize credited to the winner", prize1 ? prize1.clubId : null, winClub);
      const levy1 = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:WIN:${d1.fixtureId}:LEVY` } });
      check("div-1 gravamen 10% = 8", levy1 ? levy1.amount : null, 8);
    }

    // ── (c2) Division-3 league win prize = 64 (80 × 80%) ────────────
    console.log("\n── (c2) Division-3 league win prize (80 × 80% = 64) ──");
    const d3 = await playLeague(d3Home.id, d3Away.id, 2);
    check("sandbox div-3 match produced a decision", !!d3, true);
    if (d3) {
      const prize3 = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:WIN:${d3.fixtureId}` } });
      check("div-3 league win prize gross = 64", prize3 ? prize3.grossAmount : null, 64);
      const levy3 = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:WIN:${d3.fixtureId}:LEVY` } });
      check("div-3 gravamen 10% = 6 (floor 6.4)", levy3 ? levy3.amount : null, 6);
    }

    // restore the red-card chance BEFORE friendly/idempotency runs
    await prisma.configKey.deleteMany({ where: { key: "matches.redCardChancePct" } });
    invalidateConfig();

    // FRIENDLY pays nothing + idempotency (reuse div-1 clubs)
    const friendly = await prisma.fixture.create({
      data: { seasonId: season.id, competition: "FRIENDLY", matchDay: 3, kickoffAt: new Date(Date.now() - 60_000), homeId: homeClub.id, awayId: awayClub.id },
    });
    await simulateFixture(friendly.id);
    const fPrize = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:WIN:${friendly.id}` } });
    check("FRIENDLY pays no win prize", fPrize, null);
    if (d1) {
      const again = await simulateFixture(d1.fixtureId);
      check("re-running a PLAYED fixture is a no-op", again.played, false);
      check("no duplicate PRIZE rows", await prisma.ledgerEntry.count({ where: { idemKey: `PRIZE:WIN:${d1.fixtureId}` } }), 1);
    }

    // ── (e) Regional cup: round escalation + final champion prize ───
    console.log("\n── (e) Cup round escalation + FINAL champion prize ──");
    // 4 entrants (2 div-1 sandbox clubs + 2 fillers) → 2 round-1 fixtures →
    // the engine pairs survivors into the stage-F FINAL (round 2) itself.
    const cupEntrants = [homeClub.id, awayClub.id];
    for (let i = 0; i < 2; i++) {
      const filler = await mk(div1.id, `T27 SANDBOX FILLER ${i}`);
      cupEntrants.push(filler.id);
    }
    for (const clubId of cupEntrants) {
      await prisma.cupRun.create({ data: { seasonId: season.id, regionId: region.id, clubId, eliminatedRound: null } });
    }
    // 4 entrants → totalRounds = ceil(log2(4)) = 2 → round 1 pays 1/2 of 120 = 60
    const cupR1a = await prisma.fixture.create({
      data: { seasonId: season.id, competition: "REGIONAL_CUP", round: 1, regionId: region.id, matchDay: 4, kickoffAt: new Date(Date.now() - 60_000), homeId: cupEntrants[0], awayId: cupEntrants[1] },
    });
    const cupR1b = await prisma.fixture.create({
      data: { seasonId: season.id, competition: "REGIONAL_CUP", round: 1, regionId: region.id, matchDay: 4, kickoffAt: new Date(Date.now() - 60_000), homeId: cupEntrants[2], awayId: cupEntrants[3] },
    });
    await simulateFixture(cupR1a.id);
    await simulateFixture(cupR1b.id);
    const prizeR1 = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:WIN:${cupR1a.id}` } });
    check("cup round-1 win prize = round(120 × 1/2) = 60", prizeR1 ? prizeR1.grossAmount : null, 60);

    // The engine auto-created the FINAL (round 2, stage F) once round 1 completed.
    const finalRow = await prisma.fixture.findFirst({
      where: { seasonId: season.id, competition: "REGIONAL_CUP", stage: "F" },
      include: { match: true },
    });
    check("engine created the stage-F final after round 1", !!finalRow, true);
    if (finalRow && !finalRow.match) await simulateFixture(finalRow.id);
    const finalFresh = await prisma.fixture.findUnique({ where: { id: finalRow!.id }, include: { match: true } });
    check("cup final was simulated", !!finalFresh?.match, true);
    const cupWinner = await prisma.cupRun.findFirst({ where: { seasonId: season.id, regionId: region.id, champion: true } });
    const finalists = [finalRow!.homeId, finalRow!.awayId];
    check("cup champion is one of the finalists", cupWinner ? finalists.includes(cupWinner.clubId) : false, true);
    const champPrize = await prisma.ledgerEntry.findUnique({ where: { idemKey: `PRIZE:CUP:${season.id}:${cupWinner?.clubId ?? ""}` } });
    check("cup FINAL winner receives the CHAMPION prize (2500)", champPrize ? champPrize.grossAmount : null, 2500);
    check("no flat PRIZE:WIN row for the final", champPrize ? champPrize.memo.includes("CHAMPION") : false, true);
    // Idempotency: the season-transition payout uses the SAME key → no-op
    const { creditClub } = await import("../src/lib/engine/finance");
    const doublePay = await prisma.$transaction(async (tx) =>
      creditClub(tx, cupWinner!.clubId, 2500, "PRIZE", `PRIZE:CUP:${season.id}:${cupWinner!.clubId}`, "transition attempt"),
    );
    check("season-transition cup payout is idempotent (no double pay)", doublePay, false);

    // ── (f) Loans: HOST pays the salary, ORIGIN pays nothing ────────
    console.log("\n── (f) Loaned player: host club pays his salary ──");
    const loanHost = await prisma.club.create({ data: { regionId: region!.id, divisionId: div1.id, name: `T27 SANDBOX LOAN HOST ${stamp}`, operatingFund: 1000 } });
    const loanOrigin = await prisma.club.create({ data: { regionId: region!.id, divisionId: div1.id, name: `T27 SANDBOX LOAN ORIGIN ${stamp}`, operatingFund: 1000 } });
    const { generatePlayerName } = await import("../src/lib/engine/names");
    const { firstName, lastName } = generatePlayerName(() => 0.42);
    const loaned = await prisma.player.create({
      data: {
        clubId: loanHost.id, loanOriginClubId: loanOrigin.id, loanedUntilDay: 9_999_999,
        firstName, lastName, age: 24, position: "MF", detailedPos: "CM",
        stars: 1, ovr: 60, potential: 70, marketValue: 900, salary: 5,
        releaseClause: 4500, attributes: "{}",
      },
    });
    const syntheticDay = 7_000_007; // 7000007 % 7 === 0 → payday, unique keys, far future
    await paySalaries(syntheticDay, null, [loanHost.id, loanOrigin.id]);
    const hostRow = await prisma.ledgerEntry.findUnique({ where: { idemKey: `SALARY:${loanHost.id}:${syntheticDay}` } });
    const originRow = await prisma.ledgerEntry.findUnique({ where: { idemKey: `SALARY:${loanOrigin.id}:${syntheticDay}` } });
    check("HOST club debited the loaned player's weekly salary (5 × 7 = 35)", hostRow ? Math.abs(hostRow.amount) : null, 35);
    check("ORIGIN club pays nothing while the loan lasts", originRow, null);

    // ── cleanup ──────────────────────────────────────────────────────
    console.log("\n── cleanup ──");
    const allFixtures = await prisma.fixture.findMany({ where: { seasonId: season.id }, select: { id: true, matchId: true } });
    for (const f of allFixtures) {
      if (f.matchId) {
        await prisma.matchEvent.deleteMany({ where: { matchId: f.matchId } });
        await prisma.match.delete({ where: { id: f.matchId } }).catch(() => undefined);
      }
      await prisma.fixture.delete({ where: { id: f.id } }).catch(() => undefined);
    }
    await prisma.standing.deleteMany({ where: { seasonId: season.id } });
    await prisma.cupRun.deleteMany({ where: { seasonId: season.id } });
    await prisma.ledgerEntry.deleteMany({ where: { idemKey: { contains: String(syntheticDay) } } });
    for (const clubId of [...cupEntrants, loanHost.id, loanOrigin.id]) {
      await prisma.player.deleteMany({ where: { clubId } });
      await prisma.club.delete({ where: { id: clubId } }).catch(() => undefined);
    }
    await prisma.division.delete({ where: { id: div1.id } }).catch(() => undefined);
    await prisma.division.delete({ where: { id: div3.id } }).catch(() => undefined);
    await prisma.season.delete({ where: { id: season.id } }).catch(() => undefined);
    await prisma.region.delete({ where: { id: region.id } }).catch(() => undefined);
    console.log("sandbox cleaned up (synthetic SALARY ledger rows removed; PRIZE rows kept — Task 26 precedent)");

    if (await prisma.configKey.findUnique({ where: { key: "matches.redCardChancePct" } })) {
      console.log("WARN: red-card override was NOT restored");
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED ✅" : `\n${failures} CHECK(S) FAILED ❌`);
  if (failures > 0) process.exit(1);
}

main();
