// PATCH /api/club/brand — OWNER-only club branding (Task 24-a: club identity).
// Name change: once per season (server-authoritative), unique, 3..32 chars,
// sanitized (trimmed, whitespace collapsed, control chars stripped).
// Colors: #RRGGBB pair — primary and secondary must differ (SAME_COLORS).
// Badge shape: shield | circle | square. Crest pattern: solid | stripes-v |
// stripes-h | halves | quarters | sash | checker. Initials: 1-3 chars A-Z.

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { audit, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { currentGameDay } from "@/lib/engine/clock";
import { getActiveSeason } from "@/app/api/_lib/active-season";
import { getClubAccess, ownerOnlyError } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;

const BADGE_SHAPES = ["shield", "circle", "square"] as const;
const CREST_PATTERNS = [
  "solid", "stripes-v", "stripes-h", "halves", "quarters", "sash", "checker",
] as const;

const brandSchema = z.object({
  clubId: z.string().min(1, "clubId is required"),
  name: z.string().min(3, "name must be 3-32 characters").max(32, "name must be 3-32 characters").optional(),
  primaryColor: z.string().regex(HEX, "primaryColor must be #RRGGBB").optional(),
  secondaryColor: z.string().regex(HEX, "secondaryColor must be #RRGGBB").optional(),
  initials: z.string().regex(/^[A-Z]{1,3}$/, "initials must be 1-3 characters A-Z").optional(),
  badgeShape: z.enum(BADGE_SHAPES, { message: "badgeShape must be shield|circle|square" }).optional(),
  crestPattern: z
    .enum(CREST_PATTERNS, { message: "crestPattern must be solid|stripes-v|stripes-h|halves|quarters|sash|checker" })
    .optional(),
});

/**
 * Name sanitizer (Task 24-a): strips control characters (< 0x20 and 0x7f),
 * collapses runs of whitespace into single spaces and trims the ends.
 * Applied BEFORE length validation so legit names with stray whitespace
 * survive and unprintable padding cannot smuggle past the 3..32 rule.
 */
function sanitizeClubName(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const rawBody = await readJson<Record<string, unknown>>(req);
  if (rawBody && typeof rawBody === "object" && typeof rawBody.name === "string") {
    rawBody.name = sanitizeClubName(rawBody.name);
  }

  const parsed = brandSchema.safeParse(rawBody);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const body = parsed.data;
  const { clubId } = body;

  const access = await getClubAccess(auth.userId, clubId);
  const guard = ownerOnlyError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);
  const club = access.club!;

  const hasChange = body.name !== undefined || body.primaryColor !== undefined ||
    body.secondaryColor !== undefined || body.initials !== undefined ||
    body.badgeShape !== undefined || body.crestPattern !== undefined;
  if (!hasChange) return fail("NO_CHANGES", "Provide at least one field to update", 400);

  // Two-color identity: primary and secondary must differ (case-insensitive),
  // considering the resulting pair (incoming values win over stored ones).
  const effectivePrimary = body.primaryColor ?? club.brand?.primaryColor ?? null;
  const effectiveSecondary = body.secondaryColor ?? club.brand?.secondaryColor ?? null;
  if (
    effectivePrimary !== null &&
    effectiveSecondary !== null &&
    effectivePrimary.toLowerCase() === effectiveSecondary.toLowerCase()
  ) {
    return fail("SAME_COLORS", "primaryColor and secondaryColor must be different", 400);
  }

  const gameDay = await currentGameDay();

  // Name change: once per season (nameChangeDay stores the absolute game day).
  let newName: string | undefined;
  if (body.name !== undefined && body.name !== club.name) {
    const season = await getActiveSeason();
    const alreadyChangedThisSeason =
      season !== null && club.nameChangeDay !== null && club.nameChangeDay >= season.startEpochDay;
    if (alreadyChangedThisSeason) {
      return fail("NAME_CHANGE_LOCKED", "Club name can only be changed once per season", 403);
    }
    newName = body.name;
  }

  try {
    await db.$transaction(async (tx) => {
      if (newName !== undefined) {
        await tx.club.update({
          where: { id: clubId },
          data: { name: newName, nameChangeDay: gameDay },
        });
      }
      await tx.clubBrand.upsert({
        where: { clubId },
        create: {
          clubId,
          primaryColor: body.primaryColor ?? club.brand?.primaryColor ?? "#10b981",
          secondaryColor: body.secondaryColor ?? club.brand?.secondaryColor ?? "#0f172a",
          initials: body.initials ?? club.brand?.initials ?? club.name.slice(0, 3).toUpperCase(),
          badgeShape: body.badgeShape ?? club.brand?.badgeShape ?? "shield",
          crestPattern: body.crestPattern ?? club.brand?.crestPattern ?? "solid",
        },
        update: {
          ...(body.primaryColor !== undefined ? { primaryColor: body.primaryColor } : {}),
          ...(body.secondaryColor !== undefined ? { secondaryColor: body.secondaryColor } : {}),
          ...(body.initials !== undefined ? { initials: body.initials } : {}),
          ...(body.badgeShape !== undefined ? { badgeShape: body.badgeShape } : {}),
          ...(body.crestPattern !== undefined ? { crestPattern: body.crestPattern } : {}),
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("NAME_TAKEN", "Club name already in use", 409);
    }
    throw e;
  }

  await audit("CLUB_BRAND_UPDATED", auth.userId, {
    clubId,
    name: newName ?? null,
    primaryColor: body.primaryColor ?? null,
    secondaryColor: body.secondaryColor ?? null,
    initials: body.initials ?? null,
    badgeShape: body.badgeShape ?? null,
    crestPattern: body.crestPattern ?? null,
    gameDay,
  });

  const brand = await db.clubBrand.findUnique({ where: { clubId } });
  const refreshed = await db.club.findUnique({
    where: { id: clubId },
    select: { name: true, originalName: true, nameChangeDay: true, systemOwned: true },
  });

  return ok({
    updated: true,
    brand,
    club: refreshed,
  });
}
