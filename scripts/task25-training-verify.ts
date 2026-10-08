// Task 25-c — mandatory engine verification for the multi-factor training formula.
// Run: bun scripts/task25-training-verify.ts
// Cases:
//   (a) fresh player (condition 100), age 17, ovr 60, coach 60, tc 3, default
//       weights → exact spec factors (fAge 1.23, fQuality 1.05, fCoach 1.05,
//       fFacility 0.98, fCondition 1.40) and finalPct = base × growth × Π(f).
//   (b) all training.weight.* set to 0 (TEMPORARY) → every eff = 1 → finalPct
//       == base × growth. Weights are RESTORED to 100 at the end (always).
//   (c) exhausted (condition 0) vs fresh (condition 100) → fCondition 0.60 vs 1.40.

import { PrismaClient } from "@prisma/client";

const WEIGHT_KEYS = [
  "training.weight.condition",
  "training.weight.age",
  "training.weight.quality",
  "training.weight.coach",
  "training.weight.facility",
] as const;

let failures = 0;
function check(name: string, actual: number, expected: number, eps = 1e-9): void {
  const okv = Math.abs(actual - expected) <= eps;
  if (!okv) failures += 1;
  console.log(`${okv ? "PASS" : "FAIL"}  ${name}: ${actual} (expected ${expected})`);
}

