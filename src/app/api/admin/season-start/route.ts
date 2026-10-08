// Knight FM — Knight Control Center: world season anchor (Task 25-a).
// GET: current world epoch (UTC ISO + YYYY-MM-DD), game day, active season.
// POST: re-anchor the world clock to a new date (ADMIN-only). When Season rows
// exist the action is destructive (it resets the game-day counter the running
// seasons are mapped onto) and therefore requires { force: true } — every
// re-anchor is audited (SEASON_ANCHOR_SET with the previous epoch).

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { CONFIG_DEFAULTS, invalidateConfig } from "@/lib/config";
import { getWorldEpochMs, gameDayFrom, resolveSeason } from "@/lib/engine/clock";

async function adminGuard(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);
  return auth;
}

/** YYYY-MM-DD (UTC) rendering of an epoch — the shape date inputs expect. */
function epochToDateStr(ms: number): string {
  const d = new Date(ms);
  return (
    `${String(d.getUTCFullYear()).padStart(4, "0")}-` +
    `${String(d.getUTCMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getUTCDate()).padStart(2, "0")}`
  );
}

async function anchorInfo() {
  const epochMs = await getWorldEpochMs();
  const gameDay = gameDayFrom(epochMs, new Date());
  const season = await resolveSeason(gameDay);
  const hasSeasons = (await db.season.count()) > 0;
  return {
    epochUtc: new Date(epochMs).toISOString(),
    epochDate: epochToDateStr(epochMs),
    gameDay,
    season: season
      ? { id: season.id, number: season.number, startEpochDay: season.startEpochDay, state: season.state }
      : null,
    hasSeasons,
  };
}

export async function GET(req: NextRequest) {
  const auth = await adminGuard(req);
  if (isResponse(auth)) return auth;
  return ok(await anchorInfo());
}

const PostBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  force: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await adminGuard(req);
  if (isResponse(auth)) return auth;

  const parsed = PostBody.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "date (YYYY-MM-DD) is required", 400);
  const { date, force } = parsed.data;

  // Calendar validation: real dates only, 1970..2100 (no future-far anchors).
  const [y, m, d] = date.split("-").map(Number);
  if (y < 1970 || y > 2100) {
    return fail("OUT_OF_RANGE", "Date must be between 1970 and 2100", 400);
  }
  const epochMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Round-trip guard: Date.UTC rolls invalid days over (2026-02-31 → March),
  // so the rendered date must match the input exactly.
  if (epochToDateStr(epochMs) !== date) {
    return fail("BAD_REQUEST", "Invalid calendar date", 400);
  }

  const hasSeasons = (await db.season.count()) > 0;
  if (hasSeasons && !force) {
    return fail(
      "SEASON_EXISTS",
      "Seasons already exist: re-anchoring the world resets the game-day counter and remaps every running season, fixtures and contracts. Repeat the request with force:true after explicit confirmation.",
      409,
      { hasSeasons }
    );
  }

  const previousMs = await getWorldEpochMs();
  const iso = new Date(epochMs).toISOString();

  // Authoritative clock (SystemState) — getWorldEpochMs() reads this first.
  await db.systemState.upsert({
    where: { key: "world.epoch.utc" },
    create: { key: "world.epoch.utc", value: iso },
    update: { value: iso },
  });
  // Keep the ConfigKey mirror in sync the same way /api/admin/config writes
  // (upsert + invalidateConfig) so config readers see the same epoch.
  const def = CONFIG_DEFAULTS.find((c) => c.key === "world.epoch.utc");
  if (def) {
    await db.configKey.upsert({
      where: { key: def.key },
      create: {
        key: def.key, group: def.group, valueType: def.valueType, defaultValue: def.defaultValue,
        currentValue: iso, locked: false, description: def.description ?? "", updatedBy: auth.userId,
      },
      update: { currentValue: iso, updatedBy: auth.userId },
    });
    invalidateConfig();
  }

  await audit("SEASON_ANCHOR_SET", auth.userId, {
    date,
    force: !!force,
    previous: new Date(previousMs).toISOString(),
  });

  return ok(await anchorInfo());
}
