# KNIGHT FM — TEMAS Y TOKENS (Task 91)

## 1. Fuentes de verdad (orden de precedencia)

1. `src/app/globals.css` — bloques `[data-theme="…"]` (**fuente canónica**; los
   tokens existen antes de la hidratación).
2. `docs/ui/themes/tokens/*.json` — extracción verbatim por tema (generada).
3. `src/lib/theme-tokens.ts` — módulo tipado generado desde (2).

> Si editas un tema: edita globals.css y regenera (2)/(3). Nada más.

## 2. Contrato de tokens por tema

Cada tema define (paridad exigida, `REQUIRED_TOKEN_NAMES`):
`background, foreground, card, card-foreground, popover, popover-foreground,
primary, primary-foreground, secondary, secondary-foreground, muted,
muted-foreground, accent, accent-foreground, destructive,
destructive-foreground, border, input, ring, chart-1..5, sidebar*`.

Consumo SIEMPRE vía utilidades semánticas Tailwind:
`bg-background text-foreground bg-card border-border bg-primary/15 text-primary…`
Prohibido `bg-[#hex]` en UI (excepciones auditadas: césped del tablero).

## 3. Los 5 temas

| id | Nombre | Modo | Dirección |
|----|--------|------|-----------|
| `knight-emerald` | Esmeralda Caballero | oscuro | Premium oscuro, esmeralda, metálico contenido (**default**) |
| `obsidian` | Obsidiana Nocturna | oscuro | Monocromo casi negro, plata/blanco |
| `royal` | Azul Real | oscuro | Marino profundo + oro refinado |
| `aurora` | Aurora Boreal | oscuro | Grafito + gradientes fríos (cian/violeta) |
| `classic` | Verde Clásico | **claro** | Verde profundo, señas futbolísticas clásicas |

## 4. Selector y proveedor (mandato: THEME_PROVIDER.tsx / THEME_SELECTOR.tsx)

- **Proveedor**: `src/components/theme-provider.tsx` (`ThemeProvider`, `useTheme`):
  aplica `data-theme` + `localStorage("knightfm.theme")`; el tema **nunca** toca
  estado de juego. Sincronizado con la BD (`User.theme`) por el backend.
- **Selectores en UI**: (a) menú de usuario del shell (dropdown con muestras de
  color `swatch`); (b) selector del AuthFlow (pantalla de acceso); (c) paleta de
  comandos (grupo "Cambiar tema"). Tres entradas, un mismo estado global.
- Añadir tema = 1 bloque CSS + 1 entrada en `THEMES` + swatch. La paleta, el
  menú y el AuthFlow lo recogen solos.

## 5. WCAG AA por tema (resumen operativo)

- Texto normal ≥4.5:1; grande/UI ≥3:1. Pares críticos verificados por tema:
  `foreground/background`, `muted-foreground/background` (≥4.5), `primary/
  primary-foreground`, texto sobre `bg-primary/15` (usa foreground normal).
- `classic` (claro): muted-foreground 38% de luz sobre fondo 97% → AA ✓.
- Regla anti "solo color": todo estado lleva icono/texto además del color
  (lesión=⚠+texto, sanción=🚫+texto, no leído=punto+contador numérico).
- Foco visible 2px con `ring` del tema en TODOS los interactivos.

## 6. Estados y elevación (convenciones)

- Hover: `bg-accent`; activo/seleccionado: `bg-primary/15 text-primary`; disabled:
  `opacity-50 pointer-events-none`; foco: `ring-2 ring-ring`.
- Superficies: `bg-card` (elevada) sobre `bg-background` (base); sunken =
  `bg-muted/40`; overlay = Radix overlay + `bg-background/80 backdrop-blur`.
- Radios: `rounded-md` (controles) / `rounded-lg`/`xl` (cards, campo).
- Sombras: `shadow-xs` controles, `shadow-lg shadow-primary/20` CTA principal.
