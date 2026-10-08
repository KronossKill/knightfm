// Knight FM — SEO stats (Task 24-b). Counts real world data for hero copy / JSON-LD.
// Run: bun scripts/seo-stats.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const [clubs, players, regions, divisions, seasons, activeSeasons, clubsForSale] =
    await Promise.all([
      db.club.count(),
      db.player.count(),
      db.region.count(),
      db.division.count(),
      db.season.count(),
      db.season.count({ where: { state: "ACTIVE" } }),
      db.club.count({ where: { systemOwned: true } }),
    ]);
  const latestSeason = await db.season.findFirst({
    orderBy: { number: "desc" },
    select: { number: true, state: true, startEpochDay: true },
  });
  console.log(
    JSON.stringify(
      { clubs, players, regions, divisions, seasons, activeSeasons, clubsForSale, latestSeason },
      null,
      2,
    ),
  );
}

main()
  .then(() => db.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
