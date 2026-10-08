#!/bin/bash
# Knight FM — release ZIP builder (user mandate: after EVERY project update,
# regenerate the complete project ZIP with documentation and expose it for
# download from the web footer).
#
# Usage: bash scripts/release-zip.sh
# Output:
#   download/knight-fm-proyecto-completo.zip   (master copy)
#   public/downloads/knight-fm-project.zip     (served by the app footer)
#
# Includes: src, public, prisma, db (SQLite world incl.), scripts, docs (md +
# Word), tests, examples, .zscripts, upload, every root config, worklog.md and
# the Word documentation at the root.
# SECURITY (Task 59): .env REAL is NEVER included — it carries AUTH_SECRET and
# the admin bootstrap credentials. Only the .env.example template travels.
# Excludes: node_modules, .next, dev logs, tsbuildinfo, nested release ZIPs,
# agent working folders (download/, tool-results/, agent-ctx/, skills/).

set -euo pipefail
cd "$(dirname "$0")/.."

ROOT_DOC="Knight_FM_Documentacion_del_Proyecto.docx"
[ -f docs/knight-fm-documentacion.docx ] && cp docs/knight-fm-documentacion.docx "$ROOT_DOC"

# SQLite WAL checkpoint: flush the running server's WAL into custom.db so the
# shipped main DB is complete and the transient -wal/-shm sidecars can be
# excluded (a stale sidecar pair in a backup can corrupt recovery).
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('db/custom.db');
db.exec('PRAGMA busy_timeout=10000;');
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
db.close();
" 2>/dev/null || echo "(aviso: checkpoint WAL omitido — BD en uso)"

rm -f download/knight-fm-proyecto-completo.zip
mkdir -p download

zip -r -q download/knight-fm-proyecto-completo.zip \
  src public prisma db scripts docs tests examples .zscripts upload \
  package.json bun.lock tsconfig.json next.config.ts next-env.d.ts \
  eslint.config.mjs postcss.config.mjs tailwind.config.ts components.json \
  Caddyfile .env.example .gitattributes .gitignore README.md worklog.md INVENTARIO_MAESTRO.md "$ROOT_DOC" \
  t16-funds-dialog.png t16-wallet-live-transition.png t16-wallet-mobile.png t16-wallet-mode.png \
  -x "public/downloads/*.zip" "*/node_modules/*" "node_modules/*" \
     "*.tsbuildinfo" "dev.log*" ".next/*" ".zscripts/dev.pid" \
     "db/*.db-wal" "db/*.db-shm" 2>/dev/null || true

cp download/knight-fm-proyecto-completo.zip public/downloads/knight-fm-project.zip

FILES=$(unzip -l download/knight-fm-proyecto-completo.zip | tail -1 | awk '{print $2}')
MD5=$(md5sum download/knight-fm-proyecto-completo.zip | cut -d' ' -f1)
echo "✅ ZIP regenerado: $(ls -lh download/knight-fm-proyecto-completo.zip | awk '{print $5}') · ${FILES} archivos · md5 ${MD5}"
echo "   → download/knight-fm-proyecto-completo.zip (maestro)"
echo "   → public/downloads/knight-fm-project.zip (servido por la web)"
echo "   → public/downloads/knight-fm-documentacion.docx (documentación Word)"
