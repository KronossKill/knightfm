# 06 — INTEGRITY REPORT (Fase 6, Task 94)

**Objeto verificado:** zip v9.0.0 (canónico + copia fechada, mismo contenido).
**Fecha:** 2026-10-11 · **Método:** réplica 1:1 del algoritmo del verificador
sobre el zip extraído + auditorías del builder + navegador.

## Verificación estructural — ✅ TODO VERDE
- ✅ zip == stage (diff de rutas del builder, sin entradas de directorio fantasma)
- ✅ `unzip -t` íntegro (builder paso 5)
- ✅ **RÉPLICA DEL VERIFICADOR sobre el zip extraído:
  `CORRECTOS: 448 · FALTAN: 0 · TAMANO DISTINTO: 0 · EXTRA: 0`**
  (con archivos propios injectados daría EXTRA exactos; src/ sin falsos positivos)
- ✅ Ruta más larga: **58 caracteres** (`src/components/game/control-center/control-center-view.tsx`) — muy por debajo del límite de 260 de Windows

## Verificación Windows (KFM-OPS-020/023) — ✅
- ✅ 0 bytes no-ASCII en TODOS los scripts Windows del zip:
  VERIFICAR-INSTALACION.ps1/.bat, DEPLOY_WINDOWS.ps1/.bat, MANIFIESTO (byte a byte)
- ✅ CRLF presente in-zip en los 4 scripts (ps1 61 pares · bat 5/16 · deploy 134/16)
- ✅ Probes del verificador: `-Encoding UTF8`, normalización de separadores,
  cadenas ASCII (TAMANO DISTINTO / EXTRA - NO molestan)

## Verificación de contenido — ✅
- ✅ 25 guards de rutas críticas + 15 probes de contenido (Task 88/89/90/91/94)
- ✅ KFM-OPS-016: cierre de imports internos — 318 ts/tsx, 1092 imports @/, **0 rotos**
- ✅ package.json in-zip: next **16.4.0 exacto** (ADR-001), 73 deps,
  dev `next dev -p 3000` / build `next build` / postinstall `prisma generate`
- ✅ schema.prisma in-zip = postgresql (+ DashboardLayout)
- ✅ Negativos: sin `.env`, sin withdraw-executor.ts, sin public/downloads (recursión)

## Verificación funcional — ✅
- ✅ `bun run lint` verde (react-hooks/set-state-in-effect = warn con plan, 0 errores)
- ✅ Dev server: Next.js **16.4.0 (Turbopack)** Ready en 307 ms · GET / 200 ·
  /api/downloads 200 (dev.log sin errores)
- ✅ HTTP 200 + `Content-Disposition: attachment` en canonical y fechado (curl)
- ✅ Navegador: landing renderiza, panel de descargas con el fechado como
  «MÁS RECIENTE», 0 errores de consola/página

## Entradas verificadas
- ✅ Zip usuario SHA-256 `ff5fc849ac0a8c64a28bcd6b1d98409a2f59438e4fe276d387593d9acc39a7f7`
- ✅ Backup phase0 SHA-256 `ff63590a918a8f4ffdc46dab8b3fc6804283e839120b47d981504d12fc8b83cc` = sidecar coincide

**Veredicto: la entrega v9.0.0 es íntegra, Windows-safe y funcional.**
(SHA-256 del zip final: publicado en el chat junto al enlace de descarga —
un zip no puede contener su propio hash.)
