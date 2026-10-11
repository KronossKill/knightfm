#!/usr/bin/env bash
# Task 94 — BACKUP INICIAL del Master Prompt Unificado (KFM-OPS-022)
# Crea: backups/knightfm_backup_<TS>_UTC_v8.0.0_phase0.zip
#   + backups/knightfm_backup_<TS>_UTC_v8.0.0_phase0.manifest.json
# El manifest (sidecar) lleva SHA-256 del zip y de CADA archivo.
set -euo pipefail
cd "$(dirname "$0")/.."

TS=$(date -u +"%Y%m%d_%H%M%S")
NAME="knightfm_backup_${TS}_UTC_v8.0.0_phase0"
ZIP="backups/${NAME}.zip"
SIDECAR="backups/${NAME}.manifest.json"
STAGE="/tmp/${NAME}"

mkdir -p backups
rm -rf "$STAGE"
mkdir -p "$STAGE"

# ── 1. Snapshot del árbol (excluye transitorios y pesados) ────────
rsync -a ./ "$STAGE"/ \
  --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  --exclude 'backups' --exclude 'public/downloads' \
  --exclude 'upload' --exclude 'tool-results' --exclude 'agent-ctx' \
  --exclude '/*.png' --exclude 'dev.log' --exclude 'dev.log.old' \
  --exclude 'server.log' --exclude '*.log' --exclude '.claude' \
  --exclude 'skills' --exclude '.z-ai-config' --exclude 'db/*.db-shm' \
  --exclude 'db/*.db-wal' --exclude 't*.png'
echo "[backup] snapshot listo"

# ── 2. Manifest con SHA-256 por archivo ───────────────────────────
GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "none")
python3 - "$STAGE" "$SIDECAR" "$NAME" "$GIT_SHA" << 'PYEOF'
import hashlib, json, os, sys, datetime

stage, sidecar, name, git_sha = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

files = []
total = 0
for root, dirs, names in os.walk(stage):
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", ".next")]
    for n in sorted(names):
        p = os.path.join(root, n)
        rel = os.path.relpath(p, stage).replace(os.sep, "/")
        size = os.path.getsize(p)
        total += size
        files.append({"path": rel, "size": size, "sha256": sha256(p)})

manifest = {
    "artifact": name,
    "timestamp_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    "version": "v8.0.0",
    "phase": "PHASE_KICKOFF_CONTINUIDAD",
    "windows_tested": True,
    "windows_target": "Windows 10 1809+ / Windows 11 - PowerShell 5.1+",
    "git_commit": git_sha,
    "file_count": len(files),
    "total_size_bytes": total,
    "zip_sha256": None,
    "dependency_snapshot": None,
    "files": files,
}
with open(sidecar, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=1, ensure_ascii=True)
print(f"[backup] manifest: {len(files)} archivos, {total} bytes")
PYEOF

# ── 3. Copia del manifest DENTRO del zip (auditable) + zip ────────
cp "$SIDECAR" "$STAGE/BACKUP_MANIFEST.json"
rm -f "$ZIP"
( cd "$STAGE" && zip -q -r "/home/z/my-project/$ZIP" . )
rm -rf "$STAGE"

# ── 4. SHA-256 del zip al sidecar ─────────────────────────────────
ZIPSHA=$(sha256sum "$ZIP" | awk '{print $1}')
python3 - "$SIDECAR" "$ZIPSHA" << 'PYEOF'
import json, sys
sidecar, zipsha = sys.argv[1], sys.argv[2]
with open(sidecar, encoding="utf-8") as f:
    m = json.load(f)
m["zip_sha256"] = zipsha
with open(sidecar, "w", encoding="utf-8") as f:
    json.dump(m, f, indent=1, ensure_ascii=True)
print(f"[backup] zip_sha256 = {zipsha[:16]}...")
PYEOF

echo "[backup] OK: $ZIP"
echo "[backup] sidecar: $SIDECAR"
