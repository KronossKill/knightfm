// Knight FM — server-side configuration registry (spec §36 Knight Control Center)
// Every configurable rule is a named key with validated default, range and audit.
// Locked keys = immutable invariants (spec §44) and cannot be changed via configuration.

import { db } from "@/lib/db";

export interface ConfigEntry {
  key: string;
  group: string;
  valueType: "int" | "string" | "bool" | "json";
  defaultValue: string;
  minValue?: number;
  maxValue?: number;
  locked?: boolean;
  description?: string;
}

export const CONFIG_DEFAULTS: ConfigEntry[] = [
  // World
  { key: "world.epoch.utc", group: "world", valueType: "string", defaultValue: "", locked: true, description: "World epoch (UTC ISO). GameDay = 1 + floor((UTCNow - epoch)/24h)." },
  { key: "world.seasonStartOffsetDays", group: "world", valueType: "int", defaultValue: "5", minValue: 5, maxValue: 60, description: "Full game days between the WORLD RESET (day 1) and Season 1 competitive day 1. The world starts in PRE-SEASON: no matches exist and no match history is carried over. MINIMUM 5 (a reset always lands at least 5 days before the season starts, per platform rule); the administrator may raise it. Season 1 startEpochDay = 1 + this value." },
  { key: "world.regions", group: "world", valueType: "int", defaultValue: "10", locked: true, description: "Initial regions." },
  { key: "world.divisionsPerRegion", group: "world", valueType: "int", defaultValue: "10", locked: true },
  { key: "world.clubsPerDivision", group: "world", valueType: "int", defaultValue: "16", locked: true },
  { key: "world.autoCreateDivision", group: "world", valueType: "bool", defaultValue: "true", description: "Create a new division when a region is exhausted." },
  { key: "world.pickMinDivisionIndex", group: "world", valueType: "int", defaultValue: "5", minValue: 1, maxValue: 50, description: "LOWEST selectable division index when choosing a system club (new registrations, managers taking a club, owners buying additional clubs). Only divisions with index >= this value appear as available; top divisions (1..n-1) are protected so players cannot simply pick the clubs at the top of the pyramid. Default 5 = divisions 5..last selectable." },

  // Season / competitions
  { key: "season.competitiveDays", group: "competition", valueType: "int", defaultValue: "32", locked: true },
  { key: "season.preseasonDays", group: "competition", valueType: "int", defaultValue: "5", locked: true },
  { key: "competition.leagueCompleteByDay", group: "competition", valueType: "int", defaultValue: "28", locked: true },
  { key: "competition.cupFinalDay", group: "competition", valueType: "int", defaultValue: "29", locked: true },
  { key: "competition.worldCupFinalDay", group: "competition", valueType: "int", defaultValue: "30", locked: true },
  { key: "competition.kickoffHourUtc", group: "competition", valueType: "int", defaultValue: "19", minValue: 0, maxValue: 23, description: "Default league kickoff hour (UTC)." },
  { key: "competition.kickoffRegionStaggerMinutes", group: "competition", valueType: "int", defaultValue: "90", minValue: 0, maxValue: 240, description: "Kickoff spacing between regions: each region's matches shift by regionIndex × this many minutes from the base kickoff hour, so the scheduler never simulates every match at the same instant (server load)." },
  { key: "competition.kickoffMinuteJitter", group: "competition", valueType: "int", defaultValue: "20", minValue: 0, maxValue: 59, description: "Deterministic per-fixture minute jitter (0..n-1, seeded from the fixture identity) added on top of the regional offset so matches within one region do not all fire at the same second." },
  { key: "competition.promotionSlots", group: "competition", valueType: "int", defaultValue: "3", minValue: 0, maxValue: 4, description: "Top-N clubs of each division (except division 1) promote to the division above. Division-1 top-3 qualify for the Club World Cup." },
  { key: "competition.relegationSlots", group: "competition", valueType: "int", defaultValue: "3", minValue: 0, maxValue: 4, description: "Bottom-N clubs of each division (except the last one, which always stays) relegate to the division below." },
  { key: "competition.worldCupSlots", group: "competition", valueType: "int", defaultValue: "3", minValue: 1, maxValue: 6, description: "Top-N first-division clubs per region that qualify for the Club World Cup via league position (a regional cup champion also earns a slot; best remaining first-division records complete the 40-club field)." },
  { key: "competition.prizeLeagueBase", group: "competition", valueType: "int", defaultValue: "5000", description: "Season-1 league prize pool base ($Knight)." },
  { key: "competition.prizeCupBase", group: "competition", valueType: "int", defaultValue: "2500" },
  { key: "competition.prizeWorldBase", group: "competition", valueType: "int", defaultValue: "10000" },
  { key: "competition.winPrizeLeague", group: "competition", valueType: "int", defaultValue: "80", minValue: 0, maxValue: 100000, description: "Prize paid to the WINNER of every league match ($Knight, before the club-income gravamen). Sized so a typical club stays sustainable without accumulating wealth." },
  { key: "competition.winPrizeCup", group: "competition", valueType: "int", defaultValue: "120", minValue: 0, maxValue: 100000, description: "Prize paid to the winner of every REGIONAL CUP match ($Knight), knockout ties included. Higher than the league win prize (fewer matches)." },
  { key: "competition.winPrizeWorld", group: "competition", valueType: "int", defaultValue: "250", minValue: 0, maxValue: 100000, description: "Reference prize for CLUB WORLD CUP matches ($Knight). Group-stage wins pay winPrizeWorldGroupPct of it; knockout wins scale up round by round (QF 1/3, SF 2/3); the FINAL winner instead receives the configured world championship prize (competition.prizeWorldBase)." },
  { key: "competition.winPrizeDivisionStepPct", group: "competition", valueType: "int", defaultValue: "10", minValue: 0, maxValue: 90, description: "League prize scaling by DIVISION: every division below the 1st reduces league win prizes AND league title prizes by this percentage (linear, floor 10%). Division 1 pays 100%, division 2 90%... with the default step of 10." },
  { key: "competition.winPrizeWorldGroupPct", group: "competition", valueType: "int", defaultValue: "25", minValue: 0, maxValue: 100, description: "Percent of competition.winPrizeWorld paid for a CLUB WORLD CUP GROUP-STAGE win (early phases pay the minimum; knockout rounds escalate to the final champion prize)." },
  { key: "competition.winPrizeCupRoundScale", group: "competition", valueType: "bool", defaultValue: "true", description: "When true, REGIONAL CUP round wins escalate: round k of N pays winPrizeCup x k/N (early phases minimal, later rounds richer) and the FINAL winner instead receives the configured cup champion prize (competition.prizeCupBase). When false every round pays the flat winPrizeCup." },

  // Economy
  { key: "economy.clubStartingFund", group: "economy", valueType: "int", defaultValue: "1000", minValue: 0, description: "Operating fund assigned to EVERY club at world genesis/reset ($Knight, admin-configurable). System clubs picked by users keep their basic setup: level-1 facilities and NO staff — improvements are acquired over time with the club's own funds." },
  { key: "economy.playerSalaryRatePct", group: "economy", valueType: "int", defaultValue: "1", minValue: 0, maxValue: 10, description: "Daily player salary = pct of the player's BASE market value (before market.playerValueMultiplier) so wage bills stay sustainable." },
  { key: "economy.releaseClauseMultiplier", group: "economy", valueType: "int", defaultValue: "5", minValue: 1, maxValue: 20 },
  { key: "economy.userFundsLevyPct", group: "economy", valueType: "int", defaultValue: "10", minValue: 0, maxValue: 50, description: "Levy on ALL platform INCOMES credited to personal wallets (manager salary, referral bonus, club-sale proceeds). The levy goes to the SYSTEM fund; the user receives the net. Investments and deposits are levy-free." },
  { key: "economy.withdrawalLevyPct", group: "economy", valueType: "int", defaultValue: "10", minValue: 0, maxValue: 50, description: "Levy on withdrawals (crypto cash-out). Internal moves between user wallet and club treasury are levy-free." },
  { key: "economy.clubIncomeTaxPct", group: "economy", valueType: "int", defaultValue: "10", minValue: 0, maxValue: 50, description: "Gravamen (tax) withheld from CLUB INCOME (prizes, player sales, matchday revenue, loan fees). The club receives the net amount and the tax goes to the SYSTEM fund. Owner deposits (INVEST), auction refunds and admin grants are exempt." },
  { key: "economy.clubWithdrawTaxPct", group: "economy", valueType: "int", defaultValue: "10", minValue: 0, maxValue: 50, description: "Tax (gravamen) withheld when an owner withdraws club funds to their personal wallet. The tax goes to the SYSTEM fund; investing personal funds into a club is tax-free." },
  { key: "economy.revenueRegionalPct", group: "economy", valueType: "int", defaultValue: "5", minValue: 0, maxValue: 50 },
  { key: "economy.revenueSystemPct", group: "economy", valueType: "int", defaultValue: "5", minValue: 0, maxValue: 50 },
  { key: "economy.systemClubPrice", group: "economy", valueType: "int", defaultValue: "100", minValue: 1, description: "Fixed price to purchase a system-owned club." },
  { key: "economy.managerBaseContract", group: "economy", valueType: "int", defaultValue: "140", minValue: 1, description: "Base 1-season manager contract total ($Knight)." },
  { key: "economy.insolventDays", group: "economy", valueType: "int", defaultValue: "3", locked: true },
  { key: "economy.bankruptcyDays", group: "economy", valueType: "int", defaultValue: "10", locked: true },
  { key: "economy.repaymentMultiplier", group: "economy", valueType: "int", defaultValue: "2", minValue: 1, maxValue: 5 },
  { key: "economy.knightUsdCents", group: "economy", valueType: "int", defaultValue: "0", minValue: 0, maxValue: 10000000, description: "Manual USD value of 1 $Knight in US cents (25 = $0.25). Drives the USD equivalents shown next to every price and value in the game when no automatic price source is configured (or as fallback when the source is unreachable). 0 = disabled (USD display hidden, honest no-fabrication)." },

  // Markets
  { key: "market.directSaleFloorPct", group: "markets", valueType: "int", defaultValue: "100", minValue: 1, maxValue: 500 },
  { key: "market.auctionFloorPct", group: "markets", valueType: "int", defaultValue: "20", minValue: 1, maxValue: 200 },
  { key: "finance.salaryIntervalDays", group: "economy", valueType: "int", defaultValue: "7", minValue: 1, maxValue: 30, description: "Salaries (players + staff + manager) are paid every N game days. The payout equals the daily rate multiplied by N (weekly by default)." },
  { key: "market.freeAgentPoolSize", group: "markets", valueType: "int", defaultValue: "40", minValue: 0, maxValue: 500 },
  { key: "market.playerValueMultiplier", group: "markets", valueType: "int", defaultValue: "3", minValue: 1, maxValue: 100, description: "Player MARKET VALUE = system calculation x this multiplier (default 3). Applied at player creation and via one-time backfill. Salaries still derive from the BASE value so wage bills remain sustainable; transfer prices, clauses and listing floors follow the multiplied value." },
  { key: "market.managerOfferDays", group: "markets", valueType: "int", defaultValue: "7", minValue: 1, maxValue: 30 },

  // Squad / players
  { key: "squad.baseCapacity", group: "players", valueType: "int", defaultValue: "25", locked: true },
  { key: "squad.maxBonusSlots", group: "players", valueType: "int", defaultValue: "20", locked: true },
  { key: "squad.icpTrainingWeight", group: "players", valueType: "int", defaultValue: "30" },
  { key: "squad.icpMedicalWeight", group: "players", valueType: "int", defaultValue: "25" },
  { key: "squad.icpYouthWeight", group: "players", valueType: "int", defaultValue: "25" },
  { key: "squad.icpScienceWeight", group: "players", valueType: "int", defaultValue: "20" },
  { key: "players.retirementAgeOutfield", group: "players", valueType: "int", defaultValue: "36", locked: true },
  { key: "players.retirementAgeGk", group: "players", valueType: "int", defaultValue: "40", locked: true },
  { key: "players.youthPromotionAge", group: "players", valueType: "int", defaultValue: "18", locked: true },

  // Youth academy
  { key: "youth.baseCapacity", group: "youth", valueType: "int", defaultValue: "3", minValue: 1, maxValue: 50, description: "Youth academy capacity at the MINIMUM level (1): max prospects a club can hold. A level-1 academy holds exactly 3 prospects; capacity grows with every upgrade." },
  { key: "youth.capacityPerLevel", group: "youth", valueType: "int", defaultValue: "2", minValue: 0, maxValue: 10, description: "Extra youth capacity added per academy level above 1: capacity = baseCapacity + capacityPerLevel * (level - 1), capped by maxProspectsPool." },
  { key: "youth.maxProspectsPool", group: "youth", valueType: "int", defaultValue: "50", minValue: 5, maxValue: 200, description: "Absolute ceiling on a club's youth pool regardless of academy level (oldest trimmed). Effective capacity = min(baseCapacity + capacityPerLevel*(level-1), this ceiling). A scouting session reveals as many prospects as the SCOUT's star rating (1★→1 … 5★→5), limited by the remaining space." },
  { key: "youth.academyQualityCapBase", group: "youth", valueType: "int", defaultValue: "40", minValue: 0, maxValue: 100, description: "Base signable prospect quality cap at academy level 1." },
  { key: "youth.academyQualityCapPerLevel", group: "youth", valueType: "int", defaultValue: "10", minValue: 0, maxValue: 30, description: "Signable quality cap added per youth academy level (cap = base + perLevel * level)." },

  // Admin access
  { key: "admin.bootstrapEmail", group: "operations", valueType: "string", defaultValue: process.env.ADMIN_BOOTSTRAP_EMAIL ?? "owner@knight-fm.local", description: "Comma-separated emails that receive the ADMIN role at registration; the Control Center is visible only to ADMIN users. Default owner account is seeded by genesis from the ADMIN_BOOTSTRAP_EMAIL env var." },

  // Facilities
  { key: "facilities.maxLevel", group: "facilities", valueType: "int", defaultValue: "10", locked: true },
  { key: "facilities.upgradeDays", group: "facilities", valueType: "int", defaultValue: "5", locked: true },
  { key: "facilities.baseCost", group: "facilities", valueType: "int", defaultValue: "80", description: "Cost formula: baseCost * level^1.6" },
  { key: "facilities.restRecoveryPerLevel", group: "facilities", valueType: "int", defaultValue: "2", minValue: 0, maxValue: 10, description: "Daily fatigue reduction added per REST_ROOMS level." },

  // Training
  { key: "training.generalSessionsPerDay", group: "training", valueType: "int", defaultValue: "1", minValue: 1, maxValue: 3, description: "General (whole-squad) training sessions allowed per club per day." },
  { key: "training.specialPerTypePerDay", group: "training", valueType: "int", defaultValue: "1", minValue: 1, maxValue: 3, description: "Sessions allowed per club per day for EACH special training type." },
  { key: "training.weight.condition", group: "training", valueType: "int", defaultValue: "100", minValue: 0, maxValue: 200, description: "Weight (%) of the PLAYER CONDITION factor in training gains (fresh players improve more). 0 disables the factor, 200 doubles its effect." },
  { key: "training.weight.age", group: "training", valueType: "int", defaultValue: "100", minValue: 0, maxValue: 200, description: "Weight (%) of the PLAYER AGE factor (young players improve more, ~-3.5%/year from 15). 0 disables the factor." },
  { key: "training.weight.quality", group: "training", valueType: "int", defaultValue: "100", minValue: 0, maxValue: 200, description: "Weight (%) of the PLAYER QUALITY factor (high-OVR players are harder to improve). 0 disables the factor." },
  { key: "training.weight.coach", group: "training", valueType: "int", defaultValue: "100", minValue: 0, maxValue: 200, description: "Weight (%) of the COACH QUALITY factor (average quality of the club's coaches; no coach = 40 baseline). 0 disables the factor." },
  { key: "training.weight.facility", group: "training", valueType: "int", defaultValue: "100", minValue: 0, maxValue: 200, description: "Weight (%) of the TRAINING-CENTER LEVEL factor. 0 disables the factor." },
  { key: "training.growthFactor", group: "training", valueType: "int", defaultValue: "100", minValue: 1, maxValue: 500, description: "Percent growth factor." },
  { key: "training.generalAttrPct", group: "training", valueType: "int", defaultValue: "1", minValue: 1, maxValue: 20, description: "General session: percent applied to EVERY attribute of EVERY squad player." },
  { key: "training.specialAttrPct", group: "training", valueType: "int", defaultValue: "3", minValue: 1, maxValue: 30, description: "Special session: percent applied to the trained attribute family of the trained player." },

  // Staff
  { key: "staff.maxPerRole", group: "staff", valueType: "int", defaultValue: "3", minValue: 1, maxValue: 8, description: "Max hired staff members per area/role per club." },
  { key: "staff.hireCostPerQuality", group: "staff", valueType: "int", defaultValue: "2", minValue: 0, maxValue: 20, description: "Fallback hire fee factor (quality * this) used only when the per-star fee for the chosen star level is 0." },
  { key: "staff.severanceMultiplier", group: "staff", valueType: "int", defaultValue: "1", minValue: 0, maxValue: 10, description: "Staff dismissal severance = daily salary × remaining contract days (rest of the season) × this factor. All dismissed-contract funds go to the SYSTEM fund." },
  { key: "staff.starFee.1", group: "staff", valueType: "int", defaultValue: "50", minValue: 0, maxValue: 100000, description: "Hire fee ($Knight) for a 1-star staff member." },
  { key: "staff.starFee.2", group: "staff", valueType: "int", defaultValue: "100", minValue: 0, maxValue: 100000, description: "Hire fee ($Knight) for a 2-star staff member." },
  { key: "staff.starFee.3", group: "staff", valueType: "int", defaultValue: "200", minValue: 0, maxValue: 100000, description: "Hire fee ($Knight) for a 3-star staff member." },
  { key: "staff.starFee.4", group: "staff", valueType: "int", defaultValue: "350", minValue: 0, maxValue: 100000, description: "Hire fee ($Knight) for a 4-star staff member." },
  { key: "staff.starFee.5", group: "staff", valueType: "int", defaultValue: "600", minValue: 0, maxValue: 100000, description: "Hire fee ($Knight) for a 5-star staff member." },
  { key: "staff.starSalary.1", group: "staff", valueType: "int", defaultValue: "3", minValue: 0, maxValue: 10000, description: "Daily salary ($Knight) of a 1-star staff member." },
  { key: "staff.starSalary.2", group: "staff", valueType: "int", defaultValue: "6", minValue: 0, maxValue: 10000, description: "Daily salary ($Knight) of a 2-star staff member." },
  { key: "staff.starSalary.3", group: "staff", valueType: "int", defaultValue: "12", minValue: 0, maxValue: 10000, description: "Daily salary ($Knight) of a 3-star staff member." },
  { key: "staff.starSalary.4", group: "staff", valueType: "int", defaultValue: "22", minValue: 0, maxValue: 10000, description: "Daily salary ($Knight) of a 4-star staff member." },
  { key: "staff.starSalary.5", group: "staff", valueType: "int", defaultValue: "40", minValue: 0, maxValue: 10000, description: "Daily salary ($Knight) of a 5-star staff member." },

  // Matches (discipline)
  { key: "matches.redCardChancePct", group: "players", valueType: "int", defaultValue: "5", minValue: 0, maxValue: 100, description: "Chance (%) that a played match produces ONE red card (random player from either XI). The offender is suspended for 1..matches.redCardSuspensionMatches matches and the RED_CARD event appears in the match report." },
  { key: "matches.redCardSuspensionMatches", group: "players", valueType: "int", defaultValue: "2", minValue: 1, maxValue: 10, description: "Maximum matches of suspension for a red card (the actual ban is 1..this, uniform). Suspensions are served per club fixture and shown on the player cards." },
  { key: "matches.yellowCardChancePct", group: "players", valueType: "int", defaultValue: "40", minValue: 0, maxValue: 100, description: "Chance (%) per draw that a YELLOW CARD is shown (up to matches.yellowCardMaxPerMatch independent draws per match, random XI player from either team). YELLOW_CARD events appear in the match report." },
  { key: "matches.yellowCardMaxPerMatch", group: "players", valueType: "int", defaultValue: "4", minValue: 0, maxValue: 10, description: "Maximum independent yellow-card draws per match. A player booked twice in the same match is SENT OFF (red card, 1..matches.redCardSuspensionMatches) — the first booking still counts once toward the season tally." },
  { key: "matches.yellowCardsForSuspension", group: "players", valueType: "int", defaultValue: "5", minValue: 1, maxValue: 20, description: "Yellow cards accumulated across DISTINCT matches that trigger a ONE-match ban. Each match counts once (a second yellow = send-off adds only 1). The counter resets to 0 when the ban triggers and at every season change." },

  // Referral
  { key: "referral.bonus", group: "economy", valueType: "int", defaultValue: "100", minValue: 0 },

  // Security
  { key: "users.inactiveAfterDays", group: "security", valueType: "int", defaultValue: "40", minValue: 7, maxValue: 365, description: "Days without access before a user account is automatically marked INACTIVE. ADMIN accounts never expire." },
  { key: "users.deleteAfterDays", group: "security", valueType: "int", defaultValue: "60", minValue: 14, maxValue: 730, description: "Days without access before a user account is DELETED (their clubs return to the system with their original name). Must be >= inactiveAfterDays. ADMIN accounts are permanent." },
  { key: "security.captchaProvider", group: "security", valueType: "string", defaultValue: "sandbox", description: "sandbox | cloudflare_turnstile" },
  { key: "security.loginLockoutAttempts", group: "security", valueType: "int", defaultValue: "5", minValue: 3, maxValue: 20 },
  { key: "security.loginLockoutMinutes", group: "security", valueType: "int", defaultValue: "15", minValue: 1, maxValue: 120 },
  { key: "security.vpnDetectUrl", group: "security", valueType: "string", defaultValue: "", description: "Optional HTTPS endpoint for VPN/proxy detection: GET {url}?ip={ip} must return JSON {\"vpn\": true|false}. Empty = heuristic-only (never blocks without evidence). Fail-open on error, always audited." },
  { key: "security.vpnPolicy", group: "security", valueType: "string", defaultValue: "log_only", description: "log_only | block_except_cuba (auditable Cuba exception)" },
  { key: "security.ipWindowDays", group: "security", valueType: "int", defaultValue: "30", minValue: 1, maxValue: 365, description: "Task 41 anti-multi-account window (days): when 2+ ACTIVE accounts are seen on the SAME IP within this period, every involved account is auto-BLOCKED. Only an ADMIN can unblock (Control Center → Moderation)." },
  { key: "security.ipMultiAccountPolicy", group: "security", valueType: "string", defaultValue: "BLOCK", description: "BLOCK (default) enforces the 30-day multi-account auto-block. OFF disables detection entirely (evidence is still recorded). ADMIN accounts never trigger nor receive the block." },

  // Solana
  { key: "solana.rpc.url", group: "solana", valueType: "string", defaultValue: "", description: "JSON-RPC endpoint for deposit/withdrawal verification." },
  { key: "solana.mint", group: "solana", valueType: "string", defaultValue: "HXkLu99vbRsVt2EgxcVoHGhz2mZa9awbpyFA6MQepump", description: "$Knight SPL mint (mainnet). Public on-chain identifier — shown in the wallet so users can deposit without friction." },
  { key: "solana.systemWallet", group: "solana", valueType: "string", defaultValue: "hGmwTrDzMnuZ9v1ke8yz6egG1t37Fb8Yj35AvZVEVgk", description: "Platform deposit destination (mainnet, public address). Shown with its QR code in the wallet deposit flow; the private key is NEVER stored in the platform." },
  { key: "solana.minWithdraw", group: "solana", valueType: "int", defaultValue: "50", minValue: 1, maxValue: 1000000, description: "Minimum withdrawal amount from the personal wallet to Solana ($Knight). Requests below this amount are rejected with BELOW_MIN_WITHDRAW. Enforced server-side and shown as the hint in the wallet withdrawal form." },
  { key: "solana.price.url", group: "solana", valueType: "string", defaultValue: "", description: "Optional HTTPS JSON price source for AUTOMATIC $Knight/USD detection (accepted shapes: {\"price\":n}, {\"usd\":n}, {\"data\":{\"price\":n}}, {\"pairs\":[{\"price\":n}]}). When reachable it takes priority over economy.knightUsdCents for all USD equivalents (5-minute cache, fail-open to the manual rate)." },
  { key: "solana.finalityMinutes", group: "solana", valueType: "int", defaultValue: "60", minValue: 1 },

  // Operations
  { key: "ops.maintenanceMode", group: "operations", valueType: "bool", defaultValue: "false", description: "Maintenance mode flag." },
  { key: "ops.maintenanceMessage", group: "operations", valueType: "string", defaultValue: "Knight FM is under maintenance. Back shortly." },
];

let cache: Map<string, string> | null = null;
let cacheAt = 0;
const TTL = 30_000;

export async function loadConfig(): Promise<Map<string, string>> {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  const rows = await db.configKey.findMany();
  const map = new Map<string, string>();
  for (const d of CONFIG_DEFAULTS) map.set(d.key, d.defaultValue);
  for (const r of rows) {
    if (r.currentValue !== null && r.currentValue !== undefined && r.currentValue !== "") map.set(r.key, r.currentValue);
    else map.set(r.key, r.defaultValue);
  }
  cache = map;
  cacheAt = Date.now();
  return map;
}

export function invalidateConfig() {
  cache = null;
}

export async function getConfig(key: string): Promise<string> {
  const m = await loadConfig();
  return m.get(key) ?? "";
}

export async function getInt(key: string, fallback = 0): Promise<number> {
  const v = await getConfig(key);
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function getBool(key: string): Promise<boolean> {
  const v = await getConfig(key);
  return v === "true";
}
