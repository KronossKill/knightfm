// Knight FM — Knight Control Center: world reset (two-step confirm).
// REAL PIPELINE: on confirm the endpoint (1) takes a consistent SQLite snapshot
// of the database via VACUUM INTO, (2) wipes the whole game world (FK-safe),
// (3) rebuilds it from the genesis seed, and (4) audits the execution.
// Users, sessions, personal wallets, configuration, the audit trail and the
// knowledge base are PRESERVED; clubs, players, ledgers and seasons are destroyed.

import { NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { runWorldGenesis } from "@/lib/genesis";

const Body = z.object({
  stage: z.union([z.literal("request"), z.literal("confirm")]),
  confirmToken: z.string().max(128).optional(),
});

const BACKUP_DIR = join(process.cwd(), "db", "backups");
const BACKUP_KEEP = 10;
const RESET_LOCK_KEY = "world.resetLock";
const RESET_LOCK_TTL_MS = 15 * 60_000;

/** Consistent SQLite snapshot via VACUUM INTO (safe with live connections). */
async function backupDatabase(): Promise<string> {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(BACKUP_DIR, `custom-${stamp}.db`);
  // Escape single quotes for the SQL literal.
  const sqlPath = target.replace(/'/g, "''");
  await db.$queryRawUnsafe(`VACUUM INTO '${sqlPath}'`);
  // Prune old backups, keep the newest BACKUP_KEEP.
  try {
    const files = readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".db")).sort().reverse();
    for (const f of files.slice(BACKUP_KEEP)) unlinkSync(join(BACKUP_DIR, f));
  } catch { /* best effort */ }
  return target;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "stage ('request'|'confirm') is required", 400);

  if (parsed.data.stage === "request") {
    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await db.systemState.upsert({
      where: { key: "admin.resetToken" },
      create: { key: "admin.resetToken", value: token },
      update: { value: token },
    });
    await db.systemState.upsert({
      where: { key: "admin.resetTokenExpiresAt" },
      create: { key: "admin.resetTokenExpiresAt", value: expiresAt.toISOString() },
      update: { value: expiresAt.toISOString() },
    });
    await audit("ADMIN_RESET_REQUESTED", auth.userId, { stage: "request", expiresAt });
    return ok({ stage: "request", confirmToken: token, expiresAt, note: "Token valid for 10 minutes." });
  }

  // stage === "confirm"
  if (!parsed.data.confirmToken) return fail("CONFIRM_TOKEN_REQUIRED", "confirmToken is required", 400);

  const [stored, expiresRow] = await Promise.all([
    db.systemState.findUnique({ where: { key: "admin.resetToken" } }),
    db.systemState.findUnique({ where: { key: "admin.resetTokenExpiresAt" } }),
  ]);

  if (!stored || stored.value !== parsed.data.confirmToken) {
    return fail("INVALID_TOKEN", "Confirmation token does not match", 400);
  }
  if (!expiresRow || new Date(expiresRow.value) < new Date()) {
    return fail("TOKEN_EXPIRED", "Confirmation token expired — start again with stage 'request'", 400);
  }

  // Consume token (single use).
  await db.systemState.delete({ where: { key: "admin.resetToken" } }).catch(() => undefined);
  await db.systemState.delete({ where: { key: "admin.resetTokenExpiresAt" } }).catch(() => undefined);

  // Reentrancy guard: one reset at a time (self-expiring lock).
  const existingLock = await db.systemState.findUnique({ where: { key: RESET_LOCK_KEY } });
  if (existingLock) {
    const lockedAt = new Date(existingLock.updatedAt).getTime();
    if (Date.now() - lockedAt < RESET_LOCK_TTL_MS) {
      return fail("RESET_IN_PROGRESS", "A world reset is already running — wait for it to finish", 409);
    }
  }
  await db.systemState.upsert({
    where: { key: RESET_LOCK_KEY },
    create: { key: RESET_LOCK_KEY, value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  }).catch(() => undefined);

  const startedAt = Date.now();
  try {
    await audit("ADMIN_RESET_CONFIRMED", auth.userId, { stage: "confirm" });
    const backupFile = await backupDatabase();

    // Destructive wipe + reseed from genesis.
    const result = await runWorldGenesis(db, { wipe: true });

    await audit("ADMIN_RESET_EXECUTED", auth.userId, {
      stage: "confirm", executed: true, backupFile,
      durationMs: Date.now() - startedAt, counts: result.counts, epochUtc: result.epochIso,
    });
    return ok({
      accepted: true,
      executed: true,
      backupFile,
      epochUtc: result.epochIso,
      counts: result.counts,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    // SECURITY (pentest hardening): log details server-side only — the raw
    // exception used to reach the client (path/stack fingerprinting).
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin/reset] world reset failed:", message);
    await audit("ADMIN_RESET_FAILED", auth.userId, { stage: "confirm", executed: false, error: message.slice(0, 300), durationMs: Date.now() - startedAt });
    return fail("RESET_FAILED", "World reset failed. The error has been logged; no partial state was left unlocked.", 500);
  } finally {
    await db.systemState.delete({ where: { key: RESET_LOCK_KEY } }).catch(() => undefined);
  }
}
