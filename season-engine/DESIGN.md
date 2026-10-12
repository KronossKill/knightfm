# Knight FM — Motor de calendario, horarios y clasificaciones (Task 109)

Módulo autónomo y ejecutable (`bun src/generate.ts` / `bun src/validate.ts`) que
genera la temporada completa de 1.600 clubes (10 regiones × 10 divisiones × 16
equipos): 24.000 partidos de liga, 1.590 de copa regional y 205 del Mundial de
Clubes — 25.795 en total — con horas asignadas bajo un modelo de capacidad
formal y un validador de invariantes (23 comprobaciones, todas en verde).

## 1. Decisiones de diseño

| Decisión | Justificación |
|---|---|
| **TypeScript 5 + Bun** | Stack del proyecto; sin dependencias externas (SQLite vía `bun:sqlite`). |
| **Módulo autónomo** (`season-engine/`) | El motor vivo de la app usa otro calendario (jornadas dobles 21/24, Mundial día 30 con 5 jornadas). Este motor implementa el NUEVO pliego; la migración del scheduler de producción es una tarea aparte con su propia ventana de despliegue. |
| **Capacidad antes que el código** | Slots: liga/fase-de-liga = 630 s; eliminatoria = 930 s (peor caso 600+300+30). C_min = 18.530 min (día 7) / (1.440 × 0,85) = **15,14 → 16 práctico**. |
| **Planificador por oleadas** | Bloques homogéneos (LIGA → MUNDIAL-fase-liga → COPA → MUNDIAL-KO), oleadas de duración fija por tipo, lotes de división indivisibles (8 huecos simultáneos), tandas KO ≤ 16. Sin horas escritas a mano. |
| **Regla unificada de descanso** | Bloque con placeholders (rivales TBD) → conservador: `cursor + MIN_REST`. Bloque concreto → `max(cursor, últimoFinDeCadaEquipo + MIN_REST)`: entra sin hueco cuando todos los equipos ya descansaron. Esto eliminó el único cruce entre días que violaba el descanso (día 7 → día 8). |
| **Divisiones 1ª primero en días de Mundial** | Los 40 clubes del Mundial acaban su liga en las primeras 5 oleadas (fin ≤ 00:52:30) → su bloque entra pegado a la liga con ≥ 472 min de descanso, y la copa posterior respeta los 120 min. |
| **Localías: patrón alternante por ronda** | Con el círculo, cada equipo cruza la frontera del polígono 1 vez por vuelta → exactamente 1 break → rachas ≤ 2 (de Werra). `maxVenueRun` es el árbitro; enumeración total 2^15 como red de seguridad determinista. |
| **Mundial: construcción con prueba de existencia** | Auto-pareja de bombo = ciclo de 10; pareja cruzada = ciclo alterno de 20 con permutaciones σ/τ validando τ_i ∉ {σ_i, σ_(i+1)} → 2 rivales por bombo (1 en casa, 1 fuera), nunca misma región. Jornadas = 1-factorización con backtracking + reinicios sembrados (el grafo 8-regular no es bipartito: la extracción golosa puede atascarse). |
| **Placeholders (TBD)** | Las rondas que dependen de resultados (copa R2+ y KO del Mundial) reservan huecos con equipo `TBD`: cuentan para capacidad y simultaneidad, no para descansos por equipo. Los IDs deterministas + INSERT OR IGNORE garantizan idempotencia. |
| **Eliminatorias** | Ida/vuelta: gana el global sin gol de visitante; empate → prórroga y penaltis en la vuelta (el simulador decide con la semilla del partido). Playoff 9º-24º (9v24…16v17); cuadro fijo desde octavos (1º vs ganador 16v17, etc.). |
| **Determinismo** | Toda la aleatoriedad pasa por `seed(seed, temporada, competición, ronda)` y se guarda (`sim_seed`, tabla `draws`). Misma semilla → SHA-256 del CSV idéntico (I14). |

