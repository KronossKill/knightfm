# 02 — BACKUP REPORT (Fase 2, Task 94)

**Regla aplicada:** backup ANTES de cualquier cambio. Nada se borra nunca
(archive-instead-of-delete).

## 1. Backup pre-actualización (estado v8.0.0 del proyecto)

| Propiedad | Valor |
|---|---|
| Artefacto | `backups/knightfm_backup_20261011_141038_UTC_v8.0.0_phase0.zip` |
| SHA-256 | `ff63590a918a8f4ffdc46dab8b3fc6804283e839120b47d981504d12fc8b83cc` |
| Tamaño | 30.000.548 B (59.377.608 B sin comprimir) |
| Archivos | 447 |
| Creado | 2026-10-11 14:10:39 UTC (ANTES de tocar dependencias/código) |
| Generador | `scripts/task94-backup.sh` (idempotente) |
| Sidecar | `...phase0.manifest.json` — SHA-256 **por archivo** + metadatos; copia del manifiesto incluida DENTRO del zip (`BACKUP_MANIFEST.json`) |

## 2. Preservación de la entrada del usuario

| Copia | Ubicación | Estado |
|---|---|---|
| Original subido | `upload/knight-fm-proyecto-completo (1).zip` | intacto (SHA-256 `ff5fc849…` verificado pre y post operación) |
| Copia de análisis | `/tmp/kfm-incoming` (extracción de trabajo) | solo lectura para diffs |
| Copia del usuario | su disco (`D:\Programacion\knightfm` + su zip original) | fuera de nuestro alcance — el flujo de instalación «Reemplazar» no borra nada suyo |

## 3. Micro-backups durante la aplicación

Cada cambio de este ciclo quedó además **commiteado en git** (commits
`1cf031c`, `6baa6c3`, `c3fb25c` y el commit final de la operación) — git es el
micro-backup paso a paso; el zip phase0 es la foto gruesa pre-cambios.

## 4. Datos que NUNCA entran en backups/entregas

- `.env` real (claves) — prohibición KFM-OPS; el builder aborta si un `.env`
  aparece en el stage.
- `db/*.db` de trabajo, `node_modules/`, `.next/`, `.git/`, logs, `upload/`.

## 5. Rollback

- **Usuario:** re-extraer su zip original sobre `D:\Programacion\knightfm`
  (vuelve exactamente a su snapshot del 3-oct, incluidos su `.env` y su
  `db/custom.db`).
- **Taller:** restaurar el zip phase0 (v8.0.0 pre-cambios) o
  `git revert` del ciclo.
