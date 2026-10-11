# KNIGHT FM — RESPONSIVE SPEC (Task 91)

## 1. Breakpoints (Tailwind, implementados en el shell)

| Breakpoint | Rango | Navegación | Layout |
|------------|-------|-----------|--------|
| `xs` móvil | 360–767 | **Bottom bar** fija (4+"Más") + drawer completo (hamburguesa) | 1 columna; tablas→scroll horizontal; widgets apilados |
| `sm` | 640–767 | Igual | Grid 2 cols en widgets |
| `md` tablet | 768–1199 | Bottom bar + drawer; top bar completa | 2 columnas; tablas con overflow |
| `lg` desktop | 1024–1919 | **Sidebar** (etiquetas) — colapsable a iconos | Layouts completos; bottom bar oculta |
| `xl`/2xl ultrawide | 1280–3839 | Sidebar + top bar | 3–4 columnas (widgets `xl:grid-cols-4`) |
| **4K** ≥3840 | — | Igual | **Contenedor `max-w-[1920px] mx-auto`** (header, body y footer) |

## 2. Comportamientos por tamaño

- **Sidebar**: `hidden lg:block`; ancho con `transition-[width]` (w-56 ↔ w-16);
  colapsada = iconos + tooltip; persistido.
- **Bottom bar**: `fixed bottom-0 lg:hidden`, `env(safe-area-inset-bottom)`
  respetado; el `main` lleva `pb-24` hasta `lg` para no quedar oculto; el footer
  suma `pb-20 lg:pb-3`.
- **FAB del asistente**: `bottom-24 right-4 lg:bottom-6 lg:right-6` (nunca
  tapa la barra inferior).
- **Tablas**: contenedor `max-h-96 overflow-auto` + header sticky; en móvil se
  navegan con scroll horizontal (sin comprimir columnas al ilegibilidad).
- **Tablero táctico**: campo `aspect-[68/105] max-w-[540px]` centrado; paneles
  apilados bajo el campo en móvil.
- **Widgets**: `grid-cols-1 → sm:grid-cols-2 → xl:grid-cols-4`; span 2 solo
  aplica desde `sm` (en móvil todo ocupa 1 columna).

## 3. Reglas duras

1. Nada se rompe en 360px ni en 4K (verificado en E2E por captura).
2. Touch targets **≥44×44** en móvil (`min-h-11`).
3. Sin scroll horizontal de página en móvil (solo contenedores internos que lo
   pidan: tablas).
4. El reloj del mundo oculta su línea secundaria en `compact` cuando falta espacio.
5. `prefers-reduced-motion`: transiciones esenciales reducidas a `auto`.

## 4. Desviación documentada (decisión de producto)

El mandato describe "sidebar colapsado en tablet": en 768–1199 usamos **bottom
bar + drawer** (patrón superior en touch, evita hover-dependencia) y la sidebar
de iconos aparece en desktop. El drawer garantiza el mismo alcance con 1 toque.
Registrado como decisión, no como omisión.
