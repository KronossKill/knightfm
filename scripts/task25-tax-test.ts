// Knight FM — Task 25-b verification: club-income gravamen inside creditClub.
// Creates a throwaway club, exercises PRIZE (taxable), INVEST (exempt), pct=0
// (temporary config override) and the levy>=amount edge, checks idempotency,
// then RESTORES config to 10 and cleans up every artifact (ledger rows, SYSTEM
// fund delta, club). Run: bun scripts/task25-tax-test.ts

import { PrismaClient } from "@prisma/client";
import { creditClub } from "@/lib/engine/finance";
import { invalidateConfig } from "@/lib/config";

// Own client WITHOUT query logging for readable output; creditClub/getInt use
// @/lib/db internally but results are what matter here.
const raw = new PrismaClient();
const ID = "T25TEST";
let failures = 0;

function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  if (!cond) failures++;
}

async function main() {
  // ── 0) Setup: throwaway club + saved config state ─────────────────
  const preConfig = await raw.configKey.findUnique({ where: { key: "economy.clubIncomeTaxPct" } });
  const region = await raw.region.findFirstOrThrow({ select: { id: true } });
  const division = await raw.division.findFirstOrThrow({ select: { id: true } });
  const club = await raw.club.create({
    data: {
      name: `T25 Tax Test ${Date.now()}`, regionId: region.id, divisionId: division.id,
      systemOwned: true, operatingFund: 0,
    },
    select: { id: true, operatingFund: true },
  });
  console.log(`SUMMARY — throwaway club ${club.id} created (fund 0)`);

  const sysFundBefore = (await raw.fundBalance.findUnique({ where: { scope: "SYSTEM" } }))?.balance ?? 0;

  // ── 1) Taxable PRIZE, pct 10 → club +900, SYSTEM +100 INCOME_LEVY ──
  const r1 = await creditClub(raw, club.id, 1000, "PRIZE", `${ID}:1`, "Prize test");
  check("PRIZE 1000 @10% credited (returns true)", r1 === true);
  const clubAfter1 = await raw.club.findUniqueOrThrow({ where: { id: club.id }, select: { operatingFund: true } });
  check("club operatingFund +900 (net after 10% levy)", clubAfter1.operatingFund === 900, String(clubAfter1.operatingFund));
  const clubLedger1 = await raw.ledgerEntry.findUnique({ where: { idemKey: `${ID}:1` } });
  check("club ledger T25TEST:1 exists, amount 900, category PRIZE", !!clubLedger1 && clubLedger1.amount === 900 && clubLedger1.category === "PRIZE");
  check("club ledger memo carries '(gravamen 10% incluido)'", !!clubLedger1 && clubLedger1.memo.includes("(gravamen 10% incluido)"), clubLedger1?.memo);
  check("club ledger gross/levy/net = 1000/100/900", !!clubLedger1 && clubLedger1.grossAmount === 1000 && clubLedger1.levyAmount === 100 && clubLedger1.netAmount === 900);
  const levyLedger1 = await raw.ledgerEntry.findUnique({ where: { idemKey: `${ID}:1:LEVY` } });
  check("SYSTEM_FUND ledger T25TEST:1:LEVY amount 100 category INCOME_LEVY", !!levyLedger1 && levyLedger1.amount === 100 && levyLedger1.category === "INCOME_LEVY" && levyLedger1.account === "SYSTEM_FUND");
  const sysAfter1 = (await raw.fundBalance.findUnique({ where: { scope: "SYSTEM" } }))?.balance ?? 0;
  check("FundBalance SYSTEM +100", sysAfter1 === sysFundBefore + 100, `${sysFundBefore} → ${sysAfter1}`);

  // ── 2) Idempotency: same idemKey again → no changes ───────────────
  const r2 = await creditClub(raw, club.id, 1000, "PRIZE", `${ID}:1`, "Prize test");
  check("repeat same idemKey returns false (no duplicate)", r2 === false);
  const clubAfter2 = await raw.club.findUniqueOrThrow({ where: { id: club.id }, select: { operatingFund: true } });
  const sysAfter2 = (await raw.fundBalance.findUnique({ where: { scope: "SYSTEM" } }))?.balance ?? 0;
  const dupCount = await raw.ledgerEntry.count({ where: { idemKey: { startsWith: `${ID}:1` } } });
  check("no duplicate ledger rows, balances unchanged", clubAfter2.operatingFund === 900 && sysAfter2 === sysAfter1 && dupCount === 2, `club ${clubAfter2.operatingFund}, system ${sysAfter2}, rows ${dupCount}`);

  // ── 3) Exempt INVEST → +1000 exact, no levy ───────────────────────
  const r3 = await creditClub(raw, club.id, 1000, "INVEST", `${ID}:2`, "Owner deposit test");
  check("INVEST 1000 credited (returns true)", r3 === true);
  const clubAfter3 = await raw.club.findUniqueOrThrow({ where: { id: club.id }, select: { operatingFund: true } });
  check("club +1000 exact (exempt, no levy)", clubAfter3.operatingFund === 1900, String(clubAfter3.operatingFund));
  const investLedger = await raw.ledgerEntry.findUnique({ where: { idemKey: `${ID}:2` } });
  check("INVEST ledger amount 1000, memo untouched, no gross/levy/net", !!investLedger && investLedger.amount === 1000 && investLedger.memo === "Owner deposit test" && investLedger.levyAmount === null);
  const noLevy2 = await raw.ledgerEntry.findUnique({ where: { idemKey: `${ID}:2:LEVY` } });
  const sysAfter3 = (await raw.fundBalance.findUnique({ where: { scope: "SYSTEM" } }))?.balance ?? 0;
  check("no INCOME_LEVY row for INVEST, SYSTEM fund unchanged", !noLevy2 && sysAfter3 === sysAfter1);

  // ── 4) pct=0 (temporary config) → taxable category still +1000 ────
  await raw.configKey.upsert({
    where: { key: "economy.clubIncomeTaxPct" },
    create: { key: "economy.clubIncomeTaxPct", group: "economy", valueType: "int", defaultValue: "10", currentValue: "0", minValue: 0, maxValue: 50, description: "temp test" },
    update: { currentValue: "0" },
  });
  invalidateConfig();
  const r4 = await creditClub(raw, club.id, 1000, "PRIZE", `${ID}:3`, "Zero pct test");
  const clubAfter4 = await raw.club.findUniqueOrThrow({ where: { id: club.id }, select: { operatingFund: true } });
  check("PRIZE 1000 @0% → club +1000 exact", r4 === true && clubAfter4.operatingFund === 2900, String(clubAfter4.operatingFund));
  const zeroLedger = await raw.ledgerEntry.findUnique({ where: { idemKey: `${ID}:3` } });
  check("pct=0 ledger memo has NO gravamen suffix", !!zeroLedger && zeroLedger.memo === "Zero pct test", zeroLedger?.memo);
  const noLevy3 = await raw.ledgerEntry.findUnique({ where: { idemKey: `${ID}:3:LEVY` } });
  check("pct=0 → no INCOME_LEVY row", !noLevy3);

  // ── 5) Edge pct=100 → levy>=amount, net 0 allowed ─────────────────
  await raw.configKey.update({ where: { key: "economy.clubIncomeTaxPct" }, data: { currentValue: "100" } });
  invalidateConfig();
  const r5 = await creditClub(raw, club.id, 1000, "LOAN_IN", `${ID}:4`, "Full levy edge");
  const clubAfter5 = await raw.club.findUniqueOrThrow({ where: { id: club.id }, select: { operatingFund: true } });
  const edgeLevy = await raw.ledgerEntry.findUnique({ where: { idemKey: `${ID}:4:LEVY` } });
  check("pct=100 → net 0 credited, SYSTEM +1000 (allowed edge)", r5 === true && clubAfter5.operatingFund === 2900 && edgeLevy?.amount === 1000, `club ${clubAfter5.operatingFund}, levy ${edgeLevy?.amount}`);
  const sysAfter5 = (await raw.fundBalance.findUnique({ where: { scope: "SYSTEM" } }))?.balance ?? 0;
  check("FundBalance SYSTEM total delta matches levies (100+1000)", sysAfter5 === sysFundBefore + 1100, `${sysFundBefore} → ${sysAfter5}`);

  // ── 6) RESTORE config + cleanup every artifact ────────────────────
  if (preConfig) await raw.configKey.update({ where: { key: "economy.clubIncomeTaxPct" }, data: { currentValue: preConfig.currentValue } });
  else await raw.configKey.delete({ where: { key: "economy.clubIncomeTaxPct" } }).catch(() => undefined);
  invalidateConfig();
  const cfgNow = await raw.configKey.findUnique({ where: { key: "economy.clubIncomeTaxPct" } });
  check("economy.clubIncomeTaxPct restored", preConfig ? cfgNow?.currentValue === preConfig.currentValue : !cfgNow, String(cfgNow?.currentValue));

  await raw.ledgerEntry.deleteMany({ where: { idemKey: { startsWith: `${ID}:` } } });
  const leftover = await raw.ledgerEntry.count({ where: { idemKey: { startsWith: `${ID}:` } } });
  check("test ledger rows deleted", leftover === 0);
  await raw.fundBalance.update({ where: { scope: "SYSTEM" }, data: { balance: { decrement: 1100 } } });
  const sysFinal = (await raw.fundBalance.findUnique({ where: { scope: "SYSTEM" } }))?.balance ?? 0;
  check("FundBalance SYSTEM restored", sysFinal === sysFundBefore, `${sysFundBefore} → ${sysFinal}`);
  await raw.club.delete({ where: { id: club.id } });
  const clubGone = await raw.club.findUnique({ where: { id: club.id } });
  check("throwaway club deleted", !clubGone);

  console.log(failures === 0 ? "SUMMARY — ALL CHECKS PASSED" : `SUMMARY — ${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error("FATAL", e); process.exitCode = 1; })
  .finally(() => raw.$disconnect());
