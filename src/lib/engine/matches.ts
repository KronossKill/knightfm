// Knight FM — match execution (KMIE) + competition state updates (spec §15, §19).
// Server-authoritative; invoked only by the durable scheduler when kickoffAt has passed.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { simulateMatch, TeamStrengthInput, mulberry32, seedFromString } from "@/lib/engine/kmie";
import { computeContextualOvr } from "@/lib/engine/ovr";
import { autoCompleteLineup, AutoPlayer } from "@/lib/engine/tactics";
import { FORMATION_LAYOUTS, Formation, Position } from "@/lib/types";
import { allocateRevenue, creditClub } from "@/lib/engine/finance";
import { divisionPrizeFactorPct } from "@/lib/engine/prizes";
import { fixtureKickoffDeltaMs } from "@/lib/engine/fixtures";
import { getInt, getBool } from "@/lib/config";

type Tx = Prisma.TransactionClient;

function avg(nums: number[]): number {
  if (nums.length === 0) return 45;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function strengthFromPlayers(
  players: { position: Position; ovr: number; fatigue: number; sharpness: number; morale: number; confidence: number }[],
  formation: Formation
): TeamStrengthInput {
  const ctx = (p: (typeof players)[number]) =>
    computeContextualOvr({ rawOvr: p.ovr, fatigue: p.fatigue, sharpness: p.sharpness, morale: p.morale, confidence: p.confidence });
  const gks = players.filter((p) => p.position === "GK");
  const dfs = players.filter((p) => p.position === "DF");
  const mfs = players.filter((p) => p.position === "MF");
  const fws = players.filter((p) => p.position === "FW");
  const fatigueFactor = Math.max(0.82, 1 - avg(players.map((p) => p.fatigue)) / 260);
  return {
    attackOvr: avg([...fws.map(ctx), ...mfs.map(ctx).slice(0, 3)]),
    midfieldOvr: avg(mfs.map(ctx)),
    defenseOvr: avg(dfs.map(ctx)),
    gkOvr: gks.length > 0 ? ctx(gks[0]) : 45,
    tacticsFactor: 1.0,
    fatigueFactor,
  };
}

export interface SimOutcome {
  played: boolean;
  homeGoals?: number;
  awayGoals?: number;
}

export async function simulateFixture(fixtureId: string): Promise<SimOutcome> {
  const fixture = await db.fixture.findUnique({
    where: { id: fixtureId },
    include: {
      match: true,
      season: true,
      home: { include: { players: true, lineups: true } },
      away: { include: { players: true, lineups: true } },
    },
  });
  if (!fixture || fixture.status !== "SCHEDULED" || fixture.match) return { played: false };

  const now = new Date();
  const rng = mulberry32(seedFromString(`KMIE-EV:${fixture.id}`));

  const buildXI = (club: typeof fixture.home): { ids: string[]; strength: TeamStrengthInput } => {
    const eligible = club.players.filter(
      (p) => !p.retired && !p.isYouth && (!p.injuredUntil || p.injuredUntil < now) && p.suspension === 0
    );
    const auto: AutoPlayer[] = eligible.map((p) => ({
      id: p.id, position: p.position as Position, detailedPos: p.detailedPos, ovr: p.ovr,
      fatigue: p.fatigue, sharpness: p.sharpness, morale: p.morale, confidence: p.confidence,
      form: p.form, injuredUntil: p.injuredUntil, suspension: p.suspension,
    }));
    const formation = (club.lineups?.formation ?? "4-4-2") as Formation;
    const saved = club.lineups ? (JSON.parse(club.lineups.slots || "{}") as Record<string, string>) : {};
    const slots = FORMATION_LAYOUTS[formation];
    const chosen = new Map<string, string>();
    for (const s of slots) if (saved[s.id]) chosen.set(s.id, saved[s.id]);
    for (const s of autoCompleteLineup(auto, formation, now)) {
      if (!chosen.has(s.slotId) && s.playerId) chosen.set(s.slotId, s.playerId);
    }
    const xiIds = [...chosen.values()];
    const xi = (xiIds.length >= 7 ? eligible.filter((p) => xiIds.includes(p.id)) : eligible.slice(0, 11)).map((p) => ({
      position: p.position as Position, ovr: p.ovr, fatigue: p.fatigue, sharpness: p.sharpness, morale: p.morale, confidence: p.confidence,
    }));
    return { ids: xi.map((_, i) => xiIds[i] ?? ""), strength: strengthFromPlayers(xi, formation) };
  };

  const homeXI = buildXI(fixture.home);
  const awayXI = buildXI(fixture.away);
  const seed = `KMIE:${fixture.season.number}:${fixture.competition}:${fixture.id}`;
  const sim = simulateMatch(seed, homeXI.strength, awayXI.strength);

  const allPlayers = [...fixture.home.players, ...fixture.away.players].filter((p) => !p.retired && !p.isYouth);
  // MatchEvent.clubId is non-nullable; resolve the club by squad membership.
  const clubIdOf = (p: (typeof allPlayers)[number]): string =>
    fixture.home.players.some((q) => q.id === p.id) ? fixture.homeId : fixture.awayId;
  const scorerPool = allPlayers.filter((p) => p.position === "FW" || p.position === "MF");
  const assistPool = allPlayers.filter((p) => p.position === "MF" || p.position === "DF");

  interface Ev { minute: number; type: string; clubId: string; playerId: string | null; detail: string }
  const events: Ev[] = [];
  const weightedPick = (pool: typeof allPlayers, minEdge = 40) => {
    if (pool.length === 0) return null;
    const weights = pool.map((p) => Math.max(1, p.ovr - minEdge + (p.position === "FW" ? 18 : p.position === "MF" ? 6 : 0)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  };
  const addGoals = (clubId: string, goals: number) => {
    for (let g = 0; g < goals; g++) {
      const minute = 1 + Math.floor(rng() * 90);
      const scorer = weightedPick(scorerPool.filter((p) => p.clubId === clubId));
      const assister = rng() < 0.72 ? weightedPick(assistPool.filter((p) => p.clubId === clubId && p.id !== scorer?.id), 42) : null;
      events.push({ minute, type: "GOAL", clubId, playerId: scorer?.id ?? null, detail: "" });
      if (assister) events.push({ minute, type: "ASSIST", clubId, playerId: assister.id, detail: "" });
    }
  };
  addGoals(fixture.homeId, sim.homeGoals);
  addGoals(fixture.awayId, sim.awayGoals);
  events.sort((a, b) => a.minute - b.minute);

  const winningClub = sim.homeGoals > sim.awayGoals ? fixture.homeId : sim.awayGoals > sim.homeGoals ? fixture.awayId : null;
  // Task 26: knockout ties decided by a coin flip (cup / world cup) — capture
  // the effective winner so the win prize always matches the advancing club.
  let knockoutWinner: string | null = null;
  const motmPool = allPlayers.filter((p) => (winningClub ? p.clubId === winningClub : true));
  const motm = motmPool.length > 0 ? motmPool[Math.floor(rng() * motmPool.length)] : null;

  const playedIds = new Set([...homeXI.ids, ...awayXI.ids].filter(Boolean));

  // Task 27 + Task 28: DISCIPLINE.
  // - Straight red: matches.redCardChancePct chance of ONE send-off on a random
  //   XI player; ban 1..matches.redCardSuspensionMatches of his club's fixtures
  //   (served per club match) with the RED_CARD event in the report timeline.
  // - Yellow cards (Task 28): up to matches.yellowCardMaxPerMatch independent
  //   draws, each succeeding with matches.yellowCardChancePct. A player booked
  //   twice in the SAME match is SENT OFF (second-yellow red, same ban ladder;
  //   RED_CARD detail "SECOND_YELLOW") — the first booking still counts ONCE
  //   toward the season tally, because accumulation counts distinct matches.
  // - Accumulation: matches.yellowCardsForSuspension bookings across DISTINCT
  //   matches trigger a ONE-match ban (counter resets; extra ban served from the
  //   player's NEXT club fixture, stacked on any send-off ban).
  const sendOffs = new Map<string, number>(); // playerId -> ban matches
  const bookedIds = new Set<string>(); // one count per match, per player
  const redChancePct = Math.max(0, Math.min(100, await getInt("matches.redCardChancePct", 5)));
  const maxSusp = Math.max(1, await getInt("matches.redCardSuspensionMatches", 2));
  if (redChancePct > 0 && rng() * 100 < redChancePct) {
    const xiPool = allPlayers.filter((p) => playedIds.has(p.id));
    const straightRed = xiPool.length > 0 ? xiPool[Math.floor(rng() * xiPool.length)] : null;
    if (straightRed) {
      sendOffs.set(straightRed.id, 1 + Math.floor(rng() * maxSusp));
      events.push({ minute: 1 + Math.floor(rng() * 90), type: "RED_CARD", clubId: clubIdOf(straightRed), playerId: straightRed.id, detail: "" });
      events.sort((a, b) => a.minute - b.minute);
    }
  }
  const ycChancePct = Math.max(0, Math.min(100, await getInt("matches.yellowCardChancePct", 40)));
  const ycMaxDraws = Math.max(0, await getInt("matches.yellowCardMaxPerMatch", 4));
  if (ycChancePct > 0 && ycMaxDraws > 0) {
    const xiPool = allPlayers.filter((p) => playedIds.has(p.id));
    for (let d = 0; d < ycMaxDraws; d++) {
      if (rng() * 100 >= ycChancePct) continue;
      const target = xiPool.length > 0 ? xiPool[Math.floor(rng() * xiPool.length)] : null;
      if (!target) break;
      if (sendOffs.has(target.id)) continue; // a sent-off player cannot be booked
      const minute = 1 + Math.floor(rng() * 90);
      if (bookedIds.has(target.id)) {
        // SECOND yellow in the same match → send-off.
        sendOffs.set(target.id, 1 + Math.floor(rng() * maxSusp));
        events.push({ minute, type: "RED_CARD", clubId: clubIdOf(target), playerId: target.id, detail: "SECOND_YELLOW" });
      } else {
        bookedIds.add(target.id);
        events.push({ minute, type: "YELLOW_CARD", clubId: clubIdOf(target), playerId: target.id, detail: "" });
      }
    }
    events.sort((a, b) => a.minute - b.minute);
  }
  const ycThreshold = Math.max(1, await getInt("matches.yellowCardsForSuspension", 5));

  // 30s timeout (Task 26): the per-player update loop can exceed the 5s default
  // on busy SQLite matchdays — a failed tx must not wedge the fixture (the
  // scheduler now retries FAILED MATCH jobs on the next tick).
  await db.$transaction(
    async (tx) => {
      const match = await tx.match.create({
      data: {
        fixtureId: fixture.id, seed, homeId: fixture.homeId, awayId: fixture.awayId,
        homeGoals: sim.homeGoals, awayGoals: sim.awayGoals,
        possessionHome: sim.possessionHome, shotsHome: sim.shotsHome, shotsAway: sim.shotsAway,
        xgHomeX100: sim.xgHomeX100, xgAwayX100: sim.xgAwayX100,
        eventsJson: JSON.stringify(events), motmPlayerId: motm?.id ?? null, playedAt: now,
      },
    });
    for (const ev of events) {
      await tx.matchEvent.create({
        data: { matchId: match.id, minute: ev.minute, type: ev.type, clubId: ev.clubId, playerId: ev.playerId, detail: ev.detail },
      });
    }
    await tx.fixture.update({ where: { id: fixture.id }, data: { status: "PLAYED", matchId: match.id } });

    // Task 27 + Task 28: discipline + condition loop.
    // - Suspensions are served PER CLUB FIXTURE by the whole squad
    //   (deterministic — previously only the ~sampled subset served bans).
    // - Send-offs (straight red OR second yellow) START their ban with this
    //   fixture (set, not decremented).
    // - Yellow-card accumulation (Task 28): one count per booked player per
    //   match; reaching matches.yellowCardsForSuspension adds a ONE-match ban
    //   served from the NEXT fixture and resets the counter.
    // - Condition/morale/injury updates keep the historical sampling for
    //   squad players who did not feature.
    // - Injuries on featured players emit an INJURY event for the match report.
    const postEvents: Ev[] = [];
    for (const p of allPlayers) {
      const played = playedIds.has(p.id);
      const updateCondition = played || rng() >= 0.8;
      const isOffender = sendOffs.has(p.id);
      const booked = bookedIds.has(p.id);
      let yellowCards = p.yellowCards;
      let thresholdBan = 0;
      if (booked) {
        yellowCards += 1;
        if (yellowCards >= ycThreshold) {
          thresholdBan = 1;
          yellowCards = 0;
        }
      }
      const nextSuspension = isOffender
        ? (sendOffs.get(p.id) ?? 1) + thresholdBan
        : Math.max(0, p.suspension - 1) + thresholdBan;
      if (!updateCondition && nextSuspension === p.suspension && !booked) continue;
      const injury = updateCondition ? rng() < 0.02 + p.fatigue / 5000 : false;
      const delta = p.clubId === winningClub ? 4 : -2;
      await tx.player.update({
        where: { id: p.id },
        data: {
          ...(updateCondition
            ? {
                fatigue: Math.min(100, p.fatigue + 12 + Math.floor(rng() * 10)),
                sharpness: Math.min(100, p.sharpness + 4),
                form: Math.max(5, Math.min(95, p.form + (p.clubId === winningClub ? 3 : -1) + Math.floor((rng() - 0.5) * 4))),
                morale: Math.max(5, Math.min(95, p.morale + delta)),
                injuredUntil: injury ? new Date(now.getTime() + (2 + Math.floor(rng() * 8)) * 86400000) : p.injuredUntil,
              }
            : {}),
          suspension: nextSuspension,
          ...(booked ? { yellowCards } : {}),
        },
      });
      if (updateCondition && injury && played) {
        postEvents.push({ minute: 1 + Math.floor(rng() * 90), type: "INJURY", clubId: clubIdOf(p), playerId: p.id, detail: "" });
      }
    }
    for (const ev of postEvents) {
      await tx.matchEvent.create({
        data: { matchId: match.id, minute: ev.minute, type: ev.type, clubId: ev.clubId, playerId: ev.playerId, detail: ev.detail },
      });
    }

    if (fixture.competition === "LEAGUE") {
      await updateStanding(tx, fixture.seasonId, fixture.home.divisionId, fixture.homeId, sim.homeGoals, sim.awayGoals);
      await updateStanding(tx, fixture.seasonId, fixture.home.divisionId, fixture.awayId, sim.awayGoals, sim.homeGoals);
    } else if (fixture.competition === "REGIONAL_CUP" && fixture.regionId) {
      const winner =
        sim.homeGoals > sim.awayGoals ? fixture.homeId : sim.awayGoals > sim.homeGoals ? fixture.awayId : rng() < 0.5 ? fixture.homeId : fixture.awayId;
      const loser = winner === fixture.homeId ? fixture.awayId : fixture.homeId;
      knockoutWinner = winner;
      const round = fixture.round ?? 0;
      await tx.cupRun.updateMany({ where: { seasonId: fixture.seasonId, regionId: fixture.regionId, clubId: loser }, data: { eliminatedRound: round } });
      const roundTotal = await tx.fixture.count({ where: { seasonId: fixture.seasonId, competition: "REGIONAL_CUP", regionId: fixture.regionId, round } });
      const roundPlayed = await tx.fixture.count({ where: { seasonId: fixture.seasonId, competition: "REGIONAL_CUP", regionId: fixture.regionId, round, status: "PLAYED" } });
      if (roundPlayed >= roundTotal) await advanceCup(tx, fixture.seasonId, fixture.regionId, round);
    } else if (fixture.competition === "WORLD_CHAMPIONSHIP") {
      const stage = fixture.stage;
      if (stage === "LEAGUE" || stage === null) {
        for (const [clubId, gf, ga] of [
          [fixture.homeId, sim.homeGoals, sim.awayGoals],
          [fixture.awayId, sim.awayGoals, sim.homeGoals],
        ] as const) {
          const pts = gf > ga ? 3 : gf === ga ? 1 : 0;
          await tx.worldCupSlot
            .update({
              where: { seasonId_clubId: { seasonId: fixture.seasonId, clubId } },
              data: { points: { increment: pts }, played: { increment: 1 }, gf: { increment: gf }, ga: { increment: ga } },
            })
            .catch(() => undefined);
        }
        const total = await tx.fixture.count({ where: { seasonId: fixture.seasonId, competition: "WORLD_CHAMPIONSHIP", stage: "LEAGUE" } });
        const playedC = await tx.fixture.count({ where: { seasonId: fixture.seasonId, competition: "WORLD_CHAMPIONSHIP", stage: "LEAGUE", status: "PLAYED" } });
        if (playedC >= total) await advanceWorldCupKnockout(tx, fixture.seasonId, "QF", 12);
      } else {
        const winner =
          sim.homeGoals > sim.awayGoals ? fixture.homeId : sim.awayGoals > sim.homeGoals ? fixture.awayId : rng() < 0.5 ? fixture.homeId : fixture.awayId;
        const loser = winner === fixture.homeId ? fixture.awayId : fixture.homeId;
        knockoutWinner = winner;
        await tx.worldCupSlot.updateMany({ where: { seasonId: fixture.seasonId, clubId: loser }, data: { eliminatedStage: stage } });
        const nextStage: Record<string, { stage: "SF" | "F"; hour: number }> = { QF: { stage: "SF", hour: 15 }, SF: { stage: "F", hour: 20 } };
        if (stage in nextStage) {
          const stageTotal = await tx.fixture.count({ where: { seasonId: fixture.seasonId, competition: "WORLD_CHAMPIONSHIP", stage } });
          const stagePlayed = await tx.fixture.count({ where: { seasonId: fixture.seasonId, competition: "WORLD_CHAMPIONSHIP", stage, status: "PLAYED" } });
          if (stagePlayed >= stageTotal) {
            await advanceWorldCupKnockout(tx, fixture.seasonId, nextStage[stage].stage, nextStage[stage].hour);
          }
        }
      }
    }
    },
    { maxWait: 15_000, timeout: 30_000 },
  );

  // Revenues outside the state tx (idempotent via ledger keys)
  try {
    const gross = 60 + Math.floor(Math.random() * 40);
    await db.$transaction(async (tx) => {
      await creditClub(tx, fixture.homeId, Math.floor(gross * 0.7), "MATCH_REVENUE", `REVENUE:${fixture.id}`, "Matchday revenue (home)"); // Task 25-b: taxable club income (was TRANSFER_IN)
      await allocateRevenue(tx, { regionId: fixture.home.regionId, gross: Math.floor(gross * 0.3), idemBase: `REVENUE-ALLOC:${fixture.id}`, memo: "Matchday allocation" });
    });
  } catch {
    // revenue is best-effort; ledger idempotency protects duplicates
  }

  // Task 27: per-match WIN PRIZES — league winnings scale with the DIVISION
  // (1st division earns most, the last earns least), cup rounds escalate
  // round by round, world-cup group wins pay the configured minimum and
  // knockout rounds escalate; the FINAL of the cup / world cup pays the
  // configured CHAMPION prize instead of a round win prize, under the SAME
  // idempotency key as the season-transition payout (never paid twice).
  if (fixture.competition !== "FRIENDLY" && (winningClub || knockoutWinner)) {
    const prizeWinner = winningClub ?? knockoutWinner;
    try {
      let amount = 0;
      let championKey: string | null = null;
      let championMemo = "";
      if (fixture.competition === "LEAGUE") {
        const base = await getInt("competition.winPrizeLeague", 0);
        const step = await getInt("competition.winPrizeDivisionStepPct", 10);
        const division = await db.division.findUnique({ where: { id: fixture.home.divisionId }, select: { index: true } });
        const pct = divisionPrizeFactorPct(division?.index ?? 1, step);
        amount = Math.round((base * pct) / 100);
      } else if (fixture.competition === "REGIONAL_CUP") {
        if (fixture.stage === "F" && fixture.seasonId && prizeWinner) {
          championKey = `PRIZE:CUP:${fixture.seasonId}:${prizeWinner}`;
          championMemo = "Regional cup CHAMPION prize";
        } else {
          const base = await getInt("competition.winPrizeCup", 0);
          if (await getBool("competition.winPrizeCupRoundScale")) {
            const entrants = await db.cupRun.count({ where: { seasonId: fixture.seasonId, regionId: fixture.regionId ?? undefined } });
            const totalRounds = Math.max(2, Math.ceil(Math.log2(Math.max(2, entrants))));
            const round = Math.max(1, fixture.round ?? 1);
            amount = Math.round((base * round) / totalRounds);
          } else {
            amount = base;
          }
        }
      } else {
        const base = await getInt("competition.winPrizeWorld", 0);
        const stage = fixture.stage;
        if (stage === "F" && fixture.seasonId && prizeWinner) {
          championKey = `PRIZE:WORLD:${fixture.seasonId}:${prizeWinner}`;
          championMemo = "World Championship CHAMPION prize";
        } else if (!stage || stage === "LEAGUE") {
          const groupPct = Math.max(0, Math.min(100, await getInt("competition.winPrizeWorldGroupPct", 25)));
          amount = Math.round((base * groupPct) / 100);
        } else {
          // Knockout ladder QF → SF → F: 1/3 and 2/3 of the reference prize.
          const ladder = ["QF", "SF", "F"];
          const pos = Math.max(1, ladder.indexOf(stage) + 1);
          amount = Math.round((base * pos) / ladder.length);
        }
      }
      if (prizeWinner && championKey) {
        const championAmount = championKey.startsWith("PRIZE:CUP:")
          ? await getInt("competition.prizeCupBase", 2500)
          : await getInt("competition.prizeWorldBase", 10000);
        if (championAmount > 0) {
          await db.$transaction(async (tx) => {
            await creditClub(tx, prizeWinner, championAmount, "PRIZE", championKey, championMemo);
          });
        }
      } else if (prizeWinner && amount > 0) {
        const label =
          fixture.competition === "LEAGUE"
            ? `Win prize (league, division-scaled)`
            : fixture.competition === "REGIONAL_CUP"
              ? `Win prize (regional cup round ${fixture.round ?? 1})`
              : `Win prize (world cup ${fixture.stage === "LEAGUE" || !fixture.stage ? "group stage" : fixture.stage})`;
        await db.$transaction(async (tx) => {
          await creditClub(tx, prizeWinner, amount, "PRIZE", `PRIZE:WIN:${fixture.id}`, label);
        });
      }
    } catch {
      // prize is best-effort; ledger idempotency protects duplicates
    }
  }

  return { played: true, homeGoals: sim.homeGoals, awayGoals: sim.awayGoals };
}

async function updateStanding(tx: Tx, seasonId: string, divisionId: string, clubId: string, gf: number, ga: number) {
  const pts = gf > ga ? 3 : gf === ga ? 1 : 0;
  const existing = await tx.standing.findUnique({ where: { seasonId_divisionId_clubId: { seasonId, divisionId, clubId } } });
  if (!existing) {
    await tx.standing.create({
      data: { seasonId, divisionId, clubId, played: 1, won: gf > ga ? 1 : 0, drawn: gf === ga ? 1 : 0, lost: gf < ga ? 1 : 0, gf, ga, points: pts },
    });
  } else {
    await tx.standing.update({
      where: { id: existing.id },
      data: {
        played: { increment: 1 },
        won: { increment: gf > ga ? 1 : 0 },
        drawn: { increment: gf === ga ? 1 : 0 },
        lost: { increment: gf < ga ? 1 : 0 },
        gf: { increment: gf },
        ga: { increment: ga },
        points: { increment: pts },
      },
    });
  }
}

/** Generate next cup round among surviving clubs; mark champion when one remains. */
async function advanceCup(tx: Tx, seasonId: string, regionId: string, finishedRound: number) {
  const alive = await tx.cupRun.findMany({ where: { seasonId, regionId, eliminatedRound: null } });
  if (alive.length <= 1) {
    const champ = alive[0];
    if (champ) await tx.cupRun.update({ where: { id: champ.id }, data: { champion: true } });
    return;
  }
  const rng = mulberry32(seedFromString(`CUP-DRAW:${seasonId}:${regionId}:${finishedRound}`));
  const shuffled = alive
    .map((c) => ({ c, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c);
  const nextRound = finishedRound + 1;
  const stage = shuffled.length === 2 ? "F" : shuffled.length === 4 ? "SF" : shuffled.length === 8 ? "QF" : null;
  const CUP_DAY_MAP = [3, 6, 9, 12, 15, 18, 21, 24, 26, 28];
  const day = shuffled.length === 2 ? 29 : CUP_DAY_MAP[nextRound - 1] ?? 26;
  const kickoffHour = 17;
  const base = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    await tx.fixture.create({
      data: {
        seasonId, competition: "REGIONAL_CUP", round: nextRound, stage, regionId,
        matchDay: day,
        kickoffAt: new Date(
          base + day * 86400000 + kickoffHour * 3600000 +
          (await fixtureKickoffDeltaMs(regionId, `REGIONAL_CUP:${seasonId}:R${nextRound}:${shuffled[i].clubId}`))
        ),
        homeId: shuffled[i].clubId, awayId: shuffled[i + 1].clubId,
      },
    });
  }
}

async function advanceWorldCupKnockout(tx: Tx, seasonId: string, stage: "QF" | "SF" | "F", hourUtc: number) {
  if (stage === "QF") {
    const slots = await tx.worldCupSlot.findMany({ where: { seasonId } });
    const ranked = slots.sort((a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
    for (const s of ranked.slice(8)) {
      await tx.worldCupSlot.update({ where: { id: s.id }, data: { eliminatedStage: "LEAGUE" } });
    }
    const top8 = ranked.slice(0, 8);
    const base = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    for (let i = 0; i + 1 < top8.length; i += 2) {
      await tx.fixture.create({
        data: {
          seasonId, competition: "WORLD_CHAMPIONSHIP", stage, round: 0, matchDay: 30,
          kickoffAt: new Date(base + hourUtc * 3600000 + i * 3600000),
          homeId: top8[i].clubId, awayId: top8[i + 1].clubId,
        },
      });
    }
    return;
  }
  // SF / F: pair the surviving (non-eliminated) clubs
  const survivors = await tx.worldCupSlot.findMany({ where: { seasonId, eliminatedStage: null } });
  const base = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  for (let i = 0; i + 1 < survivors.length; i += 2) {
    await tx.fixture.create({
      data: {
        seasonId, competition: "WORLD_CHAMPIONSHIP", stage, round: 0, matchDay: 30,
        kickoffAt: new Date(base + hourUtc * 3600000),
        homeId: survivors[i].clubId, awayId: survivors[i + 1].clubId,
      },
    });
  }
}

/** Build the 40-club World Championship slots.
 * Qualification rule (user-mandated): ONLY first-division clubs qualify — top-N
 * per region (competition.worldCupSlots, default 3) + fill from the best
 * remaining 1st-division records. The single exception is a regional-cup
 * CHAMPION from a lower division, who earns a slot (pass-down to the region's
 * next-best 1st-division club if already qualified). */
export async function qualifyWorldCup(seasonId: string): Promise<number> {
  const existing = await db.worldCupSlot.count({ where: { seasonId } });
  if (existing > 0) return existing;
  // USER MANDATE: the Club World Cup is NOT played in Season 1 — no qualified
  // clubs exist for it yet (qualification requires a completed season's
  // standings). It is played from Season 2 onwards. Guarded here (defense in
  // depth) AND at the scheduler's day-30 trigger.
  const season = await db.season.findUnique({ where: { id: seasonId }, select: { number: true } });
  if (!season || season.number < 2) return 0;
  // League places that qualify per region's first division (user rule: top 3).
  const wcSlots = Math.max(1, await getInt("competition.worldCupSlots", 3));
  const regions = await db.region.findMany({ include: { divisions: { where: { index: 1 } } } });
  const slots: { clubId: string; source: "LEAGUE" | "CUP" }[] = [];
  for (const region of regions) {
    const div = region.divisions[0];
    if (!div) continue;
    const standings = await db.standing.findMany({
      where: { seasonId, divisionId: div.id },
      orderBy: [{ points: "desc" }, { gf: "desc" }, { ga: "asc" }],
      take: wcSlots + 1, // +1 keeps the pass-down candidate available
    });
    for (const s of standings.slice(0, wcSlots)) slots.push({ clubId: s.clubId, source: "LEAGUE" });
  }
  // Cup winners (champion or deepest run) per region
  const cupChampions = await db.cupRun.findMany({ where: { seasonId, champion: true } });
  for (const c of cupChampions) {
    if (!slots.some((s) => s.clubId === c.clubId)) slots.push({ clubId: c.clubId, source: "CUP" });
    else {
      // pass-down: fourth-placed First Division club of that region
      const region = await db.club.findUnique({ where: { id: c.clubId }, select: { regionId: true } });
      if (region) {
        const div = await db.division.findFirst({ where: { regionId: region.regionId, index: 1 } });
        if (div) {
          const standings = await db.standing.findMany({
            where: { seasonId, divisionId: div.id },
            orderBy: [{ points: "desc" }, { gf: "desc" }, { ga: "asc" }],
            take: wcSlots + 1,
          });
          const passDown = standings[wcSlots]; // first non-qualified league place
          if (passDown && !slots.some((s) => s.clubId === passDown.clubId)) slots.push({ clubId: passDown.clubId, source: "CUP" });
        }
      }
    }
  }
  if (slots.length < 40) {
    // Fill remaining seats with the best still-unqualified FIRST-DIVISION records.
    // Lower-division clubs can only reach the World Championship by WINNING their
    // regional cup (handled above) — never via fill or deepest-run wildcards.
    const filled = new Set(slots.map((s) => s.clubId));
    const firstDivs = await db.division.findMany({ where: { index: 1 }, select: { id: true } });
    const table = await db.standing.findMany({
      where: { seasonId, divisionId: { in: firstDivs.map((d) => d.id) } },
      orderBy: [{ points: "desc" }, { gf: "desc" }, { ga: "asc" }],
    });
    for (const s of table) {
      if (slots.length >= 40) break;
      if (!filled.has(s.clubId)) {
        slots.push({ clubId: s.clubId, source: "LEAGUE" });
        filled.add(s.clubId);
      }
    }
  }
  await db.worldCupSlot.createMany({ data: slots.slice(0, 40).map((s) => ({ seasonId, clubId: s.clubId, source: s.source })) });
  // League phase: 5 rounds of 20 matches on day 30 — each round's pairs are
  // spread EVENLY across its hour (3-minute steps) so the scheduler never
  // fires 20 simulations at the same instant (Task 28, server-load rule).
  const base = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const rng = mulberry32(seedFromString(`WC-DRAW:${seasonId}`));
  let pool = slots.slice(0, 40).map((s) => s.clubId).sort(() => rng() - 0.5);
  const pairsPerRound = Math.max(1, Math.floor(pool.length / 2));
  for (let round = 1; round <= 5; round++) {
    for (let i = 0; i + 1 < pool.length; i += 2) {
      await db.fixture.create({
        data: {
          seasonId, competition: "WORLD_CHAMPIONSHIP", stage: "LEAGUE", round, matchDay: 30,
          kickoffAt: new Date(base + (1 + round) * 3600000 + Math.floor((i / pairsPerRound) * 60) * 60000),
          homeId: pool[i], awayId: pool[i + 1],
        },
      });
    }
    pool = [...pool.slice(1), pool[0]].sort(() => rng() - 0.5); // rotate for variety
  }
  return slots.length;
}
