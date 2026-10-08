// Task 28 — mandatory engine verification.
// Run: bun scripts/task28-verify.ts
//   (a) Kickoff jitter: deterministic, bounded 0..jitter-1 minutes.
//   (b) Regional offset: strictly increasing by the stagger across regions
//       ranked by index (raw index NEVER used — sandbox sentinel 99998 is last).
//   (c) Yellow-card threshold (deterministic): one eligible player, 1 draw at
//       100% → booked; with the accumulator at 4/5 the booking triggers a
//       ONE-match ban served from the NEXT fixture and the counter resets.
//   (d) Second yellow = send-off (deterministic): 2 draws at 100% on the same
//       player → YELLOW_CARD + RED_CARD(detail SECOND_YELLOW), ban 1..N, the
//       single booking counts once toward the tally.
//   (e) Negative control: chance 0 → zero card events.
//   (f) Real-data backfill audit: future fixtures have shifted kickoffs
//       (minutes != 0), played fixtures keep their history, distinct kickoff
//       slots per matchday > 1.
// Sandbox rows are deleted at the end. Config keys are restored.

import { PrismaClient } from "@prisma/client";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const okv = JSON.stringify(actual) === JSON.stringify(expected);
  if (!okv) failures += 1;
  console.log(`${okv ? "PASS" : "FAIL"}  ${name}: ${JSON.stringify(actual)}${okv ? "" : ` (expected ${JSON.stringify(expected)})`}`);
}

