// Knight FM — fixture generation (spec §15): league double round-robin, regional cup,
// world championship. Server-side, deterministic, auditable.

import { db } from "@/lib/db";
import { seedFromString, mulberry32 } from "@/lib/engine/kmie";
import { getInt } from "@/lib/config";

/** Double round-robin (circle method). Returns rounds of [homeId, awayId] pairs. */
export function doubleRoundRobin(clubIds: string[]): [string, string][][] {
  const ids = [...clubIds];
  if (ids.length % 2 !== 0) ids.push("__BYE__");
  const n = ids.length;
  const roundsSingle: [string, string][][] = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    roundsSingle.push(pairs);
    // rotate: keep first fixed
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as string);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  const mirrored = roundsSingle.map((pairs) => pairs.map(([h, a]) => [a, h] as [string, string]));
  return [...roundsSingle, ...mirrored];
}

/** League day mapping: rounds 1-15 → days 1-15; rounds 16-28 → days 16-28; rounds 29-30 → doubles on days 21 & 24. */
export function leagueRoundDays(totalRounds: number, leagueCompleteByDay: number): number[] {
  const days: number[] = [];
  const firstHalf = Math.min(15, totalRounds);
  for (let r = 1; r <= firstHalf; r++) days.push(r);
  let day = firstHalf + 1;
  const remaining = totalRounds - firstHalf;
  const secondHalfDays = leagueCompleteByDay - firstHalf;
  const doubles = Math.max(0, remaining - secondHalfDays);
  const doubleDays = [21, 24];
  let doubleIdx = 0;
  for (let r = 0; r < remaining; r++) {
    if (r < doubles && doubleIdx < doubleDays.length) {
      days.push(doubleDays[doubleIdx]);
      doubleIdx++;
    } else {
      days.push(day);
      day++;
    }
  }
  return days;
}

