// Knight FM — match execution (KMIE) + competition state updates (spec §15, §19).
// Server-authoritative; invoked only by the durable scheduler when kickoffAt has passed.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { simulateMatch, TeamStrengthInput, mulberry32, seedFromString } from "@/lib/engine/kmie";
import { computeContextualOvr, positionFit } from "@/lib/engine/ovr";
import { deriveConditions, medicalInjuryMul } from "@/lib/engine/conditions";
import { runTramaMatch } from "@/lib/engine/trama";
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
  players: { position: Position; ovr: number; fatigue: number; sharpness: number; morale: number; confidence: number; roleFit?: number }[],
  formation: Formation
): TeamStrengthInput {
  const ctx = (p: (typeof players)[number]) =>
    computeContextualOvr({ rawOvr: p.ovr, fatigue: p.fatigue, sharpness: p.sharpness, morale: p.morale, confidence: p.confidence, roleFit: p.roleFit ?? 1 });
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

// KMIE 2.0 (Task 100): in/out-possession style effects. The Lineup.inPossession /
// outOfPossession columns existed since genesis but were DEAD — never accepted by
// the tactics API and never applied by the engine (tacticsFactor was hardcoded 1.0).
// Effects are deliberately modest (±2..5%) so style refines strength, never replaces it.
const IN_STYLE_EFFECT: Record<string, { atk: number; poss: number }> = {
  balanced: { atk: 1.0, poss: 0 },
  possession: { atk: 1.02, poss: 5 },
  direct: { atk: 1.04, poss: -5 },
  counter: { atk: 1.03, poss: -3 },
};
const OUT_STYLE_EFFECT: Record<string, { def: number; inj: number }> = {
  "mid-block": { def: 1.0, inj: 1.0 },
  "high-press": { def: 1.03, inj: 1.05 },
  "low-block": { def: 1.05, inj: 1.0 },
};
function styleFactors(lineup: { inPossession?: string; outOfPossession?: string } | null | undefined): {
  attackFactor: number;
  defenseFactor: number;
  possessionBias: number;
  injuryMul: number;
} {
  const inE = IN_STYLE_EFFECT[lineup?.inPossession ?? "balanced"] ?? IN_STYLE_EFFECT.balanced;
  const outE = OUT_STYLE_EFFECT[lineup?.outOfPossession ?? "mid-block"] ?? OUT_STYLE_EFFECT["mid-block"];
  return {
    attackFactor: inE.atk,
    defenseFactor: outE.def * (lineup?.inPossession === "counter" ? 1.02 : 1),
    possessionBias: inE.poss,
    injuryMul: outE.inj,
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
      home: { include: { players: true, lineups: true, facilities: true, region: { select: { index: true } } } },
      away: { include: { players: true, lineups: true, facilities: true, region: { select: { index: true } } } },
    },
  });
  if (!fixture || fixture.status !== "SCHEDULED" || fixture.match) return { played: false };

  const now = new Date();
  const rng = mulberry32(seedFromString(`KMIE-EV:${fixture.id}`));

  const buildXI = (club: typeof fixture.home): {
    ids: string[]; strength: TeamStrengthInput; style: ReturnType<typeof styleFactors>;
    details: { ages: number[]; fatigueAvg: number; moraleConf: number; youthCount: number };
  } => {
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
    // KMIE 2.0 (Task 100): positional fit now affects effective strength — a DF
    // slotted into MF contributes his contextual OVR × roleFit (0.55), so bad
    // manual lineups and injuries in the wrong zone genuinely cost quality.
    const slotPosById = new Map(slots.map((s) => [s.id, s.pos] as const));
    const slotIdOfPlayer = new Map<string, string>();
    for (const [slotId, playerId] of chosen) slotIdOfPlayer.set(playerId, slotId);
    const xiBase = xiIds.length >= 7 ? eligible.filter((p) => xiIds.includes(p.id)) : eligible.slice(0, 11);
    const xi = xiBase.map((p) => {
      const slotId = slotIdOfPlayer.get(p.id);
      const slotPos = slotId ? slotPosById.get(slotId) : undefined;
      return {
        position: p.position as Position, ovr: p.ovr, fatigue: p.fatigue, sharpness: p.sharpness, morale: p.morale, confidence: p.confidence,
        roleFit: slotPos ? positionFit(p.position as Position, slotPos) : 1,
      };
    });
    const details = {
      ages: xiBase.map((p) => p.age),
      fatigueAvg: xiBase.length ? xiBase.reduce((a, b) => a + b.fatigue, 0) / xiBase.length : 20,
      moraleConf: xiBase.length ? xiBase.reduce((a, b) => a + (b.morale + b.confidence) / 2, 0) / xiBase.length : 60,
      youthCount: xiBase.filter((p) => p.age < 21).length,
    };
    return { ids: xi.map((_, i) => xiIds[i] ?? ""), strength: strengthFromPlayers(xi, formation), style: styleFactors(club.lineups), details };
  };

  const homeXI = buildXI(fixture.home);
  const awayXI = buildXI(fixture.away);

  // KMIE 2.0 (Task 100): weather / pitch / referee / hidden day-form, all
  // deterministic from the fixture seed. Region.index picks the climate band;
  // home STADIUM level drives pitch state.
  const facilityLevel = (club: typeof fixture.home, type: string): number =>
    club.facilities?.find((f) => f.type === type)?.level ?? 1;
  const [weatherEnabled, pitchEnabled] = await Promise.all([
    getBool("matches.weatherEnabled"),
    getBool("matches.pitchEnabled"),
  ]);
  const [dayFormPct, refereeVariancePct] = await Promise.all([
    getInt("matches.dayFormPct", 10),
    getInt("matches.refereeVariancePct", 20),
  ]);
  const cond = deriveConditions(`${fixture.season.number}:${fixture.competition}:${fixture.id}`, {
    regionIndex: fixture.home.region?.index ?? 5,
    homeStadiumLevel: facilityLevel(fixture.home, "STADIUM"),
    weatherEnabled,
    pitchEnabled,
    dayFormPct,
    refereeVariancePct,
  });

  const homeStrength: TeamStrengthInput = {
    ...homeXI.strength,
    attackFactor: homeXI.style.attackFactor,
    defenseFactor: homeXI.style.defenseFactor,
    possessionBias: homeXI.style.possessionBias,
  };
  const awayStrength: TeamStrengthInput = {
    ...awayXI.strength,
    attackFactor: awayXI.style.attackFactor,
    defenseFactor: awayXI.style.defenseFactor,
    possessionBias: awayXI.style.possessionBias,
  };
  const seed = `KMIE:${fixture.season.number}:${fixture.competition}:${fixture.id}`;

  // Task 101 — TRAMA engine (spec "Parte 3"): five-thread knot simulation.
  // Enabled by trama.enabled (default true); when false the legacy Poisson
  // aggregate path runs. Both paths are deterministic from the same seed.
  const tramaEnabled = await getBool("trama.enabled");
  const [chaosBudget, blackSwanPerMil, homeAdvCapPct] = await Promise.all([
    getInt("trama.chaosBudget", 4),
    getInt("trama.blackSwanPerMil", 3),
    getInt("trama.homeAdvCapPct", 3),
  ]);
  const trama = tramaEnabled
    ? runTramaMatch(
        seed,
        {
          strength: homeStrength,
          ages: homeXI.details.ages,
          fatigueAvg: homeXI.details.fatigueAvg,
          moraleConf: homeXI.details.moraleConf,
          youthCount: homeXI.details.youthCount,
          stadiumLevel: facilityLevel(fixture.home, "STADIUM"),
        },
        {
          strength: awayStrength,
          ages: awayXI.details.ages,
          fatigueAvg: awayXI.details.fatigueAvg,
          moraleConf: awayXI.details.moraleConf,
          youthCount: awayXI.details.youthCount,
          stadiumLevel: facilityLevel(fixture.away, "STADIUM"),
        },
        cond,
        { competition: fixture.competition, stage: fixture.stage ?? null },
        { chaosBudget, blackSwanPerMil, homeAdvCapPct }
      )
    : null;
  const sim = trama
    ? {
        homeGoals: trama.homeGoals,
        awayGoals: trama.awayGoals,
        possessionHome: trama.possessionHome,
        shotsHome: trama.shotsHome,
        shotsAway: trama.shotsAway,
        xgHomeX100: trama.xgHomeX100,
        xgAwayX100: trama.xgAwayX100,
      }
    : simulateMatch(seed, homeStrength, awayStrength, cond);

  const allPlayers = [...fixture.home.players, ...fixture.away.players].filter((p) => !p.retired && !p.isYouth);
  // MatchEvent.clubId is non-nullable; resolve the club by squad membership.
  const clubIdOf = (p: (typeof allPlayers)[number]): string =>
    fixture.home.players.some((q) => q.id === p.id) ? fixture.homeId : fixture.awayId;
  const scorerPool = allPlayers.filter((p) => p.position === "FW" || p.position === "MF");
  const assistPool = allPlayers.filter((p) => p.position === "MF" || p.position === "DF");

  interface Ev { minute: number; type: string; clubId: string; playerId: string | null; detail: string }
  const events: Ev[] = [];
  // KMIE 2.0 (Task 100): pre-match conditions as minute-0 events — visible in the
  // match report, hidden day-form deliberately NOT reported. clubId anchors the
  // conditions to the HOME club (pitch owner); the dialog renders them neutrally.
  events.push(
    { minute: 0, type: "WEATHER", clubId: fixture.homeId, playerId: null, detail: `${cond.weather}|${cond.tempC}C|${cond.windKmh}kmh` },
    { minute: 0, type: "PITCH", clubId: fixture.homeId, playerId: null, detail: cond.pitch },
    { minute: 0, type: "REFEREE", clubId: fixture.homeId, playerId: null, detail: cond.referee },
  );
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
      addGoalAt(clubId, minute, "", false);
    }
  };
  const addGoalAt = (clubId: string, minute: number, detail: string, penalty: boolean) => {
    const scorer = weightedPick(scorerPool.filter((p) => p.clubId === clubId));
    const assister = rng() < 0.72 ? weightedPick(assistPool.filter((p) => p.clubId === clubId && p.id !== scorer?.id), 42) : null;
    events.push({ minute, type: "GOAL", clubId, playerId: scorer?.id ?? null, detail });
    if (assister) events.push({ minute, type: "ASSIST", clubId, playerId: assister.id, detail: "" });
    void penalty;
  };
  if (trama) {
    // TRAMA: minutes, bands and CAUSES come from the knot engine (spec 3.12:
    // every event carries its causes, e.g. "CLIMA +0.20 · TERRENO +0.18").
    for (const g of trama.goalsHome) addGoalAt(fixture.homeId, g.minute, g.causes || g.band, g.penalty);
    for (const g of trama.goalsAway) addGoalAt(fixture.awayId, g.minute, g.causes || g.band, g.penalty);
    for (const pen of trama.penalties) {
      if (!pen.scored) {
        const clubId = pen.side === "home" ? fixture.homeId : fixture.awayId;
        const taker = weightedPick(scorerPool.filter((p) => p.clubId === clubId));
        events.push({ minute: pen.minute, type: "MISSED_PENALTY", clubId, playerId: taker?.id ?? null, detail: "" });
      }
    }
  } else {
    addGoals(fixture.homeId, sim.homeGoals);
    addGoals(fixture.awayId, sim.awayGoals);
  }
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
  const maxSusp = Math.max(1, await getInt("matches.redCardSuspensionMatches", 2));
  if (trama) {
    // Task 101 — TRAMA discipline (3.8): cards come from in-match fouls scaled
    // by the referee severity, not from flat per-match draws. Player picks are
    // weighted uniform over that side's XI; a booked player picked again is his
    // second yellow (same ban ladder as Task 28).
    const xiOf = (side: "home" | "away") =>
      allPlayers.filter((p) => playedIds.has(p.id) && (side === "home" ? p.clubId === fixture.homeId : p.clubId === fixture.awayId));
    for (const c of trama.cards) {
      const pool = xiOf(c.side);
      const target = pool.length > 0 ? pool[Math.floor(rng() * pool.length)] : null;
      if (!target) continue;
      const clubId = c.side === "home" ? fixture.homeId : fixture.awayId;
      if (c.kind === "YELLOW") {
        if (bookedIds.has(target.id)) {
          sendOffs.set(target.id, 1 + Math.floor(rng() * maxSusp));
          events.push({ minute: c.minute, type: "RED_CARD", clubId, playerId: target.id, detail: "SECOND_YELLOW" });
        } else {
          bookedIds.add(target.id);
          events.push({ minute: c.minute, type: "YELLOW_CARD", clubId, playerId: target.id, detail: "" });
        }
      } else {
        sendOffs.set(target.id, 1 + Math.floor(rng() * maxSusp));
        events.push({ minute: c.minute, type: "RED_CARD", clubId, playerId: target.id, detail: c.kind === "RED_SECOND" ? "SECOND_YELLOW" : "" });
      }
    }
    events.sort((a, b) => a.minute - b.minute);
  } else {
  const redChancePct = Math.max(0, Math.min(100, await getInt("matches.redCardChancePct", 5)));
  const redChance = Math.min(100, redChancePct * cond.cardMul);
  if (redChance > 0 && rng() * 100 < redChance) {
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
  const ycChance = Math.min(100, ycChancePct * cond.cardMul);
  if (ycChance > 0 && ycMaxDraws > 0) {
    const xiPool = allPlayers.filter((p) => playedIds.has(p.id));
    for (let d = 0; d < ycMaxDraws; d++) {
      if (rng() * 100 >= ycChance) continue;
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
    // - Task 100 (KMIE 2.0): injury chance now scales with weather/pitch
    //   (conditions.injuryFactor), the club's MEDICAL_CENTER + SPORTS_SCIENCE
    //   levels (medicalInjuryMul) and the team's out-of-possession style
    //   (high-press ×1.05). HAPPINESS: unused players react to the result —
    //   bench of the winner +1 morale, bench of the loser −1 (draw 0) — so
    //   rotation and losing streaks feed back into future matches via the
    //   contextual-OVR state factor.
    const postEvents: Ev[] = [];
    // Task 101 — TRAMA injuries assigned to concrete players (weighted by
    // fatigue — tired players break more, spec 3.5).
    const tramaInjuredIds = new Map<string, { severity: "KNOCK" | "MUSCLE"; minute: number }>();
    if (trama) {
      for (const inj of trama.injuries) {
        const clubId = inj.side === "home" ? fixture.homeId : fixture.awayId;
        const pool = allPlayers.filter((p) => p.clubId === clubId && playedIds.has(p.id));
        if (pool.length === 0) continue;
        const weights = pool.map((p) => Math.max(1, p.fatigue));
        const total = weights.reduce((a, b) => a + b, 0);
        let r = rng() * total;
        let picked = pool[pool.length - 1];
        for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { picked = pool[i]; break; } }
        tramaInjuredIds.set(picked.id, { severity: inj.severity, minute: inj.minute });
      }
    }
    const medicalMul = (clubId: string): number => {
      const club = clubId === fixture.homeId ? fixture.home : fixture.away;
      return medicalInjuryMul(facilityLevel(club, "MEDICAL_CENTER"), facilityLevel(club, "SPORTS_SCIENCE"));
    };
    const styleInj = (clubId: string): number => (clubId === fixture.homeId ? homeXI.style.injuryMul : awayXI.style.injuryMul);
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
      const happinessDelta = played ? 0 : winningClub === null ? 0 : p.clubId === winningClub ? 1 : -1;
      if (!updateCondition && nextSuspension === p.suspension && !booked && happinessDelta === 0) continue;
      const injury = updateCondition
        ? trama
          ? tramaInjuredIds.has(p.id)
          : rng() < (0.02 + p.fatigue / 5000) * cond.injuryFactor * medicalMul(p.clubId ?? fixture.homeId) * styleInj(p.clubId ?? fixture.homeId)
        : false;
      const delta = p.clubId === winningClub ? 4 : -2;
      const moodDelta = trama ? (p.clubId === fixture.homeId ? trama.moodHome : trama.moodAway) : 0;
      const fatigueDelta = trama ? (p.clubId === fixture.homeId ? trama.fatigueDeltaHome : trama.fatigueDeltaAway) : 12 + Math.floor(rng() * 10);
      const injDays = injury
        ? trama
          ? tramaInjuredIds.get(p.id)?.severity === "MUSCLE"
            ? 4 + Math.floor(rng() * 6)
            : 1 + Math.floor(rng() * 3)
          : 2 + Math.floor(rng() * 8)
        : 0;
      await tx.player.update({
        where: { id: p.id },
        data: {
          ...(updateCondition
            ? {
                fatigue: Math.min(100, p.fatigue + fatigueDelta),
                sharpness: Math.min(100, p.sharpness + 4),
                form: Math.max(5, Math.min(95, p.form + (p.clubId === winningClub ? 3 : -1) + Math.floor((rng() - 0.5) * 4))),
                morale: Math.max(5, Math.min(95, p.morale + delta + moodDelta)),
                injuredUntil: injury ? new Date(now.getTime() + injDays * 86400000) : p.injuredUntil,
              }
            : { morale: Math.max(5, Math.min(95, p.morale + happinessDelta)) }),
          suspension: nextSuspension,
          ...(booked ? { yellowCards } : {}),
        },
      });
      if (updateCondition && injury && played) {
        postEvents.push({ minute: trama ? tramaInjuredIds.get(p.id)?.minute ?? 45 : 1 + Math.floor(rng() * 90), type: "INJURY", clubId: clubIdOf(p), playerId: p.id, detail: "" });
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

  // Revenues outside the state tx (idempotent via ledger keys).
  // USER MANDATE: FRIENDLIES generate NO income at all — no gate receipts, no
  // home matchday revenue, no regional/system allocation. They exist purely to
  // test tactics and cost the scheduling fee + real player energy.
  if (fixture.competition !== "FRIENDLY") {
    try {
      const gross = 60 + Math.floor(Math.random() * 40);
      await db.$transaction(async (tx) => {
        await creditClub(tx, fixture.homeId, Math.floor(gross * 0.7), "MATCH_REVENUE", `REVENUE:${fixture.id}`, "Matchday revenue (home)"); // Task 25-b: taxable club income (was TRANSFER_IN)
        await allocateRevenue(tx, { regionId: fixture.home.regionId, gross: Math.floor(gross * 0.3), idemBase: `REVENUE-ALLOC:${fixture.id}`, memo: "Matchday allocation" });
      });
    } catch {
      // revenue is best-effort; ledger idempotency protects duplicates
    }
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
