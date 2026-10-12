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

## [v9.3.0] — 2026-10-11 — TEMA "NEXUS" (DISEÑO VISUAL DEFINITIVO) + FIX TURNSTILE LOGIN (Task 103)

### Fixed
- **LOGIN BLOQUEADO EN PRODUCCIÓN (knightfm.vercel.app)**: la Content-Security-Policy
  del middleware impedía cargar Cloudflare Turnstile (`script-src` sin
  `challenges.cloudflare.com`, sin `frame-src` para el iframe del widget) →
  "El captcha no se pudo cargar" en cada intento de entrada. La CSP ahora concede
  SOLO el host `https://challenges.cloudflare.com` en script-src, frame-src,
  connect-src e img-src (sin comodines). Evidencia: captura del usuario con el
  error de CSP en la consola de Edge.
- `captcha.ts` endurecido: reintento automático de carga del script (2 intentos),
  timeout de 25 s (el token ya no puede quedarse colgado para siempre), y la
  config ya no cachea para siempre el fallback "sandbox" tras un fallo de red
  (antes eso producía CAPTCHA_INVALID misteriosos).
- `AuthFlow`: nuevo botón «Reintentar verificación» en los formularios de entrar
  y registrarse cuando el captcha falla — recupera el flujo sin recargar la
  página ni perder lo escrito. 4 idiomas.
- Advertencias de preload de fuentes (`*.woff2 … not used`) mitigadas: Inter
  carga un único subset latino con display swap (sustituye a Geist Sans).

### Added
- **Tema 6 «Nexus» — el diseño visual definitivo del usuario (DOCX)**: azul noche
  #0A0F18 de fondo, azul pizarra #151E2D en paneles, verde lima #B7F34A solo para
  selección/acciones, blanco frío #E8EEF6 de texto y gris azulado para secundarios.
  Radios de tarjeta 12 px (spec 10–14 px). NUEVO TEMA POR DEFECTO (los 5 anteriores
  siguen disponibles). WCAG AA verificado: 22/22 pares (cuerpo 16.4:1, botón lima
  14.6:1, secundario 6.7:1) con el verificador del proyecto (6 temas × 22 pares).
- Tipografía Inter (spec §1) con números tabulares en tablas (estadísticas,
  presupuestos, fechas y marcadores alineados en columna).
- Sidebar alineado al spec §2: 240 px expandida / 80 px compacta, barra superior
  de 64 px, y sección activa con fondo azul pizarra + línea de acento lima +
  icono destacado (antes: tinte lima plano, sin línea).

## [v9.4.0] — 2026-10-11 — AMISTOSOS: UI COMPLETA + REGLA DE 30 MIN + CERO INGRESOS (Task 104)

### Added
- **Pestaña «Amistosos» en Competiciones** (UI nueva): programar amistosos desde
  la plataforma, sin llamar a la API a mano. Selector de rival (todos los clubes
  con escudo), fecha y hora UTC, coste visible (competition.friendlyFee, 20
  $Knight por defecto) y validación EN VIVO que replica la regla del servidor
  ANTES de pagar: conflicts marcados con partido, hora y margen Δ en minutos.
- **Regla de los 30 minutos (mandato del usuario)**: la hora del amistoso debe
  quedar al menos competition.friendlyBufferMin (30 min por defecto) ANTES o
  DESPUÉS de cualquier partido —oficial o amistoso— de LOS DOS clubes
  participantes. Ahora SÍ se puede agendar el mismo día de un partido oficial
  respetando el margen (antes el día entero estaba bloqueado). Clave nueva de
  admin: competition.friendlyBufferMin (0-720 min; 0 = solo solapamiento exacto).
- **GET /api/competitions/friendly?clubId=…**: planificador — devuelve fee,
  margen, rivales disponibles y la hora del servidor (reloj a prueba de PC
  desajustado). La UI lo consume con TanStack Query.
- Errores localizados en 4 idiomas (es/en/fr/pt): TOO_CLOSE_TO_MATCH,
  FRIENDLY_LIMIT, ALREADY_SCHEDULED, INSUFFICIENT_CLUB_FUNDS, INVALID_OPPONENT,
  KICKOFF_IN_PAST, NO_ACTIVE_SEASON.

### Changed
- **CERO INGRESOS POR AMISTOSO (mandato del usuario)**: el motor ya NO paga
  taquilla a los amistosos — sin MATCH_REVENUE para el local y sin reparto
  regional/sistema (el premio por victoria ya estaba excluido desde Task 27).
  Un amistoso es un laboratorio de tácticas: cuesta la tasa, consume energía
  real (fatiga, forma, moral vía TRAMA con exigencia 0.15) y no reparte ni un
  $Knight.
- 2 claves nuevas de admin: competition.friendlyFee (el fallback ya existía;
  ahora es visible y editable en el Control Center) y
  competition.friendlyBufferMin (125 claves totales).

## [v9.4.1] — 2026-10-11 — HOTFIX LOGIN: TURNSTILE VISIBLE Y SIN CUELGE ETERNO (Task 105)

### Fixed
- **«El sitio se queda cargando y no deja iniciar sesión» (captura del usuario,
  knightfm.vercel.app)**: la causa raíz estaba en el cliente — el widget de
  Turnstile se renderizaba FUERA DE PANTALLA (1×1 px, left:-9999px). Cuando
  Cloudflare escala el desafío a uno INTERACTIVO (entornos que considera
  sospechosos: extensiones/visores de intercambio de tráfico tipo surfs.*,
  automatizaciones, VPN), nadie podía verlo ni pulsarlo → el callback nunca
  llegaba → el botón «Entrar» giraba para siempre. Ahora el widget se monta
  DENTRO del formulario activo (login, registro, verificar correo y recuperar
  contraseña) con `appearance: interaction-only`: invisible para el tráfico
  limpio y visible exactamente cuando hay que interactuar.
