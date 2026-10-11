// Knight FM — GET/PUT /api/me/preferences (Task 32 — Master UI/UX).
// Server-side persistence of shell + dashboard preferences per user:
// theme, language (locale), sidebar state, pinned sections (max 5) and the
// widget-dashboard layouts per role (MANAGER / OWNER).
// Preferences are pure UI state — they never affect game state.

import { NextRequest } from "next/server";
import { ok, fail, requireAuth, isResponse } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const VALID_THEMES = ["knight-emerald", "obsidian", "royal", "aurora", "classic"];
const VALID_LANGUAGES = ["es", "en", "fr", "pt"];
const VALID_SIZES = ["1x1", "2x1", "1x2", "2x2"];
const VALID_LAYOUT_ROLES = ["MANAGER", "OWNER"];
const MAX_PINNED = 5;
const MAX_WIDGETS = 16;
const MAX_LAYOUT_JSON = 8192;

function parseJson(raw: string, fallback: unknown): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function sanitizePinned(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_PINNED) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || item.length < 1 || item.length > 32 || !/^[a-z][a-z0-9-]*$/.test(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function sanitizeLayouts(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [role, layout] of Object.entries(input)) {
    if (!VALID_LAYOUT_ROLES.includes(role)) return null;
    if (!Array.isArray(layout) || layout.length > MAX_WIDGETS) return null;
    const placements: { id: string; size: string }[] = [];
    const seen = new Set<string>();
    for (const wp of layout) {
      if (typeof wp !== "object" || wp === null) return null;
      const { id, size } = wp as { id?: unknown; size?: unknown };
      if (typeof id !== "string" || id.length < 1 || id.length > 48 || !/^[a-z][a-z0-9-]*$/.test(id)) return null;
      if (typeof size !== "string" || !VALID_SIZES.includes(size)) return null;
      if (seen.has(id)) return null; // no duplicate widgets
      seen.add(id);
      placements.push({ id, size });
    }
    out[role] = placements;
  }
  if (JSON.stringify(out).length > MAX_LAYOUT_JSON) return null;
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { theme: true, locale: true, sidebarCollapsed: true, pinnedSections: true, dashboardLayouts: true },
  });
  if (!user) return fail("USER_NOT_FOUND", "User not found", 404);

  return ok({
    theme: user.theme,
    language: user.locale,
    sidebarCollapsed: user.sidebarCollapsed,
    pinnedSections: parseJson(user.pinnedSections, []) as string[],
    dashboardLayouts: parseJson(user.dashboardLayouts, {}) as Record<string, unknown>,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("VALIDATION_ERROR", "Invalid JSON body", 400);
  }

  const data: {
    theme?: string;
    locale?: string;
    sidebarCollapsed?: boolean;
    pinnedSections?: string;
    dashboardLayouts?: string;
  } = {};

  if (body.theme !== undefined) {
    if (typeof body.theme !== "string" || !VALID_THEMES.includes(body.theme)) {
      return fail("VALIDATION_ERROR", "Unknown theme", 400);
    }
    data.theme = body.theme;
  }
  if (body.language !== undefined) {
    if (typeof body.language !== "string" || !VALID_LANGUAGES.includes(body.language)) {
      return fail("VALIDATION_ERROR", "Unknown language", 400);
    }
    data.locale = body.language;
  }
  if (body.sidebarCollapsed !== undefined) {
    if (typeof body.sidebarCollapsed !== "boolean") {
      return fail("VALIDATION_ERROR", "sidebarCollapsed must be boolean", 400);
    }
    data.sidebarCollapsed = body.sidebarCollapsed;
  }
  if (body.pinnedSections !== undefined) {
    const pinned = sanitizePinned(body.pinnedSections);
    if (pinned === null) {
      return fail("VALIDATION_ERROR", "pinnedSections must be an array of at most 5 section ids", 400);
    }
    data.pinnedSections = JSON.stringify(pinned);
  }
  if (body.dashboardLayouts !== undefined) {
    const layouts = sanitizeLayouts(body.dashboardLayouts);
    if (layouts === null) {
      return fail("VALIDATION_ERROR", "dashboardLayouts payload invalid", 400);
    }
    data.dashboardLayouts = JSON.stringify(layouts);
  }

  if (Object.keys(data).length === 0) {
    return fail("VALIDATION_ERROR", "No preference fields provided", 400);
  }

  const user = await db.user.update({
    where: { id: auth.userId },
    data,
    select: { theme: true, locale: true, sidebarCollapsed: true, pinnedSections: true, dashboardLayouts: true },
  });

  return ok({
    theme: user.theme,
    language: user.locale,
    sidebarCollapsed: user.sidebarCollapsed,
    pinnedSections: parseJson(user.pinnedSections, []) as string[],
    dashboardLayouts: parseJson(user.dashboardLayouts, {}) as Record<string, unknown>,
  });
}
