// Knight FM — world genesis + wipe pipeline (spec §3, §4, §36).
// Shared by scripts/seed.ts (CLI) and the admin world-reset API route.
// 10 regions × 10 divisions × 16 clubs = 1,600 system-owned clubs; 20 players each.

import { createHash } from "crypto";
import { type Prisma, type PrismaClient } from "@prisma/client";
import { CONFIG_DEFAULTS } from "./config";
import { REGION_NAME_KEYS, generateClubName, generatePlayerName } from "./engine/names";
import { computeBaseMarketValue, applyValueMultiplier, computeSalary, computeReleaseClause, starsFromOvr, ATTRIBUTE_IMPORTANCE } from "./engine/ovr";
import { ATTRIBUTE_KEYS } from "./types";
import { generateLeagueFixtures, generateCupInitial } from "./engine/fixtures";

type Client = PrismaClient;

export interface GenesisCounts {
  regions: number;
  divisions: number;
  clubs: number;
  players: number;
  fixtures: number;
  seasons: number;
}

export interface GenesisResult {
  counts: GenesisCounts;
  epochIso: string;
}

/**
 * Canonical world shape (spec §3): 10 regions × 10 divisions × 16 clubs.
 * Exported so the startup instrumentation can validate world integrity
 * against the SAME constants the builder uses (no duplicated literals).
 */
export const WORLD_SHAPE = {
  regions: 10,
  divisionsPerRegion: 10,
  clubsPerDivision: 16,
  playersPerClub: 20,
} as const;

function rngFrom(seed: string) {
  const h = createHash("sha256").update(seed).digest();
  let a = h.readUInt32BE(0);
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateAttributes(ovrTarget: number, rng: () => number): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = { technical: {}, physical: {}, mental: {} };
  for (const [family, keys] of Object.entries(ATTRIBUTE_KEYS)) {
    for (const k of keys) {
      const importance = ATTRIBUTE_IMPORTANCE[k] ?? 0.5;
      const spread = (rng() - 0.5) * 22;
      const v = Math.max(5, Math.min(97, Math.round(ovrTarget + spread * (1.2 - importance))));
      out[family][k] = v;
    }
  }
  return out;
}

const POSITIONS_PLAN: { position: "GK" | "DF" | "MF" | "FW"; detailed: string[] }[] = [
  { position: "GK", detailed: ["GK", "GK"] },
  { position: "DF", detailed: ["CB", "CB", "LB", "RB", "CB", "LB"] },
  { position: "MF", detailed: ["DM", "CM", "CM", "AM", "LM", "RM", "CM"] },
  { position: "FW", detailed: ["ST", "ST", "LW", "RW", "ST"] },
];

const BADGE_COLORS: [string, string][] = [
  ["#10b981", "#064e3b"], ["#f59e0b", "#78350f"], ["#ef4444", "#7f1d1d"], ["#8b5cf6", "#3b0764"],
  ["#14b8a6", "#134e4a"], ["#eab308", "#713f12"], ["#f97316", "#7c2d12"], ["#84cc16", "#365314"],
  ["#ec4899", "#831843"], ["#22d3ee", "#164e63"],
];

/** Today's UTC midnight — the world epoch used by GameDay arithmetic. */
export function worldEpochIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/**
 * Destructive wipe of the entire game world (FK-safe order, children first).
 * Preserves: users, sessions, personal wallets, config, audit log, knowledge base,
 * deposits/withdrawals, notifications, messages, VPN exceptions, job runs.
 * Wipes: clubs, players, staff, contracts, competitions, seasons, fixtures,
 * matches, standings, cups, markets, club ledgers, facilities, youth, world funds.
 * The user mandate is explicit: after a reset NO previous match history exists —
 * every Match/MatchEvent/Fixture/Standing/CupRun/WorldCupSlot row is destroyed
 * here (the durable Club titles + W/D/L tallies die with the clubs themselves).
 */