- **Cero colgues por construcción**: el token ahora tiene un watchdog duro
  (180 s con widget visible / 60 s en el modo legado) y TODOS los caminos
  resuelven — callback, error-callback, expired-callback, timeout-callback de
  Turnstile, watchdog propio, global ausente (`window.turnstile` antes se
  tragaba el render con optional chaining) y excepción de render. El error
  aparece con su botón «Reintentar verificación» y un mensaje nuevo claro:
  «La verificación de seguridad no terminó a tiempo…» (4 idiomas).
- **CSP endurecida sin romper nada**: `worker-src 'self' blob:` (algunas
  builds de Turnstile arrancan un worker blob:; sin esa directiva el navegador
  caía a script-src y el widget podía quedar mudo). Los píxeles
  surfs.pro/track que se ven en rojo en la consola son rastreadores de una
  extensión de intercambio de tráfico: siguen BLOQUEADOS a propósito — no
  afectan al login.
- **siteverify sin URLSearchParams**: la verificación servidor construye el
  cuerpo urlencoded a mano — elimina del camino crítico del login el crash
  `urlSearchParams.entries() is not a function` que sale en el runtime de
  Vercel (functions.js) y que podía tumbar el POST /api/auth/login con 500.
- Verificado E2E en navegador con las claves de PRUEBA oficiales de Cloudflare
  (1x…AA always-pass): login real completado con el widget cargando desde
  challenges.cloudflare.com (0 errores de consola, 0 bloqueos CSP), fallo del
  widget → «Reintentar verificación» en vez de spinner eterno, token resuelto
  tarde → el flujo continúa hasta el error de negocio correcto, y móvil
  390×844 sin regresiones visuales.

### Changed
- `getCaptchaToken()` acepta `{ mount }` (elemento del formulario); las 4
  pantallas que piden token pasan su contenedor visible. Sin mount se conserva
  el comportamiento legado fuera de pantalla (con watchdog corto).

## [v9.5.0] — 2026-10-12 — REDISEÑO INTEGRAL: SISTEMA VISUAL, MENÚ, PROGRESO CONTEXTUAL Y BIBLIOTECA DE IMÁGENES (Task 106)

### Added
- **Paleta exacta del mandato** como tema Nexus (el default): lienzo #080D15,
  paneles #101927, superficies elevadas #192638, bordes azul grisáceo #233044,
  lima #B7FF38 (solo selección/acciones/positivo), azul secundario #55A7FF
  (chart-3), ámbar #F5B93E (chart-2), texto #F1F5FB / #A2B1C5. WCAG AA
  verificado por el script del proyecto: ALL PASS 6 temas × 22 pares.
- **Menú lateral premium (mandato §4)**: indicador lateral lima redondeado en
  el ítem activo (expandido y colapsado), hover/focus diferenciados,
  separadores de categoría, tooltips Radix laterales en modo colapsado y
  aria-label permanente (el nombre accesible sobrevive al raíl de 80 px).
  Rutas, atajos y favoritos intactos.
- **Sistema de progreso contextual (mandato §6)** — un visual por pregunta:
  · `RingProgress` (anillo SVG): obra de instalación (ámbar) y preparación de
    plantilla (panel). El % SIEMPRE es dato del servidor.
  · `MilestoneTimeline`: fases de obra Preparación → Obra → Técnicas →
    Equipamiento → Inspección, con fase activa pulsante e hitos completados;
    la fase se deriva del % real, nada inventado.
  · `FormDots`: forma reciente (últimos 5) por club en la clasificación,
    calculada SOLO de partidos jugados reales (nuevo filtro status=PLAYED en
    la consulta de división; la API ya lo soportaba).
  · `Sparkline`: tendencia del saldo en Tesorería con los últimos 24 apuntes
    reales del libro mayor (balanceAfter); con <2 apuntes no dibuja nada.
  · `DeltaPill`: deltas firmados +lima/−rojo para evoluciones.
  · `EmptyState` ahora acepta una acción útil.
- **Biblioteca de imágenes nueva (mandato §7)**: 30 renders fotorrealistas
  16:9 (1344×768) = 6 tipos reales × 5 estados (Muy deteriorado → Estado
  excelente). Cada tipo se generó UNA vez (nivel base "aceptable") y los
  otros 4 niveles se DERIVARON por edición IA de esa base conservando lugar,
  arquitectura, cámara y encuadre — se reconoce LA MISMA instalación
  evolucionando. Sin texto, logos, marcas de agua ni interfaces incrustadas.
- **next/image en instalaciones**: las tarjetas usan next/image (sharp) con
  caja 16:9 reservada (aspect-video) — WebP/AVIF automático y cero saltos de
  layout. La respuesta del optimizador viaja con must-revalidate.

### Changed
- Clasificación: columna FORMA nueva (min-w 640→720) + leyenda intacta.
- Tesorería: cabecera del libro mayor con la tendencia del saldo.
- Panel: widget Preparación como anillo + ratio en leyenda.
- Centro de control y diálogo de plantilla rival: guard `overflow-x-auto`
  añadido a las tablas que podían desbordar (moderación, auditoría IP ×2,
  plantilla del rival).
- i18n: 12 claves nuevas en es/en/fr/pt (nav.admin, fases de obra, forma,
  tendencia del saldo, etc.).
