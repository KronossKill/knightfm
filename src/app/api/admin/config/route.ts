// Knight FM — Knight Control Center: configuration registry (spec §36).
// GET: merged view of defaults + DB overrides. PUT: change a non-locked key with validation.

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { CONFIG_DEFAULTS, invalidateConfig } from "@/lib/config";

async function adminGuard(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);
  return auth;
}

export async function GET(req: NextRequest) {
  const auth = await adminGuard(req);
  if (isResponse(auth)) return auth;

  const rows = await db.configKey.findMany();
  const rowByKey = new Map(rows.map((r) => [r.key, r]));

  const items = CONFIG_DEFAULTS.map((d) => {
    const r = rowByKey.get(d.key);
    return {
      key: d.key,
      group: d.group,
      valueType: d.valueType,
      defaultValue: d.defaultValue,
      currentValue: r?.currentValue ?? null,
      minValue: d.minValue ?? null,
      maxValue: d.maxValue ?? null,
      locked: d.locked ?? false,
      description: d.description ?? "",
      updatedAt: r?.updatedAt ?? null,
      updatedBy: r?.updatedBy ?? null,
    };
  });

  return ok({ items, total: items.length });
}

const PutBody = z.object({
  key: z.string().min(1).max(100),
  // Task 25-d: empty values are allowed for STRING keys (e.g. clearing
  // security.vpnDetectUrl falls back to the registry default "").
  value: z.string().max(500),
});

export async function PUT(req: NextRequest) {
  const auth = await adminGuard(req);
  if (isResponse(auth)) return auth;

  const parsed = PutBody.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "key and value are required", 400);
  const { key, value } = parsed.data;

  const def = CONFIG_DEFAULTS.find((d) => d.key === key);
  if (!def) return fail("UNKNOWN_KEY", "Unknown configuration key", 404, { key });
  // Every key is editable from the panel: the ADMIN decides (per-key explicit save)
  // whether previously locked invariants change or not. Range validation still applies.

  // Type + range validation.
  if (def.valueType === "int") {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || String(n) !== value.trim()) {
      return fail("INVALID_VALUE", "Value must be an integer", 400, { key });
    }
    if (def.minValue !== undefined && n < def.minValue) {
      return fail("OUT_OF_RANGE", `Value must be ≥ ${def.minValue}`, 400, { key, minValue: def.minValue });
    }
    if (def.maxValue !== undefined && n > def.maxValue) {
      return fail("OUT_OF_RANGE", `Value must be ≤ ${def.maxValue}`, 400, { key, maxValue: def.maxValue });
    }
  } else if (def.valueType === "bool") {
    if (value !== "true" && value !== "false") {
      return fail("INVALID_VALUE", "Value must be 'true' or 'false'", 400, { key });
    }
  }

  const previous = await db.configKey.findUnique({ where: { key } });
  const previousValue = previous?.currentValue ?? def.defaultValue;

  await db.configKey.upsert({
    where: { key },
    create: {
      key, group: def.group, valueType: def.valueType, defaultValue: def.defaultValue,
      currentValue: value, minValue: def.minValue ?? null, maxValue: def.maxValue ?? null,
      locked: false, description: def.description ?? "", updatedBy: auth.userId,
    },
    update: { currentValue: value, updatedBy: auth.userId },
  });
  invalidateConfig();

  await db.approval.create({
    data: { key, requestedValue: value, previousValue, state: "APPLIED", requestedBy: auth.userId, appliedBy: auth.userId },
  });
  await audit("CONFIG_CHANGED", auth.userId, { key, previousValue, value });

  return ok({ key, value, effectiveValue: value, previousValue });
}