## 2. Correcciones al enunciado (detectadas y verificadas, no asumidas)

1. **Días inviables con MAX=8**: el enunciado lista 7, 9 y 19; el cálculo (y el
   test negativo real) demuestran que también son inviables **3, 11 y 15**
   (11.090–13.570 min > 9.792 disponibles). C_min = 15,14 → el "mínimo teórico
   ronda 15" se confirma; el práctico es 16.
2. **Descanso entre días**: el descanso mínimo aplica también entre el último
   partido de un día y el primero del siguiente (no dice el enunciado que expire
   a medianoche). La regla unificada lo garantiza; peor descanso real: 249 min.
3. La tabla de referencia tiene una errata tipográfica el día 27 («20 (R7) )» →
   820 total); el validador reproduce los 30 días exactos.

## 3. Modelo de datos

`persistence/schema.sql` (SQLite, portable): `seasons`, `clubs`, `waves`,
`fixtures` (clave determinista, `slot_id UNIQUE`, índice único de pareja
**parcial** `WHERE placeholder = 0`, `sim_seed` para re-simulación),
`standings`, `cup_runs` (con `draw_seed`), `wc_slots`, `draws`, `movements`,
`job_runs` (claves de idempotencia). Índices de consulta: `(day, kickoff)`,
`(status, kickoff)` (cola de vencidos), `(home, day)`.

## 4. Estados, alineaciones y recuperación

- `SCHEDULED → LOCKED (kickoff − 15 min) → SIMULATING → FINISHED`
  (`nextStatus` en `transitions.ts`).
- Sin alineación enviada → última válida del equipo → formación por defecto.
- Caída a mitad de oleada: `recoverInterrupted` devuelve los `SIMULATING` sin
  resultado a `SCHEDULED` conservando su semilla (re-simulación sin duplicados);
  la cola se recalcula; verificado idempotente (I15e).

## 5. Resultados reales (16 simultáneos)

- Ocupación máxima: **80,4 %** (día 7) ≤ 85 % · pico global: **16** ·
  peor fin de día: **21:26 UTC** (día 7) · finales: día 29 00:15:30 y día 30 00:15:30.
- Día 7: liga 00:00-08:45 → Mundial 08:45-09:06 → copa R2 11:06-21:26.
- Día 9/19 (doble): descanso uniforme **634,5 min** entre jornadas.
- Generación completa: **< 1 s** (CSV de 1,78 MB + SQLite con 25.795 fixtures).
- Validador: **23/23 OK** (I01-I15 + REF + TRA + SOR).

## 6. Límites conocidos y riesgos

1. **Adopción**: integrarlo en el scheduler vivo requiere migrar el modelo
   `fixtures` (kickoff exacto por oleada, placeholders, semillas) y el job de
   tick; recomendado detrás de una flag por temporada.
2. **Particiones horizontales**: si `MAX_CONCURRENT_SIMS` bajara de 16, los días
   3/7/9/11/15/19 son inviables (falla con diagnóstico). Escalado: particionar
   por región (10 workers) multiplicaría la capacidad; el planificador actual es
   de una sola máquina por diseño determinista.
3. **DAY_START/DAY_END**: por defecto 00:00-24:00; la presentación en hora local
   es responsabilidad de la capa de presentación (todo es UTC).
4. **Fatiga/lesiones**: el pliego las fija por día de calendario; el motor expone
   el punto de enganche (día) pero la aplicación la implementa el simulador.
5. La regla conservadora de placeholders añade 120 min de holgura alrededor de
   las rondas TBD; si el simulador confirmara equipos, ese margen podría
   re-aprovecharse (mejora futura: re-planificación tras cada sorteo).

## 7. Cómo ejecutar

```bash
cd season-engine
bun src/generate.ts            # genera out/calendario.csv + out/season.db + informes
bun src/validate.ts            # 23 invariantes con resultado real
```
