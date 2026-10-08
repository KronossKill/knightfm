// Knight FM — POST /api/auth/register (spec AUTH-01/AUTH-02, D-004/D-005/D-006).
// Rate-limited, captcha-protected, case-insensitive uniqueness, 6-digit email
// verification token (sha256 at rest, 30 min), optional referral binding.
// Anti-enumeration: duplicate accounts are audited but rejected with a generic conflict.
// ANTI-MULTICUENTA (Task 39, USER MANDATE): exactly ONE account per IP — the
// registration IP is stamped on the user and protected by a UNIQUE index, with
// a friendly pre-check and an in-transaction re-check (the DB is the arbiter).

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, fail, audit, rateLimit, clientIp, readJson } from "@/lib/api";
import { hashPassword, passwordPolicyError, verifyCaptcha } from "@/lib/auth";
import { enforceMultiAccountIp } from "@/lib/security/ip-guard";
import { getBool, getConfig } from "@/lib/config";
import { evaluateVpn } from "@/lib/vpn";
import { db } from "@/lib/db";
import {
  ApiTxError,
  CaptchaSchema,
  EmailSchema,
  PasswordSchema,
  UsernameSchema,
  issueEmailVerification,
  z,
} from "../_shared";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: EmailSchema,
  username: UsernameSchema,
  password: PasswordSchema,
  // Optional here so a missing token reaches verifyCaptcha and yields 402 CAPTCHA_INVALID.
  captchaToken: CaptchaSchema.optional(),
  ref: z.string().trim().max(40).optional(),
});

