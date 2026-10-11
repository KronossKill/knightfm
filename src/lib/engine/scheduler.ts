// Knight FM — durable catch-up scheduler (spec §16, §17, §18, D-002).
// Every job has a deterministic idempotency key recorded in JobRun. The scheduler
// replays missed days without inventing world time (UTC only, no manual advance).

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getInt } from "@/lib/config";
import { currentGameDay, getWorldEpochMs, resolveSeason, dayStartUtcMs } from "@/lib/engine/clock";
import { applyUserFundsLevy, creditPersonal, debitClub, creditClub, debitPersonal } from "@/lib/engine/finance";
import { simulateFixture, qualifyWorldCup } from "@/lib/engine/matches";
import { generateSeasonCompetitions } from "@/lib/engine/fixtures";
import { runSeasonMovements, sortTable } from "@/lib/engine/promotions";
import { SEASON_TOTAL_DAYS } from "@/lib/types";
import { ageEveryone } from "@/lib/engine/aging";
import { runInactivity } from "@/lib/engine/inactivity";
import { generatePlayerName } from "@/lib/engine/names";
import { getYouthCapacity } from "@/lib/engine/training";
import { divisionPrizeFactorPct } from "@/lib/engine/prizes";
import { computeBaseMarketValue, applyValueMultiplier, computeSalary, computeReleaseClause, starsFromOvr } from "@/lib/engine/ovr";
import { mulberry32, seedFromString } from "@/lib/engine/kmie";
import { runWeeklySalaries } from "@/lib/engine/salary";
// Task 78 consolidation: the auction settlement is the SAME honest closer the
// market endpoints use (engine/auctions.ts). The old local closeExpiredAuctions
// credited sellers and "refunded" losing bids without ever debiting the winner
// (money from nothing) and ignored the systemOwned seller routing — deleted.
import { closeDueAuctions } from "@/lib/engine/auctions";

// Task 77 (user mandate): paySalaries lives in @/lib/engine/salary.ts now —
// re-exported here so existing verification scripts keep their import path.
export { paySalaries } from "@/lib/engine/salary";

let running = false;
let lastRunAt = 0;

export function schedulerStatus() {
  return { running, lastRunAt: new Date(lastRunAt).toISOString() };
}

async function beginJob(idemKey: string, jobType: string, scheduledFor: Date, payload: Record<string, unknown> = {}): Promise<boolean> {
  try {
    await db.jobRun.create({ data: { idempotencyKey: idemKey, jobType, scheduledFor, payload: JSON.stringify(payload) } });
    return true;
  } catch {
    return false; // already recorded → idempotent skip
  }
}

async function endJob(idemKey: string, outcome: "OK" | "FAILED" | "SKIPPED", error?: string) {
  await db.jobRun.update({ where: { idempotencyKey: idemKey }, data: { completedAt: new Date(), outcome, error } }).catch(() => undefined);
}

/** Main entry — opportunistic catch-up. Safe to call from any request. */
// SECURITY (pentest fix — unbounded catch-up DoS): the epoch is admin-settable
// (season-start 1970–2100), so a huge gap between lastDay and today used to run
// EVERY due day in one invocation, wedging the single-process engine for hours.
// Each invocation now processes at most MAX_DAYS_PER_RUN days; the remainder is
// picked up by the next trigger (JobRun is idempotent, nothing is lost).
const MAX_DAYS_PER_RUN = 7;

