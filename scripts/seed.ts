// Knight FM — world genesis CLI (spec §3, §4, §36).
// 10 regions × 10 divisions × 16 clubs = 1,600 system-owned clubs; 20 players each.
// Idempotent: skips if the world already exists (use --force to WIPE + rebuild).

import { PrismaClient } from "@prisma/client";
import { runWorldGenesis } from "../src/lib/genesis";

const prisma = new PrismaClient();
const force = process.argv.includes("--force");

runWorldGenesis(prisma, { wipe: force })
  .then((res) => {
    if (!force) console.log("World already exists; skipping genesis (use --force to rebuild).");
    console.log("Genesis complete:", JSON.stringify({ ...res.counts, epochUtc: res.epochIso }));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