// Task 39 (live-test finding): SQLite is a single writer, so a burst of
// concurrent signups (e.g. an automated multi-account attempt) only produces
// write-pileup timeouts (P1008/P2024) and confusing 500s — NOT extra accounts
// (the UNIQUE index held), but availability damage plus audit noise. Because
// the Next.js server is a single Node process, an in-process FIFO slot
// serializes the registration critical section: each signup runs its tiny
// transaction alone, and a burst degrades into a fast queue instead of a
// pile of timeouts. The DB UNIQUE(registrationIp) index remains the final
// arbiter for any other path (multi-process deployments, direct DB access).
let registerQueue: Promise<unknown> = Promise.resolve();
function withRegisterSlot<T>(fn: () => Promise<T>): Promise<T> {
  const next = registerQueue.then(fn, fn);
  registerQueue = next.catch(() => undefined);
  return next;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // 10 registrations / hour / IP
  const rl = rateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", "Too many registration attempts", 429, { retryAfterSec: rl.retryAfterSec });
  }

  // Maintenance gate (Task 27-b): registrations are closed while maintenance
  // mode is active — before any other logic or DB work.
  if (await getBool("ops.maintenanceMode")) {
    return fail("MAINTENANCE", await getConfig("ops.maintenanceMessage"), 503);
  }

  // VPN policy guard (Task 25-d): after the rate limit (so the limit keeps
  // protecting the endpoint) and before any other logic. Register has NO ADMIN
  // bypass (the role cannot be trusted yet — bootstrap emails included): a
  // flagged, non-excepted IP under a "block" policy is always rejected.
  const vpn = await evaluateVpn(ip);
  if (vpn.blocked) {
    await audit("VPN_BLOCK", null, { ip, route: "register" });
    return fail("VPN_BLOCKED", "Access denied: VPN/proxy detected", 403);
  }
  if (vpn.flagged) {
    // log_only mode or excepted IP: fire-and-forget audit, never blocks.
    void audit("VPN_LOG", null, { ip, route: "register", excepted: vpn.excepted }).catch(() => {});
  }

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  const { email, username, password, captchaToken, ref } = parsed.data;

  // CAPTCHA (D-004): sandbox provider requires token presence only.
  const captcha = await verifyCaptcha(captchaToken, ip);
  if (!captcha.ok) {
    await audit("AUTH_REGISTER_CAPTCHA_FAILED", null, { ip, reason: captcha.reason });
    return fail("CAPTCHA_INVALID", "Captcha verification failed", 402);
  }

  // ANTI-MULTICUENTA (Task 39): friendly pre-check before any heavy work. The
  // UNIQUE(registrationIp) index is the real enforcement; this only returns a
  // clean error message instead of surfacing a constraint violation. If the
  // read itself is momentarily busy, skip the friendly check — the UNIQUE
  // index (the arbiter) still protects the invariant.
  // Task 42 (USER MANDATE): ADMIN accounts are the ONLY accounts allowed to
  // use the same IP as anyone else — they are exempt both ways, so only
  // non-ADMIN occupants of this IP count here. (Admins are never stamped with
  // a registrationIp — see the tx below — so the role filter is belt-and-braces
  // for any legacy stamped row.)
  try {
    const ipAccounts = await db.user.count({ where: { registrationIp: ip, role: { not: "ADMIN" } } });
    if (ipAccounts >= 1) {
      await audit("AUTH_REGISTER_MULTIACCOUNT", null, { ip });
      return fail("MULTI_ACCOUNT_BLOCKED", "Only one account per IP is allowed", 403);
    }
  } catch {
    // fall through to the in-transaction guard below.
  }

  // Password policy is enforced server-side (i18n key returned as message for client mapping).
  const policy = passwordPolicyError(password);
  if (policy) {
    return fail("PASSWORD_POLICY", policy, 400);
  }

  // Case-insensitive uniqueness (email + username).
  const usernameLc = username.toLowerCase();
  const dupCandidates = await db.user.findMany({
    where: { OR: [{ email: email.toLowerCase() }, { username: { contains: username } }] },
    select: { email: true, username: true },
  });
  const duplicate = dupCandidates.some(
    (c) => c.email.toLowerCase() === email.toLowerCase() || c.username.toLowerCase() === usernameLc
  );
  if (duplicate) {
    await audit("AUTH_REGISTER_DUPLICATE", null, { ip });
    return fail("REGISTER_CONFLICT", "Invalid credentials or account already registered", 409);
  }

  // Referral binding (by username or id; case-insensitive username match).
  let referredById: string | undefined;
  if (ref && ref.length > 0) {
    const refCandidates = await db.user.findMany({
      where: { OR: [{ id: ref }, { username: { contains: ref } }] },
      select: { id: true, username: true },
    });
    const referrer =
      refCandidates.find((c) => c.id === ref) ??
      refCandidates.find((c) => c.username.toLowerCase() === ref.toLowerCase());
    if (referrer) referredById = referrer.id;
  }

  const emailLc = email.toLowerCase();
  return withRegisterSlot(async () => {
    try {
    // Admin bootstrap (configurable, no code changes): emails listed in
    // admin.bootstrapEmail (comma-separated) register with the ADMIN role —
    // but ONLY while the platform has no admin yet (first-admin bootstrap).
    // SECURITY (pentest fix): previously the grant was unconditional, so whoever
    // registered the (knowable) bootstrap email first became ADMIN even on an
    // already-operated platform. Additional admins must now be created by an
    // existing admin via /api/admin/promote.
    const bootstrapRaw = (await getConfig("admin.bootstrapEmail")).toLowerCase();
    const bootstrapList = bootstrapRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    const isAdmin = adminCount === 0 && bootstrapList.includes(emailLc);

    // PERFORMANCE/RACE (Task 39 live-test finding): Argon2 (m=19456) costs
    // ~0.5s of CPU. Hashing INSIDE the SQLite transaction kept it open long
    // enough that 6 concurrent signups from the same IP all timed out instead
    // of exactly one winning. Hash BEFORE opening the transaction — the tx is
    // then two fast queries + two inserts (~few ms) and SQLite contention
    // collapses. SECURITY NOTE: pre-hashing is safe — the password never
    // re-enters any path that could be observed by another request.
    const passwordHash = await hashPassword(password);

    const user = await db.$transaction(async (tx) => {
      // SECURITY (pentest fix — case-collision race): the duplicate check ran
      // OUTSIDE the transaction and the DB unique index is case-sensitive, so
      // concurrent "John"/"john" could both insert. Re-check inside the tx.
      const stillDup = await tx.user.findFirst({
        where: { username: { contains: username } },
        select: { username: true },
      });
      if (stillDup && stillDup.username.toLowerCase() === usernameLc) {
        throw new Error("USERNAME_TAKEN");
      }
      // ANTI-MULTICUENTA (Task 39): re-check INSIDE the transaction — two
      // concurrent signups from the same IP must not both pass the outer check.
      // If both still slip through, the UNIQUE(registrationIp) index rejects the
      // second INSERT (P2002 → MULTI_ACCOUNT_BLOCKED in the catch below).
      // Task 42 (USER MANDATE): ADMIN registrations skip the rule entirely and
      // are NEVER stamped with a registrationIp — administrative accounts are
      // the only ones allowed to share an IP, in both directions.
      if (!isAdmin) {
        const ipTaken = await tx.user.count({ where: { registrationIp: ip, role: { not: "ADMIN" } } });
        if (ipTaken > 0) throw new Error("MULTI_ACCOUNT");
      }
      const created = await tx.user.create({
        data: {
          email: emailLc,
          username,
          passwordHash,
          emailVerified: false,
          role: isAdmin ? "ADMIN" : "USER",
          referredById: referredById ?? null,
          registrationIp: isAdmin ? null : ip,
        },
      });
      // New users start with 0 personal funds (D-010). No free money.
      await tx.personalWallet.create({ data: { userId: created.id, balance: 0 } });
      return created;
    });

    // Task 41 (USER MANDATE — 30-day multi-account rule): Task 39 already
    // refuses a SECOND registration from an IP via UNIQUE(registrationIp), but
    // legacy accounts have registrationIp NULL. If another ACTIVE account was
    // recently SEEN on this IP (within security.ipWindowDays, default 30 days),
    // the new account AND that counterpart are auto-blocked (only an admin can
    // unblock). The sign-up ends with an honest 403 and no verification mail is
    // ever issued for a blocked account. This call also records the IpLink
    // evidence row for the new account.
    const ipGuard = await enforceMultiAccountIp({ userId: user.id, ip, role: user.role });
    if (ipGuard.blocked) {
      await audit("AUTH_REGISTER_MULTIACCOUNT_IP", user.id, { ip, accounts: ipGuard.accounts });
      return fail(
        "MULTI_ACCOUNT_IP_BLOCKED",
        "Multiple accounts detected on this IP; the accounts have been blocked",
        403
      );
    }

    const verification = await issueEmailVerification(emailLc);
    await audit("AUTH_REGISTER", user.id, {
      email: emailLc,
      username,
      ip,
      referred: !!referredById,
      adminBootstrap: isAdmin,
    });

    // Sandbox (console transport): the verification code is returned so the flow is
    // completable without a real mailbox. With a real provider devCode is undefined.
    return ok({ email: emailLc, ...(verification.devCode ? { devCode: verification.devCode } : {}) });
  } catch (err) {
    // ANTI-MULTICUENTA (Task 39): the in-tx guard tripped, or the race reached
    // the UNIQUE(registrationIp) index (P2002 on that column only — email and
    // username conflicts keep their generic anti-enumeration response).
    const multiAccount =
      (err instanceof Error && err.message === "MULTI_ACCOUNT") ||
      (err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        String(err.meta?.target ?? "").includes("registrationIp"));
    if (multiAccount) {
      await audit("AUTH_REGISTER_MULTIACCOUNT", null, { ip, race: true });
      return fail("MULTI_ACCOUNT_BLOCKED", "Only one account per IP is allowed", 403);
    }
    // SQLite contention under a concurrent burst (Task 39 live-test finding):
    // an interactive transaction that loses the writer race can surface as
    // P2024 (timeout), P2034 (write conflict) or a raw "database is locked".
    // Integrity is never at risk (the DB is the arbiter), but the client must
    // get an honest retryable 503 instead of a misleading 409/500.
    const busyError =
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2024" || err.code === "P2034") ||
      (err instanceof Error && /database is locked|SQLITE_BUSY/i.test(err.message));
    if (busyError) {
      return fail("SERVICE_BUSY", "Registration is busy, please retry", 503, { retryAfterSec: 3 });
    }
    // Unique-constraint race (concurrent duplicate registration).
    await audit("AUTH_REGISTER_DUPLICATE", null, { ip, race: true });
    return fail("REGISTER_CONFLICT", "Invalid credentials or account already registered", 409);
    }
  });
}
