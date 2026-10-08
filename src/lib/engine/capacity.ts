// Knight FM — Squad capacity via ICP (spec §8). Computed SERVER-SIDE only.
// ICP = 0.30×TrainingCenter + 0.25×MedicalCenter + 0.25×YouthAcademy + 0.20×SportsScience (levels normalized 0..1)
// BonusSlots = floor(ICP × MaxBonusSlots); FinalCapacity = BaseCapacity + BonusSlots (max 45)

import { FacilityType } from "@/lib/types";

export function normalizeLevel(level: number, maxLevel = 10): number {
  if (maxLevel <= 1) return 0;
  return Math.max(0, Math.min(1, (level - 1) / (maxLevel - 1)));
}

export function computeIcp(levels: Record<FacilityType, number>, weights: { training: number; medical: number; youth: number; science: number }, maxLevel = 10): number {
  const tc = normalizeLevel(levels.TRAINING_CENTER, maxLevel);
  const mc = normalizeLevel(levels.MEDICAL_CENTER, maxLevel);
  const ya = normalizeLevel(levels.YOUTH_ACADEMY, maxLevel);
  const ss = normalizeLevel(levels.SPORTS_SCIENCE, maxLevel);
  return (
    (weights.training / 100) * tc +
    (weights.medical / 100) * mc +
    (weights.youth / 100) * ya +
    (weights.science / 100) * ss
  );
}

export function computeCapacity(opts: {
  baseCapacity: number;
  maxBonusSlots: number;
  levels: Record<FacilityType, number>;
  weights: { training: number; medical: number; youth: number; science: number };
  maxLevel?: number;
}): { icp: number; bonusSlots: number; capacity: number } {
  const icp = computeIcp(opts.levels, opts.weights, opts.maxLevel ?? 10);
  const bonusSlots = Math.floor(icp * opts.maxBonusSlots);
  const capacity = Math.min(opts.baseCapacity + bonusSlots, 45);
  return { icp, bonusSlots, capacity };
}
