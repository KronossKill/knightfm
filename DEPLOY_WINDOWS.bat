@echo off
title Knight FM - Despliegue en Windows
echo =====================================================
echo  KNIGHT FM - DESPLIEGUE EN WINDOWS
echo  (este boton ejecuta DEPLOY_WINDOWS.ps1 paso a paso:
echo   npm install + prisma generate + arrancar el juego)
echo =====================================================
where powershell >nul 2>nul
if errorlevel 1 (
  echo ERROR: PowerShell no esta disponible en este equipo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0DEPLOY_WINDOWS.ps1"
echo.
pause
