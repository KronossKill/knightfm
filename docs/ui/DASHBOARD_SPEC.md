# KNIGHT FM — DASHBOARD SPEC (Task 91)

Implementación: `src/components/game/dashboard/` (`widget-registry.tsx`,
`widgets-grid.tsx`, `dashboard-view.tsx`) + `GET/PUT /api/me/dashboard` +
modelo Prisma `DashboardLayout`.

## 1. Modelo de widgets

```ts
interface WidgetDef {
  id: string;                    // estable, sirve a layout + presets
  labelKey: string; descKey: string;   // i18n ×4
  icon: Component;               // lucide
  roles: ("MANAGER" | "OWNER")[];     // visibilidad por rol
  defaultSize: { w: 1|2; h: 1|2 };
  allowedSizes: { w: 1|2; h: 1|2 }[]; // ciclo del botón redimensionar
  render: (ctx: { club: ClubMine | null; clubs: ClubMine[] }) => ReactNode;
}
```

Grid: CSS grid de 4 columnas (1 en móvil, 2 en tablet), `auto-rows minmax(148px,auto)`;
`w`→col-span, `h`→row-span. Cada widget es **autocontenido** (dueño de su
react-query, skeleton, error state con reintento y empty state honesto).

## 2. Widgets implementados (11)

| id | Título (es) | Tamaños permitidos | Roles | Datos (API real) |
|----|-------------|--------------------|-------|------------------|
| `next-match` | Próximo partido | 1×1, 2×1, 2×2, 1×2 | Ambos | `competitions/fixtures?status=SCHEDULED` |
| `last-match` | Último partido | 1×1, 2×1, 2×2, 1×2 | Ambos | `fixtures?status=PLAYED` + acta (`MatchDetailDialog`) |
| `readiness` | Preparación táctica | 4 tamaños | Mánager | `players` (lesiones/sanciones/fatiga) + enlace a Tácticas |
| `squad-status` | Resumen de plantilla | 4 tamaños | Ambos | `players` (nº, media OVR, salarios) |
| `inbox` | Últimos mensajes | 4 tamaños | Ambos | `messages/notifications` (typeKey traducido + GENERIC) |
| `world-clock` | Reloj del mundo | 1×1, 2×1 | Ambos | `world/state` (UTC + día + próximo kickoff con cuenta atrás) |
| `standings` | Clasificación | 4 tamaños | Ambos | `competitions/standings?divisionId` (top 5 + posición propia) |
| `calendar` | Calendario (próximos 5) | 4 tamaños | Ambos | `fixtures?status=SCHEDULED&limit=5` |
| `finance` | Finanzas del club | 4 tamaños | Propietario | `club/mine` (fondo, deuda, estado financiero) + enlaces |
| `facilities` | Instalaciones | 4 tamaños | Propietario | `facilities` (media de nivel, tipos, obras) |
| `treasury-controls` | Tesorería rápida | 1×1, 2×1 | Propietario | enlaces-acción a Tesorería/Cartera (navega; no muta) |
| `youth` | Cantera | 1×1, 2×1 | Mánager | enlace a Cantera |

## 3. Layouts por defecto (por rol, en código)

- **Mánager**: next-match 2×1 · last-match 2×1 · readiness · squad-status · inbox ·
  world-clock · standings 1×2 · (youth disponible para añadir).
- **Propietario**: finance 2×1 · squad-status · inbox · calendar 1×2 · world-clock ·
  standings 1×2 · facilities · treasury-controls.

## 4. Personalización (mandato completo)

- **Añadir**: botón "Añadir widget" → diálogo con los no colocados (rol-filtrado).
- **Quitar**: X por widget (con `aria-label` específico).
- **Redimensionar**: botón que cicla entre los tamaños permitidos del widget
  (1×1 → 2×1 → 2×2 → 1×2 → 1×1). Accesible por teclado (no exige drag).
- **Reordenar**: drag & drop (dnd-kit `rectSortingStrategy`) con **sensor de
  teclado** (`sortableKeyboardCoordinates`): Espacio/Enter levanta, flechas mueven,
  Espacio/Enter suelta, Esc cancela — instrucciones anunciadas por lector.
- **Presets**: guardar la disposición actual con nombre (máx. 8), aplicar con un
  clic, eliminar; "Restaurar por defecto" vuelve al layout del rol.

## 5. Persistencia (server-side por usuario)

- `DashboardLayout { userId @unique, layout JSON, presets JSON, updatedAt }`
  (cascade con el usuario).
- `GET /api/me/dashboard` → `{ customized, widgets, presets }` (si no hay fila:
  defaults del rol). `PUT` valida con zod (≤24 widgets, w/h ∈ {1,2}, ≤8 presets,
  nombre ≤40) y hace upsert. Fila corrupta → se degrada a defaults sin romper la UI.
- Guardado **optimista + debounce 600ms** tras cada cambio con estado visible
  ("Guardando… / Panel guardado / error con reintento").

## 6. Principios

Glanceable (<3s la métrica clave) · Accionable (todo widget tiene enlace/acción) ·
Progresivo (detalle profundo al hacer clic — p. ej. acta del partido) ·
Consistente (misma card, paddings p-4/p-6, tipografía) · Accesible (teclado,
aria-labels, live regions) · Rápido (queries independientes por widget con
staleTime/refetchInterval apropiados) · Persistente (server-side por usuario+rol).

## World Pulse (añadido — Master UI/UX v2.0)

Widget `world-pulse` (1×2, roles MANAGER+OWNER, resize 1×1/1×2/2×2). Fuente: `GET /api/world/pulse`
(solo lectura, autenticado; ventana de presencia D-009 de 5 min; consultas indexadas `[kickoffAt,status]`).

