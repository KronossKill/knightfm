# 07 — DELIVERY REPORT (Fase 7, Task 94)

**Fecha:** 2026-10-11 · **Operación:** Master Prompt Unificado — aplicar las
actualizaciones acumuladas y entregar UN zip completo actualizado (v9.0.0).

## Entregables publicados (panel de descargas, `/downloads/`)

| Entregable | Nombre exacto | Tamaño |
|---|---|---|
| Fechado (el «MÁS RECIENTE» del panel) | `knightfm_updated_20261011_145930_UTC_v9.0.0.zip` | ≈ 7,08 MB |
| Canónico (siempre el mismo nombre) | `knightfm-sincronizacion-completa.zip` | ≈ 7,08 MB |

- Ambos son el MISMO contenido byte a byte (la copia fechada la genera el
  builder KFM-OPS-015/023 en el paso 6b).
- **SHA-256 del zip final: publicado en el chat junto al enlace** — un zip no
  puede contener su propio hash.
- Entradas del zip: **634** (448 archivos del manifiesto + verificador +
  LEEME v9 + entradas de directorio).

## Contenido (resumen)

- Código completo v9 (54 archivos actualizados + 62 nuevos vs tu snapshot
  del 3-oct — detalle en `DELIVERY_DIFF.md`).
- Mecanismo anti-pérdida: `MANIFIESTO-COMPLETO.txt` +
  `VERIFICAR-INSTALACION.bat/.ps1` (100% ASCII + CRLF).
- Instalación de un clic: `DEPLOY_WINDOWS.bat/.ps1` + guías
  `WINDOWS_SETUP.md` / `TROUBLESHOOTING_WINDOWS.md`.
- Informes completos: `docs/reports/01-07` + gobernanza (CHANGELOG,
  BACKUP_LOG, STATE, ADR-001).

## Verificación de publicables — ✅

- HTTP 200 + `Content-Disposition: attachment` en ambos (curl + navegador).
- `/api/downloads` lista el fechado como MÁS RECIENTE.
- Verificador: `CORRECTOS: 448 · FALTAN: 0 · TAMANO DISTINTO: 0 · EXTRA: 0`.

## Instalación / Rollback

- **Instalar:** extraer → copiar sobre `D:\Programacion\knightfm`
  («Reemplazar») → `VERIFICAR-INSTALACION.bat` (DEBES VER «ESTA COMPLETO»)
  → `DEPLOY_WINDOWS.bat` (un clic) o PASOS 5-9 del LEEME.
- **Rollback:** tu zip original (`ff5fc849…`) o el backup phase0 del taller
  (`ff63590a…`, v8.0.0 pre-cambios) — ver `02_BACKUP_REPORT.md`.
