# 01 — INVENTARIO INICIAL (Fase 1, Task 94)

**Fecha (UTC):** 2026-10-11 · **Ventana de referencia:** últimos 5 días naturales
(2026-10-07 → 2026-10-11). El snapshot recibido es del 3-oct, por lo que se le
aplica el SUPERSET completo de cambios desde esa fecha (sin pérdida de nada).

## 1. Entrada recibida

| Propiedad | Valor |
|---|---|
| Archivo | `upload/knight-fm-proyecto-completo (1).zip` |
| SHA-256 | `ff5fc849ac0a8c64a28bcd6b1d98409a2f59438e4fe276d387593d9acc39a7f7` |
| Tamaño | 16.140.948 B (15,4 MB) |
| Entradas del zip | 605 (431 archivos reales tras extraer) |
| Sin comprimir | 45,4 MB (incluye `db/custom.db` = 33,7 MB) |
| Fecha del snapshot | 2026-10-03 (mtimes internos) |
| Idéntico a | `knight-fm-proyecto-completo (11).zip` del 4-oct (mismo tamaño) — re-subida del mismo snapshot local |

## 2. Stack del snapshot recibido

| Componente | Valor |
|---|---|
| package.json | name `nextjs_tailwind_shadcn_ts`, version **0.2.1** |
| Next.js | `^16.1.1` (**flotante**, sin anclar) |
| Dependencias | 70 deps + 10 devDeps |
| Script dev | `next dev -p 3000 2>&1 \| tee dev.log` (**NO Windows-safe**: `tee` no existe en CMD) |
| Prisma | solo `schema.prisma` con `provider = "sqlite"` (sin schema.production) |
| React | `^19.0.0` flotante |

## 3. Ausencias detectadas (vs entrega canónica vigente)

- Sin `.env.example`, sin `.npmrc`, sin `public/robots.txt`, sin `prisma/schema.production.prisma`.
- Sin `.gitignore` seguro para GitHub (tenía uno propio antiguo).
- Sin `MANIFIESTO-COMPLETO.txt` ni `VERIFICAR-INSTALACION.bat/.ps1`.
- Sin `docs/ui/` (sistema de diseño), sin `docs/reports/`, sin docs Windows.
- Funciones NO presentes (sondeos `rg` sobre su `src/`):
  `reg-confirm-password` = 0 · `DownloadsPanel` = 0 · `QRCodeSVG` = 0 ·
  `WIDGET_REGISTRY` = 0 · `useCommandPaletteHotkey` = 0 · `dnd-kit` = 0 ·
  `country-flag` = 0.
  Sí presentes: `TURNSTILE_` = 2 (captcha base), `depositAddress` = 2 (endpoint
  básico de depósito, sin bloque de billetera del sistema/QR).

## 4. Datos locales del usuario (no viajan, se preservan)

| Dato | Tamaño | Tratamiento |
|---|---|---|
| `.env` (solo `DATABASE_URL=file:...`) | 50 B | NO se empaqueta (prohibido por KFM-OPS); queda en su disco y DENTRO de su zip original |
| `db/custom.db` (partida SQLite) | 33.714.176 B | NO se empaqueta (peso + divergencia postgres documentada); queda en su disco y en su zip original |
| `upload/` (2,2 MB de imágenes pegadas) | 2,2 MB | No viaja (no es contenido del proyecto); queda en su disco |
| `t16-*.png` raíz, `Knight_FM_...docx` raíz, `worklog.md`, `examples/` | — | No viajan (no entregables); quedan en su disco |

## 5. Fuente de actualización (inputs de la operación)

- **Mandato:** Master Prompt Unificado (archivado en
  `docs/archive/MASTER_PROMPT_UNIFICADO_FUENTE.txt`) — «aplicar los últimos
  5 días de actualizaciones y devolver UN zip completo actualizado».
- **Bitácora autorizada:** `worklog.md` Tasks 88→94 y `INVENTARIO_MAESTRO.md`
  filas KFM-OPS-015…023.
- **Historial git:** commits 2026-10-10/11 (captcha+brevo, banderas de país,
  entrenamiento sostenible, fix captcha lockout, entrega v5→v8, continuidad v9).
- **Master Specification:** materializada en `INVENTARIO_MAESTRO.md` + docs/ui
  (invariantes: Next anclado, entrega PostgreSQL, scripts Windows ASCII).

**Veredicto Fase 1:** entrada íntegra (SHA-256 coincide con la subida), extraída
y clasificada sin errores. Todas las entradas requeridas disponibles → se
continúa 2→7 de forma autónoma (sin paradas por decisión de usuario: los
conflictos se resuelven con invariantes ya documentadas del proyecto — ver 03).