Contenido (glanceable <3 s):
1. **Online snapshot** — mánagers conectados ahora + top-3 países.
2. **Latest results** — últimos 6 resultados del mundo (marcador real de `Match`, etiqueta J## / fase de copa).
3. **Upcoming kickoffs** — próximos 6 pitidos de salida (hora en **UTC**, reloj de solo lectura).

Refetch 60 s, skeleton `aria-busy`, estado vacío honesto, todos los strings vía i18n (es/en/fr/pt),
todos los colores vía tokens semánticos. Sin acciones de estado: es observación pura del mundo vivo.

---

## Master UI/UX v2.0 — Delta del dashboard (implementado)

### Registro de widgets v2.0 (17 widgets, `widget-registry.tsx`)

| id | Widget | Roles | 1×1 | 2×1 | 1×2 | 2×2 | Acción principal |
|---|---|---|:-:|:-:|:-:|:-:|---|
| `next-match` | Próximo partido | M+O | ✓ | ✓ | ✓ | ✓ | Ver calendario |
| `last-match` | Último partido | M+O | ✓ | ✓ | ✓ | ✓ | Detalle del partido |
| `readiness` | Listura táctica | M | ✓ | ✓ | ✓ | ✓ | Ir a tácticas |
| `squad-status` | Estado de plantilla | M+O | ✓ | ✓ | ✓ | ✓ | Ir a plantilla |
| `inbox` | Bandeja | M+O | ✓ | ✓ | ✓ | ✓ | Abrir bandeja |
| `world-clock` | Reloj del mundo (UTC, solo lectura) | M+O | ✓ | ✓ | — | — | — |
| `standings` | Tabla (mini) | M+O | ✓ | ✓ | ✓ | ✓ | Ver competiciones |
| `calendar` | Calendario | M+O | ✓ | ✓ | ✓ | ✓ | Ver calendario |
| `finance` | Finanzas del club | O | ✓ | ✓ | ✓ | ✓ | Ir a tesorería |
| `facilities` | Instalaciones | O | ✓ | ✓ | ✓ | ✓ | Gestionar |
| `treasury-controls` | Tesorería rápida | O | ✓ | ✓ | — | — | Invertir/retirar |
| `youth` | Cantera | M | ✓ | ✓ | — | — | Ir a cantera |
| `world-pulse` | **Pulso mundial** (feed vivo del mundo) | M+O | ✓ | — | ✓ | ✓ | Ver competiciones |
| `top-performers` | **Top de la plantilla** (v2.0) | M | ✓ | ✓ | ✓ | ✓ | Ir a plantilla |
| `squad-overview` | **Resumen de plantilla** (v2.0) | O | ✓ | ✓ | ✓ | ✓ | Ir a plantilla |
| `manager-contract` | **Contrato del mánager** (v2.0) | O | ✓ | ✓ | — | — | Ir a tesorería |
| `insolvency-risk` | **Riesgo financiero** (v2.0) | O | ✓ | ✓ | — | — | Ir a tesorería |

Cada widget: `react-query` propio (refresco 30–120 s), esqueleto de carga, estado vacío/error honestos, cadenas 100% i18n (4 idiomas, paridad 606/606/606/606), colores 100% por tokens.

### Mapeo especificación v2.0 → dominio Knight FM

| Widget del prompt v2.0 | Resolución en Knight FM |
|---|---|
| Previous/Next Match, Tactical Readiness, Squad Status, Inbox, World Clock, Standings, World Pulse, Club Finance, Facilities, Calendar, Treasury Controls | Implementación directa (tabla anterior) |
| **Top Performers** | `top-performers` (top 5 por `ovr`, tendencia por `trendPerAttribute.ovr`) |
| **Squad Overview** (Owner) | `squad-overview` (ocupación vs `capacity.finalCapacity`, media, valor, salarios) |
| **Manager Contract** | `manager-contract` (`ClubMine.contract`: importe, salario diario, días restantes con `gameDay`) |
| **Insolvency Risk** | `insolvency-risk` (`finState` + `debt` + `operatingFund`; icono+texto, nunca solo color) |
| Training Plan | Cubierto por `readiness` + vista Entrenamiento (decisión de dominio; el plan diario vive en su sección) |
| Scouting Reports | Cubierto por `youth` (la cantera ES el sistema de prospección de Knight FM) |
| Commercial / Sponsors | **N/A**: el dominio (Master Spec v2.2) no incluye patrocinios; el equivalente económico es `finance` + `treasury-controls` |

### World Pulse (respuesta al "lost world building" de FM26)

- Feed en vivo de la liga/región: últimos resultados, próximos partidos, mánagers conectados (`/api/world/pulse`, refresco 60 s).
- Presente por defecto en AMBOS roles; lectura pura (nunca muta estado).
- Tamaños permitidos 1×1 / 1×2 / 2×2; vacío honesto ("Todavía no hay actividad del mundo").

### Presets y persistencia (implementados, `widgets-grid.tsx` + `/api/me/dashboard`)

- Tamaños de rejilla soportados: **1×1, 2×1, 1×2, 2×2** (`allowedSizes` por widget, ciclo con botón).
- Reordenar: dnd-kit con asa de arrastre accesible (instrucciones `sr-only` + `aria-describedby`, `min-h-11`).
- Presets: guardar con nombre (máx. 8), aplicar al instante, snapshóstico del layout; persistencia **server-side por usuario + rol** (`customized`, `widgets`, `presets`).
- Por defecto por rol: `defaultLayout(role)` deriva del registro (código, no copias manuales).
