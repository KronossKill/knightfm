#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Knight FM — GENERADOR DE ENTREGA COMPLETA (KFM-OPS-015)
# Reconstruido en Task 90 tras la reversión total del sandbox.
#
# REGLA DE ORO: cada entrega es el ESTADO COMPLETO del proyecto con
# el MISMO nombre canónico siempre:
#     knightfm-sincronizacion-completa.zip
# y siempre lleva dentro:
#   1. TODO el árbol entregable (src − withdraw-executor, public − downloads,
#      prisma POSTGRESQL, scripts, docs, tests, configs raíz, .env.example)
#   2. MANIFIESTO-COMPLETO.txt   ("ruta|tamaño" de cada archivo)
#   3. VERIFICAR-INSTALACION.bat/.ps1  (verificador Windows de un clic)
#
# La autoauditoría KFM-OPS-008 (+ KFM-OPS-016 cierre de imports internos)
# ABORTA la publicación si algo falla. Nada defectuoso llega al usuario.
#
# KFM-OPS-020: VERIFICAR-INSTALACION.ps1/.bat + MANIFIESTO van 100% ASCII.
# Windows PowerShell 5.1 parsea los .ps1 sin BOM como ANSI (Windows-1252):
# los bytes UTF-8 de acentos/ñ/rayas (p.ej. la raya — termina en 0x94, que
# en cp1252 es COMILLA DOBLE) rompen strings y llaves y el verificador ni
# siquiera arranca (bug real v5/v6, reportado con captura — Task 92).
#
# KFM-OPS-023 (Task 94, Master Prompt Unificado): endurecimiento Windows
# global — TODOS los .ps1/.bat del stage van 100% ASCII + CRLF obligatorio
# (antes de empaquetar y auditar), probe next 16.4.0, guards de los nuevos
# documentos Windows (DEPLOY_WINDOWS, WINDOWS_SETUP, .gitattributes,
# docs/reports, ADR-001) y generación automática de la copia fechada
# knightfm_updated_<TS>_UTC_v9.2.0.zip (mismo contenido que el canónico).
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

ZIP_NAME="knightfm-sincronizacion-completa.zip"
ZIP_PATH="public/downloads/$ZIP_NAME"
DELIVERY_VERSION="v9.3.0"
UPDATED_TS="${KFM_UPDATED_TS:-$(date -u +%Y%m%d_%H%M%S)}"
UPDATED_NAME="knightfm_updated_${UPDATED_TS}_UTC_${DELIVERY_VERSION}.zip"
STAGE="$(mktemp -d /tmp/kfm-stage-XXXXXX)"
LEEME_SRC="public/downloads/LEEME-SINCRONIZACION-COMPLETA.txt"
TMPDIR_ZIP="$(mktemp -d /tmp/kfm-zip-XXXXXX)"
TMPZIP="$TMPDIR_ZIP/$ZIP_NAME"   # el .zip NO debe preexistir: este zip rechaza destinos vacíos

log() { printf "\n\033[1;32m[KFM-OPS-015]\033[0m %s\n" "$*"; }
die() { printf "\n\033[1;31m[KFM-OPS-015] ABORT: %s\033[0m\n" "$*" >&2; exit 1; }

[ -f "$LEEME_SRC" ] || die "no existe $LEEME_SRC (crea el LEEME v9 antes de empaquetar)"