export async function wipeWorld(client: Client): Promise<void> {
  // Match data (MatchEvent cascades from Match, but delete explicitly for clarity)
  await client.matchEvent.deleteMany();
  await client.match.deleteMany();
  await client.fixture.deleteMany();
  await client.standing.deleteMany();
  // Cup / world-cup / prize / transfers
  await client.cupRun.deleteMany();
  await client.worldCupSlot.deleteMany();
  await client.prizePool.deleteMany();
  await client.transferRecord.deleteMany();
  // Markets
  await client.bid.deleteMany();
  await client.listing.deleteMany();
  // Players & youth
  await client.attributeSnapshot.deleteMany();
  await client.youthScoutSession.deleteMany();
  await client.youthProspect.deleteMany();
  // Club-linked operational data
  await client.trainingSession.deleteMany();
  await client.managerOffer.deleteMany();
  await client.managerContract.deleteMany();
  await client.permissionGrant.deleteMany();
  await client.staffMember.deleteMany();
  await client.facilityUpgrade.deleteMany();
  await client.facility.deleteMany();
  await client.ledgerEntry.deleteMany();
  await client.lineup.deleteMany();
  await client.trainingPlan.deleteMany();
  await client.ownershipRecord.deleteMany();
  // World entities
  await client.player.deleteMany();
  await client.club.deleteMany();
  await client.division.deleteMany();
  await client.region.deleteMany();
  await client.season.deleteMany();
  // Funds: regional fund rows belong to dead regions; SYSTEM is reset to 0 by seedConfig.
  await client.fundBalance.deleteMany();
  // Scheduler operational state of the DEAD world: JobRun is a per-day
  // idempotency ledger whose keys are day-numbered (SALARY:7, ROLLOVER:12…).
  // Keeping it would silently suppress every day-job of the rebuilt world
  // (beginJob would see the keys as already recorded) and scheduler.lastDay
  // would freeze the catch-up loop until real time caught up with the old
  // world's clock. The durable historical record lives in AuditEvent, which
  // IS preserved.
  await client.jobRun.deleteMany();
}

async function seedConfig(client: Client, opts: { resetEpoch: boolean }): Promise<void> {
  for (const cfg of CONFIG_DEFAULTS) {
    await client.configKey.upsert({
      where: { key: cfg.key },
      create: { key: cfg.key, group: cfg.group, valueType: cfg.valueType, defaultValue: cfg.defaultValue, minValue: cfg.minValue ?? null, maxValue: cfg.maxValue ?? null, locked: cfg.locked ?? false, description: cfg.description ?? "" },
      update: {},
    });
  }
  // World epoch: start of today UTC. On a fresh genesis (wipe) the epoch is
  // FORCED to now so GameDay restarts at 1 for the rebuilt world.
  const epochIso = worldEpochIso();
  const epochData = opts.resetEpoch ? { value: epochIso } : {};
  await client.systemState.upsert({
    where: { key: "world.epoch.utc" },
    create: { key: "world.epoch.utc", value: epochIso },
    update: epochData,
  });
  await client.configKey.update({ where: { key: "world.epoch.utc" }, data: { currentValue: epochIso } }).catch(() => undefined);
  await client.fundBalance.upsert({ where: { scope: "SYSTEM" }, create: { scope: "SYSTEM", balance: 0 }, update: opts.resetEpoch ? { balance: 0 } : {} });
  // Reset the scheduler's day cursor with the world: the rebuilt world starts
  // at GameDay 1 and every day-job must run again from there.
  await client.systemState.upsert({
    where: { key: "scheduler.lastDay" },
    create: { key: "scheduler.lastDay", value: "0" },
    update: opts.resetEpoch ? { value: "0" } : {},
  });
}

async function seedKnowledge(client: Client): Promise<void> {
  const articles = [
    { slug: "tutorial-getting-started", titleKey: "kb.tutorialGettingStarted.title", bodyKey: "kb.tutorialGettingStarted.body", category: "TUTORIAL" },
    { slug: "rules-time", titleKey: "kb.rulesTime.title", bodyKey: "kb.rulesTime.body", category: "RULES" },
    { slug: "rules-markets", titleKey: "kb.rulesMarkets.title", bodyKey: "kb.rulesMarkets.body", category: "MARKETS" },
    { slug: "rules-economy", titleKey: "kb.rulesEconomy.title", bodyKey: "kb.rulesEconomy.body", category: "FINANCE" },
    { slug: "rules-tactics", titleKey: "kb.rulesTactics.title", bodyKey: "kb.rulesTactics.body", category: "TACTICS" },
    { slug: "rules-training", titleKey: "kb.rulesTraining.title", bodyKey: "kb.rulesTraining.body", category: "TRAINING" },
  ];
  for (const a of articles) {
    await client.knowledgeArticle.upsert({ where: { slug: a.slug }, create: a, update: {} });
  }
}

