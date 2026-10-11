// Knight FM — Downloads index (Task 81).
// Public GET: lists every deliverable file in /public/downloads so the landing
// footer panel can offer one-click downloads for ALL packages, newest first.
// Read-only, fixed directory (no user input reaches the filesystem paths),
// extension-whitelisted, dotfiles skipped, always-fresh (no-store).

import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const ALLOWED_EXT = new Set([".zip", ".txt", ".sql", ".docx", ".md"]);

interface DownloadEntry {
  name: string;
  size: number;
  modifiedAt: string;
}

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "downloads");
    const entries = await readdir(dir, { withFileTypes: true });

    const files: DownloadEntry[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name.startsWith(".")) continue;
      const dot = entry.name.lastIndexOf(".");
      if (dot < 0) continue;
      const ext = entry.name.slice(dot).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) continue;
      try {
        const st = await stat(path.join(dir, entry.name));
        files.push({ name: entry.name, size: st.size, modifiedAt: st.mtime.toISOString() });
      } catch {
        // File vanished mid-scan — skip it, never fail the whole listing.
      }
    }

    files.sort((a, b) =>
      a.modifiedAt === b.modifiedAt
        ? a.name.localeCompare(b.name)
        : b.modifiedAt.localeCompare(a.modifiedAt),
    );

    return NextResponse.json(
      { files },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "DOWNLOADS_UNAVAILABLE",
          message: "Downloads directory unavailable",
        },
      },
      { status: 500 },
    );
  }
}