# ── 1/7 Staging del árbol completo ────────────────────────────────
log "1/7 Staging del árbol completo"
mkdir -p "$STAGE"/{src,prisma,public,scripts,docs,tests}
rsync -a src/ "$STAGE/src/" --exclude '/lib/solana/withdraw-executor.ts'
[ -f "$STAGE/src/lib/solana/solana-verify.ts" ] || die "solana-verify.ts no quedó en el stage (debe VIAJAR)"
[ ! -e "$STAGE/src/lib/solana/withdraw-executor.ts" ] || die "withdraw-executor.ts NO debe viajar (WIP)"
rsync -a prisma/ "$STAGE/prisma/"
rsync -a scripts/ "$STAGE/scripts/"
rsync -a docs/ "$STAGE/docs/" 2>/dev/null || true
rsync -a tests/ "$STAGE/tests/" 2>/dev/null || true
rsync -a public/ "$STAGE/public/" --exclude 'downloads/'
[ ! -e "$STAGE/public/downloads" ] || die "public/downloads no debe viajar dentro del zip"
# Configs raíz entregables (nunca .env real, nunca dev.log/agent-ctx/upload…)
for f in package.json bun.lock .npmrc .env.example .gitignore next.config.ts tsconfig.json \
         postcss.config.mjs tailwind.config.ts eslint.config.mjs components.json \
         vercel.json .gitattributes \
         WINDOWS_SETUP.md TROUBLESHOOTING_WINDOWS.md DEPLOY_WINDOWS.ps1 DEPLOY_WINDOWS.bat \
         STATE.md CHANGELOG.md BACKUP_LOG.md CHANGELOG_UPDATE.md DELIVERY_REPORT.md \
         DELIVERY_DIFF.md BACKUP_MANIFEST.json INTEGRITY_REPORT.md DEPENDENCY_REPORT.md; do
  [ -f "$f" ] && cp "$f" "$STAGE/" || true
done
[ -f "$STAGE/package.json" ] || die "package.json no quedó en el stage"
# Prisma de ENTREGA = variante POSTGRESQL (divergencia formalizada Task 76/87)
[ -f "$STAGE/prisma/schema.production.prisma" ] || die "falta prisma/schema.production.prisma (ejecuta scripts/gen-production-schema.mjs)"
cp "$STAGE/prisma/schema.production.prisma" "$STAGE/prisma/schema.prisma"
grep -q 'provider = "postgresql"' "$STAGE/prisma/schema.prisma" || die "schema.prisma del stage no es postgresql"
grep -q 'provider = "sqlite"' prisma/schema.prisma || true   # el sandbox sigue en sqlite (solo aviso si no)
# package.json del stage = Windows-safe + Vercel-ready (divergencias
# KFM-OPS-011 y KFM-OPS-021):
#   dev        = next dev -p 3000       (sin tee: no existe en Windows)
#   build      = next build             (Vercel compila; el cp -r de
#                                        standalone es para self-hosting)
#   postinstall= prisma generate        (Vercel genera el cliente Prisma
#                                        automáticamente al instalar)
node -e '
const fs = require("fs");
const p = process.argv[1] + "/package.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
j.scripts.dev = "next dev -p 3000";
j.scripts.build = "next build";
j.scripts.postinstall = "prisma generate";
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
' "$STAGE"
# KFM-OPS-021: sin .gitignore la entrega NO sale (el usuario podría subir
# su .env real y node_modules a GitHub en el primer push)
[ -f "$STAGE/.gitignore" ] || die "falta .gitignore en el stage (KFM-OPS-021)"
grep -q "^\.env" "$STAGE/.gitignore" || die ".gitignore no ignora .env (peligro de fuga de claves)"
grep -q "node_modules" "$STAGE/.gitignore" || die ".gitignore no ignora node_modules"
grep -q "^!\.env\.example" "$STAGE/.gitignore" || die ".gitignore sin excepción !.env.example"
NFILES=$(find "$STAGE" -type f | wc -l)
log "Stage OK: $NFILES archivos"

