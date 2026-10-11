# Knight FM — BACKUP LOG

**Protocolo (Master Prompt Unificado, Task 94):** backup ANTES de cualquier
cambio. Nunca se borra un backup. Archive-instead-of-delete.

## Registro de backups

| # | Fecha (UTC) | Artefacto | Alcance | Archivos | Tamaño zip | SHA-256 |
|---|---|---|---|---|---|---|
| 1 | 2026-10-11 14:10:39 | `backups/knightfm_backup_20261011_141038_UTC_v8.0.0_phase0.zip` | Árbol completo del proyecto pre-actualización (sin node_modules/.next/.git/entregables) | 447 | 30.000.548 B | `ff63590a918a8f4ffdc46dab8b3fc6804283e839120b47d981504d12fc8b83cc` |

- Sidecar con SHA-256 **por archivo**:
  `backups/knightfm_backup_20261011_141038_UTC_v8.0.0_phase0.manifest.json`
- Generador: `scripts/task94-backup.sh` (idempotente, crea zip + sidecar + copia
  del manifiesto DENTRO del zip para auditoría).
- Fuente subida por el usuario, preservada intacta:
  `upload/knight-fm-proyecto-completo (1).zip`
  (SHA-256 `ff5fc849ac0a8c64a28bcd6b1d98409a2f59438e4fe276d387593d9acc39a7f7`,
  16.140.948 B, 605 entradas / 431 archivos extraídos — snapshot del 3-oct).

## Datos locales del usuario (NUNCA viajan en zips)

| Dato | Dónde vive tu copia | ¿Lo toca esta actualización? |
|---|---|---|
| `.env` (tus claves) | raíz de tu proyecto (`D:\Programacion\knightfm\.env`) | **NO** — el flujo «Reemplazar» lo conserva; los zips jamás lo traen |
| `db/custom.db` (tu partida SQLite antigua) | `db/custom.db` | **NO** — se conserva en tu disco (nota: esta versión usa PostgreSQL; ver WINDOWS_SETUP.md §4) |

Tu zip original subido TAMBIÉN contiene tu `.env` y tu `db/custom.db` — doble
red de seguridad. Rollback completo = volver a extraer tu zip original sobre
`D:\Programacion\knightfm` (o restaurar el backup phase0 en el taller).

## Reglas para backups futuros
1. Generar uno nuevo ANTES de cada ciclo de cambios: `bash scripts/task94-backup.sh`.
2. Conservar como mínimo las 2 últimas generaciones.
3. Recomendado al usuario: guardar una copia de cada zip entregado fuera del
   proyecto (otro disco o la nube).