export async function processDueJobs(): Promise<{ processedDays: number; matches: number; payrolls: number }> {
  if (running) return { processedDays: 0, matches: 0, payrolls: 0 };
  running = true;
  let matches = 0;
  let payrolls = 0;
  try {
    const epoch = await getWorldEpochMs();
    const today = 1 + Math.floor((Date.now() - epoch) / 86400000);
    const lastRow = await db.systemState.findUnique({ where: { key: "scheduler.lastDay" } });
    const lastDay = lastRow ? parseInt(lastRow.value, 10) : 0;

    let processedDays = 0;
    if (today > lastDay) {
      const endDay = Math.min(today, lastDay + MAX_DAYS_PER_RUN);
      for (let day = Math.max(lastDay + 1, 1); day <= endDay; day++) {
        await runDayJobs(day, epoch);
        processedDays++;
      }
      // Advance the cursor ONLY past the days actually completed (crash-safe:
      // an interrupted run resumes from the same day, never skips).
      await db.systemState.upsert({ where: { key: "scheduler.lastDay" }, create: { key: "scheduler.lastDay", value: String(endDay) }, update: { value: String(endDay) } });
    }

    // Lazy loan returns: players whose loan has ended rejoin their origin club
    // immediately on any tick (self-idempotent: rows only match while due).
    await returnLoanedPlayers(today).catch(() => undefined);

    // Weekly payroll (Task 77, user mandate): every SUNDAY at 01:00 server
    // time (UTC). Lazy + idempotent — pays every due Sunday since the last
    // recorded payday exactly once (JobRun + ledger idempotency keys), so any
    // number of ticks/instances can call it safely. A FAILED Sunday is
    // retried by the next tick; the exception is swallowed here because the
    // JobRun row already records the failure and /api/cron/salary surfaces it.
    try {
      payrolls = (await runWeeklySalaries()).paid;
    } catch {
      // retry on the next tick (JobRun FAILED row is cleared there)
    }

    // Due matches (event-timestamp driven, any UTC instant)
    const due = await db.fixture.findMany({
      where: { status: "SCHEDULED", kickoffAt: { lte: new Date() } },
      select: { id: true },
      take: 400,
    });
    for (const f of due) {
      // Spec §44.4 (recoverable): a FAILED attempt (e.g. the 5s SQLite tx timeout
      // seen on busy matchdays) must not wedge the fixture forever. simulateFixture
      // is state-idempotent (SCHEDULED + no Match row), so clearing the FAILED
      // row makes the next tick retry it safely.
      await db.jobRun.deleteMany({ where: { idempotencyKey: `MATCH:${f.id}`, outcome: "FAILED" } }).catch(() => undefined);
      const began = await beginJob(`MATCH:${f.id}`, "MATCH", new Date());
      if (!began) continue;
      try {
        const r = await simulateFixture(f.id);
        if (r.played) matches++;
        await endJob(`MATCH:${f.id}`, "OK");
      } catch (e) {
        await endJob(`MATCH:${f.id}`, "FAILED", String(e));
      }
    }

    // Expired auctions — single honest settlement path (engine/auctions.ts):
    // winner is debited at settlement, insolvent/frozen/self-dealing bidders are
    // skipped, system-club sale proceeds flow to the SYSTEM fund.
    await closeDueAuctions();

    // World Cup qualification on the configured final day. USER MANDATE: the
    // Club World Cup is NOT played in Season 1 (no qualified clubs exist yet —
    // qualification requires a completed season); it is played from Season 2
    // onwards. qualifyWorldCup re-checks the season number internally.
    const season = await resolveSeason(today);
    if (season && season.number >= 2 && season.seasonDay === 30 && season.phase === "COMPETITIVE") {
      const began = await beginJob(`WORLD-CUP:${season.id}`, "WORLD_CUP_QUALIFY", new Date());
      if (began) {
        try {
          await qualifyWorldCup(season.id);
          await endJob(`WORLD-CUP:${season.id}`, "OK");
        } catch (e) {
          await endJob(`WORLD-CUP:${season.id}`, "FAILED", String(e));
        }
      }
    }

    lastRunAt = Date.now();
    return { processedDays, matches, payrolls };
  } finally {
    running = false;
  }
}

