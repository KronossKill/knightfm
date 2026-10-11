// Knight FM — generate the PRODUCTION prisma schema from the dev (sqlite)
// schema (Task 76 rule, restored Task 90): the ONLY divergence in this schema
// is the datasource provider (no Json/enums/@db native types are used, so a
// plain provider swap is provably lossless). Output: prisma/schema.production.prisma
// The delivery builder copies the production variant over the staged
// schema.prisma; the sandbox keeps sqlite for local dev.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "prisma/schema.prisma";
const DST = "prisma/schema.production.prisma";

let out = readFileSync(SRC, "utf8");
const before = out;
out = out.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
if (out === before || !/provider = "postgresql"/.test(out)) {
  console.error("FATAL: could not swap provider to postgresql");
  process.exit(1);
}
if (/provider = "sqlite"/.test(out)) {
  console.error("FATAL: sqlite provider still present");
  process.exit(1);
}
writeFileSync(DST, out, "utf8");
console.log(`OK ${DST} (${Buffer.byteLength(out)} B, provider=postgresql)`);
