// Knight FM — club access & permission helper (shared by all game-core API routes).
// OWNER via club.ownerId; MANAGER via club.managerId + PermissionGrant JSON
// (missing/blank grant ⇒ permissive defaults, explicit `false` overrides deny).

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ClubRole = "OWNER" | "MANAGER" | "NONE";

export type ClubWithBrand = Prisma.ClubGetPayload<{ include: { brand: true } }>;

export interface ClubAccess {
  club: ClubWithBrand | null; // null when the club does not exist
  role: ClubRole;
  permissions: Record<string, boolean>;
}

export const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  training: true,
  tactics: true,
  youth: true,
  transfers: true,
};

function parsePermissions(raw: string | null | undefined): Record<string, boolean> {
  const merged = { ...DEFAULT_PERMISSIONS };
  if (!raw) return merged;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const key of Object.keys(merged)) {
      if (typeof parsed[key] === "boolean") merged[key] = parsed[key] as boolean;
    }
  } catch {
    // malformed grant JSON ⇒ keep defaults
  }
  return merged;
}

export async function getClubAccess(userId: string, clubId: string): Promise<ClubAccess> {
  const club = await db.club.findUnique({ where: { id: clubId }, include: { brand: true } });
  if (!club) return { club: null, role: "NONE", permissions: { ...DEFAULT_PERMISSIONS } };

  if (club.ownerId === userId) {
    return { club, role: "OWNER", permissions: { ...DEFAULT_PERMISSIONS } };
  }
  if (club.managerId === userId) {
    const grant = await db.permissionGrant.findUnique({
      where: { clubId_managerId: { clubId, managerId: userId } },
    });
    return { club, role: "MANAGER", permissions: parsePermissions(grant?.permissions) };
  }
  return { club, role: "NONE", permissions: {} };
}

/** Uniform guard result for management endpoints: 404 if club missing, 403 if not staff. */
export function clubAccessError(access: ClubAccess): { status: 403 | 404; code: string; message: string } | null {
  if (!access.club) return { status: 404, code: "CLUB_NOT_FOUND", message: "Club not found" };
  if (access.role === "NONE") return { status: 403, code: "FORBIDDEN", message: "No access to this club" };
  return null;
}

/** OWNER-only guard result (non-null error when the caller is not the owner). */
export function ownerOnlyError(access: ClubAccess): { status: 403 | 404; code: string; message: string } | null {
  const base = clubAccessError(access);
  if (base) return base;
  if (access.role !== "OWNER") return { status: 403, code: "FORBIDDEN", message: "Club owner role required" };
  return null;
}

/**
 * Squad-management guard (user mandate): the club's OWNER **or** its MANAGER
 * (unless transfers were explicitly denied via PermissionGrant) may run the
 * transfer desk — sell, auction, loan out, clause edit — and deposit personal
 * funds into the club. Owner-exclusive actions (withdraw club funds, release
 * contracts, buy/sell the club itself) keep using ownerOnlyError.
 */
export function squadManagementError(access: ClubAccess): { status: 403 | 404; code: string; message: string } | null {
  const base = clubAccessError(access);
  if (base) return base;
  if (access.role === "OWNER") return null;
  if (access.role === "MANAGER" && access.permissions.transfers !== false) return null;
  return {
    status: 403,
    code: "NOT_CLUB_OWNER",
    message: "Club owner or manager (with transfer permission) required",
  };
}

/** Safe JSON parse for string columns (returns fallback on null/invalid). */
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