/** Run the §16.1 daily timeline for an absolute game day. */
async function runDayJobs(day: number, epochMs: number) {
  const season = await resolveSeason(day);
  const dayStart = dayStartUtcMs(epochMs, day);

  if (await beginJob(`ROLLOVER:${day}`, "ROLLOVER", new Date(dayStart))) {
    await endJob(`ROLLOVER:${day}`, "OK");
  }

  // Salaries: MOVED OUT of the per-day timeline (Task 77, user mandate).
  // Payroll now runs on a FIXED calendar schedule — every SUNDAY at 01:00
  // server time (UTC) — via the lazy, idempotent trigger runWeeklySalaries()
  // in processDueJobs() and the /api/cron/salary Vercel Cron endpoint.
  // (Legacy JobRun rows jobType="SALARY" remain as audit history; the new
  // migration treats the last one as the coverage baseline, never double-pays.)

  // 00:30 — daily recovery: rest rooms + physio/medic/analyst staff effects.
  if (await beginJob(`RECOVERY:${day}`, "DAILY_RECOVERY", new Date(dayStart + 1800000))) {
    try {
      await dailyRecovery(day);
      await endJob(`RECOVERY:${day}`, "OK");
    } catch (e) {
      await endJob(`RECOVERY:${day}`, "FAILED", String(e));
    }
  }

  // 00:35 — player birthdays (Task 23-d): every person ages on their own
  // birthday — the day they first appeared — every EXACTLY 30 real-time days.
  if (await beginJob(`AGING:${day}`, "AGING", new Date(dayStart + 2100000))) {
    try {
      await ageEveryone(day);
      await endJob(`AGING:${day}`, "OK");
    } catch (e) {
      await endJob(`AGING:${day}`, "FAILED", String(e));
    }
  }

  // 00:40 — loan returns: players whose loan ended rejoin their origin club.
  if (await beginJob(`LOANRET:${day}`, "LOAN_RETURN", new Date(dayStart + 2400000))) {
    try {
      await returnLoanedPlayers(day);
      await endJob(`LOANRET:${day}`, "OK");
    } catch (e) {
      await endJob(`LOANRET:${day}`, "FAILED", String(e));
    }
  }

  // 00:02 — training bookkeeping (weekly snapshots). Session effects are now
  // user-triggered via POST /api/training/run with per-day limits (training.*).
  if (await beginJob(`TRAINING:${day}`, "TRAINING", new Date(dayStart))) {
    try {
      await weeklySnapshots(day, season?.number ?? 1, season?.startEpochDay ?? 1);
      await endJob(`TRAINING:${day}`, "OK");
    } catch (e) {
      await endJob(`TRAINING:${day}`, "FAILED", String(e));
    }
  }

  // 00:05 — facility/timer sweep
  if (await beginJob(`TIMER-SWEEP:${day}`, "TIMER_SWEEP", new Date(dayStart))) {
    try {
      await completeFacilities();
      await endJob(`TIMER-SWEEP:${day}`, "OK");
    } catch (e) {
      await endJob(`TIMER-SWEEP:${day}`, "FAILED", String(e));
    }
  }

  // 00:10 — insolvency evaluation
  if (season && await beginJob(`INSOLVENCY:${season.id}:${day}`, "INSOLVENCY", new Date(dayStart))) {
    try {
      await insolvencyEvaluation(day);
      await endJob(`INSOLVENCY:${season.id}:${day}`, "OK");
    } catch (e) {
      await endJob(`INSOLVENCY:${season.id}:${day}`, "FAILED", String(e));
    }
  }

  // 00:15 — referral settlement
  if (await beginJob(`REFERRAL:${day}`, "REFERRAL", new Date(dayStart))) {
    try {
      await settleReferrals(day);
      await endJob(`REFERRAL:${day}`, "OK");
    } catch (e) {
      await endJob(`REFERRAL:${day}`, "FAILED", String(e));
    }
  }

  // 00:20 — account lifecycle (Task 25-a): mark INACTIVE after
  // users.inactiveAfterDays and hard-delete after users.deleteAfterDays
  // (owned clubs revert to the system with their original name; ADMIN never expires).
  if (await beginJob(`INACTIVITY:${day}`, "INACTIVITY", new Date(dayStart + 20 * 60000))) {
    try {
      await runInactivity(day);
      await endJob(`INACTIVITY:${day}`, "OK");
    } catch (e) {
      await endJob(`INACTIVITY:${day}`, "FAILED", String(e));
    }
  }

  // 01:00 — financial reconciliation
  if (await beginJob(`FIN-RECON:${day}`, "FIN_RECON", new Date(dayStart + 3600000))) {
    try {
      await financialReconciliation(day);
      await endJob(`FIN-RECON:${day}`, "OK");
    } catch (e) {
      await endJob(`FIN-RECON:${day}`, "FAILED", String(e));
    }
  }

  // 05:00 — youth/scouting cycle
  if (season && await beginJob(`YOUTH:${season.id}:${day}`, "YOUTH", new Date(dayStart + 5 * 3600000))) {
    try {
      await youthCycle(day, season.id);
      await endJob(`YOUTH:${season.id}:${day}`, "OK");
    } catch (e) {
      await endJob(`YOUTH:${season.id}:${day}`, "FAILED", String(e));
    }
  }

  // 06:00 — free-agent refresh
  if (await beginJob(`FREE-AGENT:${day}`, "FREE_AGENT", new Date(dayStart + 6 * 3600000))) {
    try {
      await freeAgentRefresh(day);
      await endJob(`FREE-AGENT:${day}`, "OK");
    } catch (e) {
      await endJob(`FREE-AGENT:${day}`, "FAILED", String(e));
    }
  }

  // 23:50 — analytics aggregation
  if (await beginJob(`ANALYTICS:${day}`, "ANALYTICS", new Date(dayStart + 23.83 * 3600000))) {
    try {
      await aggregateAnalytics();
      await endJob(`ANALYTICS:${day}`, "OK");
    } catch (e) {
      await endJob(`ANALYTICS:${day}`, "FAILED", String(e));
    }
  }

  // 23:50 — world readiness check
  if (await beginJob(`READINESS:${day}`, "READINESS", new Date(dayStart + 23.83 * 3600000))) {
    const dueCount = await db.fixture.count({ where: { status: "SCHEDULED", kickoffAt: { lte: new Date() } } });
    await db.systemState.upsert({
      where: { key: "ops.readiness.lastCheck" },
      create: { key: "ops.readiness.lastCheck", value: JSON.stringify({ day, dueCount, at: new Date().toISOString() }) },
      update: { value: JSON.stringify({ day, dueCount, at: new Date().toISOString() }) },
    });
    await endJob(`READINESS:${day}`, dueCount > 200 ? "FAILED" : "OK");
  }

  // Season transition: on the FIRST day after the running season's last day
  // (resolveSeason caps seasonDay at SEASON_TOTAL_DAYS, so "the season is over"
  // ⇔ day ≥ startEpochDay + SEASON_TOTAL_DAYS). The legacy condition
  // (seasonDay === 1) was UNREACHABLE — the next season only exists once this
  // transition has created it — so season rollover never fired. beginJob's
  // idempotency key keeps it once-per-day; after the new season exists,
  // resolveSeason finds it and the condition self-disables.
  if (season && day > 1 && day >= season.startEpochDay + SEASON_TOTAL_DAYS) {
    const began = await beginJob(`SEASON-TRANSITION:${day}`, "SEASON_TRANSITION", new Date(dayStart));
    if (began) {
      try {
        await seasonTransition(day);
        await endJob(`SEASON-TRANSITION:${day}`, "OK");
      } catch (e) {
        await endJob(`SEASON-TRANSITION:${day}`, "FAILED", String(e));
      }
    }
  }
}

// ─── Salary payment → moved to @/lib/engine/salary.ts (Task 77) ──
// Weekly payroll, every SUNDAY 01:00 server time (UTC). See salary.ts for the
// payout core (paySalaries, re-exported above) and the lazy orchestration.

// ─── Daily recovery (rest rooms + technical staff effects) ────────

/**
 * Daily 00:30 job. Rest rooms are a determining factor in player performance:
 * every day each squad player recovers fatigue (base + per rest-room level +
 * best PHYSIO quality) and slightly lifts morale. MEDIC quality accelerates
 * injury healing; ANALYST quality maintains form.
 */
