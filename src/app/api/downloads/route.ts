// Knight FM — GET /api/downloads (Task 87/90): public, auth-less listing of
// the DELIVERY artifacts in public/downloads, newest first. The landing
// downloads panel renders this list; the newest file is flagged so the UI can
// badge it "MÁS RECIENTE". Read-only, tiny, no secrets: it exposes exactly the
// files that are already publicly downloadable.

import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const dir = path.join(process.cwd(), "public", "downloads");
  try {
    const names = await readdir(dir);
    const files = await Promise.all(
      names
        .filter((n) => !n.startsWith("."))
        .map(async (name) => {
          const s = await stat(path.join(dir, name));
          return { name, size: s.size, mtimeMs: s.mtimeMs, isFile: s.isFile() };
        })
    );
    const sorted = files
      .filter((f) => f.isFile)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .map((f, i) => ({ name: f.name, size: f.size, mtime: new Date(f.mtimeMs).toISOString(), newest: i === 0 }));
    return ok({ files: sorted });
  } catch {
    return ok({ files: [] });
  }
}
