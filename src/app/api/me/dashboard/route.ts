// Knight FM — GET/PUT /api/me/dashboard (Task 91, UI/UX master mandate).
// Persists the user's customizable dashboard: active widget layout + saved
// presets. Server-authoritative validation with zod; the DB guarantees one
// row per user (DashboardLayout.userId @unique, cascade-deleted with user).
// Role defaults are code-owned (widget-registry) — this endpoint only stores
// EXPLICIT customizations, so an empty state = "use role defaults".

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, requireAuth, isResponse, readJson, fail } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WidgetPlacement = z.object({
  id: z.string().trim().min(1).max(48),
  w: z.union([z.literal(1), z.literal(2)]),
  h: z.union([z.literal(1), z.literal(2)]),
});

const PresetSchema = z.object({
  name: z.string().trim().min(1).max(40),
  widgets: z.array(WidgetPlacement).max(24),
});

const BodySchema = z.object({
  widgets: z.array(WidgetPlacement).max(24),
  presets: z.array(PresetSchema).max(8),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const row = await db.dashboardLayout.findUnique({ where: { userId: auth.userId } });
  if (!row) {
    // No customization yet — the client falls back to code-owned role defaults.
    return ok({ customized: false, widgets: [], presets: [] });
  }
  let widgets: unknown = [];
  let presets: unknown = [];
  try {
    widgets = JSON.parse(row.layout);
  } catch {}
  try {
    presets = JSON.parse(row.presets);
  } catch {}
  const parsed = BodySchema.safeParse({ widgets, presets });
  if (!parsed.success) {
    // Corrupt/legacy row: treat as uncustomized instead of breaking the UI.
    return ok({ customized: false, widgets: [], presets: [] });
  }
  return ok({ customized: true, widgets: parsed.data.widgets, presets: parsed.data.presets });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION", "Invalid dashboard payload", 400);
  }
  const { widgets, presets } = parsed.data;

  await db.dashboardLayout.upsert({
    where: { userId: auth.userId },
    create: { userId: auth.userId, layout: JSON.stringify(widgets), presets: JSON.stringify(presets) },
    update: { layout: JSON.stringify(widgets), presets: JSON.stringify(presets) },
  });
  return ok({ customized: true, widgets, presets });
}
