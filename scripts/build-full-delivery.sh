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
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

ZIP_NAME="knightfm-sincronizacion-completa.zip"
ZIP_PATH="public/downloads/$ZIP_NAME"
STAGE="$(mktemp -d /tmp/kfm-stage-XXXXXX)"
LEEME_SRC="public/downloads/LEEME-SINCRONIZACION-COMPLETA.txt"
TMPDIR_ZIP="$(mktemp -d /tmp/kfm-zip-XXXXXX)"
TMPZIP="$TMPDIR_ZIP/$ZIP_NAME"   # el .zip NO debe preexistir: este zip rechaza destinos vacíos

log() { printf "\n\033[1;32m[KFM-OPS-015]\033[0m %s\n" "$*"; }
die() { printf "\n\033[1;31m[KFM-OPS-015] ABORT: %s\033[0m\n" "$*" >&2; exit 1; }

[ -f "$LEEME_SRC" ] || die "no existe $LEEME_SRC (crea el LEEME v7 antes de empaquetar)"

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
for f in package.json bun.lock .npmrc .env.example next.config.ts tsconfig.json \
         postcss.config.mjs tailwind.config.ts eslint.config.mjs components.json \
         vercel.json; do
  [ -f "$f" ] && cp "$f" "$STAGE/" || true
done
[ -f "$STAGE/package.json" ] || die "package.json no quedó en el stage"
# Prisma de ENTREGA = variante POSTGRESQL (divergencia formalizada Task 76/87)
[ -f "$STAGE/prisma/schema.production.prisma" ] || die "falta prisma/schema.production.prisma (ejecuta scripts/gen-production-schema.mjs)"
cp "$STAGE/prisma/schema.production.prisma" "$STAGE/prisma/schema.prisma"
grep -q 'provider = "postgresql"' "$STAGE/prisma/schema.prisma" || die "schema.prisma del stage no es postgresql"
grep -q 'provider = "sqlite"' prisma/schema.prisma || true   # el sandbox sigue en sqlite (solo aviso si no)
# package.json del stage = Windows-safe (sin tee; divergencia KFM-OPS-011)
node -e '
const fs = require("fs");
const p = process.argv[1] + "/package.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
j.scripts.dev = "next dev -p 3000";
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
' "$STAGE"
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
log "Auditoría KFM-OPS-020: ASCII puro en .ps1/.bat/MANIFIESTO"
for f in VERIFICAR-INSTALACION.ps1 VERIFICAR-INSTALACION.bat MANIFIESTO-COMPLETO.txt; do
  NONASCII=$(LC_ALL=C tr -d '\11\12\15\40-\176' < "$STAGE/$f" | wc -c)
  if [ "$NONASCII" -ne 0 ]; then
    LC_ALL=C grep -n '[^[:print:]]' "$STAGE/$f" | head -3 || true
    die "$f tiene $NONASCII byte(s) NO-ASCII (rompe PowerShell 5.1)"
  fi
done
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
VERIFICAR-INSTALACION.bat
VERIFICAR-INSTALACION.ps1
MANIFIESTO-COMPLETO.txt
LEEME-SINCRONIZACION-COMPLETA.txt
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
grep -q "WIDGET_REGISTRY" "$STAGE/src/components/game/dashboard/widget-registry.tsx" || die "sin registro de widgets (Task 91)"
grep -q "SortableContext" "$STAGE/src/components/game/dashboard/widgets-grid.tsx" || die "grid sin dnd-kit (Task 91)"
grep -q "CommandDialog" "$STAGE/src/components/game/command-palette.tsx" || die "sin paleta de comandos (Task 91)"
grep -q "DashboardLayout" "$STAGE/prisma/schema.prisma" || die "schema sin DashboardLayout (Task 91)"
grep -q "game.palette.placeholder" "$STAGE/src/lib/i18n/dict/game/es.ts" || die "dict game sin paleta (Task 91)"
# package.json dentro del zip: versiones candado
unzip -p "$TMPZIP" package.json > /tmp/kfm-pkg.json
node -e '
const d = JSON.parse(require("fs").readFileSync("/tmp/kfm-pkg.json", "utf8"));
const deps = Object.keys(d.dependencies || {}).length;
const bad = [];
if (d.next !== undefined) bad.push("next fuera de dependencies");
if ((d.dependencies||{}).next !== "16.1.3") bad.push("next != 16.1.3 exacto");
if ((d.dependencies||{})["flag-icons"] !== "^7.5.0") bad.push("flag-icons != ^7.5.0");
if ((d.dependencies||{})["remark-gfm"] !== "4.0.1") bad.push("remark-gfm != 4.0.1");
if ((d.dependencies||{})["qrcode.react"] !== "^4.2.0") bad.push("qrcode.react != ^4.2.0");
if (!(d.dependencies||{}).bs58) bad.push("falta bs58");
if (d.scripts?.dev !== "next dev -p 3000") bad.push("dev != next dev -p 3000 (Windows-safe)");
if (deps < 70) bad.push("dependencias=" + deps + " (<70)");
if (bad.length) { console.error("package.json del zip: " + bad.join("; ")); process.exit(1); }
console.log(`package.json OK — ${deps} deps, next 16.1.3 exacto, flag-icons, remark-gfm, qrcode.react, dev Windows-safe`);
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

# ── 7/7 RESUMEN ───────────────────────────────────────────────────
log "7/7 RESUMEN"
NFIRSTZIP=$(unzip -Z1 "$ZIP_PATH" | wc -l)
echo "  Paquete   : $ZIP_PATH"
echo "  Archivos  : $NFIRSTZIP (incl. MANIFIESTO + verificador)"
echo "  Tamaño    : $SIZE bytes"
echo "  Mecanismo : mismo nombre SIEMPRE + MANIFIESTO + VERIFICAR-INSTALACION.bat"
echo "  Próximo uso tras cualquier cambio:  bash scripts/build-full-delivery.sh"
