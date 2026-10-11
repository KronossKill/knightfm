# KNIGHT FM — PERFORMANCE SPEC (Task 91)

## 1. Presupuesto

| Métrica | Objetivo | Estado/estrategia |
|---------|----------|-------------------|
| LCP | < 2.5s | Landing sin bloqueo; logo `priority`; imágenes lazy |
| INP | < 200ms | Interacciones locales (zustand) sin round-trips; mutaciones optimistas |
| CLS | < 0.1 | Skeletons con dimensiones fijas; sin banners que aparecen sin hueco |
| JS inicial (gzip) | < 200KB | Code splitting por módulo (ver §2) |
| Animaciones | 60fps | Solo transform/opacity (framer-motion, dnd-kit Translate) |

## 2. Estrategia aplicada en el código

- **Code splitting por módulo**: mercados/tesorería/cartera/tácticas/control-center/
  bandeja cargan perezosos (`lazy-modules.tsx` + `next/dynamic`); el shell y el
  dashboard cargan síncronos (primera pantalla autenticada).
- **Widgets independientes**: cada widget tiene su react-query (claves aisladas,
  `staleTime` 30–60s, `refetchInterval` 60–120s) → fallo de uno no bloquea el
  panel; skeletons por widget; **CSS containment** por card (layout propio).
- **Polling razonable**: mundo/presencia/notificaciones 60s (top bar) — sin
  websockets para datos que cambian por minutos; countdown local vía `useNow`
  (1 timer compartido, no N timers).
- **Consultas**: solo campos necesarios (`select` en Prisma), paginación en
  tablas (ledger 50); índices en BD para los órdenes de clasificación.
- **Imágenes**: next/image con lazy por defecto; `priority` solo logo/hero.
- **Listas grandes**: virtualización disponible (tabla de plantilla usa
  ventanas/limit del servidor; paleta limita 60 resultados).

## 3. Reglas para nuevos componentes

1. Todo async → skeleton con dimensiones (nunca spinner de pantalla completa).
2. Toda lista >100 items → paginar en servidor o virtualizar.
3. Animar solo `transform/opacity`; nada de animar width/height/top/left.
4. No añadir dependencias sin necesidad (el bundle manda); reutilizar shadcn.
5. Un timer global (`useNow`) por pantalla, no uno por widget.

## 4. Medición

- Lighthouse móvil en preview antes de cada entrega mayor (objetivo ≥90 PWA-ish).
- dev.log sin queries N+1 nuevas (revisar `prisma:query` repetidos en ráfaga).
