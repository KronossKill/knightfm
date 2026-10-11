# 03 — UPDATE ANALYSIS (Fase 3, Task 94)

**Fuente analizada:** diff completo `snapshot usuario (3-oct)` ↔ `estado v9.0.0`
+ bitácora worklog Tasks 88→94 + INVENTARIO KFM-OPS-015…023 + git log 10/11-oct.

## 1. Categorización de los cambios aplicados

### added (funciones nuevas que TU copia no tiene)
| Cambio | Tarea | Riesgo |
|---|---|---|
| Registro: contraseña ×2 + mostrar/ocultar (4 idiomas) | 89 / KFM-OPS-017 | bajo |
| Cartera: billetera del sistema + QR + copiar + 11 checks server-side | 88 / KFM-OPS-016 | bajo |
| Descarga forzada del zip (3 capas) + panel en la landing + /api/downloads | 90 / KFM-OPS-018 | bajo |
| Dashboard de widgets (12, por rol, presets server-side, dnd-kit teclado) | 91 / KFM-OPS-019 | medio — verificado E2E |
| Paleta Ctrl+K + Ctrl+1..9 + sidebar fijadas + barra inferior móvil + 4K | 91 | medio — verificado E2E |
| 5 temas + tokens exportados + docs/ui ×11 | 91 | bajo |
| Verificador Windows 100% ASCII (arranca en PS 5.1) | 92 / KFM-OPS-020 | bajo |
| .gitignore seguro + postinstall prisma generate (GitHub/Vercel-ready) | 93 / KFM-OPS-021 | bajo |
| DEPLOY_WINDOWS.ps1/.bat + WINDOWS_SETUP + TROUBLESHOOTING + .gitattributes | 94 / KFM-OPS-022 | bajo |
| Captcha auto-sincronizado (fin del lockout), banderas de país, entrenamiento sostenible, fixes seguridad | 10-oct | medio — verificado E2E |

### modified
- `AuthFlow.tsx` (+189 l), `wallet-view.tsx` (+86), `shell.tsx` (+394),
  `dashboard-view.tsx` (reconstruido como hub de widgets), `package.json`
  (83 declaraciones), `next.config.ts` (headers attachment), i18n ×4 idiomas
  (auth/landing/markets/game), `eslint.config.mjs`, `.gitignore`.

### config
- `.env.example` (18 vars documentadas), `.npmrc`, `robots.txt`, `vercel.json`,
  `.gitattributes` (eol), `.gitignore` endurecido.

### dependency
- **40 minor + 22 patch + 21 anclajes** aplicados (next 16.4.0 incluido);
  **0 majors** aplicados; 14 majors disponibles APLAZADAS con plan.
  Detalle: `05_DEPENDENCY_REPORT.md`.

### migration / schema
- `prisma/schema.prisma` del snapshot (sqlite) → entrega **postgresql**
  + `schema.production.prisma` generado. Divergencia FORMALIZADA del proyecto
  (Task 76/87): sandbox=sqlite, entrega=postgresql. No se «corrige»: se documenta.
  El usuario necesita PostgreSQL (neon.tech gratis) para datos; sin DB el sitio
  arranca y las pantallas de juego avisan honestamente.

### docs
- docs/reports/01-07, WINDOWS_SETUP.md, TROUBLESHOOTING_WINDOWS.md,
  CHANGELOG.md, BACKUP_LOG.md, STATE.md, ADR-001, DELIVERY_*,
  docs/archive/MASTER_PROMPT_UNIFICADO_FUENTE.txt.

### windows-specific
- Script `dev` sin `tee` (Windows-safe), scripts `.ps1/.bat` 100% ASCII + CRLF,
  guía PowerShell 5.1, rutas largas, ExecutionPolicy, puerto 3000.

### removed
- **Ningún archivo del usuario se elimina.** Los archivos que la entrega ya no
  usa (p. ej. `public/downloads` de su copia, `upload/` local, `db/custom.db`,
  `.env` viejo) simplemente NO viajan: quedan intactos en su disco y se listan
  en el DELIVERY_DIFF como «se mantiene en tu disco».

## 2. Conflictos y resolución (regla: preferir entrante/existente/merge/escalar)

| Conflicto | Resolución | Justificación |
|---|---|---|
| schema sqlite (tuyo) vs postgresql (entrega) | **entrante (postgresql)** | divergencia formalizada Task 76/87; el juego en producción corre en postgres |
| `dev` con `tee` (tuyo) vs Windows-safe | **entrante** | `tee` no existe en CMD; Windows-safe ya validado |
| next `^16.1.1` flotante (tuyo) vs 16.4.0 exacto | **entrante + ADR-001** | latest estable minor; ancla = reproducibilidad |
| tu `.gitignore` antiguo vs el seguro | **merge → entra el seguro** | protege tu `.env`/node_modules en GitHub |
| majors disponibles (14) | **aplazadas** | «latest stable» ≠ meter 14 majors de golpe en una entrega; plan una-por-ciclo con E2E |

**No se requiere decisión del usuario** → no hay STOP; se continúa 4→7
autónomamente (todas las resoluciones siguen invariantes ya publicadas del
proyecto en INVENTARIO_MAESTRO.md).

## 3. Riesgos residuales y mitigación

| Riesgo | Mitigación |
|---|---|
| `.env` viejo con `DATABASE_URL=file:` tras actualizar | aviso integrado en DEPLOY_WINDOWS.ps1 + WINDOWS_SETUP §4 + TROUBLESHOOTING §8 (no se toca su archivo nunca) |
| PowerShell 5.1 y scripts con acentos | prohibición ASCII (KFM-OPS-020/023) auditada byte a byte por el builder |
| CRLF/LF mezclados | `.gitattributes` + normalización CRLF del builder |
| Zip corrupto a medio descargar | MANIFIESTO + VERIFICAR-INSTALACION + Plan B «Guardar enlace como…» |
