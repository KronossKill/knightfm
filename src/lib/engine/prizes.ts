// Knight FM — Task 27: shared prize-scaling helpers.
// League winnings (per-match win prizes AND season title prizes) scale with the
// DIVISION the club plays in: the 1st division earns the most, the last earns
// the least. Cup / world-cup winnings escalate ROUND BY ROUND and the final
// winner receives the configured champion prize instead of a round win prize.

/** Linear division scaling with a hard floor: division 1 → 100%, every division
 * below reduces the payout by `stepPct` points, never below 10% of the base. */
export function divisionPrizeFactorPct(divIndex: number, stepPct: number): number {
  const step = Math.max(0, Math.min(90, stepPct));
  const idx = Math.max(1, divIndex);
  return Math.max(10, 100 - (idx - 1) * step);
}

/** Clamp helper for admin-configured percentages. */
export function clampPct(v: number, fallback = 100): number {
  const n = Number.isFinite(v) ? v : fallback;
  return Math.max(0, Math.min(100, n));
}
