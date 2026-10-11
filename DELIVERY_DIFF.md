# Knight FM — DELIVERY DIFF (tu snapshot 3-oct → v9.0.0)

**Método:** comparación real archivo por archivo (431 de tu zip vs 452 de la
entrega v9) usando tamaños exactos del MANIFIESTO-COMPLETO.txt del zip final.
Generado al cierre de la operación Task 94.

## Resumen

| Categoría | Archivos | Qué significa |
|---|---|---|
| **Sin cambios** | **336** | idénticos en tu copia y en v9 (mismo tamaño) |
| **Actualizados** | **54** | el corazón de los 5 días de trabajo (ver lista) |
| **Nuevos en v9** | **62** | funciones y docs que tu copia no tiene |
| **Se quedan en tu disco** | **41** | tuyos, no viajan (`.env`, `db/custom.db`, capturas…) — **0 borrados** |
| **Eliminados de tu proyecto** | **0** | nada tuyo se pierde ni se archiva fuera: upgrade limpio |

## Los 54 ACTUALIZADOS (resumen por área)

- **Auth/captcha:** `AuthFlow.tsx` (26,5→32,6 KB: contraseña ×2 + ojo),
  `captcha.ts`, `login/register/_shared`, `lib/auth.ts`.
- **Cartera/tesorería:** `wallet-view.tsx` (21,8→25,2 KB: QR + sistema),
  `api/wallet`, `api/wallet/withdraw`, `api/treasury/withdraw`.
- **Navegación/dashboard:** `shell.tsx` (32,3→43,4 KB: paleta, fijadas,
  Ctrl+1..9, barra móvil, 4K), `dashboard-view.tsx` (reconstruido como hub),
  `markets/types.ts`, `api/me/dashboard`.
- **Motor de juego:** `engine/training.ts` (entrenamiento sostenible),
  `instrumentation.ts`, `presence/*` (banderas de país), `admin/ip-audit`,
  `admin/reset`, `security/ip-guard.ts`, `vpn.ts`.
- **i18n ×4 idiomas:** auth, game, landing, markets, admincfg (16 archivos).
- **Infra:** `package.json` (83 dependencias), `bun.lock`, `schema.prisma`
  (postgres + DashboardLayout), `next.config.ts` (attachment), `.gitignore`
  (GitHub-safe), `eslint.config.mjs`, `landing/index.tsx`, `api.ts`,
  `club-context.tsx`, `layout.tsx`, `config.ts`.

## Los 62 NUEVOS (resumen)

- **Windows de un clic:** `DEPLOY_WINDOWS.bat/.ps1`, `WINDOWS_SETUP.md`,
  `TROUBLESHOOTING_WINDOWS.md`, `.gitattributes`.
- **Anti-pérdida:** `MANIFIESTO-COMPLETO.txt`, `VERIFICAR-INSTALACION.bat/.ps1`,
  `LEEME-SINCRONIZACION-COMPLETA.txt` v9.
- **Informes y gobernanza:** `docs/reports/01-07`, `CHANGELOG.md`,
  `BACKUP_LOG.md`, `BACKUP_MANIFEST.json`, `STATE.md`, `DELIVERY_REPORT.md`,
  `CHANGELOG_UPDATE.md`, `DEPENDENCY_REPORT.md`, `INTEGRITY_REPORT.md`,
  `docs/decisions/ADR-001-next-pinned.md`, `docs/archive/MASTER_PROMPT_*`.
- **Sistema de diseño (Task 91):** `docs/ui/` ×11 + tokens ×6,
  `widget-registry.tsx`, `widgets-grid.tsx`, `command-palette.tsx`,
  `api/me/dashboard/route.ts`, `theme-tokens.ts`.
- **Otras funciones:** `downloads-panel.tsx`, `api/downloads`,
  `country-flag.tsx`, `geo.ts`, `api/auth/captcha-config`,
  `schema.production.prisma`, `.env.example`, `.npmrc`, `robots.txt`,
  `scripts/` (builder + task94-backup + gen-production-schema + e2e).

## Se quedan en TU disco (41, intactos)

`.env` (50 B, tus claves) · `db/custom.db` (33,7 MB, tu partida SQLite) ·
`upload/` (17 capturas/docs) · `t16-*.png` ×4 · `examples/` · `Caddyfile` ·
`worklog.md` · `Knight_FM_...docx` · `public/downloads/` (zips viejos) ·
`.zscripts/` · `next-env.d.ts`. Tu zip original TAMBIÉN los contiene
(`ff5fc849…`) — doble red de seguridad.
