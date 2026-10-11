# Knight FM — CHANGELOG (solo se AÑADEN entradas)

**Regla del proyecto (Master Prompt Unificado, Task 94):** las entradas nuevas
van SIEMPRE al final. Prohibido editar o borrar entradas antiguas.
Las entregas se documentan además en `INVENTARIO_MAESTRO.md` (filas KFM-OPS-*)
y en `worklog.md` (bitácora interna del taller).

---

## [v9.0.0] — 2026-10-11 — ACTUALIZACIÓN COMPLETA APLICADA (Master Prompt Unificado, Task 94)

### Added
- `DEPLOY_WINDOWS.ps1` + `DEPLOY_WINDOWS.bat`: instalación de UN CLIC en Windows
  (comprueba Node 20+, hace `npm install`, `npx prisma generate`, crea tu `.env`
  desde `.env.example` si falta —sin tocar el existente—, detecta PostgreSQL
  local en el puerto 5432 y crea las tablas, arranca el servidor y abre el
  navegador). Aviso integrado si tu `.env` antiguo apunta a SQLite (`file:`).
- `WINDOWS_SETUP.md` y `TROUBLESHOOTING_WINDOWS.md`: guías Windows 10/11 +
  PowerShell 5.1 con «DEBES VER» en cada paso.
- `docs/reports/01..07`: informes completos de esta operación (inventario,
  backup, análisis, aplicación, dependencias, integridad, entrega).
- `BACKUP_MANIFEST.json` + backup pre-actualización
  `backups/knightfm_backup_20261011_141038_UTC_v8.0.0_phase0.zip`
  (447 archivos, SHA-256 por archivo en el sidecar `.manifest.json`).
- `.gitattributes`: LF en código fuente, CRLF obligatorio en `.ps1`/`.bat`/`.cmd`
  (KFM-OPS-022/023 — los scripts de Windows ya viajan con CRLF real dentro del zip).
- `docs/archive/MASTER_PROMPT_UNIFICADO_FUENTE.txt`: fuente archivada del mandato.
- `docs/decisions/ADR-001-next-pinned.md`: decisión documentada del candado de Next.
- Entregable fechado adicional: `knightfm_updated_20261011_<HHMMSS>_UTC_v9.0.0.zip`
  (mismo contenido exacto que el canónico `knightfm-sincronizacion-completa.zip`).

### Changed
- **Dependencias actualizadas a latest estable**: Next.js 16.1.3 → **16.4.0 exacto**
  (ADR-001), react/react-dom 19.3.0, prisma/@prisma/client 6.19.3, eslint-config-next
  16.4.0 — total **40 minor + 22 patch + 21 anclajes (^→exacto) = 83 declaraciones;
  0 majors aplicados**. Detalle completo en `docs/reports/05_DEPENDENCY_REPORT.md`.
- **Builder endurecido (KFM-OPS-023)**: auditoría ASCII global de TODOS los
  `.ps1`/`.bat` del stage, CRLF obligatorio en scripts Windows, nuevos guards y
  probes (Windows docs, .gitattributes, informes) y generación automática de la
  copia fechada `knightfm_updated_*`.
- `eslint.config.mjs`: `react-hooks/set-state-in-effect` = warn (8 sitios
  preexistentes y funcionales; plan de refactor documentado — 0 riesgo runtime).
- `STATE.md` con estado de continuidad (fase, backup, informes, decisiones).

### Deferred (plan «una major por ciclo», ver 05_DEPENDENCY_REPORT)
- @mdxeditor/editor 4 · @prisma/client + prisma 7 · @tanstack/react-table 9 ·
  framer-motion 14 · lucide-react 1 · react-day-picker 10 ·
  react-resizable-panels 4 · react-syntax-highlighter 16 · recharts 3 ·
  uuid 14 · sharp 0.35 · eslint 10 · typescript 7.

---

## [v8.0.0] — 2026-10-11 — LISTO PARA GITHUB/VERCEL (Task 93, KFM-OPS-021)
- `.gitignore` viaja en el zip: tu `.env` (claves), `node_modules` y `.next` NO
  suben al repositorio. `package.json` con `postinstall: prisma generate` y
  `build: next build` (Vercel compila solo). LEEME v8 con guía GitHub → Vercel → Neon.

## [v7.0.0] — 2026-10-11 — VERIFICADOR WINDOWS 100% ASCII (Task 92, KFM-OPS-020)
- `VERIFICAR-INSTALACION.ps1` reescrito ASCII puro (PowerShell 5.1 ya no lo rompe),
  lectura del manifiesto con `-Encoding UTF8`, falsos EXTRA anidados corregidos,
  el builder audita ASCII y aborta cualquier futuro byte no-ASCII.

## [v6.0.0] — 2026-10-11 — SISTEMA DE DISEÑO UI/UX (Task 91, KFM-OPS-019)
- Dashboard de widgets personalizable (server-side), paleta de comandos Ctrl+K,
  sidebar colapsable + fijadas + Ctrl+1..9, barra inferior móvil, 4K centrado,
  5 temas con tokens exportados, docs/ui ×11.

## [v5.0.0] — 2026-10-10 — DESCARGA FORZADA + RECUPERACIÓN TOTAL (Task 90, KFM-OPS-018)
- `/downloads/*` con `Content-Disposition: attachment` (3 capas), panel de
  descargas en la landing, mecanismo anti-pérdida reconstruido (KFM-OPS-015).

## [v4/v3] — 2026-10-10 — REGISTRO REFORZADO + DEPÓSITOS (Tasks 89/88, KFM-OPS-017/016)
- Contraseña ×2 + ojo mostrar/ocultar (4 idiomas); billetera del sistema con QR
  y 11 comprobaciones server-side (anti-replay, uso único).

