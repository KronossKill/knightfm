// Knight FM — server bootstrap instrumentation (Next.js register hook).
// USER MANDATE: after ANY restart the world must NEVER be left empty. If the
// database has no live world (fresh or wiped custom.db, or a PARTIAL build
// killed mid-genesis), the genesis seed rebuilds it automatically before the
// server serves traffic. Shape: WORLD_SHAPE.regions × divisionsPerRegion ×
// clubsPerDivision = 1,600 clubs, 20 players each, full fixtures, free-agent
// pool, config and knowledge base. Idempotent: a HEALTHY world (complete
// shape + season + fixtures) is left untouched.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __knightWorldBootstrap?: boolean };
  if (g.__knightWorldBootstrap) return;
  g.__knightWorldBootstrap = true;

  // Dedicated PrismaClient for the bootstrap: NO query logging (genesis emits
  // tens of thousands of statements — dev query logging would slow it down
  // and flood dev.log) and SQLite WAL pragmas for fast, non-blocking commits.
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    await db.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
    await db.$queryRawUnsafe("PRAGMA synchronous=NORMAL;");

    const { runWorldGenesis, WORLD_SHAPE } = await import("./lib/genesis");
    const [regions, divisions, clubs, seasons, fixtures] = await Promise.all([
      db.region.count(),
      db.division.count(),
      db.club.count(),
      db.season.count(),
      db.fixture.count(),
    ]);

    const expectedDivisions = WORLD_SHAPE.regions * WORLD_SHAPE.divisionsPerRegion;
    const expectedClubs = expectedDivisions * WORLD_SHAPE.clubsPerDivision;
    const healthy =
      regions === WORLD_SHAPE.regions &&
      divisions === expectedDivisions &&
      clubs === expectedClubs &&
      seasons > 0 &&
      fixtures > 0;

    if (healthy) {
      console.log(
        `[knight-fm] world OK (regions=${regions} divisions=${divisions} clubs=${clubs} seasons=${seasons} fixtures=${fixtures}) — genesis skipped`,
      );
      await db.$disconnect();
      return;
    }

    console.log(
      `[knight-fm] empty/partial world detected (regions=${regions}/${WORLD_SHAPE.regions} divisions=${divisions}/${expectedDivisions} clubs=${clubs}/${expectedClubs} seasons=${seasons} fixtures=${fixtures}) — auto-genesis starting…`,
    );
    const t0 = Date.now();
    // wipe:true guarantees a clean rebuild — orphan rows from a previous
    // partial run (e.g. free agents without clubs, half-built divisions)
    // are destroyed first, so the world can never restart corrupted.
    const res = await runWorldGenesis(db, { wipe: true });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[knight-fm] world ready in ${secs}s: ${JSON.stringify(res.counts)}`);
  } catch (err) {
    // The server must boot even if genesis fails (e.g. DB unavailable at
    // boot); the admin reset endpoint remains the manual fallback.
    console.error("[knight-fm] auto-genesis FAILED:", err);
  } finally {
    await db.$disconnect().catch(() => undefined);
  }
}