# ── 2/7 Generando verificador Windows (VERIFICAR-INSTALACION) ─────
log "2/7 Generando verificador Windows (VERIFICAR-INSTALACION)"
cat > "$STAGE/VERIFICAR-INSTALACION.ps1" << 'PSEOF'
# Knight FM - VERIFICADOR DE INSTALACION (KFM-OPS-015)
# Compara TU carpeta contra MANIFIESTO-COMPLETO.txt (ruta|tamano).
# Rojo = FALTA. Amarillo = tamano distinto / extra. Verde = completo.
#
# AVISO: este archivo es 100% ASCII A PROPOSITO. Windows PowerShell 5.1
# lee los .ps1 sin BOM como ANSI (Windows-1252): los acentos, la enye y
# las rayas largas en UTF-8 corrompen el parseo y el script ni siquiera
# arranca (fallo real v5/v6, KFM-OPS-020 / Task 92).
# NO anadir acentos, enes ni rayas largas aqui NUNCA.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifest = Join-Path $root "MANIFIESTO-COMPLETO.txt"
if (-not (Test-Path $manifest)) { Write-Host "FALTA MANIFIESTO-COMPLETO.txt" -ForegroundColor Red; exit 1 }
$ignoreRel = @("node_modules", ".next", ".git", "public/downloads")
$tools = @("MANIFIESTO-COMPLETO.txt", "VERIFICAR-INSTALACION.bat", "VERIFICAR-INSTALACION.ps1", "LEEME-SINCRONIZACION-COMPLETA.txt")
$okCount = 0; $missing = 0; $diffSize = 0
$extra = New-Object System.Collections.Generic.List[string]
$expected = @{}
# -Encoding UTF8: el manifiesto se genera en UTF-8; asi cualquier ruta con
# acentos (si la hubiera) se compara bien en TODAS las versiones de PS.
Get-Content -LiteralPath $manifest -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  $parts = $line.Split("|")
  if ($parts.Count -ne 2) { return }
  $rel = $parts[0].Trim(); $size = 0
  [void][int64]::TryParse($parts[1].Trim(), [ref]$size)
  $expected[$rel] = $size
  $full = Join-Path $root ($rel -replace "/", "\\")
  if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
    Write-Host "FALTA: $rel" -ForegroundColor Red; $missing++
  } else {
    $real = (Get-Item -LiteralPath $full).Length
    if ($real -ne $size) { Write-Host "TAMANO DISTINTO: $rel (esperado $size, real $real)" -ForegroundColor Yellow; $diffSize++ }
    else { $okCount++ }
  }
}
# Extras: archivos de TU copia que no estan en el manifiesto (ignorables).
# Los separadores se normalizan a "/" para comparar contra el manifiesto
# (si no, TODOS los archivos anidados aparecian como EXTRA en falso).
Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($root.Length + 1) -replace "\\", "/"
  if ($tools -contains $rel) { return }
  $skip = $false
  foreach ($ig in $ignoreRel) { if ($rel.StartsWith($ig)) { $skip = $true; break } }
  if ($skip) { return }
  if (-not $expected.ContainsKey($rel)) { $extra.Add($rel) }
}
Write-Host ""
Write-Host "CORRECTOS: $okCount   FALTAN: $missing   TAMANO DISTINTO: $diffSize   EXTRA: $($extra.Count)" -ForegroundColor Cyan
if ($extra.Count -gt 0) {
  Write-Host "Archivos EXTRA (tuyos, de entregas o descargas anteriores - NO molestan, ignoralos):" -ForegroundColor DarkYellow
  $extra | Select-Object -First 15 | ForEach-Object { Write-Host "  EXTRA: $_" -ForegroundColor DarkYellow }
}
if ($missing -eq 0 -and $diffSize -eq 0) {
  Write-Host ""
  Write-Host "RESULTADO: TU PROYECTO ESTA COMPLETO" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "RESULTADO: INCOMPLETO - vuelve a extraer el zip y pulsa 'Reemplazar los archivos en destino'" -ForegroundColor Red
}
PSEOF
cat > "$STAGE/VERIFICAR-INSTALACION.bat" << 'BATEOF'
@echo off
title Knight FM - Verificador de instalacion
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0VERIFICAR-INSTALACION.ps1"
echo.
pause
BATEOF
cp "$LEEME_SRC" "$STAGE/"
[ -f "$STAGE/VERIFICAR-INSTALACION.bat" ] && [ -f "$STAGE/VERIFICAR-INSTALACION.ps1" ] || die "el verificador Windows no se generó"

