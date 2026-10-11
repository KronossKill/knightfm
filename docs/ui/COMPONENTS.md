# KNIGHT FM — ESPECIFICACIÓN DE COMPONENTES (Task 91)

Consume tokens definidos en THEMES_TOKENS.md. Cada spec aplica a los 5 temas
(por diseño, vía tokens). Base: shadcn/ui + Radix (New York).

## Botones (Button)
- `primary`: `bg-primary text-primary-foreground hover:bg-primary/90` — máx. 1 por región.
- `secondary/outline`: `border bg-primary/5 hover:bg-primary/15`.
- `ghost`: hover `bg-accent`; `destructive`: `text-destructive` (variant).
- `icon`: 36px desktop, **≥44px en móvil** (`min-h-11 min-w-11`).
- Estados: focus `ring-2 ring-ring`; disabled `opacity-50`; loading = `Loader2 animate-spin`.
- Alturas: h-8/h-9 (sm), h-10 (md), h-11 (touch).

## Inputs (Input/Select/Checkbox/Radio/Switch/Textarea)
- Altura h-9, `border-input bg-transparent`, focus `ring-[3px] ring-ring/50`.
- `aria-invalid` → borde destructivo (estilo integrado en el componente).
- Label visible siempre (`<Label htmlFor>`); hints con `aria-describedby`;
  errores inline con `role="alert"` (ej.: "Las contraseñas no coinciden.").
- Campo de contraseña con **ojo** mostrar/ocultar (`PasswordInput` del AuthFlow):
  `aria-pressed`, aria-label dinámico.

## Navegación
- **Sidebar**: expandida w-56 / colapsada w-16 (iconos + tooltip `title`).
  Item activo `bg-primary/15 text-primary` + `aria-current="page"`. Fijadas con
  chincheta (`aria-pressed`), grupo propio, máx. 5.
- **Top bar** h-14 sticky: club activo, buscador (⌘K), reloj UTC (solo lectura),
  presencia, campana con badge numérico, menú usuario.
- **Bottom bar móvil** fija: 4 secciones + "Más"; activo = acento; safe-area.
- **Tabs/Pills**: `bg-muted` contenedor, activa `bg-background shadow-xs`.
- **Breadcrumbs**: texto muted-foreground, separador `/`, último = foreground.

## Cards
- `rounded-xl border bg-card`; header `pb-3`, contenido `p-4/p-6`.
- `interactive`: hover `border-primary/40` + cursor; `selected`: `ring-primary`;
  widget card: header con grip de arrastre + acciones (resize/quitar).

## Player tile (tablero táctico)
- **Cuadrado** `aspect-square rounded-lg`, borde rol, dorsal + inicial + badge.
- Estados: hueco vacío (borde discontinuo), ocupado (fondo elevado), seleccionado
  (ring). Nunca circular (regla dura).

## Club tile / BrandBadge
- Escudo con forma del club (shield/circle/square) + patrón; nombre truncado.

## KPI / métrica (KV)
- `dt` uppercase 10px muted + `dd` bold tabular-nums (posiciones/dinero con
  `font-mono tabular-nums`); variante grande 2xl para widgets.

## Data table
- Header sticky `bg-background/95 backdrop-blur`; filas hover `bg-accent/50`;
  zebra opcional `bg-muted/20`; seleccionada `bg-primary/10`; celdas numéricas
  `text-right font-mono tabular-nums`; scroll horizontal en móvil (contenedor
  `overflow-auto` con máx. altura y scrollbar estilizada).

## Status badge
- Lesión: rojo destructivo + icono; sanción: ámbar + icono; contrato: outline;
  forma: tendencia (flecha + número) — **siempre icono/texto + color**.

## Alert / Toast / Banner
- `Alert` con icono y `AlertTitle/Description`; variantes: default, `destructive`,
  ámbar (avisos honestos "modo prueba"/mantenimiento). Toasts vía `useToast`
  (éxito neutro, error destructivo). Banner de mantenimiento `role="alert"`.

## Modal / Dialog / Drawer / Popover
- Radix: overlay `bg-black/60`, contenido `bg-card rounded-xl border shadow-2xl`,
  foco atrapado, `Esc` cierra, título+descripción obligatorios (a11y).
- Drawer móvil = `Sheet` (side left) con NavList completo.

## Paleta de comandos
- `CommandDialog` (cmdk): input con placeholder, grupos (Recientes, Ir a,
  Plantilla, Temas, Idioma, Finanzas), `CommandEmpty` honesto, kbd hint ⌘K/Ctrl+K.

## Widget card (dashboard)
- Header: grip (drag accesible) + icono + título + resize + quitar.
- Cuerpo autocontenido (skeleton/error/empty propios). Spans por tamaño.

## Gráficos y timelines
- `recharts` (línea/barra/radar) con colores de tokens (`chart-1..5`); eje y
  grid `border-border`. Timeline de acta: lista vertical con iconos por evento
  (gol ⚽, cambio 🔄, tarjeta) — nunca solo color.

## Código QR (Cartera)
- `QRCodeSVG` sobre `bg-white p-1.5` (contraste de escaneo), dirección en
  `font-mono break-all`, botón "Copiar dirección" con feedback ✓+toast.