export async function generateLeagueFixtures(seasonId: string, divisionId: string, clubIds: string[], seasonStartEpochDay: number): Promise<number> {
  if (clubIds.length < 2) return 0;
  const kickoffHour = await getInt("competition.kickoffHourUtc", 19);
  const completeBy = await getInt("competition.leagueCompleteByDay", 28);
  // Task 28: staggered kickoffs — regional offset + deterministic per-fixture
  // jitter spread the matchday across hours so the scheduler never simulates
  // every match at the same instant.
  const division = await db.division.findUnique({ where: { id: divisionId }, select: { regionId: true } });
  const rounds = doubleRoundRobin(clubIds);
  const dayMap = leagueRoundDays(rounds.length, completeBy);
  const worldEpoch = await db.systemState.findUnique({ where: { key: "world.epoch.utc" } });
  const epoch = worldEpoch ? new Date(worldEpoch.value).getTime() : Date.now();
  const base = epoch + (seasonStartEpochDay - 1) * 86400000;
  let count = 0;
  const doublesCount = new Map<number, number>();
  const rows: { seasonId: string; competition: string; round: number; matchDay: number; kickoffAt: Date; homeId: string; awayId: string }[] = [];
  for (let r = 0; r < rounds.length; r++) {
    const day = dayMap[r];
    const isDouble = dayMap.filter((d) => d === day).length > 1;
    const idx = doublesCount.get(day) ?? 0;
    doublesCount.set(day, idx + 1);
    const hour = isDouble ? kickoffHour + 3 : kickoffHour;
    for (const [homeId, awayId] of rounds[r]) {
      const kickoff = new Date(
        base + (day - 1) * 86400000 + hour * 3600000 + (await fixtureKickoffDeltaMs(division?.regionId ?? null, `LEAGUE:${seasonId}:R${r + 1}:${homeId}`))
      );
      rows.push({ seasonId, competition: "LEAGUE", round: r + 1, matchDay: day, kickoffAt: kickoff, homeId, awayId });
      count++;
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await db.fixture.createMany({ data: rows.slice(i, i + 500) });
  }
  return count;
}

/** Create initial regional cup state (CupRun rows + round-1 fixtures) for a region. */
export async function generateCupInitial(seasonId: string, regionId: string, clubIds: string[], seasonStartEpochDay: number): Promise<number> {
  if (clubIds.length < 2) return 0;
  const worldEpoch = await db.systemState.findUnique({ where: { key: "world.epoch.utc" } });
  const epoch = worldEpoch ? new Date(worldEpoch.value).getTime() : Date.now();
  const base = epoch + (seasonStartEpochDay - 1) * 86400000;
  const rng = mulberry32(seedFromString(`CUP-INIT:${seasonId}:${regionId}`));
  const shuffled = clubIds
    .map((c) => ({ c, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c);
  await db.cupRun.createMany({ data: shuffled.map((clubId) => ({ seasonId, regionId, clubId })) });
  let count = 0;
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    await db.fixture.create({
      data: {
        seasonId, competition: "REGIONAL_CUP", round: 1, regionId, matchDay: 3,
        kickoffAt: new Date(
          base + 2 * 86400000 + 17 * 3600000 + (await fixtureKickoffDeltaMs(regionId, `REGIONAL_CUP:${seasonId}:R1:${shuffled[i]}`))
        ),
        homeId: shuffled[i], awayId: shuffled[i + 1],
      },
    });
    count++;
  }
  return count;
}

// ─── Task 28: kickoff spreading (server-load protection) ────────────────────
// Every region's matches shift by the region's RANK (position among all regions
// ordered by index — never the raw index, which can be a large sentinel like
// 99998) × competition.kickoffRegionStaggerMinutes, plus a deterministic
// per-fixture minute jitter seeded from the fixture identity. The seed key is
// derivable BOTH at generation time and in backfill scripts, so re-running the
// backfill reproduces the exact same kickoffs.

let regionRankCache: { at: number; map: Map<string, number> } | null = null;

async function regionRanks(): Promise<Map<string, number>> {
  if (regionRankCache && Date.now() - regionRankCache.at < 60_000) return regionRankCache.map;
  const regions = await db.region.findMany({ select: { id: true }, orderBy: { index: "asc" } });
  const map = new Map(regions.map((r, i) => [r.id, i]));
  regionRankCache = { at: Date.now(), map };
  return map;
}

/** Deterministic per-fixture minute jitter (0..jitterMinutes-1) in ms. */
export function kickoffJitterMs(seedKey: string, jitterMinutes: number): number {
  if (jitterMinutes <= 0) return 0;
  const rng = mulberry32(seedFromString(`KICKOFF-JIT:${seedKey}`));
  return Math.floor(rng() * jitterMinutes) * 60000;
}

/** Regional kickoff offset in ms for a region (0 when unknown or stagger disabled). */
export async function regionKickoffOffsetMs(regionId: string | null | undefined): Promise<number> {
  const stagger = Math.max(0, await getInt("competition.kickoffRegionStaggerMinutes", 90));
  if (stagger === 0 || !regionId) return 0;
  const ranks = await regionRanks();
  return (ranks.get(regionId) ?? 0) * stagger * 60000;
}

/** Full per-fixture kickoff delta (regional offset + identity jitter) in ms. */
export async function fixtureKickoffDeltaMs(regionId: string | null | undefined, seedKey: string): Promise<number> {
  const jitter = Math.max(0, await getInt("competition.kickoffMinuteJitter", 20));
  return (await regionKickoffOffsetMs(regionId)) + kickoffJitterMs(seedKey, jitter);
}

/** Regenerate all competition fixtures for a season (league per division + cup per region). */
export async function generateSeasonCompetitions(seasonId: string, seasonStartEpochDay: number): Promise<void> {
  const divisions = await db.division.findMany({ include: { clubs: { select: { id: true } } } });
  for (const div of divisions) {
    const ids = div.clubs.map((c) => c.id);
    await generateLeagueFixtures(seasonId, div.id, ids, seasonStartEpochDay);
  }
  const regions = await db.region.findMany({ include: { clubs: { select: { id: true } } } });
  for (const region of regions) {
    await generateCupInitial(seasonId, region.id, region.clubs.map((c) => c.id), seasonStartEpochDay);
  }
}
