// Knight FM — Task 24 migration (idempotent, kept for reproducibility).
// 1) Club.originalName: backfilled to the CURRENT name for every club that has
//    no originalName yet ("" default). The founding name becomes immutable.
// 2) ClubBrand.crestPattern: deterministic pattern per clubId hash so the world
//    starts visually varied (solid/stripes/halves/quarters/sash/checker).

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PATTERNS = [
  "solid",
  "stripes-v",
  "stripes-h",
  "halves",
  "quarters",
  "sash",
  "checker",
] as const;

function hashPattern(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PATTERNS[h % PATTERNS.length];
}

async function main() {
  const missingName = await db.club.updateMany({
    where: { OR: [{ originalName: "" }, { originalName: null as unknown as string }] },
    data: {},
  }).catch(() => null);
  // updateMany can't copy column→column; do it row by row only where needed.
  const clubs = await db.club.findMany({
    where: { originalName: "" },
    select: { id: true, name: true },
  });
  for (const c of clubs) {
    await db.club.update({ where: { id: c.id }, data: { originalName: c.name } });
  }

  const noPattern = await db.clubBrand.findMany({
    where: { OR: [{ crestPattern: "solid" }, { crestPattern: "" }] },
    select: { id: true, clubId: true },
  });
  let patched = 0;
  for (const b of noPattern) {
    await db.clubBrand.update({
      where: { id: b.id },
      data: { crestPattern: hashPattern(b.clubId) },
    });
    patched++;
  }

  const [total, named, brandTotal] = await Promise.all([
    db.club.count(),
    db.club.count({ where: { NOT: { originalName: "" } } }),
    db.clubBrand.count(),
  ]);
  console.log(
    JSON.stringify({
      clubs: total,
      originalNameBackfilled: clubs.length,
      originalNameSet: named,
      brands: brandTotal,
      patternsPatched: patched,
      placeholderUpdateManyNoop: missingName ? true : false,
    })
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
