# Knight FM — CHANGELOG DE ESTA ACTUALIZACIÓN (qué cambia en TU copia)

**Operación:** aplicar las actualizaciones acumuladas (Master Prompt Unificado,
Task 94). Tu copia de origen: snapshot del **3-oct** (`knight-fm-proyecto-completo (1).zip`).
**Resultado:** tu proyecto queda en **v9.0.0** = estado completo actual.

## Lo que TU copia GANA con esta actualización

| Función | Estado en tu copia (3-oct) | Estado tras v9 |
|---|---|---|
| Registro: contraseña ×2 + ojo mostrar/ocultar | ✗ no lo tiene | ✓ (Task 89) |
| Cartera: dirección de depósito del SISTEMA + QR + copiar | solo endpoint básico | ✓ completo + 11 comprobaciones (Task 88) |
| Descarga del zip en pestaña nueva + panel en la portada | ✗ | ✓ descarga forzada 3 capas (Task 90) |
| Dashboard de widgets personalizable + presets | ✗ | ✓ 12 widgets, guardar diseños (Task 91) |
| Paleta de comandos Ctrl+K, Ctrl+1..9, sidebar fijadas | ✗ | ✓ (Task 91) |
| 5 temas + tokens exportados + docs/ui (11 documentos) | ✗ | ✓ (Task 91) |
| Verificador VERIFICAR-INSTALACION.bat que arranca bien | ✗ (ni existía) | ✓ 100% ASCII (Task 92) |
| .gitignore seguro para subir a GitHub | ✗ (no traía) | ✓ (Task 93) |
| DEPLOY_WINDOWS.bat: instalación de un clic | ✗ | ✓ (Task 94) |
| Captcha auto-sincronizado (no te bloquea) | parcial | ✓ (fix captcha lockout) |
| Banderas de país de los mánagers conectados | ✗ | ✓ (Task banderas) |
| Entrenamiento sostenible (techos de potencial) | ✗ | ✓ |
| Next.js / dependencias | next ^16.1.1 flotante, 70 deps | **next 16.4.0 exacto + 83 declaraciones actualizadas** |

## Lo que NO cambia (se conserva en tu disco)

- Tu `.env` (tus claves) — los zips jamás lo traen; el flujo «Reemplazar» no lo borra.
- Tu `db/custom.db` (partida SQLite antigua) — se conserva; esta versión usa
  PostgreSQL (gratis en neon.tech) cuando quieras jugar con datos.
- Tus archivos EXTRA (zips viejos, capturas…) — nunca se borran; el verificador
  los marca en amarillo como «EXTRA» y son ignorables.

## Ajustes que debes conocer

1. **PowerShell:** tu copia vieja tenía el script `dev` con `tee` (no existe en
   CMD de Windows). Ahora `npm run dev` es Windows-safe puro.
2. **Base de datos:** tu `prisma/schema.prisma` era SQLite; la entrega oficial
   usa **PostgreSQL** (decisión formalizada del proyecto, Task 76/87). El sitio
   arranca igual; para jugar con datos sigue WINDOWS_SETUP.md §4 (neon.tech, 2 min).
3. **Scripts de Windows en CRLF:** `.ps1`/`.bat` viajan con CRLF real
   (.gitattributes + KFM-OPS-023).
4. **Majors aplazadas a propósito** (14 paquetes): se aplican «una por ciclo»
   con verificación completa — detalle en docs/reports/05_DEPENDENCY_REPORT.md.
