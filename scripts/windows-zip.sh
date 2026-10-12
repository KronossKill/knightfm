#!/bin/bash
# Knight FM — Windows deployment ZIP builder (runs in the Linux sandbox).
#
# Regenerates delivery/knight-fm-windows.zip from the current project state
# (Task 107: delivery/ is a LOCAL gitignored folder — the site ships zero
# downloadable files, nothing under public/ is exposed anymore).
#   * INCLUDES app source, prisma schema, public assets, the current world DB
#     (WAL-checkpointed), docs, root configs, deploy tooling and the Word doc
#     copied to the root under a friendly name;
#   * EXCLUDES the real .env (secrets NEVER ship), db WAL/SHM sidecars, logs,
#     build output, node_modules, download artifacts and agent working folders.
#
# Usage: bash scripts/windows-zip.sh
# Output: delivery/knight-fm-windows.zip  (+ prints size, files, md5)

set -uo pipefail
cd "$(dirname "$0")/.."

OUT="delivery/knight-fm-windows.zip"
ROOT_DOC="Knight_FM_Documentacion_del_Proyecto.docx"

mkdir -p delivery

# --- WAL checkpoint: flush the running server's WAL into db/custom.db so the
# shipped main DB is complete and the transient -wal/-shm sidecars can be
# excluded (a stale sidecar pair in a backup can corrupt recovery).
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('db/custom.db');
db.exec('PRAGMA busy_timeout=10000;');
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
db.close();
" 2>/dev/null || echo "(warn: WAL checkpoint skipped — DB busy)"

# --- root copy of the Word documentation (friendly name), included if present
if [ -f docs/knight-fm-documentacion.docx ]; then
  cp docs/knight-fm-documentacion.docx "$ROOT_DOC"
fi

rm -f "$OUT"

# --- core files (|| true keeps optional/missing paths from aborting) ---
zip -r -q "$OUT" \
  src prisma public docs tests \
  db/custom.db \
  .gitignore DEPLOY-WINDOWS.md deploy-windows.bat \
  package.json tsconfig.json next.config.ts next-env.d.ts \
  postcss.config.mjs components.json eslint.config.mjs \
  scripts/tee.mjs scripts/copy-standalone.mjs scripts/start-prod.mjs scripts/seed.ts \
  "$ROOT_DOC" \
  -x "public/downloads/*" "public/download/*" "download/*" "delivery/*" \
     "*/node_modules/*" "node_modules/*" \
     "*.tsbuildinfo" "dev.log*" ".next/*" \
     "db/*.db-wal" "db/*.db-shm" \
     ".env" "worklog.md" "bun.lock" "Caddyfile" "t16-*.png" \
     "tool-results/*" "agent-ctx/*" "skills/*" "upload/*" ".zscripts/*" ".git/*" \
  2>/dev/null || true

# --- optional files (missing ones must not abort the build) ---
for opt in .env.example tailwind.config.ts mini-services/.gitkeep; do
  if [ -e "$opt" ]; then
    zip -r -q "$OUT" "$opt" 2>/dev/null || true
  fi
done

# --- report ---
if [ ! -f "$OUT" ]; then
  echo "ERROR: $OUT was not created." >&2
  exit 1
fi

SIZE_H=$(ls -lh "$OUT" | awk '{print $5}')
SIZE_B=$(stat -c%s "$OUT")
FILES=$(unzip -l "$OUT" | awk 'END{print $(NF-1)}')
MD5=$(md5sum "$OUT" | cut -d' ' -f1)

echo "Windows ZIP rebuilt: $OUT"
echo "  size: ${SIZE_H} (${SIZE_B} bytes) | files: ${FILES} | md5: ${MD5}"
echo "  excluded: .env (real secrets), db -wal/-shm, dev logs, node_modules, .next, download artifacts"
