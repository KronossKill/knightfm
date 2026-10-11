// Knight FM — WEEKLY SALARY PAYROLL (Task 77, USER MANDATE).
// As of this task, salaries are paid EVERY SUNDAY at 01:00 SERVER TIME. The
// server clock is UTC-only (spec D-002), so "Sunday 01:00 server time" is the
// instant Sunday 01:00:00 UTC — a fixed, predictable schedule that replaces the
// old "every N game days counted from the world epoch" rule
// (the finance.salaryIntervalDays config key is retired).
//
// Design:
//   • Lazy trigger — runWeeklySalaries() is called from the opportunistic
//     scheduler tick (processDueJobs) and from /api/cron/salary (Vercel Cron,
//     Sundays 01:00 UTC). No long-running process is required.
//   • Idempotent — each payday is recorded as a JobRun row
//     (`SALARY-SUN:<YYYY-MM-DD>`, UNIQUE idempotencyKey), and the ledger
//     writes inside paySalaries use per-club-per-day idempotency keys. A
//     payday can therefore never be paid twice, no matter how many instances
//     or requests race.
//   • Catch-up safe — every missed Sunday since the last RECORDED payday is
//     paid, one weekly payout each. Migration never double-pays: the last
//     legacy `SALARY:<day>` job (old every-N-days rule) is treated as covering
//     the 7 days after its day start, so the first new payday is the first
//     Sunday 01:00 UTC on/after that coverage end.
//   • Fresh worlds — with no payday history at all, the FIRST payroll is the
//     upcoming Sunday (nothing is retroactively paid from genesis).

import { db } from "@/lib/db";
import { getWorldEpochMs } from "@/lib/engine/clock";
import { applyUserFundsLevy, creditPersonal, debitClub, clubEconomyIsFrozen } from "@/lib/engine/finance";

export const SALARY_WEEK_DAYS = 7; // fixed weekly cadence (user mandate)
const SUNDAY = 0;
const PAYDAY_HOUR_UTC = 1; // 01:00 server time (server clock = UTC)
const WEEK_MS = SALARY_WEEK_DAYS * 86_400_000;
const JOB_TYPE = "SALARY_SUNDAY";
const KEY_PREFIX = "SALARY-SUN:";

/** Most recent Sunday 01:00 UTC instant that is <= `now`. */
export function lastSunday0100Utc(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), PAYDAY_HOUR_UTC, 0, 0));
  while (d.getUTCDay() !== SUNDAY) d.setUTCDate(d.getUTCDate() - 1);
  if (d.getTime() > now.getTime()) d.setUTCDate(d.getUTCDate() - SALARY_WEEK_DAYS);
  return d;
}

/** Next Sunday 01:00 UTC instant strictly after `now` (preview/display only). */
export function nextSunday0100Utc(now: Date = new Date()): Date {
  return new Date(lastSunday0100Utc(now).getTime() + WEEK_MS);
}

/**
 * Weekly payroll trigger. Pays every due Sunday 01:00 UTC that has not been
 * recorded yet, in chronological order. Safe to call from any request, any
 * instance, any number of times. `now` is injectable for verification.
 */
export async function runWeeklySalaries(
  opts: { now?: Date; clubFilter?: string[] } = {},
): Promise<{ paid: number; sundays: string[] }> {
  const now = opts.now ?? new Date();
  const epoch = await getWorldEpochMs();
  const dueSundayMs = lastSunday0100Utc(now).getTime();

  // Coverage end of the most recent recorded payday (either keying scheme).
  let paidThroughMs: number;
  const lastNew = await db.jobRun.findFirst({
    where: { jobType: JOB_TYPE, outcome: "OK" },
    orderBy: { scheduledFor: "desc" },
    select: { scheduledFor: true },
  });
  if (lastNew) {
    paidThroughMs = lastNew.scheduledFor.getTime() + WEEK_MS;
  } else {
    const lastOld = await db.jobRun.findFirst({
      where: { jobType: "SALARY", outcome: "OK" },
      orderBy: { scheduledFor: "desc" },
      select: { scheduledFor: true },
    });
    // No payday history at all → fresh world: first payroll = upcoming Sunday.
    paidThroughMs = lastOld ? lastOld.scheduledFor.getTime() + WEEK_MS : dueSundayMs + 1;
  }

  // First due payday strictly on/after the coverage end…
  let t = lastSunday0100Utc(new Date(paidThroughMs)).getTime();
  if (t < paidThroughMs) t += WEEK_MS;

  const sundays: string[] = [];
  for (; t <= dueSundayMs; t += WEEK_MS) {
    const payday = new Date(t);
    const key = `${KEY_PREFIX}${payday.toISOString().slice(0, 10)}`;
    const gameDay = 1 + Math.floor((t - epoch) / 86_400_000);
    // Retry pass: a FAILED row from an earlier attempt is removed so this
    // invocation can re-record it. Per-club ledger idempotency keys make the
    // retry pay only what was left unpaid.
    await db.jobRun.deleteMany({ where: { idempotencyKey: key, outcome: "FAILED" } }).catch(() => undefined);
    try {
      await db.jobRun.create({ data: { idempotencyKey: key, jobType: JOB_TYPE, scheduledFor: payday, payload: JSON.stringify({ gameDay, intervalDays: SALARY_WEEK_DAYS }) } });
    } catch {
      continue; // already recorded (OK/RUNNING elsewhere) → skip
    }
    try {
      await paySalaries(gameDay, null, opts.clubFilter);
      await db.jobRun.update({ where: { idempotencyKey: key }, data: { completedAt: new Date(), outcome: "OK" } });
      sundays.push(key);
    } catch (e) {
      await db.jobRun.update({ where: { idempotencyKey: key }, data: { completedAt: new Date(), outcome: "FAILED", error: String(e).slice(0, 500) } }).catch(() => undefined);
      throw e; // surfaced to the caller; the next tick retries this Sunday
    }
  }
  return { paid: sundays.length, sundays };
}