async function dailyRecovery(day: number) {
  void day;
  const perLevel = await getInt("facilities.restRecoveryPerLevel", 2);
  const clubs = await db.club.findMany({
    select: { id: true, facilities: { select: { type: true, level: true } } },
  });

  for (const club of clubs) {
    const restLevel = club.facilities.find((f) => f.type === "REST_ROOMS")?.level ?? 1;
    const staff = await db.staffMember.findMany({
      where: { clubId: club.id },
      select: { role: true, quality: true },
    });
    const bestQuality = (role: string) =>
      staff.filter((s) => s.role === role).reduce((m, s) => Math.max(m, s.quality), 0);
    const physio = bestQuality("PHYSIO");
    const medic = bestQuality("MEDIC");
    const analyst = bestQuality("ANALYST");

    const baseReduction = 8 + restLevel * perLevel + Math.floor(physio / 25);
    const players = await db.player.findMany({
      where: { clubId: club.id, retired: false, isFreeAgent: false },
      select: { id: true, fatigue: true, morale: true, form: true, injuredUntil: true },
    });

    for (const p of players) {
      // Mandatory randomness: ±2 fatigue-recovery jitter.
      const jitter = Math.floor(Math.random() * 5) - 2;
      const data: { fatigue: number; morale: number; form: number; injuredUntil?: Date | null } = {
        fatigue: Math.max(0, p.fatigue - Math.max(0, baseReduction + jitter)),
        morale: Math.min(100, p.morale + 1 + (restLevel >= 5 ? 1 : 0)),
        // Analyst quality scales form maintenance: ≥55 → +1/day, ≥85 → +2/day.
        form: Math.min(100, p.form + (analyst >= 85 ? 2 : analyst >= 55 ? 1 : 0)),
      };
      if (p.injuredUntil && p.injuredUntil.getTime() > Date.now()) {
        // Better medics shorten injuries (up to ~ +20h/day at quality 80).
        const healMs = (12 + medic * 0.25) * 3600000;
        const next = new Date(p.injuredUntil.getTime() - healMs);
        data.injuredUntil = next.getTime() <= Date.now() ? null : next;
      }
      await db.player.update({ where: { id: p.id }, data });
    }
  }
}

// ─── Loan returns ─────────────────────────────────────────────────

/**
 * Daily 00:40 job. Players whose loan ended automatically rejoin their origin
 * club (borrower lineup slots referencing them are cleared).
 */
async function returnLoanedPlayers(day: number) {
  const due = await db.player.findMany({ where: { loanedUntilDay: { lte: day } } });
  for (const p of due) {
    const origin = p.loanOriginClubId;
    if (!origin) {
      await db.player.update({ where: { id: p.id }, data: { loanedUntilDay: null } });
      continue;
    }
    const borrowerClubId = p.clubId;
    await db.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: p.id },
        data: { clubId: origin, loanOriginClubId: null, loanedUntilDay: null },
      });
      if (borrowerClubId) {
        const lineup = await tx.lineup.findUnique({ where: { clubId: borrowerClubId } });
        if (lineup) {
          const slots = JSON.parse(lineup.slots || "{}") as Record<string, string | null>;
          let changed = false;
          for (const k of Object.keys(slots)) {
            if (slots[k] === p.id) {
              slots[k] = null;
              changed = true;
            }
          }
          if (changed) {
            await tx.lineup.update({ where: { clubId: borrowerClubId }, data: { slots: JSON.stringify(slots) } });
          }
        }
      }
    });
    const owner = (await db.club.findUnique({ where: { id: origin }, select: { ownerId: true } }))?.ownerId;
    if (owner) {
      await db.notification
        .create({
          data: {
            userId: owner,
            typeKey: "notification.loanReturned",
            payload: JSON.stringify({ playerId: p.id, name: `${p.firstName} ${p.lastName}` }),
          },
        })
        .catch(() => undefined);
    }
    await db.auditEvent.create({
      data: { type: "LOAN_RETURNED", payload: JSON.stringify({ playerId: p.id, clubId: origin, day }) },
    });
  }
}

// ─── Training bookkeeping (weekly snapshots, §7.2) ────────────────
// Session effects moved to src/lib/engine/training.ts (user-triggered runs).

async function weeklySnapshots(day: number, seasonNumber: number, seasonStart: number) {
  const seasonDay = day - seasonStart + 1;
  if (!(seasonDay > 0 && seasonDay % 7 === 0)) return;

  const clubIds = await db.club.findMany({ select: { id: true } });
  for (const { id: clubId } of clubIds) {
    const players = await db.player.findMany({ where: { clubId, retired: false } });
    for (const p of players) {
      await db.attributeSnapshot.create({
        data: { playerId: p.id, day, attributes: p.attributes, ovr: p.ovr, contextOvr: p.ovr },
      });
    }
  }
  void seasonNumber;
}

// ─── Facilities sweep ─────────────────────────────────────────────

async function completeFacilities() {
  const due = await db.facility.findMany({ where: { upgradeCompletesAt: { lte: new Date() } } });
  for (const f of due) {
    const upgrade = await db.facilityUpgrade.findFirst({
      where: { clubId: f.clubId, type: f.type, completesAt: f.upgradeCompletesAt as Date, completedAt: null },
    });
    if (!upgrade) {
      await db.facility.update({ where: { id: f.id }, data: { upgradeStartedAt: null, upgradeCompletesAt: null } });
      continue;
    }
    await db.$transaction(async (tx) => {
      await tx.facility.update({ where: { id: f.id }, data: { level: upgrade.toLevel, upgradeStartedAt: null, upgradeCompletesAt: null } });
      await tx.facilityUpgrade.update({ where: { id: upgrade.id }, data: { completedAt: new Date() } });
    });
    await db.notification.create({
      data: { userId: (await db.club.findUnique({ where: { id: f.clubId }, select: { ownerId: true } }))?.ownerId ?? "", typeKey: "notification.facilityComplete", payload: JSON.stringify({ facility: f.type, level: upgrade.toLevel }) },
    }).catch(() => undefined);
  }
}

