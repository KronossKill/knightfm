// Knight FM — Anti-multi-account IP guard (Task 41, USER MANDATE).
//
// RULE: when TWO (or more) accounts are detected on the SAME IP within a
// 30-day window, every involved account is automatically BLOCKED. There is NO
// self-service unlock — only an ADMIN can lift the block via
// /api/admin/moderation (POST action=UNBLOCK).
//
// Layering with Task 39 (exactly one account per IP at signup):
//   - Task 39 refuses a SECOND REGISTRATION from an IP (UNIQUE registrationIp).
//   - Task 41 catches the remaining path to two accounts on one IP: accounts
//     registered elsewhere (legacy rows have registrationIp NULL, or a user
//     signed up from another network) that end up USED from the same IP. Every
//     sign-in/registration upserts an IpLink (account ↔ IP with first/last
//     seen); detection then looks for other ACTIVE accounts on that IP inside
//     the window and blocks everyone involved.
//
// Deliberate policy decisions (documented, audited):
//   - USER MANDATE (Task 42): ADMIN accounts are NEVER blocked and are the
//     ONLY accounts allowed to use the same IP as anyone else. Enforced in all
//     three directions: (1) an ADMIN sign-in never triggers this rule, (2) an
//     ADMIN row is never counted as the "other account" (a player sharing an
//     IP with an admin is left alone), and (3) the registration rule never
//     stamps or counts ADMIN rows — a promoted admin's registrationIp is
//     cleared (see /api/admin/promote). Staff legitimately inspect the
//     platform from shared/office connections and must keep access to the
//     Control Center.
//   - Detection only counts ACTIVE accounts inside the window. Already-BLOCKED
//     accounts are inert, so a selective admin unblock sticks: if A and B are
//     both blocked and the admin unblocks only A, A's next sign-in will not
//     re-trigger (B is no longer an ACTIVE counterpart). If the admin unblocks
//     BOTH and they keep sharing the IP, the rule fires again on the next
//     sign-in — by design.
//   - Dormant INACTIVE accounts (40d without access) cannot appear inside a
//     30-day window in practice; they are also excluded explicitly.
//   - Blocking is atomic (one transaction): status→BLOCKED for every involved
//     account, all their sessions revoked (refresh tokens die instantly; the
//     access-token window is closed by the BLOCKED check in requireAuth), plus
//     one aggregated audit event with the full evidence.
//
// Admin-tunable config (PUT /api/admin/config):
//   security.ipWindowDays         int  default 30 (1..365)
//   security.ipMultiAccountPolicy str  default "BLOCK" ("OFF" disables detection)

import { db } from "@/lib/db";
import { audit } from "@/lib/api";
import { getConfig } from "@/lib/config";

/** Stable machine codes stored in User.blockedReason (mapped to i18n client-side). */
export const BLOCK_REASON_MULTI_ACCOUNT = "MULTI_ACCOUNT_IP";
export const BLOCK_REASON_ADMIN_MANUAL = "ADMIN_MANUAL";

/**
 * Upsert the (account, IP) evidence row and stamp User.lastLoginIp. Always
 * recorded — even when the caller is about to be blocked — so the audit trail
 * shows exactly which IP triggered the rule. `country` (Task 67) is the
 * resolved ISO-2 for the IP when known; failures are swallowed (logged):
 * evidence is observability and must never break a sign-in.
 */
export async function recordIpLink(userId: string, ip: string, country?: string | null): Promise<void> {
  if (!userId || !ip) return;
  const now = new Date();
  try {
    await db.ipLink.upsert({
      where: { userId_ip: { userId, ip } },
      create: country ? { userId, ip, country } : { userId, ip },
      update: { lastSeenAt: now, ...(country ? { country } : {}) },
    });
    await db.user.update({ where: { id: userId }, data: { lastLoginIp: ip } });
  } catch (err) {
    console.error("[ip-guard] recordIpLink failed", err instanceof Error ? err.message : err);
  }
}

async function resolveWindowDays(): Promise<number> {
  try {
    const raw = await getConfig("security.ipWindowDays");
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 365) return n;
  } catch {
    // fall through to the default
  }
  return 30;
}

export interface IpGuardResult {
  /** true when this call blocked accounts (the caller must refuse the session). */
  blocked: boolean;
  /** every account BLOCKED by this invocation (empty when blocked=false). */
  accounts: string[];
}

/**
 * Task 41 core enforcement. Records the caller's IP evidence, then — unless
 * the caller is ADMIN or the policy is OFF — looks for other ACTIVE,
 * non-ADMIN accounts seen on the same IP within the configured window and
 * blocks them all (including the caller).
 *
 * Called from the login route BEFORE any session is issued, and from the
 * register route right after the account is created (covering legacy
 * counterparts whose registrationIp is NULL).
 */
export async function enforceMultiAccountIp(opts: {
  userId: string;
  ip: string;
  role: string;
  /** Task 67: resolved ISO-2 country for this IP (observability only). */
  country?: string | null;
}): Promise<IpGuardResult> {
  const { userId, ip, role } = opts;
  if (!userId || !ip) return { blocked: false, accounts: [] };

  // Evidence first — ALWAYS recorded, even if the rule ends up blocking.
  await recordIpLink(userId, ip, opts.country);

  // ADMIN never triggers the rule and is never auto-blocked (see header).
  if (role === "ADMIN") return { blocked: false, accounts: [] };

  let policy = "BLOCK";
  try {
    policy = (await getConfig("security.ipMultiAccountPolicy")).trim().toUpperCase();
  } catch {
    // default BLOCK
  }
  if (policy === "OFF") return { blocked: false, accounts: [] };

  const days = await resolveWindowDays();
  const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const links = await db.ipLink.findMany({
    where: { ip, userId: { not: userId }, lastSeenAt: { gte: windowStart } },
    select: { userId: true },
  });
  const otherIds = [...new Set(links.map((l) => l.userId))];
  if (otherIds.length === 0) return { blocked: false, accounts: [] };

  // Only ACTIVE, non-ADMIN counterparts count (see header for why).
  const others = await db.user.findMany({
    where: { id: { in: otherIds }, status: "ACTIVE", role: { not: "ADMIN" } },
    select: { id: true },
  });
  if (others.length === 0) return { blocked: false, accounts: [] };

  const targets = [...new Set([userId, ...others.map((o) => o.id)])];
  const now = new Date();
  await db.$transaction([
    db.user.updateMany({
      where: { id: { in: targets }, status: "ACTIVE" },
      data: { status: "BLOCKED", blockedReason: BLOCK_REASON_MULTI_ACCOUNT, blockedAt: now },
    }),
    // Kill every live session of every involved account immediately.
    db.session.updateMany({
      where: { userId: { in: targets }, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  await audit("MULTI_ACCOUNT_IP_BLOCK", null, {
    ip,
    windowDays: days,
    accounts: targets,
    triggeredBy: userId,
  });

  return { blocked: true, accounts: targets };
}
