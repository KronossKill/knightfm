# ============================================================
# KNIGHT FM - DESPLIEGUE EN WINDOWS (PowerShell 5.1+ / 7+)
# ============================================================
# KFM-OPS-020: este archivo es 100% ASCII A PROPOSITO.
# NO anadir acentos, enes ni rayas largas aqui NUNCA
# (Windows PowerShell 5.1 lee los .ps1 sin BOM como ANSI y los
#  bytes UTF-8 de acentos y rayas rompen el script - fallo real
#  del verificador en v5/v6, corregido en v7 / Task 92).
#
# QUE HACE (equivale a los PASOS 5-7 del LEEME, de un solo clic):
#   1) Comprueba Node.js (se necesita 20 o mas)
#   2) npm install
#   3) npx prisma generate
#   4) Crea tu .env desde .env.example si todavia no existe
#   5) Si detecta PostgreSQL local (puerto 5432) crea las tablas
#   6) Arranca el servidor y abre http://localhost:3000
#
# COMO USARLO: doble clic en DEPLOY_WINDOWS.bat
# (o en PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\DEPLOY_WINDOWS.ps1 )
# ============================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

function Step([string]$m) { Write-Host ""; Write-Host "==> $m" -ForegroundColor Cyan }
function Ok([string]$m)   { Write-Host "    OK: $m" -ForegroundColor Green }
function Warn([string]$m) { Write-Host "    AVISO: $m" -ForegroundColor Yellow }

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host " KNIGHT FM - DESPLIEGUE EN WINDOWS" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# --- 1/6 Node.js ---------------------------------------------------------
Step "1/6 Comprobando Node.js"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Warn "Node.js NO esta instalado en este equipo."
  Write-Host ""
  Write-Host "    INSTALALO ASI (copia y pega en esta misma ventana):" -ForegroundColor Yellow
  Write-Host "        winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "    Despues CIERRA esta ventana, abre una nueva y vuelve a hacer"
  Write-Host "    doble clic en DEPLOY_WINDOWS.bat"
  exit 1
}
$ver = (& node --version).Trim()
$maj = [int]($ver.TrimStart("v").Split(".")[0])
if ($maj -lt 20) {
  Warn "Node.js $ver es demasiado antiguo para Knight FM (se necesita 20 o mas)."
  Write-Host "    Actualiza con:  winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
  exit 1
}
Ok "Node.js $ver"

# --- 2/6 dependencias ----------------------------------------------------
Step "2/6 Instalando dependencias (npm install - puede tardar varios minutos)"
& npm install
if ($LASTEXITCODE -ne 0) {
  Warn "npm install fallo. Revisa el mensaje de arriba."
  Write-Host "    Si el error habla de la cache o de permisos, prueba:" -ForegroundColor Yellow
  Write-Host "        npm cache clean --force" -ForegroundColor Yellow
  Write-Host "    y vuelve a ejecutar este script."
  exit 1
}
Ok "dependencias instaladas"

# --- 3/6 cliente Prisma --------------------------------------------------
Step "3/6 Generando el cliente de Prisma"
& npx prisma generate
if ($LASTEXITCODE -ne 0) {
  Warn "prisma generate fallo (revisa el mensaje de arriba)."
  exit 1
}
Ok "cliente Prisma generado"

# --- 4/6 .env ------------------------------------------------------------
Step "4/6 Preparando tu archivo .env"
if (Test-Path -LiteralPath ".env") {
  Ok ".env ya existe - no se toca (tus claves estan a salvo)"
  $envContent = Get-Content -LiteralPath ".env" -Raw -ErrorAction SilentlyContinue
  if ($envContent -and $envContent -match "DATABASE_URL\s*=\s*file:") {
    Warn "tu .env apunta a SQLite (file:) y esta version usa PostgreSQL."
    Write-Host "    Tu base de datos vieja NO se borra (sigue en db/custom.db)." -ForegroundColor Yellow
    Write-Host "    El sitio arranca igual; para jugar con datos elige UNA opcion" -ForegroundColor Yellow
    Write-Host "    (detalle en WINDOWS_SETUP.md seccion 4):" -ForegroundColor Yellow
    Write-Host "      a) Renombra .env a .env.sqlite-backup y vuelve a ejecutar" -ForegroundColor Yellow
    Write-Host "         este script: creara un .env nuevo desde .env.example." -ForegroundColor Yellow
    Write-Host "      b) Edita .env y pon en DATABASE_URL una cadena postgresql://" -ForegroundColor Yellow
    Write-Host "         (gratis en neon.tech - WINDOWS_SETUP.md seccion 4, Opcion A)." -ForegroundColor Yellow
  }
} else {
  Copy-Item -LiteralPath ".env.example" -Destination ".env"
  Ok ".env creado desde la plantilla .env.example"
  Write-Host "    Para PROBAR el sitio en local NO hace falta tocar nada mas."
  Write-Host "    Para PRODUCCION edita .env con tus datos reales y NUNCA lo"
  Write-Host "    subas a GitHub (el .gitignore ya lo excluye por ti)."
}

# --- 5/6 base de datos ---------------------------------------------------
Step "5/6 Comprobando base de datos local (PostgreSQL puerto 5432)"
$pg = $false
try {
  $pg = (Test-NetConnection -ComputerName "localhost" -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue)
} catch { $pg = $false }
if ($pg) {
  Write-Host "    PostgreSQL detectado en localhost:5432. Creando tablas..."
  & npx prisma db push
  if ($LASTEXITCODE -eq 0) {
    Ok "tablas listas en PostgreSQL local"
  } else {
    Warn "prisma db push fallo - lee WINDOWS_SETUP.md (seccion Base de datos)"
  }
} else {
  Write-Host "    No hay PostgreSQL local en el puerto 5432 (es NORMAL si no lo"
  Write-Host "    has instalado). El servidor ARRANCA igual: el sitio se ve"
  Write-Host "    completo y las paginas que piden datos avisaran solas."
  Write-Host "    Opciones gratuitas cuando las necesites (WINDOWS_SETUP.md):"
  Write-Host "      - neon.tech  (PostgreSQL gratis en la nube, 2 minutos)"
  Write-Host "      - winget install PostgreSQL.PostgreSQL.16  (PostgreSQL local)"
}

# --- 6/6 arrancar --------------------------------------------------------
Step "6/6 Arrancando Knight FM"
Write-Host ""
Write-Host "    DEBES VER en unos segundos:" -ForegroundColor Green
Write-Host "        Ready - Local: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "    Abrimos tu navegador automaticamente. Para DETENER el servidor"
Write-Host "    pulsa Ctrl+C en esta ventana."
Write-Host ""
Start-Job -ScriptBlock { Start-Sleep -Seconds 12; Start-Process "http://localhost:3000" } | Out-Null
& npm run dev