// ─── Insolvency (spec §22) ────────────────────────────────────────

async function insolvencyEvaluation(day: number) {
  const insolventDays = await getInt("economy.insolventDays", 3);
  const bankruptDays = await getInt("economy.bankruptcyDays", 10);
  const clubs = await db.club.findMany({ where: { debt: { gt: 0 } } });
  for (const club of clubs) {
    if (club.unpaidDays >= bankruptDays) {
      if (club.finState !== "BANKRUPT") {
        await db.$transaction(async (tx) => {
          await tx.club.update({ where: { id: club.id }, data: { finState: "BANKRUPT" } });
          // Automatic relegation by one division
          const div = await tx.division.findUnique({ where: { id: club.divisionId }, include: { region: true } });
          if (div && div.index < 10) {
            const lower = await tx.division.findFirst({ where: { regionId: div.regionId, index: div.index + 1 } });
            if (lower) await tx.club.update({ where: { id: club.id }, data: { divisionId: lower.id } });
          }
        });
        await db.auditEvent.create({ data: { type: "CLUB_BANKRUPT", actorId: club.ownerId, payload: JSON.stringify({ clubId: club.id, day }) } });
      }
    } else if (club.unpaidDays >= insolventDays) {
      const next = club.unpaidDays >= 7 ? "POSSIBLE_BANKRUPTCY" : "INSOLVENT";
      if (club.finState !== next && club.finState !== "BANKRUPT") {
        await db.club.update({ where: { id: club.id }, data: { finState: next } });
      }
      // Attempt owner personal funds rescue (spec: club then owner funds are attempted)
      if (club.ownerId) {
        const wallet = await db.personalWallet.findUnique({ where: { userId: club.ownerId } });
        if (wallet && wallet.balance > 0) {
          const mult = club.finState === "POSSIBLE_BANKRUPTCY" ? 2 : 1;
          const owed = Math.min(wallet.balance, club.debt * mult);
          await db.$transaction(async (tx) => {
            await debitPersonal(tx, club.ownerId as string, owed, "OTHER", `RESCUE:${club.id}:${day}`, `Insolvency rescue for club debt`);
            await tx.club.update({ where: { id: club.id }, data: { debt: { decrement: Math.min(owed, club.debt) }, unpaidDays: 0, finState: club.debt - owed <= 0 ? "HEALTHY" : club.finState } });
          });
        }
      }
    }
  }
}

// ─── Referral settlement (spec §5.1) ──────────────────────────────

async function settleReferrals(day: number) {
  const bonus = await getInt("referral.bonus", 100);
  if (bonus <= 0) return;
  const pending = await db.user.findMany({ where: { referredById: { not: null }, referralCredited: false, emailVerified: true } });
  for (const user of pending) {
    await db.$transaction(async (tx) => {
      // Referral credits are platform income: the configurable income levy applies.
      const a = await applyUserFundsLevy(bonus);
      await creditPersonal(tx, user.id, a.net, "REFERRAL", `REFERRAL:${user.id}`, "Referral bonus (new user, net of income levy)", { gross: a.gross, levy: a.levy, net: a.net });
      if (user.referredById) await creditPersonal(tx, user.referredById, a.net, "REFERRAL", `REFERRAL:${user.referredById}:${user.id}`, "Referral bonus (referrer, net of income levy)", { gross: a.gross, levy: a.levy, net: a.net });
      await tx.user.update({ where: { id: user.id }, data: { referralCredited: true } });
    });
  }
}

// ─── Financial reconciliation ─────────────────────────────────────

async function financialReconciliation(day: number) {
  const clubs = await db.club.findMany({ select: { id: true, operatingFund: true } });
  for (const c of clubs) {
    const agg = await db.ledgerEntry.aggregate({ where: { account: "CLUB", clubId: c.id }, _sum: { amount: true } });
    const expected = (agg._sum.amount ?? 0) + 1000; // starting fund
    if (expected !== c.operatingFund) {
      await db.auditEvent.create({ data: { type: "FIN_RECON_MISMATCH", payload: JSON.stringify({ clubId: c.id, expected, actual: c.operatingFund, day }) } });
    }
  }
  const users = await db.personalWallet.findMany();
  for (const w of users) {
    const agg = await db.ledgerEntry.aggregate({ where: { account: "PERSONAL", userId: w.userId }, _sum: { amount: true } });
    if ((agg._sum.amount ?? 0) !== w.balance) {
      await db.auditEvent.create({ data: { type: "FIN_RECON_MISMATCH", payload: JSON.stringify({ userId: w.userId, expected: agg._sum.amount ?? 0, actual: w.balance, day }) } });
    }
  }
}

// ─── Youth & scouting (spec §10) ──────────────────────────────────

