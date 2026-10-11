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