# ── 2b/7 KFM-OPS-023: CRLF obligatorio en TODOS los scripts Windows ──
# Los .bat con LF pueden romper goto/etiquetas en CMD; PowerShell y Notepad
# esperan CRLF. Se normaliza ANTES del zip/manifest/auditoría.
log "2b/7 KFM-OPS-023: normalizando CRLF en todos los .ps1/.bat del stage"
python3 - "$STAGE" << 'PYCRLF'
import os, sys
stage = sys.argv[1]
n = 0
for root, dirs, files in os.walk(stage):
    for name in files:
        if name.endswith((".ps1", ".bat", ".cmd")):
            p = os.path.join(root, name)
            data = open(p, "rb").read().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
            open(p, "wb").write(data)
            n += 1
print(f"[KFM-OPS-023] {n} scripts Windows normalizados a CRLF")
PYCRLF

# ── 3/7 Empaquetando zip (estado completo) ────────────────────────
log "3/7 Empaquetando zip (estado completo)"
( cd "$STAGE" && zip -q -r "$TMPZIP" . )

# ── 4/7 MANIFIESTO-COMPLETO.txt (ruta|tamaño) dentro del zip ──────
log "4/7 Generando MANIFIESTO-COMPLETO.txt y añadiéndolo al zip"
MANI="$(mktemp /tmp/kfm-mani-XXXXXX.txt)"
{
  echo "# Knight FM - MANIFIESTO COMPLETO (generado por KFM-OPS-015)"
  echo "# formato: ruta|tamano_en_bytes - verifica con VERIFICAR-INSTALACION.bat"
  ( cd "$STAGE" && find . -type f \
      ! -name "MANIFIESTO-COMPLETO.txt" \
      ! -name "VERIFICAR-INSTALACION.bat" \
      ! -name "VERIFICAR-INSTALACION.ps1" \
      ! -name "LEEME-SINCRONIZACION-COMPLETA.txt" \
      -printf '%P|%s\n' | sort )
} > "$MANI"
cp "$MANI" "$STAGE/MANIFIESTO-COMPLETO.txt"
( cd "$STAGE" && zip -q "$TMPZIP" MANIFIESTO-COMPLETO.txt )

# ── 4b/7 KFM-OPS-020: verificador + manifiesto 100% ASCII ───────
# PowerShell 5.1 parsea .ps1 sin BOM como ANSI; cualquier byte UTF-8
# no-ASCII (acentos, enes, rayas) rompe el script en el Windows del
# usuario ANTES de comprobar nada (bug real v5/v6). tr borra TAB/LF/CR
# + ASCII imprimible: si SOBRA un solo byte, la entrega se ABORTA.
log "Auditoría KFM-OPS-020/023: ASCII puro en .ps1/.bat/MANIFIESTO + CRLF"
for f in MANIFIESTO-COMPLETO.txt; do
  NONASCII=$(LC_ALL=C tr -d '\11\12\15\40-\176' < "$STAGE/$f" | wc -c)
  if [ "$NONASCII" -ne 0 ]; then
    LC_ALL=C grep -n '[^[:print:]]' "$STAGE/$f" | head -3 || true
    die "$f tiene $NONASCII byte(s) NO-ASCII (rompe PowerShell 5.1)"
  fi
