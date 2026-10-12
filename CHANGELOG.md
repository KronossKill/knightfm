# CHANGELOG — Knight FM

Formato: `[vX.Y.Z] — título` + lista de cambios. (El historial previo a v9.7.0
quedó documentado en `worklog.md`; el fichero original se perdió en una limpieza
del entorno y se reconstruye aquí.)

## [v9.7.0] — Task 109: motor de calendario, horarios y clasificaciones (nuevo pliego)

- Nuevo módulo autónomo `season-engine/` (TypeScript 5 + Bun, sin dependencias):
  genera la temporada de 1.600 clubes — 24.000 liga + 1.590 copa + 205 Mundial.
- Modelo de capacidad formal: slots 630 s (liga) / 930 s (eliminatorias, peor caso),
  `MAX_CONCURRENT_SIMS` configurable (múltiplo de 8), `MIN_REST_MIN`, `MAX_UTILIZATION`,
  fallo explicativo con día/carga/capacidad/déficit/C_min (nunca desplaza partidos).
- Planificador por oleadas: lotes de división indivisibles, tandas KO ≤ capacidad,
  regla unificada de descanso (placeholders conservadores, bloques concretos por
  descanso real por equipo), divisiones 1ª primero en días de Mundial, J29/J30 con
  divisiones adyacentes juntas, días dobles 9/19 con orden idéntico (descanso
  uniforme 634,5 min).
- Liga: círculo + espejo, rachas ≤ 2 garantizadas (patrón alternante, de Werra).
- Copa: R1 concreta (div 7-10) + huecos reservados por ronda/día; sorteos con
  semilla por (temporada, región, ronda) almacenada.
- Mundial UCL-40: bombos (1 por región y bombo), fase de liga construida con
  ciclos σ/τ (2 rivales por bombo, 1H/1A, sin misma región) y 1-factorización con
  backtracking; playoff 9v24…16v17; cuadro fijo desde octavos; sin gol de
  visitante; prórroga+penaltis reservados (930 s).
- Clasificaciones: puntos→DG→GF→enfrentamiento directo (minitabla)→sorteo con
  semilla. Ascensos/descensos 3/3 (día 28), lista del Mundial (día 28 provisional,
  día 29 cerrada con pase al 4º cuando el campeón de copa ya está por liga).
- Persistencia SQLite (`persistence/schema.sql`, índice único parcial para
  placeholders) + export `calendario.csv` (11 columnas del pliego).
- Estados SCHEDULED→LOCKED(−15 min)→SIMULATING→FINISHED; alineaciones: enviada >
  última válida > por defecto; recuperación de caídas con re-simulación sembrada.
- Validador: 23 comprobaciones — todas OK — incluidos test negativo MAX=8
  (días 3,7,9,11,15,19: CORRECCIÓN al pliego, que solo listaba 7,9,19) y
  determinismo SHA-256. C_min = 15,14 → 16 práctico; ocupación máx 80,4 % (día 7).

## [v9.6.0] — Task 108: IA guía endurecida + icono moderno + chat elegante + unicidad en vivo

- IA restringida a juego y navegación (rechaza código/fórmulas dos veces: prompt y
  filtro de respuesta); icono AI moderno; panel de chat anclado con animación.
- Usuario/correo únicos con comprobación EN VIVO mientras se escribe (debounce
  450 ms, `/api/auth/availability`), feedback inline en 4 idiomas.

## [v9.5.1] — Task 107: retirada de descargas de usuarios

- Eliminados todos los puntos de descarga públicos (panel, API, headers y ~60 MB
  de ficheros); las entregas pasan al canal privado del propietario (puerto 3400).
