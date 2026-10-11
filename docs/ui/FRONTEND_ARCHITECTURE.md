# KNIGHT FM — ARQUITECTURA FRONTEND (React + TypeScript) (Task 91)

## 1. Stack

Next.js 16 (App Router, exact 16.1.3) · TypeScript 5 · Tailwind CSS 4 ·
shadcn/ui (New York) + Radix · TanStack Query (server state) · Zustand (client
state: sesión `auth/store`, vistas `view-store`) · dnd-kit (drag accesible) ·
framer-motion (landing) · cmdk (paleta) · qrcode.react · Prisma 6 (backend).

## 2. Árbol relevante

```
src/
  app/
    page.tsx                     → única ruta: monta <AppRoot/> (ssr:false)
    api/…                        → backend REST (route handlers, zod, rate-limit)
    globals.css                  → tokens de los 5 temas ([data-theme])
  components/
    auth/                        → AuthFlow (login/registro/verify/reset), store
    theme-provider.tsx           → ThemeProvider (useTheme)
    landing/                     → port pública (secciones + descargas)
    game/
      app-root.tsx               → Landing ⇄ AuthFlow ⇄ GameShell (estado sesión)
      shell.tsx                  → top bar + sidebar + bottom bar + paleta + FAB
      view-store.ts              → GameView activo + club activo (zustand)
      api.ts                     → fetchers + tipos del dominio (contrato UI↔API)
      lazy-modules.tsx           → módulos pesados con next/dynamic
      dashboard/                 → widget-registry · widgets-grid · dashboard-view
      command-palette.tsx        → paleta global (Ctrl+K)
      squad/ tactics/ training/ facilities/ staff/ youth/ competitions/
      markets/ treasury/ wallet/ inbox/ settings/ control-center/ assistant/
      ui/bits.tsx                → BrandBadge, EmptyState, ErrorState, KV, useNow…
  lib/
    themes.ts                    → THEMES/LANGUAGES (ids, swatch, validación)
    theme-tokens.ts              → tokens tipados generados de globals.css
    i18n/                        → diccionarios ×4 (auth/game/landing/markets/…)
```

## 3. Reglas de arquitectura

1. **Solo `/` como ruta de app**; el shell intercambia vistas por estado (SPA).
2. **Server state = TanStack Query** con claves estables (`qk.*`); **client state
   = Zustand** (nunca mezclar: no persistas respuestas API en stores).
3. **Todo texto por i18n** (4 idiomas; namespaces por dominio). Prohibido
   hardcodear strings visibles.
4. **Tokens, no colores**: utilidades semánticas Tailwind (ver THEMES_TOKENS).
5. **Módulos pesados lazy**; el shell nunca importa vistas pesadas directo.
6. **Contrato de datos**: los tipos viven en `api.ts` (o `markets/types.ts`) y
   coinciden 1:1 con los route handlers (validados con zod en el backend).
7. **Accesibilidad por defecto**: botones reales, labels, focus visible, live
   regions; los componentes de dominio reutilizan `ui/bits.tsx`.
8. **Nada de estado de juego en la UI**: la UI observa y navega; las mutaciones
   pasan por la API (server-authoritative), con toasts de resultado.

## 4. Convenciones

- Componentes de vista: `XView.tsx` default-export; piezas privadas en el mismo
  archivo salvo reutilización (`registry`).
- Queries: `queryKey` jerárquico `["dashboard","fixtures","next",clubId]`;
  invalidación dirigida tras mutaciones.
- Errores de API: códigos estables (`VALIDATION`, `RATE_LIMITED`, `DEPOSIT_*`…)
  mapeados a mensajes i18n en cliente; nunca exponer detalles internos.
- Estilos: Tailwind + `cn()` (clsx+tailwind-merge); variantes con `cva` cuando
  aplican (Button/Badge shadcn ya lo hacen).

## 5. Extensión

- **Nuevo widget**: entrada en `WIDGET_REGISTRY` + i18n ×4. Grid/persistencia
  intactos.
- **Nueva sección**: `NAV_MAIN`/`NAV_SYSTEM` (+ lazy si pesa) + i18n. Paleta y
  atajos la adoptan solos.
- **Nuevo tema**: bloque CSS + `THEMES` + regenerar tokens (THEMES_TOKENS §1).

---

## Master UI/UX v2.0 — Delta de arquitectura frontend

### Pipeline único de tokens (fuente única de verdad)

```
globals.css [data-theme="…"]            ← única fuente editable
  └→ src/lib/theme-tokens.ts            ← extracción canónica (T91)
       ├→ scripts/verify-wcag-contrast.mjs   → docs/ui/themes/wcag-contrast.md  (gate WCAG AA)
       └→ scripts/export-theme-deliverables.mjs
            └→ docs/ui/themes/{css,ts,json}/<tema>.*  + README.md  (entregable v2.0)
```

- Los componentes SOLO consumen utilidades semánticas (`bg-background`, `text-muted-foreground`, `bg-danger`…). Colores hardcodeados prohibidos; excepción de dominio documentada: césped/fondo de tesela táctica (`#0b1220`).
- Añadir un tema = nuevo bloque `[data-theme]` + entrada en `themes.ts` + regenerar export + verificador en verde.

### Estado

- **Servidor**: TanStack Query (claves por dominio; refrescos 30–120 s).
- **UI**: Zustand (`view-store` con deep linking `?view=` + última pantalla en `sessionStorage`; `depositEscape`).
- **Dashboard**: layouts y presets en servidor (`/api/me/dashboard` por usuario+rol).
- **Paleta**: favoritos/recientes en `localStorage` (por dispositivo, sin PII).

### i18n (4 idiomas, paridad verificada)

- Diccionarios planos por namespace (`dict/<ns>/{es,en,fr,pt}.ts`) — paridad 606/606/606/606 claves en `game.*`.
- Español primario; interpolación `{n}`; reutilización de `common.*` (`player.trend.*`, `err.generic`).
