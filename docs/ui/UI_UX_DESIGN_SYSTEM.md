# KNIGHT FM — UI/UX DESIGN SYSTEM (v1, Task 91)

> Documento raíz del sistema de diseño. Idioma: español (primario).
> Fuente única de verdad: el código (`src/app/globals.css`, `src/lib/themes.ts`,
> `src/lib/theme-tokens.ts`, `src/components/game/*`). Si este documento y el
> código discrepan, manda el código y se corrige el documento.

## 1. Principios

1. **Base oscura premium**: fondos profundos, superficies elevadas, acentos contenidos.
2. **Densidad útil**: alta información, respirable. Nada de ruido ni espacio perdido.
3. **Jerarquía de 3 niveles de texto** (título / cuerpo / nota) y **2 de superficies** (card / fondo).
4. **Consistencia**: los mismos componentes funcionan idénticos en los 5 temas.
5. **Elegancia**: color contenido, alineación precisa, whitespace generoso.
6. **Identidad fútbol**: escudos de club (BrandBadge), césped del tablero táctico, motifs de copa.
7. **Movimiento sutil y con propósito**: respeta `prefers-reduced-motion`.
8. **Accesibilidad WCAG 2.1 AA** en todos los temas y breakpoints.
9. **El mundo manda**: la UI es capa de control/observación de un mundo persistente
   server-authoritative. **Nunca** existen botones "Avanzar día" ni "Jugar partido";
   el reloj es de solo lectura (UTC como único reloj).
10. **Sin dinero inventado**: estados vacíos honestos; ninguna métrica se fabrica.

## 2. Los 5 temas (ningún competidor ofrece más de 1)

| # | Tema | id | Modo | Dirección |
|---|------|----|------|-----------|
| 1 | Esmeralda Caballero | `knight-emerald` | Oscuro | Premium oscuro / esmeralda / metálico contenido. **Por defecto.** |
| 2 | Obsidiana Nocturna | `obsidian` | Oscuro | Monocromo casi negro, alto contraste, acentos plata/blanco |
| 3 | Azul Real | `royal` | Oscuro | Azul marino profundo con oro refinado |
| 4 | Aurora Boreal | `aurora` | Oscuro | Grafito oscuro con gradientes fríos luminosos |
| 5 | Verde Clásico | `classic` | **Claro** | Verde profundo elegante con señas del fútbol tradicional |

- Tokens completos por tema: `docs/ui/themes/tokens/*.json` (extraídos verbatim del CSS)
  y módulo tipado `src/lib/theme-tokens.ts`.
- Contratos: cada tema define **19+ tokens semánticos** (background, foreground, card,
  popover, primary, secondary, accent, destructive, muted, border, input, ring,
  chart-1..5, sidebar-*). Paridad garantizada por `REQUIRED_TOKEN_NAMES`.
- El cambio de tema **nunca** afecta estado de juego (`ThemeProvider` solo toca
  `data-theme` + localStorage). Persistencia por usuario en la BD (`User.theme`).

## 3. Sistema de componentes (resumen; detalle en COMPONENTS.md)

Todos los componentes consumen **tokens semánticos** vía utilidades Tailwind
(`bg-background`, `text-foreground`, `bg-primary`, `border-border`…). Prohibido
hardcodear colores (excepción auditada: césped del tablero táctico, que usa verde
de campo literal por realismo deportivo).

Biblioteca base: shadcn/ui (New York) sobre Radix — botones, inputs, tabs, cards,
diálogos, dropdowns, sheets, toasts, tables, badges, progress, skeletons, command.
Componentes de dominio: player tile cuadrado (tácticas), club tile, KPI/KV, tabla de
plantilla, timeline de acta, widget card (dashboard), sidebar, top bar, paleta de
comandos, QR de depósito, insignias de estado (lesión/sanción/contrato/forma).

## 4. Navegación híbrida (detalle en NAVIGATION_ARCHITECTURE.md)

Barra lateral colapsable (iconos ↔ etiquetas) + top bar contextual + **paleta de
comandos Ctrl/Cmd+K** + atajos **Ctrl+1..9** + sección "Fijadas" (3–5 favoritos) +
barra inferior móvil (5 secciones + "Más"). Máximo 2 clics a cualquier pantalla.

## 5. Dashboard de widgets (detalle en DASHBOARD_SPEC.md)

Hub personalizable: añadir/quitar/redimensionar (1×1, 2×1, 1×2, 2×2)/reordenar por
drag accesible/presets con nombre. Persistido **server-side** por usuario
(`DashboardLayout`, `GET/PUT /api/me/dashboard`). Layouts por defecto por rol
(Mánager vs Propietario) definidos en el registro de widgets.

## 6. Tablero táctico (detalle en TACTICAL_BOARD_SPEC.md)

Fichas **cuadradas** (regla dura: nunca círculos), césped interactivo, panel
izquierdo (plantilla), panel derecho (análisis), diálogo de posición con filtros.
La vista combinada/posesión/defensa y la explicación táctica contextual viven en
`src/components/game/tactics/`.

## 7. Responsive (detalle en RESPONSIVE_SPEC.md)

| Breakpoint | Navegación | Contenido |
|------------|-----------|-----------|
| Móvil 360–767 | Barra inferior fija (4+"Más") + drawer | Tarjetas apiladas, tablas→listas |
| Tablet 768–1199 | Sidebar colapsado a iconos + top bar | 2 columnas, scroll horizontal en tablas |
| Desktop 1200–1919 | Sidebar expandida (etiquetas) | Layouts completos, multi-columna |
| Ultrawide 1920–3839 | Sidebar + top bar | Contenido centrado, hasta 3 columnas |
| 4K ≥3840 | Igual que ultrawide | Contenido centrado, máx. 1920px |

## 8. Accesibilidad y rendimiento

Checklists completos en ACCESSIBILITY_SPEC.md y PERFORMANCE_SPEC.md.

## 9. Gobierno del sistema

- **Añadir un tema**: definir bloque `[data-theme="x"]` en globals.css con los
  tokens requeridos → añadirlo a `THEMES` (lib/themes) y a `THEME_TOKENS`.
- **Añadir un widget**: entrada en `WIDGET_REGISTRY` (id, roles, tamaños, render)
  + claves i18n ×4. El grid y la persistencia no requieren cambios.
- **Añadir una sección**: entrada en `NAV_MAIN`/`NAV_SYSTEM` + i18n; la paleta y
  los atajos la recogen automáticamente.