// ─── Per-club payout (moved verbatim from scheduler.ts, Task 25-a origin) ──

/**
 * Pays one weekly payroll for the game day `day` (the Sunday 01:00 UTC
 * instant, expressed in absolute game days). The payout equals the daily rate
 * × 7 for players, staff and the manager's wage (the manager's gross still
 * runs through applyUserFundsLevy). Idempotency keys keep their :day suffix,
 * so each payday is recorded exactly once. Retries after a partial failure
 * only pay the clubs that were not settled yet.
 * (Exported for verification scripts; runWeeklySalaries is the sole production caller.)
 */
export async function paySalaries(day: number, _seasonId: string | null, clubFilter?: string[]) {
  const interval = SALARY_WEEK_DAYS; // FIXED weekly since Task 77 (every Sunday 01:00 UTC)
  const clubs = await db.club.findMany({
    // clubFilter: test/verification hook (Task 27) — narrows the payroll run to
    // specific sandbox clubs; production callers never pass it.
    where: clubFilter && clubFilter.length > 0 ? { id: { in: clubFilter } } : undefined,
    include: {
      players: { where: { retired: false, isFreeAgent: false } },
      staff: true,
      contracts: { where: { state: "ACTIVE" } },
    },
  });
  for (const club of clubs) {
    // Task 78 (user mandate): a system club with no manager and no owner has a
    // FROZEN economy — it pays no wages and accumulates NO debt. Skipped before
    // any math so neither the treasury nor the debt/insolvency counters move.
    if (clubEconomyIsFrozen(club)) continue;
    const playerWages = club.players.reduce((sum, p) => sum + p.salary, 0) * interval;
    const staffWages = club.staff.reduce((sum, s) => sum + s.salary, 0) * interval;
    const absoluteDay = day; // contracts use absolute epoch days
    const contract = club.contracts[0];
    let managerDaily = 0;
    if (contract && absoluteDay >= contract.startDay && absoluteDay <= contract.endDay) {
      managerDaily = contract.dailySalary + (absoluteDay === contract.startDay ? contract.totalAmount - contract.dailySalary * contract.durationDays : 0);
    }
    const managerWage = managerDaily * interval;
    const due = playerWages + staffWages + managerWage;
    const available = club.operatingFund;
    const paid = Math.min(available, due);
    const unpaid = due - paid;

    await db.$transaction(async (tx) => {
      if (paid > 0) {
        const okDebit = await debitClub(tx, club.id, paid, "SALARY_PLAYER", `SALARY:${club.id}:${day}`, `Weekly salaries (paid Sundays 01:00 server time)`);
        if (!okDebit) throw new Error("salary ledger idempotency conflict");
      }
      // The manager's wage reaches their PERSONAL wallet net of the income levy
      // (platform incomes are taxed; investments are levy-free).
      const managerPaid = Math.min(managerWage, Math.max(0, paid - playerWages - staffWages));
      if (managerPaid > 0 && contract) {
        const levy = await applyUserFundsLevy(managerPaid);
        await creditPersonal(tx, contract.managerId, levy.net, "SALARY_MANAGER", `SALARYMGR:${club.id}:${day}`, `Manager salary from ${club.name} (Sunday payroll)`, { gross: levy.gross, levy: levy.levy, net: levy.net });
      }
      if (unpaid > 0) {
        await tx.club.update({ where: { id: club.id }, data: { debt: { increment: unpaid }, unpaidDays: { increment: 1 } } });
      } else if (club.debt > 0) {
        // Repay debt from surplus
        const repay = Math.min(club.operatingFund - paid, club.debt);
        if (repay > 0) {
          const mult = club.finState === "POSSIBLE_BANKRUPTCY" ? 2 : 1;
          const owed = Math.min(repay, club.debt * mult);
          await tx.club.update({ where: { id: club.id }, data: { debt: { decrement: Math.min(owed, club.debt) }, unpaidDays: 0, finState: club.debt - owed <= 0 ? "HEALTHY" : club.finState } });
        } else if (club.unpaidDays > 0 && club.debt === 0) {
          await tx.club.update({ where: { id: club.id }, data: { unpaidDays: 0, finState: "HEALTHY" } });
        }
      }
    });
  }
}
