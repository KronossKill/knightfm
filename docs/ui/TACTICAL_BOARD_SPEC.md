# KNIGHT FM — TACTICAL BOARD SPEC (Task 91)

Implementación viva: `src/components/game/tactics/` (`tactics-view.tsx`, `pitch.tsx`,
`slot-dialog.tsx`, `squad-panel.tsx`, `analysis-panel.tsx`, `use-tactics.ts`).
El módulo se carga perezosamente desde el shell (`ModuleSlot moduleKey="tactics"`).

## 1. Reglas duras del mandato (estado)

- **Fichas CUADRADAS**: `pitch.tsx` renderiza tiles `aspect-square rounded-lg`
  (nunca círculos). ✓ ya cumple el código.
- **Objetivos ≥44px**: tiles con `min-w-[56px]`; controles ≥44px. ✓
- **Sin controles de tiempo** ni botones "Jugar partido". ✓ (la simulación es
  del servidor; el tablero solo prepara).
- **Sin colores hardcodeados en UI**: única excepción deliberada y auditada = el
  verde de césped del campo (`bg-[#0b1220]/75` del panel + tono de campo), que es
  representación física del terreno de juego, no color de tema.

## 2. Anatomía de la pantalla

- **Controles superiores**: formación, guardar, restablecer, vista
  (posesión / defensa / combinada según implementación del módulo).
- **Campo interactivo** (`pitch.tsx`): campo con proporción real `aspect-[68/105]`,
  carriles/zonas dibujadas, tiles posicionados en % sobre el campo.
- **Tile de jugador (cuadrado)**: dorsal, inicial/apellido corto, badge de
  posición; anillo/fondo con el rol; indicadores de estado (lesión). Contenido
  completo (forma, fatiga, familiaridad) en el diálogo del hueco.
- **Clic en posición → `slot-dialog.tsx`**: selector de jugadores elegibles con
  orden/filtrado por idoneidad para el rol, forma, condición física y
  disponibilidad (lesión/sanción).
- **Panel izquierdo (`squad-panel.tsx`)**: lista corta de plantilla disponible
  para arrastrar/asignar.
- **Panel derecho (`analysis-panel.tsx`)**: explicación táctica contextual
  (fortalezas, riesgos, huecos creados/expuestos, exigencias) que se actualiza
  con cada cambio relevante de la alineación.

## 3. Interacción y accesibilidad

- Todo tile/hueco es **botón real** con `aria-label` ("Posición X — elegir
  jugador…"), focus visible y navegación Tab.
- El diálogo de hueco es un Dialog Radix: focus trap, `Esc` cierra, lista
  navegable por teclado.
- Arrastrar/colocar tiene alternativa por clic (misma acción, sin depender del
  puntero) — la colocación nunca depende solo del color ni del gesto.
- `prefers-reduced-motion` respetado en transiciones de colocación.

## 4. Datos y honestidad

- La alineación y su idoneidad provienen del servidor (`use-tactics` + API de
  tácticas); la UI **nunca inventa** ratings ni disponibilidad.
- Cambios sin guardar se indican; guardar requiere acción explícita del usuario.
- Mobile 360px: el campo escala (`max-w-[540px]`), paneles se apilan; 4K: el
  módulo vive dentro del contenedor máx. 1920px del shell.

---

## Master UI/UX v2.0 — Delta del tablero táctico (verificado en código)

- **Teselas cuadradas/redondeadas, jamás circulares** — verificado en `pitch.tsx`: `aspect-square … rounded-lg` (líneas 238/273); prohibición documentada en el propio encabezado del archivo. Única excepción circular del dominio: el marcador de amonestación (tarjeta roja, semántica del fútbol real, no es una tesela de jugador).
- **Contenido de tesela**: dorsal, nombre corto, badge de posición, forma/estado; área táctil ≥56 px (mín. 44 px cumplido con margen).
- **Clic en posición → selector de jugadores elegibles** (`slot-dialog.tsx`) con orden/filtrado por rol y disponibilidad.
- **Panel izquierdo**: plantilla y comparación (`squad-panel.tsx`); **panel derecho**: instrucciones, riesgos, feedback (`analysis-panel.tsx`).
- **Controles superiores**: formación, auto-completar (`/api/tactics/auto`), guardar, reset (`/api/tactics`).
- **Explicación táctica contextual** tras cada cambio grande (`analysis-panel`).
- Color de fondo de tesela: `#0b1220` constante de dominio — decisión de accesibilidad deliberada: garantiza contraste del texto blanco sobre CUALQUIER césped en los 5 temas (los tokens de tema gobiernan todo lo demás).
