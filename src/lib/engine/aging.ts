// Knight FM — birthday aging engine (Task 23-d, user mandate).
//
// Every person in the game ages on their OWN birthday: the absolute game day
// they FIRST appeared in the game (creation, market arrival, academy
// promotion, free-agent listing…). From that anchor they turn one year older
// every EXACTLY 30 real-time days (game days are 24h, so 30 days = 30 game
// days). The old "everyone ages +1 at the season change" behaviour is gone:
// the season transition no longer touches ages.
//
// The daily AGING scheduler job calls ageEveryone(day). Because the job runs
// once per game day, `nextAgeDay` is normally === day for the people who
// celebrate today; the lte-window + period math keeps it correct even if the
// scheduler skipped days (catch-up ages everyone only the days they are owed).

import { db } from "@/lib/db";
import { getInt } from "@/lib/config";

/** Real-time days between birthdays (user mandate: exactly 30). */
export const DAYS_PER_YEAR = 30;

/** The absolute game day of the NEXT birthday for someone appearing on `birthDay`. */
export function nextAgeDayFor(birthDay: number, fromDay?: number): number {
  const base = birthDay + DAYS_PER_YEAR;
  if (!fromDay || fromDay <= birthDay) return base;
  const periods = Math.floor((fromDay - birthDay) / DAYS_PER_YEAR) + 1;
  return birthDay + periods * DAYS_PER_YEAR;
}

/**
 * Deterministic birthday spread for people who already existed when the
 * birthday system was introduced: their first appearance day is unknown, so we
 * anchor the NEXT birthday within the following 30 days (hash of the id) and
 * set birthDay exactly one cycle before it. Ages stay as they are; from now on
 * each person ages on their own stable day.
 */
export function birthdayAnchorForExisting(id: string, currentDay: number): { birthDay: number; nextAgeDay: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const nextAgeDay = currentDay + 1 + (hash % DAYS_PER_YEAR);
  return { birthDay: nextAgeDay - DAYS_PER_YEAR, nextAgeDay };
}

/**
 * Daily birthday job (Task 23-d). Ages every player AND youth prospect whose
 * birthday is due (nextAgeDay ≤ day). Senior players retire on the birthday
 * that passes their position's age limit (same limits as before — the config
 * keys stay authoritative); youth prospects simply grow.
 */
export async function ageEveryone(day: number): Promise<{ playersAged: number; retired: number; prospectsAged: number }> {
  const [retireOutfield, retireGk] = await Promise.all([
    getInt("players.retirementAgeOutfield", 36),
    getInt("players.retirementAgeGk", 40),
  ]);

  let playersAged = 0;
  let retired = 0;
  let prospectsAged = 0;

  const duePlayers = await db.player.findMany({
    where: { nextAgeDay: { lte: day }, retired: false },
    select: { id: true, age: true, position: true, nextAgeDay: true, clubId: true, isFreeAgent: true },
  });
  for (const p of duePlayers) {
    const anchor = p.nextAgeDay ?? day;
    // How many whole 30-day cycles have passed since the due birthday (1 when
    // the scheduler runs every day; more only after skipped days).
    const periods = Math.floor((day - anchor) / DAYS_PER_YEAR) + 1;
    const newAge = p.age + periods;
    const limit = p.position === "GK" ? retireGk : retireOutfield;
    const mustRetire = newAge > limit;
    await db.player.update({
      where: { id: p.id },
      data: {
        age: newAge,
        nextAgeDay: anchor + periods * DAYS_PER_YEAR,
        retired: mustRetire,
        clubId: mustRetire ? null : p.clubId,
      },
    });
    playersAged += 1;
    if (mustRetire) retired += 1;
  }

  const dueProspects = await db.youthProspect.findMany({
    where: { nextAgeDay: { lte: day } },
    select: { id: true, age: true, nextAgeDay: true },
  });
  for (const pr of dueProspects) {
    const anchor = pr.nextAgeDay ?? day;
    const periods = Math.floor((day - anchor) / DAYS_PER_YEAR) + 1;
    await db.youthProspect.update({
      where: { id: pr.id },
      data: { age: pr.age + periods, nextAgeDay: anchor + periods * DAYS_PER_YEAR },
    });
    prospectsAged += 1;
  }

  return { playersAged, retired, prospectsAged };
}