async function youthCycle(day: number, seasonId: string) {
  const clubs = await db.club.findMany({ include: { facilities: true } });
  const rng = mulberry32(seedFromString(`YOUTH:${seasonId}:${day}`));
  for (const club of clubs) {
    const ya = club.facilities.find((f) => f.type === "YOUTH_ACADEMY")?.level ?? 1;
    // Task 26: passive generation also respects the academy CAPACITY
    // (level 1 = youth.baseCapacity, default 3, grows with upgrades).
    const capacity = await getYouthCapacity(ya);
    const used = await db.youthProspect.count({ where: { clubId: club.id } });
    const space = Math.max(0, capacity - used);
    const count = Math.min(space, Math.floor(rng() * (1 + Math.floor(ya / 4))));
    const qualityBase = 30 + ya * 4;
    const scouts = await db.staffMember.count({ where: { clubId: club.id, role: "SCOUT" } });
    for (let i = 0; i < count; i++) {
      const { firstName, lastName } = generatePlayerName(rng);
      const position = (["GK", "DF", "MF", "FW"] as const)[Math.floor(rng() * 4)];
      const quality = Math.max(10, Math.min(95, Math.round(qualityBase + (rng() - 0.5) * 30)));
      await db.youthProspect.create({
        data: {
          clubId: club.id, firstName, lastName, age: 14, position, quality,
          attributes: JSON.stringify({ quality, scoutedDepth: scouts > 0 ? Math.min(3, 1 + Math.floor(ya / 4)) : 0 }),
          generatedOn: day,
          // Task 23-d: first appearance today → birthday anchor.
          birthDay: day, nextAgeDay: day + 30,
        },
      });
    }
    // Scouts produce/refresh reports
    if (scouts > 0) {
      const prospects = await db.youthProspect.findMany({ where: { clubId: club.id, scouted: false }, take: 5 });
      for (const p of prospects) {
        await db.youthProspect.update({ where: { id: p.id }, data: { scouted: true, reportDepth: Math.min(3, 1 + Math.floor(ya / 4)) } });
      }
    }
  }
}

// ─── Free agents (spec §13) ───────────────────────────────────────

async function freeAgentRefresh(day: number) {
  const poolSize = await getInt("market.freeAgentPoolSize", 40);
  const current = await db.player.count({ where: { isFreeAgent: true, retired: false } });
  const salaryPct = await getInt("economy.playerSalaryRatePct", 1);
  const clauseMult = await getInt("economy.releaseClauseMultiplier", 5);
  const rng = mulberry32(seedFromString(`FA:${Date.now() >> 20}`));

  const active = await db.player.count({ where: { isFreeAgent: true, retired: false, listings: { some: { state: "OPEN" } } } });
  const removable = current - active;
  const toRemove = Math.max(0, Math.min(removable, Math.floor(current / 2)));
  const stale = await db.player.findMany({
    where: { isFreeAgent: true, retired: false, listings: { none: { state: "OPEN" } } },
    take: toRemove,
    select: { id: true },
  });
  for (const p of stale) await db.player.delete({ where: { id: p.id } });

  const toCreate = Math.max(0, poolSize - current + toRemove);
  const gameDay = day;
  for (let i = 0; i < toCreate; i++) {
    const { firstName, lastName } = generatePlayerName(rng);
    const position = (["GK", "DF", "MF", "FW"] as const)[Math.floor(rng() * 4)];
    // Higher incidence of lower categories (1★ common)
    const roll = rng();
    const ovr = roll < 0.7 ? 40 + Math.floor(rng() * 20) : roll < 0.93 ? 60 + Math.floor(rng() * 15) : 75 + Math.floor(rng() * 12);
    const age = 17 + Math.floor(rng() * 14);
    // Task 27: stored VALUE = base × market.playerValueMultiplier (default 3);
    // the salary still derives from the BASE value to keep wage bills sane.
    const baseValue = computeBaseMarketValue(ovr, age);
    const value = applyValueMultiplier(baseValue, await getInt("market.playerValueMultiplier", 3));
    await db.player.create({
      data: {
        clubId: null, isFreeAgent: true, firstName, lastName, age, position,
        detailedPos: position, stars: starsFromOvr(ovr), ovr, potential: Math.min(99, ovr + Math.floor(rng() * 10)),
        marketValue: value, salary: computeSalary(baseValue, salaryPct), releaseClause: computeReleaseClause(value, clauseMult),
        attributes: JSON.stringify({ technical: {}, physical: {}, mental: {} }),
        // Task 23-d: today is this free agent's first appearance → his birthday anchor.
        birthDay: gameDay, nextAgeDay: gameDay + 30,
      },
    });
  }
}

// ─── Analytics aggregation ────────────────────────────────────────

async function aggregateAnalytics() {
  const now = new Date();
  const ranges = {
    weekly: new Date(now.getTime() - 7 * 86400000),
    monthly: new Date(now.getTime() - 30 * 86400000),
    yearly: new Date(now.getTime() - 365 * 86400000),
  };
  const out: Record<string, number> = {};
  for (const [k, since] of Object.entries(ranges)) {
    const c = await db.analyticsEvent.count({ where: { createdAt: { gte: since } } });
    out[k] = c;
  }
  const sessions = await db.session.count({ where: { createdAt: { gte: ranges.weekly } } });
  out.weeklySessions = sessions;
  await db.systemState.upsert({
    where: { key: "analytics.aggregates" },
    create: { key: "analytics.aggregates", value: JSON.stringify(out) },
    update: { value: JSON.stringify(out) },
  });
}

