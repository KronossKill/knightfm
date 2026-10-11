# KNIGHT FM — ARQUITECTURA DE NAVEGACIÓN (Task 91)

Implementación viva: `src/components/game/shell.tsx` (+ `command-palette.tsx`,
`view-store.ts`). El juego es una SPA bajo `/`: las "pantallas" son vistas del
shell (`GameView`) con estado persistente en el cliente y datos server-authoritative.

## 1. Capas de navegación

### 1.1 Barra lateral (desktop ≥1024px)
- **Expandida** por defecto (etiquetas + iconos), **colapsable a iconos**
  (botón PanelLeft; persistido en `localStorage.kfm.shell.collapsed`).
- **Fijadas**: hasta **5** secciones favoritas como grupo propio en cabeza
  (`kfm.shell.pins`). Botón de chincheta al pasar el ratón sobre cada fila;
  teclado accesible (focus visible + aria-pressed).
- Activa = `aria-current="page"` + acento del tema.
- Grupos: **Principal** (Dashboard, Plantilla, Tácticas, Entrenamiento,
  Instalaciones, Personal, Cantera, Competiciones) y **Sistema** (Mercados,
  Tesorería, Cartera, Bandeja, Ajustes; Control Center solo rol ADMIN).

### 1.2 Top bar (siempre visible)
- Identidad del club activo + selector multi-club (rol OWNER).
- **Buscador global** (abre la paleta; muestra `Ctrl+K` / `⌘K`).
- **Reloj del mundo** (UTC + día de juego + día de temporada/pretemporada).
  **Solo lectura** — nunca hay botones de avanzar tiempo.
- Presencia en vivo (conectados + banderas por país).
- Campana de mensajes con contador de no leídos.
- Menú de usuario (tema, idioma, ajustes, salir) con verificación de ADMIN.
- **Sin** "Avanzar día" ni "Jugar partido" (regla dura del mandato).

### 1.3 Paleta de comandos (`Ctrl/Cmd+K`)
- Ir a cualquier vista; buscar jugadores del club activo (nombre + OVR + posición);
  cambiar tema (5) e idioma (4); accesos a Cartera/Tesorería.
- **Recientes** (últimos 5, `knightfm.palette.recents`), scoring difuso de cmdk,
  `Esc` cierra, navegación por flechas nativa de Radix.
- Abrible desde: teclado, botón del top bar.

### 1.4 Atajos de teclado
| Atajo | Acción |
|-------|--------|
| `Ctrl/Cmd + K` | Paleta de comandos |
| `Ctrl/Cmd + 1..9` | Saltar a la sección principal N |
| `Tab / Shift+Tab` | Foco visible (anillo acento 2px) |
| `Esc` | Cierra paleta/diálogos |
| Espacio/Enter + flechas | Reordenar widgets (dnd-kit, teclado) |

### 1.5 Móvil (<1024px)
- **Barra inferior fija** con 4 secciones de alta frecuencia + **"Más"**
  (abre el drawer con la lista completa). Safe-area respetada
  (`env(safe-area-inset-bottom)`), objetivos ≥44px.
- Drawer lateral completo (mismo NavList) accesible también desde la hamburguesa.

## 2. Secciones primarias (8)

| # | Sección | Vista | Propósito |
|---|---------|-------|-----------|
| 1 | Panel | `dashboard` | Hub de widgets personalizable |
| 2 | Plantilla | `squad` | Jugadores, detalles, cláusulas |
| 3 | Tácticas | `tactics` | Tablero, alineación, instrucciones |
| 4 | Entrenamiento | `training` | Planes y desarrollo |
| 5 | Instalaciones | `facilities` | Niveles, mejoras, cola |
| 6 | Personal | `staff` | Cuerpo técnico |
| 7 | Cantera | `youth` | Prospección y promesas |
| 8 | Competiciones | `competitions` | Calendario, clasificación, copas, mundial |

Sistema: Mercados, Tesorería, Cartera (depósitos verificados con QR), Bandeja,
Ajustes; Control Center (ADMIN).

## 3. Principios operativos (cumplidos en código)

1. **≤2 clics a cualquier pantalla**: sidebar + paleta + bottom bar.
2. **Sin callejones sin salida**: toda pantalla tiene retorno (sidebar/paleta/back).
3. **Persistencia**: club activo y vista viven en `view-store` (zustand).
4. **Deep-linking**: el juego vive bajo `/` (SPA); la ruta del navegador es única
   para la app por diseño del producto (mundo persistente).
5. **Keyboard-first**: paleta + atajos + reorder por teclado (ver tabla).
6. **Responsive**: bottom bar <1024px; sidebar iconos en tablet; 4K centrado.
7. **Sin controles de tiempo**: el reloj es display-only (mandato).

## 4. Modos restringidos (casos de borde)

- **"Solo Control Center"** (ADMIN sin club): navegación limitada a Control Center.
- **"Ir a depositar"** (escape de fondos insuficientes): navegación limitada a
  Cartera. Ambos modes muestran banner explicativo + botón de salida; el modo de
  depósito tiene precedencia.