async function seedAdmin(client: Client): Promise<void> {
  // USER MANDATE: the platform's default administrator account is defined by
  // the ADMIN_BOOTSTRAP_EMAIL env var (admin.bootstrapEmail default matches).
  // If the owner already registered that email before genesis ran, it is
  // PROMOTED to ADMIN in place (keeping its username/password); otherwise it
  // is created here with the ADMIN_BOOTSTRAP_PASSWORD — change it after login.
  const { hash } = await import("@node-rs/argon2");
  // SECURITY (GitHub/Supabase hardening): bootstrap credentials are NOT
  // hardcoded anymore — the repository may be hosted publicly on GitHub.
  // They come from environment variables (.env / hosting provider) and MUST
  // be set before running genesis. The fallbacks below are placeholders for
  // an empty database in local development only.
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "owner@knight-fm.local";
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!bootstrapPassword) {
    console.warn(
      "[genesis] ADMIN_BOOTSTRAP_PASSWORD is not set — the bootstrap admin will be created with a placeholder password. Set ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD in .env before deploying.",
    );
  }
  const existing = await client.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN" || !existing.emailVerified) {
      await client.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN", emailVerified: true, registrationIp: null },
      });
    }
    return;
  }
  await client.user.create({
    data: {
      email, username: "kronoss2803", passwordHash: await hash(bootstrapPassword ?? "ChangeMe-Bootstrap!", { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      role: "ADMIN", emailVerified: true, path: "OWNER",
    },
  });
}

/**
 * Build the world from the seed. When `wipe` is true the existing world is
 * destroyed first (FK-safe) and the epoch/funds are reset — the full
 * "backup+reseed" behavior used by the admin reset and `seed.ts --force`.
 */
export async function runWorldGenesis(client: Client, opts: { wipe?: boolean } = {}): Promise<GenesisResult> {
  const existing = await client.region.count();
  if (existing > 0 && !opts.wipe) {
    const counts = await countWorld(client);
    return { counts, epochIso: (await client.systemState.findUnique({ where: { key: "world.epoch.utc" } }))?.value ?? worldEpochIso() };
  }
  if (opts.wipe) await wipeWorld(client);

  await seedConfig(client, { resetEpoch: !!opts.wipe });
  await seedKnowledge(client);
  await seedAdmin(client);

  // Season 1 starts at least world.seasonStartOffsetDays (min 5, admin-raised)
  // FULL game days after the reset: the world re-enters in PRE-SEASON — no
  // match has ever been played and no history exists. Fixtures are generated
  // against the future start day so nothing fires before the season begins.
  const offsetCfg = await client.configKey.findUnique({ where: { key: "world.seasonStartOffsetDays" } });
  const offsetRaw = parseInt(offsetCfg?.currentValue || offsetCfg?.defaultValue || "5", 10);
  const seasonOffset = Math.max(5, Number.isFinite(offsetRaw) ? offsetRaw : 5);
  const seasonStartDay = 1 + seasonOffset;

  // Every club is born with the ADMIN-CONFIGURED operating fund
  // (economy.clubStartingFund — unlocked, editable in the Control Center).
  const fundCfg = await client.configKey.findUnique({ where: { key: "economy.clubStartingFund" } });
  const fundRaw = parseInt(fundCfg?.currentValue || fundCfg?.defaultValue || "1000", 10);
  const clubStartingFund = Math.max(0, Number.isFinite(fundRaw) ? fundRaw : 1000);

  const season = await client.season.create({
    data: {
      number: 1, startEpochDay: seasonStartDay, state: "ACTIVE",
      prizeLeague: 5000, prizeCup: 2500, prizeWorld: 10000,
    },
  });

  const usedNames = new Set<string>();
  const regions: { id: string; clubIds: string[] }[] = [];
  for (let ri = 0; ri < WORLD_SHAPE.regions; ri++) {
    const region = await client.region.create({ data: { index: ri + 1, nameKey: REGION_NAME_KEYS[ri] } });
    const clubIds: string[] = [];
    for (let di = 0; di < WORLD_SHAPE.divisionsPerRegion; di++) {
      const division = await client.division.create({ data: { regionId: region.id, index: di + 1 } });
      const clubRows: { name: string; ci: number }[] = [];
      for (let ci = 0; ci < WORLD_SHAPE.clubsPerDivision; ci++) {
        let name = "";
        let attempt = 0;
        do {
          name = generateClubName(rngFrom(`club:${ri}:${di}:${ci}:${attempt}`), ci);
          attempt++;
        } while (usedNames.has(name) && attempt < 10);
        if (usedNames.has(name)) name = `${name} ${ri}${di}${ci}`;
        usedNames.add(name);
        clubRows.push({ name, ci });
      }

      const playerRows: Prisma.PlayerCreateManyInput[] = [];
      // NOTE: system clubs start with ZERO staff members (user mandate). All six
      // facilities are already created at the BASIC level (1); coaches, scouts,
      // physios… are hired over time WITH THE CLUB'S OWN FUNDS. Special
      // training stays locked until the first COACH joins.
      const facilityRows: Prisma.FacilityCreateManyInput[] = [];
      const lineupRows: Prisma.LineupCreateManyInput[] = [];
      const planRows: Prisma.TrainingPlanCreateManyInput[] = [];

      for (const { name, ci } of clubRows) {
        const [primary, secondary] = BADGE_COLORS[(ri + di + ci) % BADGE_COLORS.length];
        const initials = name.split(" ").filter((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w)).slice(0, 2).map((w) => w[0]).join("") || name.slice(0, 2).toUpperCase();
        const club = await client.club.create({
          data: {
            regionId: region.id, divisionId: division.id, name, originalName: name, systemOwned: true, operatingFund: clubStartingFund,
            brand: { create: { primaryColor: primary, secondaryColor: secondary, initials } },
          },
        });
        clubIds.push(club.id);

        for (const type of ["STADIUM", "TRAINING_CENTER", "YOUTH_ACADEMY", "MEDICAL_CENTER", "SPORTS_SCIENCE", "REST_ROOMS"]) {
          facilityRows.push({ clubId: club.id, type, level: 1 });
        }
        lineupRows.push({ clubId: club.id, formation: "4-4-2", slots: "{}" });
        planRows.push({ clubId: club.id });

        // Batched players: playersPerClub per club
        let pi = 0;
        for (const plan of POSITIONS_PLAN) {
          for (const detailed of plan.detailed) {
            const rng = rngFrom(`player:${club.id}:${pi}`);
            const roll = rng();
            const ovr = roll < 0.8 ? 42 + Math.floor(rng() * 18) : roll < 0.97 ? 60 + Math.floor(rng() * 15) : 75 + Math.floor(rng() * 12);
            const age = 17 + Math.floor(rng() * 17);
            // Task 27: VALUE = base × multiplier (default 3); salary from BASE.
            const baseValue = computeBaseMarketValue(ovr, age);
            const value = applyValueMultiplier(baseValue, 3);
            const { firstName, lastName } = generatePlayerName(rng);
            playerRows.push({
              clubId: club.id, firstName, lastName, age,
              position: plan.position, detailedPos: detailed,
              stars: starsFromOvr(ovr), ovr, potential: Math.min(99, ovr + 2 + Math.floor(rng() * 12)),
              marketValue: value, salary: computeSalary(baseValue, 1), releaseClause: computeReleaseClause(value, 5),
              attributes: JSON.stringify(generateAttributes(ovr, rng)),
              form: 40 + Math.floor(rng() * 25), fatigue: Math.floor(rng() * 15), sharpness: 55 + Math.floor(rng() * 25),
              morale: 50 + Math.floor(rng() * 30), confidence: 50 + Math.floor(rng() * 30),
            });
            pi++;
          }
        }
      }

      if (facilityRows.length) await client.facility.createMany({ data: facilityRows });
      if (lineupRows.length) await client.lineup.createMany({ data: lineupRows });
      if (planRows.length) await client.trainingPlan.createMany({ data: planRows });
      if (playerRows.length) await client.player.createMany({ data: playerRows });
    }
    regions.push({ id: region.id, clubIds });
  }

  // League + cup fixtures — scheduled relative to Season 1's FUTURE start day
  // (reset day + world.seasonStartOffsetDays). Nothing kicks off before that.
  const divisions = await client.division.findMany({ include: { clubs: { select: { id: true } } } });
  for (const div of divisions) {
    await generateLeagueFixtures(season.id, div.id, div.clubs.map((c) => c.id), season.startEpochDay);
  }
  for (const region of regions) {
    await generateCupInitial(season.id, region.id, region.clubIds, season.startEpochDay);
  }

  // Free-agent pool
  const faRng = rngFrom("free-agents:initial");
  const faRows: Prisma.PlayerCreateManyInput[] = [];
  for (let i = 0; i < 40; i++) {
    const { firstName, lastName } = generatePlayerName(faRng);
    const roll = faRng();
    const ovr = roll < 0.7 ? 40 + Math.floor(faRng() * 20) : roll < 0.93 ? 60 + Math.floor(faRng() * 15) : 75 + Math.floor(faRng() * 10);
    const position = (["GK", "DF", "MF", "FW"] as const)[Math.floor(faRng() * 4)];
    const age = 17 + Math.floor(faRng() * 14);
    const baseValue = computeBaseMarketValue(ovr, age);
    const value = applyValueMultiplier(baseValue, 3);
    faRows.push({
      clubId: null, isFreeAgent: true, firstName, lastName, age, position, detailedPos: position,
      stars: starsFromOvr(ovr), ovr, potential: Math.min(99, ovr + Math.floor(faRng() * 10)),
      marketValue: value, salary: computeSalary(baseValue, 1), releaseClause: computeReleaseClause(value, 5),
      attributes: JSON.stringify(generateAttributes(ovr, faRng)),
    });
  }
  if (faRows.length) await client.player.createMany({ data: faRows });

  return { counts: await countWorld(client), epochIso: worldEpochIso() };
}

async function countWorld(client: Client): Promise<GenesisCounts> {
  const [regions, divisions, clubs, players, fixtures, seasons] = await Promise.all([
    client.region.count(),
    client.division.count(),
    client.club.count(),
    client.player.count(),
    client.fixture.count(),
    client.season.count(),
  ]);
  return { regions, divisions, clubs, players, fixtures, seasons };
}