done
# KFM-OPS-023: auditoría GLOBAL de TODOS los scripts Windows del stage
# (no solo el verificador: también DEPLOY_WINDOWS, futuros .ps1/.bat…)
while IFS= read -r f; do
  rel=${f#"$STAGE/"}
  NONASCII=$(LC_ALL=C tr -d '\11\12\15\40-\176' < "$f" | wc -c)
  if [ "$NONASCII" -ne 0 ]; then
    LC_ALL=C grep -n '[^[:print:]]' "$f" | head -3 || true
    die "$rel tiene $NONASCII byte(s) NO-ASCII (rompe PowerShell 5.1)"
  fi
  CR=$(LC_ALL=C tr -dc '\15' < "$f" | wc -c)
  [ "$CR" -gt 0 ] || die "$rel sin CRLF (KFM-OPS-023)"
done < <(find "$STAGE" -type f \( -name '*.ps1' -o -name '*.bat' -o -name '*.cmd' \) | sort)
# Probes de contenido del verificador (fixes Task 92 presentes de verdad)
grep -q -- "-Encoding UTF8" "$STAGE/VERIFICAR-INSTALACION.ps1" || die "ps1 sin lectura UTF8 del manifiesto (KFM-OPS-020)"
grep -q "anteriores - NO molestan" "$STAGE/VERIFICAR-INSTALACION.ps1" || die "ps1 sin cadena EXTRA ASCII (KFM-OPS-020)"
grep -q "TAMANO DISTINTO" "$STAGE/VERIFICAR-INSTALACION.ps1" || die "ps1 sin TAMANO DISTINTO ASCII (KFM-OPS-020)"
grep -q -F '$rel = $_.FullName.Substring($root.Length + 1) -replace "\\", "/"' "$STAGE/VERIFICAR-INSTALACION.ps1" || die "ps1 sin normalizacion de separadores (extras en falso)"
if grep -q "chcp" "$STAGE/VERIFICAR-INSTALACION.bat"; then die "el .bat no debe depender de chcp (contenido 100% ASCII)"; fi

# ── 5/7 Autoauditoría KFM-OPS-008 + KFM-OPS-016 ──────────────────
log "5/7 Autoauditoría KFM-OPS-008 (el zip no se publica si falla algo)"
unzip -tq "$TMPZIP" > /dev/null || die "zip corrupto (unzip -t)"
# zip == stage (mismo conjunto de rutas; zip -r añade ENTRADAS DE DIRECTORIO
# terminadas en "/" que find -type f no lista → se filtran)
( cd "$STAGE" && find . -type f -printf '%P\n' | sort ) > /tmp/kfm-stage-list.txt
unzip -Z1 "$TMPZIP" | grep -v '/$' | sort > /tmp/kfm-zip-list.txt
diff -q /tmp/kfm-stage-list.txt /tmp/kfm-zip-list.txt > /dev/null || { diff /tmp/kfm-stage-list.txt /tmp/kfm-zip-list.txt | head; die "el zip y el stage difieren"; }
# Guardas de rutas críticas (lecciones Task 83/86/87/88/89/90)
while IFS= read -r p; do
  [ -e "$STAGE/$p" ] || die "falta ruta crítica en el stage: $p"
done << 'GUARDS'
src/components/auth/AuthFlow.tsx
src/components/landing/sections/downloads-panel.tsx
src/components/landing/index.tsx
src/app/api/downloads/route.ts
src/app/api/wallet/route.ts
src/app/api/wallet/deposit/route.ts
src/components/game/wallet/wallet-view.tsx
src/components/game/markets/types.ts
src/components/game/dashboard/widget-registry.tsx
src/components/game/dashboard/widgets-grid.tsx
src/components/game/dashboard/dashboard-view.tsx
src/components/game/command-palette.tsx
src/components/game/shell.tsx
src/lib/theme-tokens.ts
src/lib/i18n/dict/game/es.ts
src/app/api/me/dashboard/route.ts
docs/ui/UI_UX_DESIGN_SYSTEM.md
docs/ui/themes/tokens/index.json
src/lib/solana/solana-verify.ts
src/lib/engine/conditions.ts
src/lib/engine/trama.ts
src/lib/i18n/dict/auth/es.ts
src/lib/i18n/dict/markets/es.ts
prisma/schema.production.prisma
prisma/schema.prisma
public/facilities/stadium-t1.jpg
public/knight-logo.png
public/logo.svg
public/robots.txt
scripts/gen-production-schema.mjs
next.config.ts
package.json
bun.lock
.npmrc
.env.example
.gitignore
VERIFICAR-INSTALACION.bat
VERIFICAR-INSTALACION.ps1
MANIFIESTO-COMPLETO.txt
LEEME-SINCRONIZACION-COMPLETA.txt
WINDOWS_SETUP.md
TROUBLESHOOTING_WINDOWS.md
DEPLOY_WINDOWS.bat
DEPLOY_WINDOWS.ps1
STATE.md
CHANGELOG.md
BACKUP_LOG.md
BACKUP_MANIFEST.json
INTEGRITY_REPORT.md
DEPENDENCY_REPORT.md
.gitattributes
docs/reports/01_INITIAL_INVENTORY.md
docs/reports/07_DELIVERY_REPORT.md
docs/decisions/ADR-001-next-pinned.md
docs/archive/MASTER_PROMPT_UNIFICADO_FUENTE.txt
GUARDS
# Probes de CONTENIDO en el stage (fixes Task 88/89/90 presentes de verdad)
grep -q "reg-confirm-password" "$STAGE/src/components/auth/AuthFlow.tsx" || die "AuthFlow sin confirmación de contraseña (Task 89)"
grep -q "PasswordInput" "$STAGE/src/components/auth/AuthFlow.tsx" || die "AuthFlow sin PasswordInput (Task 89)"
grep -q "TURNSTILE_" "$STAGE/src/components/auth/AuthFlow.tsx" || die "AuthFlow sin mapeo TURNSTILE (Task 70)"
grep -q "QRCodeSVG" "$STAGE/src/components/game/wallet/wallet-view.tsx" || die "wallet-view sin QR (Task 88)"
grep -q "depositAddress" "$STAGE/src/app/api/wallet/route.ts" || die "/api/wallet sin depositAddress (Task 88)"
grep -q "depositDestTitle" "$STAGE/src/lib/i18n/dict/markets/es.ts" || die "dict markets es sin depositDest (Task 88)"
grep -q "auth.field.confirmPassword" "$STAGE/src/lib/i18n/dict/auth/es.ts" || die "dict auth es sin confirmPassword (Task 89)"
grep -q "landing.downloads.newest" "$STAGE/src/lib/i18n/dict/landing/es.ts" || die "dict landing es sin downloads (Task 90)"
grep -q "DownloadsPanel" "$STAGE/src/components/landing/index.tsx" || die "landing sin DownloadsPanel (Task 90)"
grep -q '"attachment"' "$STAGE/next.config.ts" || die "next.config sin Content-Disposition attachment (Task 90)"
grep -q '^\.env' "$STAGE/.gitignore" || die ".gitignore del stage sin regla .env (KFM-OPS-021)"
grep -q "WIDGET_REGISTRY" "$STAGE/src/components/game/dashboard/widget-registry.tsx" || die "sin registro de widgets (Task 91)"
grep -q "SortableContext" "$STAGE/src/components/game/dashboard/widgets-grid.tsx" || die "grid sin dnd-kit (Task 91)"
grep -q "CommandDialog" "$STAGE/src/components/game/command-palette.tsx" || die "sin paleta de comandos (Task 91)"
grep -q "DashboardLayout" "$STAGE/prisma/schema.prisma" || die "schema sin DashboardLayout (Task 91)"
grep -q "game.palette.placeholder" "$STAGE/src/lib/i18n/dict/game/es.ts" || die "dict game sin paleta (Task 91)"
# Probes KFM-OPS-022/023 (continuidad Windows + Master Prompt Unificado, Task 94)
grep -q "eol=crlf" "$STAGE/.gitattributes" || die ".gitattributes sin regla CRLF para scripts Windows"
grep -q "prisma generate" "$STAGE/DEPLOY_WINDOWS.ps1" || die "DEPLOY_WINDOWS.ps1 sin prisma generate"
grep -q "OpenJS.NodeJS.LTS" "$STAGE/DEPLOY_WINDOWS.ps1" || die "DEPLOY_WINDOWS.ps1 sin ayuda de instalacion de Node"
grep -q "file:" "$STAGE/DEPLOY_WINDOWS.ps1" || die "DEPLOY_WINDOWS.ps1 sin aviso SQLite-PostgreSQL (Task 94)"
grep -q "neon.tech" "$STAGE/WINDOWS_SETUP.md" || die "WINDOWS_SETUP.md sin ruta de base de datos"
grep -q "NUEVO EN v9" "$STAGE/LEEME-SINCRONIZACION-COMPLETA.txt" || die "LEEME sin seccion v9"
# Probes KMIE 2.0 (Task 100: clima + terreno + volatilidad + estilos + felicidad)
grep -q "deriveConditions" "$STAGE/src/lib/engine/matches.ts" || die "matches.ts sin deriveConditions (Task 100)"
grep -q "matches.weatherEnabled" "$STAGE/src/lib/config.ts" || die "config sin matches.weatherEnabled (Task 100)"
grep -q "tactics.style.in.label" "$STAGE/src/lib/i18n/dict/tactics/es.ts" || die "dict tactics sin estilos (Task 100)"
grep -q "game.match.conditions" "$STAGE/src/lib/i18n/dict/game/es.ts" || die "dict game sin condiciones (Task 100)"
grep -q "inPossession" "$STAGE/src/app/api/tactics/route.ts" || die "tactics API sin estilos (Task 100)"
grep -q "medicalInjuryMul" "$STAGE/src/lib/engine/conditions.ts" || die "conditions sin ciencia deportiva (Task 100)"
# Probes TRAMA (Task 101: spec Parte 3)
grep -q "runTramaMatch" "$STAGE/src/lib/engine/matches.ts" || die "matches.ts sin TRAMA (Task 101)"
grep -q "trama.enabled" "$STAGE/src/lib/config.ts" || die "config sin trama.enabled (Task 101)"
grep -q "calibrate-trama" "$STAGE/scripts/calibrate-trama.ts" || die "falta calibrador TRAMA (3.13)"
grep -q "TRAMA:W:" "$STAGE/src/lib/engine/trama.ts" || die "trama sin streams de semilla (Task 101)"
# package.json dentro del zip: versiones candado
unzip -p "$TMPZIP" package.json > /tmp/kfm-pkg.json
node -e '
const d = JSON.parse(require("fs").readFileSync("/tmp/kfm-pkg.json", "utf8"));
const deps = Object.keys(d.dependencies || {}).length;
const bad = [];
if (d.next !== undefined) bad.push("next fuera de dependencies");
if ((d.dependencies||{}).next !== "16.4.0") bad.push("next != 16.4.0 exacto (ADR-001)");
if ((d.dependencies||{})["flag-icons"] !== "7.5.0") bad.push("flag-icons != 7.5.0 exacto");
if ((d.dependencies||{})["remark-gfm"] !== "4.0.1") bad.push("remark-gfm != 4.0.1");
if ((d.dependencies||{})["qrcode.react"] !== "4.2.0") bad.push("qrcode.react != 4.2.0 exacto");
if (!(d.dependencies||{}).bs58) bad.push("falta bs58");
if (d.scripts?.dev !== "next dev -p 3000") bad.push("dev != next dev -p 3000 (Windows-safe)");
if (d.scripts?.build !== "next build") bad.push("build != next build (Vercel-ready)");
if (d.scripts?.postinstall !== "prisma generate") bad.push("postinstall != prisma generate (Vercel-ready)");
if (deps < 70) bad.push("dependencias=" + deps + " (<70)");
if (bad.length) { console.error("package.json del zip: " + bad.join("; ")); process.exit(1); }
console.log(`package.json OK — ${deps} deps, next 16.4.0 exacto (ADR-001), flag-icons, remark-gfm, qrcode.react, dev Windows-safe`);
'
# Schema dentro del zip = postgresql
unzip -p "$TMPZIP" prisma/schema.prisma | grep -q 'provider = "postgresql"' || die "schema.prisma dentro del zip no es postgresql"
# Negativos
if unzip -l "$TMPZIP" | grep -qE " (\.env)$|/\.env$"; then die "el zip contiene .env REAL — prohibido"; fi
if unzip -l "$TMPZIP" | grep -q "withdraw-executor"; then die "el zip contiene withdraw-executor.ts (excluido a propósito)"; fi
if unzip -l "$TMPZIP" | grep -q "public/downloads/"; then die "el zip contiene public/downloads (recursión prohibida)"; fi
# KFM-OPS-016: cierre de imports internos "@/…"
node -e '
const fs = require("fs"), path = require("path");
const stage = process.argv[1];
const exts = ["", ".ts", ".tsx", ".js", ".mjs", ".json", ".css", "/index.ts", "/index.tsx"];
let files = [];
(function walk(d){ for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
}})(path.join(stage, "src"));
const resolveAt = (spec) => {
  const base = path.join(stage, "src", spec.replace(/^@\//, ""));
  for (const ext of exts) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return true;
  return false;
};
let checked = 0; const broken = [];
const re = /(?:from\s+|import\(|require\()\s*["'"'"'](@\/[^"'"'"']+)["'"'"']/g;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8"); let m;
  while ((m = re.exec(src))) {
    checked++;
    const spec = m[1].split("?")[0];
    if (!resolveAt(spec)) broken.push(path.relative(stage, f) + " -> " + spec);
  }
}
if (broken.length) { console.error(broken.slice(0, 10).join("\n")); process.exit(1); }
console.log(`KFM-OPS-016 cierre de imports internos OK — ${files.length} ts/tsx, ${checked} imports @/, 0 rotos`);
' "$STAGE"

# ── 6/7 Publicando y verificando servible HTTP ────────────────────
log "6/7 Publicando y verificando servible HTTP"
mkdir -p public/downloads
mv "$TMPZIP" "$ZIP_PATH"
SIZE=$(stat -c%s "$ZIP_PATH")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/downloads/$ZIP_NAME" || echo 000)
[ "$HTTP" = "200" ] || die "el zip publicado no responde HTTP 200 (got $HTTP)"
FIRST=$(curl -s "http://localhost:3000/api/downloads" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.data?.files?.[0]?.name||"")}catch{console.log("")}})')
[ "$FIRST" = "$ZIP_NAME" ] || die "/api/downloads no lista el zip canónico primero (got '$FIRST')"
log "Servible HTTP 200 · /api/downloads primero= $FIRST"

# ── 6b/7 KFM-OPS-023: copia fechada knightfm_updated_* ────────────
# El Master Prompt Unificado exige un entregable fechado; es byte a byte el
# mismo contenido que el canónico (mismo mecanismo, mismo manifiesto).
log "6b/7 Copia fechada de entrega (Master Prompt Unificado)"
rm -f public/downloads/knightfm_updated_*_UTC_*.zip
cp "$ZIP_PATH" "public/downloads/$UPDATED_NAME"
log "Copia fechada publicada: $UPDATED_NAME"

# ── 7/7 RESUMEN ───────────────────────────────────────────────────
log "7/7 RESUMEN"
NFIRSTZIP=$(unzip -Z1 "$ZIP_PATH" | wc -l)
echo "  Paquete   : $ZIP_PATH"
echo "  Fechado   : public/downloads/$UPDATED_NAME (mismo contenido)"
echo "  Archivos  : $NFIRSTZIP (incl. MANIFIESTO + verificador)"
echo "  Tamaño    : $SIZE bytes"
echo "  Mecanismo : mismo nombre SIEMPRE + MANIFIESTO + VERIFICAR-INSTALACION.bat"
echo "  Próximo uso tras cualquier cambio:  bash scripts/build-full-delivery.sh"