// ─── Season transition (spec §17) ─────────────────────────────────

async function seasonTransition(day: number) {
  const seasons = await db.season.findMany({ orderBy: { number: "desc" }, take: 1 });
  const current = seasons[0];
  if (!current) return;
  const season = await resolveSeason(day);
  if (!season || season.number === current.number) {
    // transition applies to the season that just ended
  }

  // 1. Champions & prizes — Task 27: league TITLE prizes are paid to EVERY
  // division (champion + runner-up), scaled by the division index via
  // competition.winPrizeDivisionStepPct (division 1 = 100%, last = least).
  const prizeLeague = current.prizeLeague || (await getInt("competition.prizeLeagueBase", 5000));
  const divStep = await getInt("competition.winPrizeDivisionStepPct", 10);
  const allDivisions = await db.division.findMany({ select: { id: true, index: true } });
  const divIndexById = new Map(allDivisions.map((d) => [d.id, d.index]));
  const prizeRows = await db.standing.findMany({
    where: { seasonId: current.id },
    select: { clubId: true, points: true, gf: true, ga: true, divisionId: true, club: { select: { name: true } } },
  });
  const leagueChampionIds: string[] = [];
  const rowsByDivision = new Map<string, typeof prizeRows>();
  for (const row of prizeRows) {
    const list = rowsByDivision.get(row.divisionId) ?? [];
    list.push(row);
    rowsByDivision.set(row.divisionId, list);
  }
  for (const [divisionId, rows] of rowsByDivision) {
    // Official table tie-breaks (points → GD → GF → name) so prize money can
    // never disagree with the published standings (Task 22).
    const top = sortTable(rows.map((r) => ({ ...r, clubName: r.club.name }))).slice(0, 2);
    if (!top[0]) continue;
    leagueChampionIds.push(top[0].clubId);
    const pct = divisionPrizeFactorPct(divIndexById.get(divisionId) ?? 1, divStep);
    await db.$transaction(async (tx) => {
      await creditClub(tx, top[0].clubId, Math.floor(prizeLeague * 0.6 * pct) / 100, "PRIZE", `PRIZE:LEAGUE:${current.id}:${top[0].clubId}`, `League champion prize (division ${divIndexById.get(divisionId) ?? 1})`);
      if (top[1]) await creditClub(tx, top[1].clubId, Math.floor(prizeLeague * 0.25 * pct) / 100, "PRIZE", `PRIZE:LEAGUE-RU:${current.id}:${top[1].clubId}`, `League runner-up prize (division ${divIndexById.get(divisionId) ?? 1})`);
    });
  }
  const cupChamps = await db.cupRun.findMany({ where: { seasonId: current.id, champion: true } });
  const prizeCup = current.prizeCup || (await getInt("competition.prizeCupBase", 2500));
  for (const c of cupChamps) {
    // Task 27: the cup FINAL already credits the champion prize at match time
    // under the SAME idempotency key — this transition payout is a no-op then.
    await db.$transaction(async (tx) => creditClub(tx, c.clubId, prizeCup, "PRIZE", `PRIZE:CUP:${current.id}:${c.clubId}`, "Regional cup prize")).catch(() => undefined);
  }
  const wcChampion = await db.worldCupSlot.findFirst({ where: { seasonId: current.id, eliminatedStage: null } });
  const prizeWorld = current.prizeWorld || (await getInt("competition.prizeWorldBase", 10000));
  if (wcChampion) {
    // Task 27: same idempotency-key sharing as the cup champion prize above.
    await db.$transaction(async (tx) => creditClub(tx, wcChampion.clubId, prizeWorld, "PRIZE", `PRIZE:WORLD:${current.id}:${wcChampion.clubId}`, "World Championship prize")).catch(() => undefined);
  }

  // 2. Promotions / relegations — EXACT user rule (Task 22, engine/promotions.ts):
  //    top-3 of every division from the 2ND promote; worst-3 of every division
  //    from the 1ST relegate (the last division never relegates); division-1
  //    top clubs qualify for the Club World Cup instead. Tie-breaks match the
  //    official table, application is atomic and fully audited.
  const promoSlots = await getInt("competition.promotionSlots", 3);
  const relegaSlots = await getInt("competition.relegationSlots", 3);
  const movements = await runSeasonMovements(current.id, promoSlots, relegaSlots);

  // 3. Player aging — REMOVED (Task 23-d): ages now advance on each person's
  //    own birthday via the daily AGING job (every 30 real-time days from
  //    first appearance), NOT at the season change. Retirement happens on the
  //    birthday too, inside ageEveryone().

  // 3b. Task 28: yellow-card accumulators reset for the new season.
  await db.player.updateMany({ data: { yellowCards: 0 } });

  // 4. Contracts & offers lifecycle
  await db.managerContract.updateMany({ where: { state: "ACTIVE", endDay: { lt: day } }, data: { state: "EXPIRED", endedAt: new Date() } });
  await db.managerOffer.updateMany({ where: { state: "OPEN" }, data: { state: "EXPIRED" } });
  await db.listing.updateMany({ where: { state: "OPEN", type: { in: ["DIRECT", "CLUB_SALE", "FREE_AGENT"] } }, data: { state: "EXPIRED" } });

  // 5. Close current season
  await db.season.update({ where: { id: current.id }, data: { state: "CLOSED" } });

  // 6. Create next season (prizes from collected system fund, fallback to bases)
  const systemFund = await db.fundBalance.findUnique({ where: { scope: "SYSTEM" } });
  const collected = Math.max(0, Math.floor((systemFund?.balance ?? 0) * 0.5));
  const nextNumber = current.number + 1;
  const nextStart = current.startEpochDay + SEASON_TOTAL_DAYS;
  const next = await db.season.create({
    data: {
      number: nextNumber, startEpochDay: nextStart, state: "ACTIVE",
      prizeLeague: prizeLeague + Math.floor(collected * 0.5),
      prizeCup: prizeCup + Math.floor(collected * 0.2),
      prizeWorld: prizeWorld + Math.floor(collected * 0.3),
    },
  });
  await generateSeasonCompetitions(next.id, nextStart);
  const promotedCount = movements.filter((m) => m.direction === "PROMOTED").length;
  const relegatedCount = movements.filter((m) => m.direction === "RELEGATED").length;

  // 7. Durable history — user mandate: match details are kept for TWO seasons.
  //    Every closed season is folded into the clubs' PERMANENT record first
  //    (all-time W/D/L from every played match + titles won), so the purge in
  //    step 8 only ever deletes REDUNDANT detail, never the record itself.
  const tally = await tallySeasonResults(current.id);
  await db.$transaction(async (tx) => {
    const entries = [...tally.entries()];
    for (let i = 0; i < entries.length; i += 200) {
      await Promise.all(
        entries.slice(i, i + 200).map(([clubId, t]) =>
          tx.club.update({
            where: { id: clubId },
            data: { histWon: { increment: t.w }, histDrawn: { increment: t.d }, histLost: { increment: t.l } },
          }),
        ),
      );
    }
  });
  // Titles: division champions (league), regional cup champions, world champion.
  if (leagueChampionIds.length) {
    await db.club.updateMany({ where: { id: { in: leagueChampionIds } }, data: { titlesLeague: { increment: 1 } } });
  }
  const cupChampionIds = cupChamps.map((c) => c.clubId);
  if (cupChampionIds.length) {
    await db.club.updateMany({ where: { id: { in: cupChampionIds } }, data: { titlesCup: { increment: 1 } } });
  }
  if (wcChampion) {
    await db.club.update({ where: { id: wcChampion.clubId }, data: { titlesWorld: { increment: 1 } } });
  }

  // 8. History retention (user mandate): keep FULL match detail for the two
  //    most recent COMPLETED seasons (current "next" just started, "current"
  //    just closed). Older seasons lose Matches/MatchEvents/Fixtures/Standings/
  //    CupRuns/WorldCupSlots/PrizePools — clubs keep only their aggregate
  //    record (titles + W/D/L above). Parameterized raw SQL: a season carries
  //    ~25k fixtures and the indexed sub-queries avoid shipping ids to memory.
  const stale = await db.season.findMany({
    where: { number: { lte: next.number - 3 } },
    select: { id: true, number: true },
  });
  if (stale.length > 0) {
    const ids = Prisma.join(stale.map((s) => s.id));
    await db.$executeRaw`DELETE FROM "MatchEvent" WHERE "matchId" IN (SELECT m."id" FROM "Match" m JOIN "Fixture" f ON f."id" = m."fixtureId" WHERE f."seasonId" IN (${ids}))`;
    await db.$executeRaw`DELETE FROM "Match" WHERE "fixtureId" IN (SELECT "id" FROM "Fixture" WHERE "seasonId" IN (${ids}))`;
    await db.$executeRaw`DELETE FROM "Fixture" WHERE "seasonId" IN (${ids})`;
    await db.$executeRaw`DELETE FROM "Standing" WHERE "seasonId" IN (${ids})`;
    await db.$executeRaw`DELETE FROM "CupRun" WHERE "seasonId" IN (${ids})`;
    await db.$executeRaw`DELETE FROM "WorldCupSlot" WHERE "seasonId" IN (${ids})`;
    await db.$executeRaw`DELETE FROM "PrizePool" WHERE "seasonId" IN (${ids})`;
  }

  await db.auditEvent.create({
    data: {
      type: "SEASON_TRANSITION",
      payload: JSON.stringify({ from: current.number, to: nextNumber, day, promoted: promotedCount, relegated: relegatedCount, purgedSeasons: stale.map((s) => s.number) }),
    },
  });
}

/** All-time W/D/L deltas for every club from one season's PLAYED matches. */
async function tallySeasonResults(seasonId: string): Promise<Map<string, { w: number; d: number; l: number }>> {
  const played = await db.match.findMany({
    where: { fixture: { seasonId } },
    select: { homeId: true, awayId: true, homeGoals: true, awayGoals: true },
  });
  const tally = new Map<string, { w: number; d: number; l: number }>();
  const bump = (clubId: string, r: "w" | "d" | "l") => {
    const t = tally.get(clubId) ?? { w: 0, d: 0, l: 0 };
    t[r] += 1;
    tally.set(clubId, t);
  };
  for (const m of played) {
    if (m.homeGoals > m.awayGoals) {
      bump(m.homeId, "w");
      bump(m.awayId, "l");
    } else if (m.homeGoals < m.awayGoals) {
      bump(m.homeId, "l");
      bump(m.awayId, "w");
    } else {
      bump(m.homeId, "d");
      bump(m.awayId, "d");
    }
  }
  return tally;
}
