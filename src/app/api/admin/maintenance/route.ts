// Knight FM — Knight Control Center: maintenance mode toggle.
// Task 27-b: state lives in the configKey registry (ops.maintenanceMode /
// ops.maintenanceMessage) — the SAME table every reader (/api/world/state,
// /api/admin/config, the GET below) consults through @/lib/config. The 30s
// config cache is invalidated so the toggle takes effect immediately.

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { CONFIG_DEFAULTS, getBool, getConfig, invalidateConfig } from "@/lib/config";

const Body = z.object({
  enabled: z.boolean(),
  message: z.string().max(300).optional(),
});

/** Upsert a registry key, stamping the registry metadata from CONFIG_DEFAULTS. */
async function upsertConfigValue(key: string, value: string, updatedBy: string) {
  const def = CONFIG_DEFAULTS.find((d) => d.key === key);
  await db.configKey.upsert({
    where: { key },
    create: {
      key,
      group: def?.group ?? "operations",
      valueType: def?.valueType ?? "string",
      defaultValue: def?.defaultValue ?? "",
      currentValue: value,
      minValue: def?.minValue ?? null,
      maxValue: def?.maxValue ?? null,
      locked: false,
      description: def?.description ?? "",
      updatedBy,
    },
    update: { currentValue: value, updatedBy },
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const [enabled, message] = await Promise.all([
    getBool("ops.maintenanceMode"),
    getConfig("ops.maintenanceMessage"),
  ]);
  return ok({ enabled, message });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "enabled (boolean) is required", 400);
  const { enabled, message } = parsed.data;

  await upsertConfigValue("ops.maintenanceMode", String(enabled), auth.userId);
  if (message !== undefined) {
    await upsertConfigValue("ops.maintenanceMessage", message, auth.userId);
  }
  invalidateConfig();

  await audit("MAINTENANCE_TOGGLED", auth.userId, { enabled, message: message ?? null });
  return ok({ enabled, message: message ?? null });
}