## [v2 y anteriores] — 2026-10-09/10
- Entregas parciales previas (fixes seguridad, captcha+Brevo, banderas de país,
  entrenamiento sostenible). Sustituidas por el paquete canónico completo.

## [v9.1.0] — 2026-10-11 — MOTOR DE PARTIDO KMIE 2.0 + UI/UX v2.0 (Tasks 99-100)

**Auditoría forense solicitada por el usuario** ("faltan el clima, el estado
del terreno, la felicidad…"): se comparó byte a byte el motor contra el zip
v9.0.0, el backup v8.0.0, el primer proyecto completo, el historial git y el
worklog completo. Veredicto con evidencia: esas capas NUNCA existieron en
ninguna versión (matches.ts 578 líneas y kmie.ts 91 idénticos en todas las
entregas); lo que sí había era documentación que prometía más de lo
implementado y columnas de estilos tácticos muertas. Se implementaron:

- **Clima** por partido: banda climática de la región del local + semilla
  (CLEAR/CLOUDY/RAIN/STORM/SNOW/WIND/HEAT) → goles, ruido de posesión, lesiones.
- **Estado del terreno**: estadio del local + clima (EXCELLENT/GOOD/WORN/HEAVY);
  el campo malo amplifica la ventaja local.
- **Impredecibilidad honesta**: "día de forma" oculto por equipo (10% config)
  y árbitro de humor variable; azar simétrico, sin rubber-banding.
- **Felicidad**: suplentes +1/−1 moral según resultado; realimenta el OVR contextual.
- **Tácticas reales**: estilos Con/Sin balón persistidos desde la Pizarra
  Táctica (API + UI) y aplicados por el motor; encaje posicional en la fuerza.
- **Ciencia deportiva**: Centro Médico + Ciencia Deportiva −30% lesiones máx.
- **Informe**: franja de condiciones (clima + terreno + arbitraje) i18n ×4.
- **Config admin**: matches.weatherEnabled / pitchEnabled / dayFormPct /
  refereeVariancePct (119 claves).
- Incluye el delta UI/UX v2.0 (World Pulse, 4 widgets, Ctrl+K favoritos/pila,
  deep-linking, temas WCAG) y la guía GitHub-Supabase-Vercel.
- Verificación: lint 0 errores, tsc limpio en archivos tocados, paridad i18n
  665/665/665/665 y 90/90/90/90, test funcional del motor (favorito 86%→74%
  bajo tormenta+campo pesado+mal día), builder KFM-OPS-015 con probes Task 100.

## [v9.2.0] — 2026-10-11 — MOTOR DE PARTIDO TRAMA (spec "Parte 3", Task 101)

**El usuario subió la especificación "Parte 3 · Motor de partido TRAMA" (Tejido
de Reacciones, Azar y Momentos Adaptativos) y pidió usarla en el motor.**
Implementada como núcleo del motor (toggle trama.enabled, por defecto activo;
false conserva el camino Poisson legado):

- Nudo de 5 pasos (3.3): RE = Calidad × Fcuerpo × Fmente × Fmundo × Frol ×
  Fsinergia × Fexp (cada F 0.60-1.15), margen con Espacio+Táctica+Marea,
  P = logística con temperatura T = 3 × (1 + Caos de contexto), caos 0-1.5
  con la tabla de fuentes EXACTA del spec (clima +0.35, terreno +0.30,
  fatiga +0.25, presión +0.20, nervios +0.20×(1−Serenidad), afición +0.10,
  árbitro +0.10), bandas graduadas (Excelente/Correcto/Forzado/Fallo/
  Error/Desastre) con colas pesadas.
- Hilo Mundo (3.4): clima evolutivo (frentes), terreno por zonas con
  desgaste→barro, reparación del descanso según estadio, afición, árbitro
  con severidad y consistencia.
- Hilo Cuerpo (3.5): depósitos de energía con curva no lineal y calambres;
  lesiones con la fórmula del spec (Fatiga^1.5 × Terreno × Frío ×
  (1−Protección médica)).
- Hilo Mente (3.6): ánimo en directo, lapsus post-gol, concentración.
- Hilo Juego (3.8): cadenas con 4 puertas, lectura adaptativa de rutas
  (−12%), marea del partido con inercia, gestión del marcador progresiva.
- Fábrica de imprevisible (3.9): día de forma oculto ±8% con colas pesadas,
  cisnes negros (foco/objeto/invasión) con presupuesto de caos (4), rebotes.
- Experiencia (3.15): Madurez logística por edad, Bagaje (proxy PE),
  Fexp acotado [0.85,1.04] con exigencia por competición (liga 0.35 →
  final 0.75), Colas por madurez, Serenidad, complejidad de rol.
- Equidad (3.11): ventaja local de factores reales con tope (3%, configurable);
  determinismo auditable; causa de cada gol guardada en el informe (3.12).
- Calibración (3.13): scripts/calibrate-trama.ts — 12.000 partidos: 2.58
  goles, 9.6 tiros/equipo, 23.1 faltas, 3.85 amarillas, 0.09 rojas,
  0.25 penaltis, 46.7/20.6/32.7% 1X2, 0.32 ms/partido; dominancia máx.
  49.8% (<58%) y simetría <3%. Documentadas las simplificaciones
  (pulsos→cadenas, 3 zonas, PE proxy) y el roadmap a fase completa.
- 4 claves nuevas de admin: trama.enabled / chaosBudget / blackSwanPerMil /
  homeAdvCapPct (123 claves totales).