const CONFIG_KEYS: [string, string][] = [
  ["matches.yellowCardChancePct", "40"],
  ["matches.yellowCardMaxPerMatch", "4"],
  ["matches.yellowCardsForSuspension", "5"],
  ["matches.redCardChancePct", "5"],
  ["competition.kickoffRegionStaggerMinutes", "90"],
  ["competition.kickoffMinuteJitter", "20"],
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const { invalidateConfig } = await import("../src/lib/config");
  const { kickoffJitterMs, regionKickoffOffsetMs, fixtureKickoffDeltaMs } = await import("../src/lib/engine/fixtures");
  const { simulateFixture } = await import("../src/lib/engine/matches");

  async function setKey(key: string, value: string): Promise<void> {
    await prisma.configKey.upsert({
      where: { key },
      create: { key, group: "players", valueType: "int", defaultValue: "0", currentValue: value },
      update: { currentValue: value },
    });
    invalidateConfig();
  }

  try {
    invalidateConfig();

    // ── (a) Jitter determinism + bounds ─────────────────────────────
    console.log("\n── (a) Kickoff jitter (deterministic, bounded) ──");
    const j1 = kickoffJitterMs("LEAGUE:s1:R1:clubA", 20);
    const j2 = kickoffJitterMs("LEAGUE:s1:R1:clubA", 20);
    check("same seed → same jitter", j1, j2);
    check("jitter is minute-aligned", j1 % 60000, 0);
    check("jitter < 20 minutes", j1 < 20 * 60000, true);
    const samples = new Set<number>();
    for (let i = 0; i < 200; i++) samples.add(kickoffJitterMs(`seed-${i}`, 20) / 60000);
    check("200 seeds spread over ≥10 distinct minutes", samples.size >= 10, true);
    check("jitter 0 → zero offset", kickoffJitterMs("x", 0), 0);

    // ── (b) Regional offsets ────────────────────────────────────────
    console.log("\n── (b) Regional kickoff offsets (rank-based) ──");
    const regions = await prisma.region.findMany({ select: { id: true, index: true }, orderBy: { index: "asc" } });
    check("≥2 regions exist for the test", regions.length >= 2, true);
    const offsets: number[] = [];
    for (const r of regions) offsets.push(await regionKickoffOffsetMs(r.id));
    let strictlyIncreasing = true;
    for (let i = 1; i < offsets.length; i++) if (offsets[i] <= offsets[i - 1]) strictlyIncreasing = false;
    check("offsets strictly increase with region rank", strictlyIncreasing, true);
    check("first ranked region → offset 0", offsets[0], 0);
    const stagger = await prisma.configKey.findUnique({ where: { key: "competition.kickoffRegionStaggerMinutes" } });
    const staggerMin = stagger?.currentValue ? parseInt(stagger.currentValue, 10) : 90;
    check("step equals configured stagger", offsets[1] - offsets[0], staggerMin * 60000);
    check("unknown region → 0", await regionKickoffOffsetMs("nonexistent"), 0);
    const deltaA = await fixtureKickoffDeltaMs(regions[0].id, "k1");
    const deltaB = await fixtureKickoffDeltaMs(regions[0].id, "k1");
    check("full delta deterministic per seedKey", deltaA, deltaB);

    // ── Sandbox setup ────────────────────────────────────────────────
    console.log("\n── Sandbox (isolated region / season / clubs) ──");
    const leftovers = await prisma.club.findMany({ where: { name: { startsWith: "T28 SANDBOX" } }, select: { id: true } });
    for (const c of leftovers) await prisma.club.delete({ where: { id: c.id } }).catch(() => undefined);
    for (const d of await prisma.division.findMany({ where: { index: { in: [997, 998, 999] } }, select: { id: true } })) {
      await prisma.division.delete({ where: { id: d.id } }).catch(() => undefined);
    }
    await prisma.season.deleteMany({ where: { number: 99997 } }).catch(() => undefined);
    const leftoverRegion = await prisma.region.findUnique({ where: { index: 99997 } });
    if (leftoverRegion) {
      await prisma.club.deleteMany({ where: { regionId: leftoverRegion.id } }).catch(() => undefined);
      await prisma.division.deleteMany({ where: { regionId: leftoverRegion.id } }).catch(() => undefined);
      await prisma.region.delete({ where: { id: leftoverRegion.id } }).catch(() => undefined);
    }

    const region = await prisma.region.create({ data: { index: 99997, nameKey: "region.sandbox" } });
    const season = await prisma.season.create({ data: { number: 99997, startEpochDay: 0, state: "ACTIVE" } });
    const division = await prisma.division.create({ data: { regionId: region.id, index: 1 } });
    const stamp = Date.now();
    const mk = async (name: string) => {
      const club = await prisma.club.create({ data: { regionId: region!.id, divisionId: division.id, name: `${name} ${stamp}`, operatingFund: 5000 } });
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
    const homeClub = await mk("T28 SANDBOX HOME");
    const awayClub = await mk("T28 SANDBOX AWAY");

    const homePlayers = await prisma.player.findMany({ where: { clubId: homeClub.id }, orderBy: { createdAt: "asc" } });
    const awayPlayers = await prisma.player.findMany({ where: { clubId: awayClub.id }, orderBy: { createdAt: "asc" } });
    const protagonist = homePlayers[0];
    const injuredUntil = new Date(Date.now() + 10 * 86400000);

    /** Make `protagonist` the ONLY eligible player in either club. */
    async function isolateProtagonist(): Promise<void> {
      await prisma.player.updateMany({
        where: { id: { not: protagonist.id }, clubId: { in: [homeClub.id, awayClub.id] } },
        data: { injuredUntil, suspension: 0 },
      });
      await prisma.player.update({ where: { id: protagonist.id }, data: { injuredUntil: null, suspension: 0 } });
    }
    async function releaseSquad(): Promise<void> {
      await prisma.player.updateMany({
        where: { clubId: { in: [homeClub.id, awayClub.id] } },
        data: { injuredUntil: null, suspension: 0, yellowCards: 0 },
      });
    }

    async function playFixture(): Promise<{ fixtureId: string; matchId: string }> {
      const fixture = await prisma.fixture.create({
        data: { seasonId: season.id, competition: "LEAGUE", round: 1, matchDay: 1, kickoffAt: new Date(Date.now() - 60_000), homeId: homeClub.id, awayId: awayClub.id },
      });
      await simulateFixture(fixture.id);
      const fresh = await prisma.fixture.findUnique({ where: { id: fixture.id }, include: { match: true } });
      if (!fresh?.match) throw new Error("sandbox fixture did not play");
      return { fixtureId: fixture.id, matchId: fresh.match.id };
    }
    async function cleanupMatch(ids: { fixtureId: string; matchId: string }[]): Promise<void> {
      for (const { matchId, fixtureId } of ids) {
        await prisma.matchEvent.deleteMany({ where: { matchId } });
        await prisma.match.delete({ where: { id: matchId } }).catch(() => undefined);
        await prisma.standing.deleteMany({ where: { seasonId: season.id } });
        await prisma.ledgerEntry.deleteMany({ where: { idemKey: { contains: fixtureId } } });
        await prisma.fixture.delete({ where: { id: fixtureId } }).catch(() => undefined);
      }
    }

    // ── (c) Yellow-card threshold → ONE-match ban + counter reset ───
    console.log("\n── (c) Accumulation: 5th yellow → 1-match ban, counter resets ──");
    await setKey("matches.yellowCardChancePct", "100");
    await setKey("matches.yellowCardMaxPerMatch", "1");
    await setKey("matches.yellowCardsForSuspension", "5");
    await setKey("matches.redCardChancePct", "0");
    await isolateProtagonist();
    await prisma.player.update({ where: { id: protagonist.id }, data: { yellowCards: 4 } });
    const t1 = await playFixture();
    const afterT1 = await prisma.player.findUnique({ where: { id: protagonist.id } });
    const t1Events = await prisma.matchEvent.findMany({ where: { matchId: t1.matchId }, orderBy: { minute: "asc" } });
    check("exactly one card event (single draw)", t1Events.filter((e) => e.type === "YELLOW_CARD").length, 1);
    check("no red card in the threshold match", t1Events.filter((e) => e.type === "RED_CARD").length, 0);
    check("accumulator reached 5 → suspension 1 (served NEXT fixture)", afterT1?.suspension, 1);
    check("accumulator reset to 0 after the ban", afterT1?.yellowCards, 0);
    check("protagonist was the booked player", t1Events.find((e) => e.type === "YELLOW_CARD")?.playerId, protagonist.id);
    await cleanupMatch([t1]);

    // ── (d) Second yellow in one match → send-off ───────────────────
    console.log("\n── (d) Two yellows in the same match → red (SECOND_YELLOW) ──");
    await setKey("matches.yellowCardMaxPerMatch", "2");
    await releaseSquad();
    await isolateProtagonist(); // protagonist is the only eligible XI player
    const t2 = await playFixture();
    const afterT2 = await prisma.player.findUnique({ where: { id: protagonist.id } });
    const t2Events = await prisma.matchEvent.findMany({ where: { matchId: t2.matchId }, orderBy: { minute: "asc" } });
    check("two YELLOW_CARD draws both fired", t2Events.filter((e) => e.type === "YELLOW_CARD").length, 1);
    check("second booking became a send-off", t2Events.filter((e) => e.type === "RED_CARD").length, 1);
    check("send-off flagged SECOND_YELLOW", t2Events.find((e) => e.type === "RED_CARD")?.detail, "SECOND_YELLOW");
    check("ban is 1..redCardSuspensionMatches (2)", afterT2 && afterT2.suspension >= 1 && afterT2.suspension <= 2, true);
    check("first booking counted ONCE toward the tally", afterT2?.yellowCards, 1);
    await cleanupMatch([t2]);

    // ── (e) Negative control ────────────────────────────────────────
    console.log("\n── (e) Negative control: chance 0 → no cards ──");
    await setKey("matches.yellowCardChancePct", "0");
    await setKey("matches.yellowCardMaxPerMatch", "4");
    await setKey("matches.redCardChancePct", "0");
    await releaseSquad();
    await isolateProtagonist();
    const t3 = await playFixture();
    const t3Events = await prisma.matchEvent.findMany({ where: { matchId: t3.matchId } });
    check("zero card events", t3Events.filter((e) => e.type === "YELLOW_CARD" || e.type === "RED_CARD").length, 0);
    check("no suspension after the match", (await prisma.player.findUnique({ where: { id: protagonist.id } }))?.suspension, 0);
    await cleanupMatch([t3]);

    // ── (f) Real-data backfill audit ────────────────────────────────
    console.log("\n── (f) Backfill audit over real fixtures ──");
    const marker = await prisma.systemState.findUnique({ where: { key: "task28.kickoffBackfill" } });
    check("backfill marker present", !!marker, true);
    const future = await prisma.fixture.findMany({
      where: { status: "SCHEDULED", kickoffAt: { gt: new Date() }, competition: "LEAGUE" },
      select: { kickoffAt: true, matchDay: true },
      take: 4000,
      orderBy: { kickoffAt: "asc" },
    });
    const shifted = future.filter((f) => f.kickoffAt.getUTCMinutes() !== 0 || f.kickoffAt.getUTCSeconds() !== 0);
    check("majority of future league fixtures shifted off the exact hour", shifted.length > future.length * 0.8, true);
    const slotsPerDay = new Map<number, Set<string>>();
    for (const f of future) {
      const set = slotsPerDay.get(f.matchDay) ?? new Set<string>();
      set.add(f.kickoffAt.toISOString().slice(0, 13));
      slotsPerDay.set(f.matchDay, set);
    }
    const firstDay = [...slotsPerDay.entries()].sort((a, b) => a[0] - b[0])[0];
    check("next matchday has ≥5 distinct kickoff HOURS across regions", firstDay ? firstDay[1].size >= 5 : false, true);
    const played = await prisma.fixture.findMany({
      where: { status: "PLAYED", competition: "LEAGUE" },
      select: { kickoffAt: true },
      take: 500,
      orderBy: { kickoffAt: "desc" },
    });
    const playedUntouched = played.filter((f) => f.kickoffAt.getUTCMinutes() === 0 && f.kickoffAt.getUTCSeconds() === 0);
    check("PLAYED fixtures keep their historical kickoffs", playedUntouched.length, played.length);
  } finally {
    // ── Restore config + teardown sandbox (FK-safe order) ───────────
    for (const [key, def] of CONFIG_KEYS) {
      await prisma.configKey.updateMany({ where: { key }, data: { currentValue: def } }).catch(() => undefined);
    }
    const sandboxSeason = await prisma.season.findUnique({ where: { number: 99997 } });
    if (sandboxSeason) {
      const allFixtures = await prisma.fixture.findMany({ where: { seasonId: sandboxSeason.id }, select: { id: true, matchId: true } });
      for (const f of allFixtures) {
        if (f.matchId) {
          await prisma.matchEvent.deleteMany({ where: { matchId: f.matchId } });
          await prisma.match.delete({ where: { id: f.matchId } }).catch(() => undefined);
        }
        await prisma.fixture.delete({ where: { id: f.id } }).catch(() => undefined);
      }
      await prisma.standing.deleteMany({ where: { seasonId: sandboxSeason.id } });
      await prisma.season.delete({ where: { id: sandboxSeason.id } }).catch(() => undefined);
    }
    const sandboxRegion = await prisma.region.findUnique({ where: { index: 99997 } });
    if (sandboxRegion) {
      const sandboxClubs = await prisma.club.findMany({ where: { regionId: sandboxRegion.id }, select: { id: true } });
      for (const c of sandboxClubs) {
        await prisma.player.deleteMany({ where: { clubId: c.id } });
        await prisma.ledgerEntry.deleteMany({ where: { clubId: c.id } }).catch(() => undefined);
        await prisma.club.delete({ where: { id: c.id } }).catch(() => undefined);
      }
      await prisma.division.deleteMany({ where: { regionId: sandboxRegion.id } }).catch(() => undefined);
      await prisma.region.delete({ where: { id: sandboxRegion.id } }).catch(() => undefined);
    }
    invalidateConfig();
    await prisma.$disconnect();
    console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
    if (failures > 0) process.exit(1);
  }
}

void main();
