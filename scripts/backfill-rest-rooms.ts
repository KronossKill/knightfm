// One-off backfill: create REST_ROOMS (level 1) for every club missing it.
// Run: bun scripts/backfill-rest-rooms.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const clubs = await prisma.club.findMany({ select: { id: true } });
  let created = 0;
  for (const club of clubs) {
    const existing = await prisma.facility.findUnique({
      where: { clubId_type: { clubId: club.id, type: "REST_ROOMS" } },
    });
    if (!existing) {
      await prisma.facility.create({ data: { clubId: club.id, type: "REST_ROOMS", level: 1 } });
      created++;
    }
  }
  console.log(`REST_ROOMS backfill done: ${created} created across ${clubs.length} clubs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