async function main(): Promise<void> {
  // Direct Prisma handle for the temporary weight flip (engine has its own pool).
  const prisma = new PrismaClient();

  const { trainingFactorValues, computeTrainingBreakdown, effectivePct, getTrainingWeights } = await import(
    "../src/lib/engine/training"
  );
  const { invalidateConfig, getInt } = await import("../src/lib/config");

  try {
    // DATA FIX (Task 22 precedent): a stray admin edit set training.growthFactor
    // to "1" (0.01×) at 19:53 today, which pins EVERY pct to the 0.2 floor and
    // makes the spec's "(b) pct ≈ base" expectation impossible. Restore default 100.
    const gf = await prisma.configKey.findUnique({ where: { key: "training.growthFactor" } });
    if (gf && gf.currentValue !== "100") {
      console.log(`NOTE: training.growthFactor was ${JSON.stringify(gf.currentValue)} → restoring default "100"`);
      await prisma.configKey.update({ where: { key: "training.growthFactor" }, data: { currentValue: "100" } });
      invalidateConfig();
    }

    // Make sure the 5 weight rows exist (labels/descriptions already seeded).
    for (const key of WEIGHT_KEYS) {
      await prisma.configKey.upsert({
        where: { key },
        create: { key, group: "training", valueType: "int", defaultValue: "100", currentValue: "100", minValue: 0, maxValue: 200, description: "Task 25-c weight" },
        update: {},
      });
    }
    invalidateConfig();

    // ── Case (c): pure factors, condition 0 vs 100 ─────────────────
    console.log("\n(c) fCondition exhausted (0) vs fresh (100):");
    const exhausted = trainingFactorValues({ condition: 0, age: 24, ovr: 60, coachQuality: 40, tcLevel: 1 });
    const fresh = trainingFactorValues({ condition: 100, age: 24, ovr: 60, coachQuality: 40, tcLevel: 1 });
    check("fCondition(condition=0)", exhausted.fCondition, 0.6);
    check("fCondition(condition=100)", fresh.fCondition, 1.4);

    // ── Case (a): fresh 17yo ovr 60, coach 60, tc 3, default weights ─
    console.log("\n(a) fresh 17y ovr 60 coach 60 tc 3 (weights 100):");
    const weightsBefore = await getTrainingWeights();
    check("weight.condition", weightsBefore.condition, 1);
    check("weight.age", weightsBefore.age, 1);
    check("weight.quality", weightsBefore.quality, 1);
    check("weight.coach", weightsBefore.coach, 1);
    check("weight.facility", weightsBefore.facility, 1);

    const bdA = await computeTrainingBreakdown(3, { condition: 100, age: 17, ovr: 60, coachQuality: 60, tcLevel: 3 });
    check("fCondition", bdA.fCondition, 1.4);
    check("fAge (1.30-0.035×2)", bdA.fAge, 1.23);
    check("fQuality (1.15-0.005×20)", bdA.fQuality, 1.05);
    check("fCoach (0.80+0.45×40/72)", bdA.fCoach, 1.05);
    check("fFacility (0.90+0.04×2)", bdA.fFacility, 0.98);
    check("eff==raw at weight 1 (age)", bdA.eff.age, bdA.fAge, 1e-9);
    check("eff==raw at weight 1 (coach)", bdA.eff.coach, bdA.fCoach, 1e-9);
    const growth = (await getInt("training.growthFactor", 100)) / 100;
    const expectedPct = 3 * growth * 1.4 * 1.23 * 1.05 * 1.05 * 0.98;
    check("finalPct (no random)", bdA.finalPct, expectedPct, 0.01);
    console.log(`      growthFactor=${growth}  finalPct=${bdA.finalPct} (expected ≈ ${expectedPct.toFixed(4)})`);

    // Randomness bounds of effectivePct: [0.75, 1.25] × preview, min 0.2.
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 300; i++) {
      const p = await effectivePct(3, { condition: 100, age: 17, ovr: 60, coachQuality: 60, tcLevel: 3 });
      min = Math.min(min, p);
      max = Math.max(max, p);
    }
    check("random min ≥ 0.75×preview−ε", min >= expectedPct * 0.75 - 0.01 ? 1 : 0, 1);
    check("random max ≤ 1.25×preview+ε", max <= expectedPct * 1.25 + 0.01 ? 1 : 0, 1);
    console.log(`      observed random pct range [${min.toFixed(3)}, ${max.toFixed(3)}]`);

    // ── Case (b): weights → 0 (TEMPORARY) → everything neutral ─────
    console.log("\n(b) weights temporarily 0:");
    for (const key of WEIGHT_KEYS) {
      await prisma.configKey.update({ where: { key }, data: { currentValue: "0" } });
    }
    invalidateConfig();
    const bdB = await computeTrainingBreakdown(3, { condition: 100, age: 17, ovr: 60, coachQuality: 60, tcLevel: 3 });
    check("eff.condition neutral", bdB.eff.condition, 1);
    check("eff.age neutral", bdB.eff.age, 1);
    check("eff.quality neutral", bdB.eff.quality, 1);
    check("eff.coach neutral", bdB.eff.coach, 1);
    check("eff.facility neutral", bdB.eff.facility, 1);
    check("finalPct == base×growth (≈base)", bdB.finalPct, 3 * growth, 0.01);
    // Raw factors still computed (weights only mute them).
    check("raw fAge still 1.23", bdB.fAge, 1.23);

    // ── RESTORE weights to 100 (always, even if assertions above failed) ─
    for (const key of WEIGHT_KEYS) {
      await prisma.configKey.update({ where: { key }, data: { currentValue: "100" } });
    }
    invalidateConfig();
    const weightsAfter = await getTrainingWeights();
    check("restored weight.condition", weightsAfter.condition, 1);
    check("restored weight.age", weightsAfter.age, 1);
    check("restored weight.quality", weightsAfter.quality, 1);
    check("restored weight.coach", weightsAfter.coach, 1);
    check("restored weight.facility", weightsAfter.facility, 1);
    const bdRestored = await computeTrainingBreakdown(3, { condition: 100, age: 17, ovr: 60, coachQuality: 60, tcLevel: 3 });
    check("post-restore finalPct back to ≈5.58", bdRestored.finalPct, expectedPct, 0.01);
  } finally {
    // Belt & braces: restore again outside the try body in case of throws.
    for (const key of WEIGHT_KEYS) {
      await prisma.configKey.updateMany({ where: { key }, data: { currentValue: "100" } });
    }
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
