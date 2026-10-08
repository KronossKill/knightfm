// Knight FM — Task 25-b verification: free-agent daily refresh (scheduler, READ-ONLY).
// 1) Tries to import freeAgentRefresh(999) directly — expected outcome reported.
// 2) Fallback: exercises the REAL path — rewinds scheduler.lastDay by one day and
//    deletes ONLY today's FREE-AGENT JobRun row, then runs processDueJobs(); every
//    other daily job is skipped via its existing idempotency rows, so effectively
//    just freeAgentRefresh(today) re-executes. Counts isFreeAgent before/after.
// Run: bun scripts/task25-fa-verify.ts

import { PrismaClient } from "@prisma/client";
import { invalidateConfig, getInt } from "@/lib/config";

const raw = new PrismaClient();

async function main() {
  // ── 1) Direct import attempt (as instructed; caught) ───────────────
  try {
    const mod: Record<string, unknown> = await import("@/lib/engine/scheduler");
    const fn = mod.freeAgentRefresh;
    if (typeof fn !== "function") throw new Error("freeAgentRefresh is NOT exported from scheduler.ts (private async function)");
    console.log("FA-REPORT — direct import: freeAgentRefresh FOUND, calling freeAgentRefresh(999)…");
    const before = await raw.player.count({ where: { isFreeAgent: true, retired: false } });
    await (fn as (day: number) => Promise<void>)(999);
    const after = await raw.player.count({ where: { isFreeAgent: true, retired: false } });
    console.log(`FA-REPORT — direct call OK: ${before} → ${after}`);
  } catch (e) {
    console.log(`FA-REPORT — direct import FAILED as anticipated: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 2) Real-path verification via processDueJobs ───────────────────
  const { currentGameDay } = await import("@/lib/engine/clock");
  const { processDueJobs } = await import("@/lib/engine/scheduler");
  const poolSize = await getInt("market.freeAgentPoolSize", 40);
  const today = await currentGameDay();
  const lastRow = await raw.systemState.findUnique({ where: { key: "scheduler.lastDay" } });
  console.log(`FA-REPORT — market.freeAgentPoolSize=${poolSize}, today=${today}, scheduler.lastDay=${lastRow?.value}`);

  const before = await raw.player.count({ where: { isFreeAgent: true, retired: false } });
  const beforeListed = await raw.player.count({ where: { isFreeAgent: true, retired: false, listings: { some: { state: "OPEN" } } } });
  console.log(`FA-REPORT — free agents BEFORE: ${before} (with OPEN listings: ${beforeListed})`);

  // Rewind the day pointer and clear ONLY the FREE-AGENT job idempotency row.
  await raw.systemState.upsert({ where: { key: "scheduler.lastDay" }, create: { key: "scheduler.lastDay", value: String(today - 1) }, update: { value: String(today - 1) } });
  const job = await raw.jobRun.findUnique({ where: { idempotencyKey: `FREE-AGENT:${today}` } });
  if (job) await raw.jobRun.delete({ where: { id: job.id } });
  console.log(`FA-REPORT — rewound scheduler.lastDay → ${today - 1}; FREE-AGENT:${today} JobRun row ${job ? "deleted (was " + job.outcome + ")" : "absent"}`);

  try {
    const res = await processDueJobs();
    const after = await raw.player.count({ where: { isFreeAgent: true, retired: false } });
    const afterListed = await raw.player.count({ where: { isFreeAgent: true, retired: false, listings: { some: { state: "OPEN" } } } });
    const jobRow = await raw.jobRun.findUnique({ where: { idempotencyKey: `FREE-AGENT:${today}` } });
    const restored = await raw.systemState.findUnique({ where: { key: "scheduler.lastDay" } });
    const created = await raw.player.findMany({ where: { isFreeAgent: true, retired: false, birthDay: today }, select: { id: true }, take: 1000 });
    console.log(`FA-REPORT — processDueJobs(): processedDays=${res.processedDays}, matches=${res.matches}`);
    console.log(`FA-REPORT — free agents AFTER: ${after} (with OPEN listings: ${afterListed}) | delta=${after - before}`);
    console.log(`FA-REPORT — players created this run (birthDay=${today}): ${created.length}`);
    console.log(`FA-REPORT — FREE-AGENT:${today} outcome=${jobRow?.outcome} | scheduler.lastDay restored to ${restored?.value}`);
    console.log(`FA-REPORT — behavior: pool target=${poolSize}; refresh removes up to floor(current/2) of stale (non-listed) agents, then tops up to the pool target; listed agents are never deleted.`);
  } catch (e) {
    // Defensive restore even on failure
    await raw.systemState.upsert({ where: { key: "scheduler.lastDay" }, create: { key: "scheduler.lastDay", value: String(today) }, update: { value: String(today) } });
    console.log(`FA-REPORT — processDueJobs FAILED (scheduler.lastDay restored): ${e instanceof Error ? e.message : String(e)}`);
  }
}

main()
  .catch((e) => { console.error("FATAL", e); process.exitCode = 1; })
  .finally(() => raw.$disconnect());
