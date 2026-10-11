// Task 79 — mandatory engine verification. USER MANDATE:
//   A 5-star player has much more quality than a 1-star player, so the way
//   quality/skills are ACQUIRED must depend on the player's star rating:
//   every training gain is multiplied by a TALENT FACTOR derived from the
//   player's potential (1★ <40 → 0.60× · 2★ 40-54 → 0.80× · 3★ 55-69 → 1.00×
//   · 4★ 70-84 → 1.20× · 5★ ≥85 → 1.50×, all admin-configurable).
// Run: bun scripts/task79-verify-talent.ts
//
//   (a) talentStarTier boundary math (pure).
//   (b) getTalentMultipliers defaults + config override round-trip.
//   (c) Sandbox engine run: identical players except potential — the 5★
//       acquires MORE skill points than the lower-tier player across 30
//       identical special sessions, and more in a general session.
//   (d) Audit rows keep breakdown.talent / talentTier; public results keep
//       the Task 78 shape (familyGains / gains only — no formula fields).
//   (e) Potential ceilings still clamp: a potential-35 "dud" (all ceilings
//       = 40) never grows past 40.

import { PrismaClient } from "@prisma/client";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const okv = JSON.stringify(actual) === JSON.stringify(expected);
  if (!okv) failures += 1;
  console.log(`${okv ? "PASS" : "FAIL"}  ${name}: ${JSON.stringify(actual)}${okv ? "" : ` (expected ${JSON.stringify(expected)})`}`);
}
function checkTrue(name: string, condition: boolean, detail = ""): void {
  if (!condition) failures += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail && !condition ? `: ${detail}` : ""}`);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const { invalidateConfig } = await import("../src/lib/config");
  const {
    runGeneralSession,
    runSpecialSession,
    talentStarTier,
    getTalentMultipliers,
    talentFactorOf,
    attributeCeiling,
  } = await import("../src/lib/engine/training");
  const { generatePlayerName } = await import("../src/lib/engine/names");

  const REGION_INDEX = 99997;
  const DAY_BASE = 999_100;

  const setCfg = async (key: string, value: string) => {
    await prisma.configKey.upsert({
      where: { key },
      create: { key, group: "training", valueType: "int", defaultValue: "1", currentValue: value },
      update: { currentValue: value },
    });
    invalidateConfig();
  };
  const delCfg = async (key: string) => {
    await prisma.configKey.delete({ where: { key } }).catch(() => undefined);
    invalidateConfig();
  };
  const passingOf = async (playerId: string) => {
    const p = await prisma.player.findUnique({ where: { id: playerId }, select: { attributes: true } });
    const attrs = JSON.parse(p?.attributes || "{}") as Record<string, Record<string, number>>;
    return attrs.technical?.passing ?? 40;
  };

  try {
    invalidateConfig();

    // ── (a) Pure tier math ─────────────────────────────────────────
    console.log("\n── (a) talentStarTier boundaries ──");
    check("tier(39) → 1★", talentStarTier(39), 1);
    check("tier(40) → 2★", talentStarTier(40), 2);
    check("tier(54) → 2★", talentStarTier(54), 2);
    check("tier(55) → 3★", talentStarTier(55), 3);
    check("tier(69) → 3★", talentStarTier(69), 3);
    check("tier(70) → 4★", talentStarTier(70), 4);
    check("tier(84) → 4★", talentStarTier(84), 4);
    check("tier(85) → 5★", talentStarTier(85), 5);
    check("tier(95) → 5★", talentStarTier(95), 5);

    // ── (b) Config defaults + override round-trip ──────────────────
    console.log("\n── (b) talent multipliers (config) ──");
    await prisma.configKey.deleteMany({ where: { key: { startsWith: "training.talent." } } });
    invalidateConfig();
    check("defaults 60/80/100/120/150", await getTalentMultipliers(), [0.6, 0.8, 1, 1.2, 1.5]);
    check("factorOf(potential 95)", talentFactorOf(await getTalentMultipliers(), 95), 1.5);
    check("factorOf(potential 50)", talentFactorOf(await getTalentMultipliers(), 50), 0.8);
    await setCfg("training.talent.star5", "300");
    check("override star5=300 → 3.0", (await getTalentMultipliers())[4], 3);
    await delCfg("training.talent.star5");
    check("restored default 1.5", (await getTalentMultipliers())[4], 1.5);

    // ── Sandbox world (region 99997) ───────────────────────────────
    const leftover = await prisma.region.findUnique({ where: { index: REGION_INDEX } });
    if (leftover) {
      await prisma.trainingSession.deleteMany({ where: { club: { regionId: leftover.id } } }).catch(() => undefined);
      await prisma.player.deleteMany({ where: { club: { regionId: leftover.id } } }).catch(() => undefined);
      await prisma.club.deleteMany({ where: { regionId: leftover.id } }).catch(() => undefined);
      await prisma.division.deleteMany({ where: { regionId: leftover.id } }).catch(() => undefined);
      await prisma.region.delete({ where: { id: leftover.id } }).catch(() => undefined);
    }

    const region = await prisma.region.create({ data: { index: REGION_INDEX, nameKey: "region.sandbox79" } });
    const division = await prisma.division.create({ data: { regionId: region.id, index: 1 } });
    const stamp = Date.now();

    const mkPlayer = async (clubId: string, potential: number) => {
      const { firstName, lastName } = generatePlayerName(() => 0.42);
      return prisma.player.create({
        data: {
          clubId, firstName, lastName, age: 18,
          position: "MF", detailedPos: "CM",
          stars: 1, ovr: 40, potential, marketValue: 300, salary: 2,
          releaseClause: 1500,
          attributes: JSON.stringify({ technical: { passing: 40 }, physical: {}, mental: {} }),
        },
      });
    };

    // Club A: only the 5★ (potential 95). Club B: the 2★ (potential 50),
    // a potential-35 dud, and a second 5★ for the general-session comparison.
    const clubA = await prisma.club.create({ data: { regionId: region.id, divisionId: division.id, name: `T5 ${stamp}`, operatingFund: 1000 } });
    const clubB = await prisma.club.create({ data: { regionId: region.id, divisionId: division.id, name: `T2 ${stamp}`, operatingFund: 1000 } });
    const pHigh = await mkPlayer(clubA.id, 95);
    const pLow = await mkPlayer(clubB.id, 50);
    const pDud = await mkPlayer(clubB.id, 35);
    const pHigh2 = await mkPlayer(clubB.id, 95);

    checkTrue("identical ceilings impossible test premise", attributeCeiling(pHigh.id, "passing", 95) > attributeCeiling(pLow.id, "passing", 50));

    // Boost paces so whole-point gains materialise every session (temp config).
    await setCfg("training.paceSpecial", "300");
    await setCfg("training.paceGeneral", "3000");

    // ── (c) 30 identical special sessions: 5★ vs 2★ ────────────────
    console.log("\n── (c) 30 special sessions (identical everything except potential) ──");
    let sumHigh = 0;
    let sumLow = 0;
    for (let i = 0; i < 30; i++) {
      const day = DAY_BASE + i;
      const rHigh = await runSpecialSession(clubA.id, "midfield", pHigh.id, day);
      const rLow = await runSpecialSession(clubB.id, "midfield", pLow.id, day);
      sumHigh += rHigh.gains.reduce((a, g) => a + g.delta, 0);
      sumLow += rLow.gains.reduce((a, g) => a + g.delta, 0);
    }
    console.log(`     5★ (potential 95) acquired ${sumHigh} pts · 2★ (potential 50) acquired ${sumLow} pts`);
    checkTrue("5★ acquired strictly more than 2★", sumHigh > sumLow, `high=${sumHigh} low=${sumLow}`);
    checkTrue("5★ acquired ≥ 1.5× the 2★", sumHigh >= sumLow * 1.5, `high=${sumHigh} low=${sumLow}`);

    const highPassing = await passingOf(pHigh.id);
    const lowPassing = await passingOf(pLow.id);
    checkTrue("5★ passing ≤ its ceiling", highPassing <= attributeCeiling(pHigh.id, "passing", 95), `passing=${highPassing}`);
    checkTrue("dud (potential 35, ceilings=40) unchanged at 40", (await passingOf(pDud.id)), 40);

    // Audit rows carry the talent factor; public shape stays Task-78 clean.
    const auditHigh = await prisma.trainingSession.findFirst({ where: { clubId: clubA.id, specialType: "midfield" }, orderBy: { day: "asc" } });
    const auditLow = await prisma.trainingSession.findFirst({ where: { clubId: clubB.id, specialType: "midfield" }, orderBy: { day: "asc" } });
    const effHigh = JSON.parse(auditHigh?.effects || "{}") as { breakdown?: { talent?: number; talentTier?: number } };
    const effLow = JSON.parse(auditLow?.effects || "{}") as { breakdown?: { talent?: number; talentTier?: number } };
    check("audit 5★ breakdown.talent", effHigh.breakdown?.talent, 1.5);
    check("audit 5★ breakdown.talentTier", effHigh.breakdown?.talentTier, 5);
    check("audit 2★ breakdown.talent", effLow.breakdown?.talent, 0.8);
    check("audit 2★ breakdown.talentTier", effLow.breakdown?.talentTier, 2);

    // ── (d) General session: mixed squad — per-player talent + audit ──
    console.log("\n── (d) general session on the mixed club ──");
    const gDay = DAY_BASE + 500;
    const gRes = await runGeneralSession(clubB.id, "balanced", gDay);
    check("general result keys (Task 78 shape)", Object.keys(gRes).sort(), ["attrsGained", "familyGains", "focus", "players"]);
    checkTrue("general produced technical gains", gRes.familyGains.technical > 0, `familyGains=${JSON.stringify(gRes.familyGains)}`);
    const gAudit = await prisma.trainingSession.findFirst({ where: { clubId: clubB.id, kind: "GENERAL", day: gDay } });
    const gEff = JSON.parse(gAudit?.effects || "{}") as { breakdown?: { talent?: number; talentTier?: number }; familyGains?: { technical: number } };
    check("general audit talent = avg(1.5, 0.8, 0.6) = 0.967", gEff.breakdown?.talent, 0.967);
    check("general audit talentTier from avg potential (round 60 → 3★)", gEff.breakdown?.talentTier, 3);
    check("general audit keeps familyGains", gEff.familyGains?.technical === gRes.familyGains.technical, true);

    const high2Passing = await passingOf(pHigh2.id);
    const lowAfterG = await passingOf(pLow.id);
    checkTrue("general: 5★ passing grew more than 2★ passing", high2Passing - 40 > lowAfterG - lowPassing, `5★+${high2Passing - 40} vs 2★+${lowAfterG - lowPassing}`);
    checkTrue("general: dud STILL capped at 40", (await passingOf(pDud.id)), 40);

    // ── Restore config + cleanup sandbox ───────────────────────────
    await delCfg("training.paceSpecial");
    await delCfg("training.paceGeneral");
    await delCfg("training.talent.star5");
    const { getInt } = await import("../src/lib/config");
    check("paceSpecial restored to registry default (42)", await getInt("training.paceSpecial", 0), 42);
    check("talent star5 restored to registry default (150)", await getInt("training.talent.star5", 0), 150);
    await prisma.trainingSession.deleteMany({ where: { club: { regionId: region.id } } });
    await prisma.player.deleteMany({ where: { club: { regionId: region.id } } });
    await prisma.club.deleteMany({ where: { regionId: region.id } });
    await prisma.division.deleteMany({ where: { regionId: region.id } });
    await prisma.region.delete({ where: { id: region.id } });
    await prisma.configKey.deleteMany({ where: { key: { startsWith: "training.talent." } } });
    invalidateConfig();

    console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
    if (failures > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
