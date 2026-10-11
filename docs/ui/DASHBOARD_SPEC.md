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
