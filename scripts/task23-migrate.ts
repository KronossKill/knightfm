// Task 23 one-off migration (idempotent):
//   1. Region.nameKey → new natural identity keys (Task 23-c).
//   2. Backfill birthDay/nextAgeDay for existing players + prospects (Task 23-d):
//      every person gets a deterministic birthday within the next 30 days so
//      ages no longer advance all at once at the season change.
//   3. ConfigKey hygiene: remove the retired scout-count keys, upsert the new
//      economy.clubWithdrawTaxPct and youth.maxProspectsPool rows (Task 23-a/b).
// Run from the project root: bun scripts/task23-migrate.ts

import { PrismaClient } from "@prisma/client";
import { REGION_NAME_KEYS } from "../src/lib/engine/names";
import { birthdayAnchorForExisting, DAYS_PER_YEAR } from "../src/lib/engine/aging";
import { CONFIG_DEFAULTS } from "../src/lib/config";

const prisma = new PrismaClient();

async function main() {
  // ── 1. Region names ──────────────────────────────────────────────
  for (let i = 0; i < REGION_NAME_KEYS.length; i++) {
    const res = await prisma.region.updateMany({
      where: { index: i + 1 },
      data: { nameKey: REGION_NAME_KEYS[i] },
    });
    console.log(`region ${i + 1} → ${REGION_NAME_KEYS[i]} (${res.count} row)`);
  }

  // ── 2. Birthday backfill ─────────────────────────────────────────
  const epochRow = await prisma.systemState.findUnique({ where: { key: "world.epoch.utc" } });
  const epochMs = epochRow ? new Date(epochRow.value).getTime() : Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const currentDay = 1 + Math.floor((Date.now() - epochMs) / DAY_MS);
  console.log(`current game day = ${currentDay}`);

  const players = await prisma.player.findMany({
    where: { birthDay: null },
    select: { id: true },
  });
  for (const p of players) {
    const { birthDay, nextAgeDay } = birthdayAnchorForExisting(p.id, currentDay);
    await prisma.player.update({ where: { id: p.id }, data: { birthDay, nextAgeDay } });
  }
  console.log(`players backfilled: ${players.length}`);

  const prospects = await prisma.youthProspect.findMany({
    where: { birthDay: null },
    select: { id: true },
  });
  for (const pr of prospects) {
    const { birthDay, nextAgeDay } = birthdayAnchorForExisting(pr.id, currentDay);
    await prisma.youthProspect.update({ where: { id: pr.id }, data: { birthDay, nextAgeDay } });
  }
  console.log(`prospects backfilled: ${prospects.length}`);

  // Sanity: every player/prospect must now have both anchors and a birthday
  // within (currentDay − DAYS_PER_YEAR, currentDay + DAYS_PER_YEAR].
  const badPlayers = await prisma.player.count({
    where: {
      OR: [
        { birthDay: null }, { nextAgeDay: null },
        { birthDay: { lte: currentDay - DAYS_PER_YEAR } },
        { nextAgeDay: { gt: currentDay + DAYS_PER_YEAR } },
      ],
    },
  });
  console.log(`players with bad anchors: ${badPlayers}`);

  // ── 3. ConfigKey hygiene ─────────────────────────────────────────
  for (const key of ["youth.scoutMinProspects", "youth.scoutMaxProspects"]) {
    const res = await prisma.configKey.deleteMany({ where: { key } });
    console.log(`removed config row ${key} (${res.count})`);
  }
  for (const key of ["economy.clubWithdrawTaxPct", "youth.maxProspectsPool"]) {
    const def = CONFIG_DEFAULTS.find((d) => d.key === key);
    if (!def) continue;
    await prisma.configKey.upsert({
      where: { key },
      create: {
        key, group: def.group, valueType: def.valueType, defaultValue: def.defaultValue,
        currentValue: def.defaultValue, minValue: def.minValue ?? null, maxValue: def.maxValue ?? null,
        locked: false, description: def.description ?? "",
      },
      update: { group: def.group, defaultValue: def.defaultValue, minValue: def.minValue ?? null, maxValue: def.maxValue ?? null, description: def.description ?? "" },
    });
    console.log(`upserted config row ${key} = ${def.defaultValue}`);
  }

  console.log("Task 23 migration DONE");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
