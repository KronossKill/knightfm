// Knight FM — Knight Control Center: full project backups (Task 49/50).
// GET  → list local backups + manifest (md5, size, DB stats, cloud chain status/URLs)
// POST → execute scripts/backup.sh (checkpoint+integrity → zip → manifest → cloud chain
//        upload: webhook/litterbox/uguu/tmpfiles → retention). Single-flight (409), 900 s ceiling, audited.
// ADMIN ONLY — backups expose infrastructure metadata.

import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { ok, fail, requireAuth, isResponse, audit } from "@/lib/api";
import { getConfig } from "@/lib/config";

interface Manifest {
  file: string;
  createdAtUtc: string;
  md5: string;
  bytes: number;
  files: number;
  db: Record<string, number>;
  cloudStatus?: string;
  cloud?: Array<{ target: string; url: string | null; expiresHours: number; status: string }>;
}

const ROOT = process.cwd();

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const webhook = await getConfig("ops.backup.webhookUrl");
  const backups: Manifest[] = [];
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(ROOT, "backups");
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".manifest.json")).sort().reverse();
    for (const name of names.slice(0, 20)) {
      try {
        const raw = await fs.readFile(path.join(dir, name), "utf8");
        backups.push(JSON.parse(raw) as Manifest);
      } catch {
        // unreadable manifest is skipped honestly (no fabricated rows)
      }
    }
  } catch {
    // no backups dir yet → empty list
  }
  return ok({
    backups,
    webhookConfigured: /^https:\/\//.test(webhook),
    cloudChainEnabled: true,
  });
}

let running = false;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  if (running) {
    return fail("BACKUP_IN_PROGRESS", "A backup is already running", 409);
  }
  running = true;
  try {
    const result = await new Promise<{ code: number; tail: string }>((resolve) => {
      const child = spawn("bash", ["scripts/backup.sh"], { cwd: ROOT });
      let out = "";
      // Cloud chain uploads (litterbox ×3 retries + uguu + tmpfiles) can legitimately take
      // several minutes — 15 min ceiling instead of killing the upload mid-flight.
      const timer = setTimeout(() => child.kill("SIGKILL"), 900_000);
      child.stdout.on("data", (d) => (out += String(d)));
      child.stderr.on("data", (d) => (out += String(d)));
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 1, tail: out.split("\n").filter(Boolean).slice(-6).join("\n") });
      });
    });

    if (result.code !== 0) {
      await audit("BACKUP_FAILED", auth.userId, { tail: result.tail.slice(0, 400) });
      return fail("BACKUP_FAILED", `Backup script exited with code ${result.code}`, 500, { tail: result.tail });
    }

    // Real outcome only — parse the summary line the script printed.
    const line = result.tail.split("\n").find((l) => l.startsWith("BACKUP OK:")) ?? "";
    await audit("BACKUP_CREATED", auth.userId, { summary: line.slice(0, 300) });
    return ok({ status: "CREATED", summary: line, log: result.tail });
  } finally {
    running = false;
  }
}
