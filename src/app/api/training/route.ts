// Knight FM — Training API.
// GET  /api/training?clubId= — standing plan + today's session usage/limits.
// PUT  /api/training — update the standing plan (OWNER, or MANAGER with `training`
//      permission). The plan only stores preferences; effects happen on RUN.
// POST /api/training — execute a session: one GENERAL (whole squad; the UI
// offers a single button, so the focus defaults to "balanced" = every attribute
// of every player) per day and one of EACH special type per day (configurable
// limits via config).

import { NextRequest } from "next/server";
import { z } from "zod";
import { audit, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { currentGameDay } from "@/lib/engine/clock";
import {
  TRAINING_GENERAL,
  TRAINING_SPECIAL_TYPES,
  TrainingLimitError,
  getTrainingUsage,
  getTrainingWeights,
  runGeneralSession,
  runSpecialSession,
  academyQualityCap,
} from "@/lib/engine/training";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

const TRAINING_SPECIAL = [...TRAINING_SPECIAL_TYPES, "none"] as const;

const putSchema = z.object({
  clubId: z.string().min(1, "clubId is required"),
  generalFocus: z.enum(TRAINING_GENERAL),
  specialFocus: z.enum(TRAINING_SPECIAL),
  specialTarget: z.string().min(1).optional(), // "auto" or a squad player id
});

const runSchema = z.object({
  clubId: z.string().min(1, "clubId is required"),
  session: z.enum(["general", "special"]),
  // Optional for general sessions: the UI's single general button relies on the
  // server default ("balanced" → every attribute of every player grows).
  generalFocus: z.enum(TRAINING_GENERAL).optional(),
  specialType: z.enum(TRAINING_SPECIAL_TYPES).optional(),
  playerId: z.string().min(1).optional(),
});

async function guardTrainingAccess(userId: string, clubId: string) {
  const access = await getClubAccess(userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);
  if (access.role === "MANAGER" && access.permissions.training === false) {
    return fail("FORBIDDEN", "Training permission not granted", 403);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const clubId = req.nextUrl.searchParams.get("clubId");
  if (!clubId) return fail("VALIDATION_ERROR", "clubId query parameter is required", 400);

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const [plan, gameDay] = await Promise.all([
    db.trainingPlan.findUnique({ where: { clubId } }),
    currentGameDay(),
  ]);
  const usage = await getTrainingUsage(clubId, gameDay);
  const weights = await getTrainingWeights();
  const academy = await db.facility.findUnique({
    where: { clubId_type: { clubId, type: "YOUTH_ACADEMY" } },
    select: { level: true },
  });
  const qualityCap = await academyQualityCap(academy?.level ?? 1);
  // User mandate: SPECIAL training sessions require technical staff — at least
  // one COACH at the club. GENERAL sessions are always available.
  const coachCount = await db.staffMember.count({ where: { clubId, role: "COACH" } });

  return ok({
    clubId,
    plan: {
      generalFocus: plan?.generalFocus ?? "balanced",
      specialFocus: plan?.specialFocus ?? "none",
      specialTarget: plan?.specialTarget ?? "auto",
      updatedAt: plan?.updatedAt ? plan.updatedAt.toISOString() : null,
    },
    usage,
    // Task 25-c: factor weights (1 = default 100%, 0 = factor disabled) so the
    // UI can show which multipliers are active.
    weights,
    academyQualityCap: qualityCap,
    // Staff gate for the UI: special cards render disabled + hint when 0.
    canSpecial: coachCount > 0,
    coachCount,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = putSchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const { clubId, generalFocus, specialFocus, specialTarget } = parsed.data;

  const guardErr = await guardTrainingAccess(auth.userId, clubId);
  if (guardErr) return guardErr;

  let target = "auto";
  if (specialTarget !== undefined) {
    target = specialTarget;
    if (target !== "auto") {
      const player = await db.player.findFirst({
        where: { id: target, clubId, retired: false, isYouth: false, isFreeAgent: false },
        select: { id: true },
      });
      if (!player) return fail("INVALID_SPECIAL_TARGET", "specialTarget must be 'auto' or a squad player id", 400);
    }
  }

  const plan = await db.trainingPlan.upsert({
    where: { clubId },
    create: { clubId, generalFocus, specialFocus, specialTarget: target },
    update: { generalFocus, specialFocus, specialTarget: target },
  });

  await audit("TRAINING_UPDATED", auth.userId, {
    clubId,
    generalFocus,
    specialFocus,
    specialTarget: target,
  });

  return ok({
    plan: {
      generalFocus: plan.generalFocus,
      specialFocus: plan.specialFocus,
      specialTarget: plan.specialTarget,
      updatedAt: plan.updatedAt.toISOString(),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = runSchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const { clubId, session, generalFocus, specialType, playerId } = parsed.data;

  const guardErr = await guardTrainingAccess(auth.userId, clubId);
  if (guardErr) return guardErr;

  const gameDay = await currentGameDay();
  const usage = await getTrainingUsage(clubId, gameDay);

  try {
    if (session === "general") {
      const focus = generalFocus ?? "balanced";
      if (usage.generalUsed >= usage.generalLimit) {
        return fail("ALREADY_RUN", "Today's general session limit has been reached", 409, {
          used: usage.generalUsed,
          limit: usage.generalLimit,
        });
      }
      const res = await runGeneralSession(clubId, focus, gameDay);
      await audit("TRAINING_SESSION_GENERAL", auth.userId, { clubId, day: gameDay, ...res });
      return ok({
        ran: "general",
        focus,
        players: res.players,
        pct: res.pct,
        attrsGained: res.attrsGained,
        breakdown: res.breakdown,
        finalPct: res.finalPct,
        usage: await getTrainingUsage(clubId, gameDay),
      });
    }

    // Special session: one target player, per-type daily limit.
    if (!specialType) return fail("VALIDATION_ERROR", "specialType is required for a special session", 400);
    if (!playerId) return fail("PLAYER_REQUIRED", "playerId is required for a special session", 400);
    // User mandate: without technical staff only GENERAL training is possible —
    // every special session requires at least one COACH at the club.
    const coachCount = await db.staffMember.count({ where: { clubId, role: "COACH" } });
    if (coachCount === 0) {
      return fail("STAFF_REQUIRED", "Special training requires a coach: hire one with the club's funds first", 409);
    }
    if ((usage.specialUsed[specialType] ?? 0) >= usage.specialLimit) {
      return fail("ALREADY_RUN", `Today's ${specialType} session limit has been reached`, 409, {
        used: usage.specialUsed[specialType] ?? 0,
        limit: usage.specialLimit,
      });
    }
    const res = await runSpecialSession(clubId, specialType, playerId, gameDay);
    await audit("TRAINING_SESSION_SPECIAL", auth.userId, { clubId, type: specialType, playerId, day: gameDay });
    return ok({
      ran: "special",
      type: res.type,
      playerId: res.playerId,
      pct: res.pct,
      attrsGained: res.attrsGained,
      breakdown: res.breakdown,
      finalPct: res.finalPct,
      usage: await getTrainingUsage(clubId, gameDay),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "PLAYER_NOT_IN_SQUAD") {
      return fail("INVALID_SPECIAL_TARGET", "playerId must be a squad player", 400);
    }
    // SECURITY (pentest fix): the atomic daily-limit claims abort here (fail closed).
    if (e instanceof TrainingLimitError) {
      return fail("ALREADY_RUN", e.message, 409);
    }
    throw e;
  }
}
