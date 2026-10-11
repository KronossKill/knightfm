"use client";
// Knight FM — widget grid framework (Task 32 — Master UI/UX dashboard).
// Customizable dashboard: add/remove widgets, resize (1×1 · 2×1 · 1×2 · 2×2),
// drag to reorder (desktop) with accessible up/down buttons (touch), instant
// presets and per-user + per-role server persistence via /api/me/preferences.

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ListPlus,
  Maximize2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/auth/store";
import {
  fetchPreferences,
  fetchUpdatePreferences,
  qk,
  type ClubMine,
  type UserPreferences,
} from "@/components/game/api";
import {
  DEFAULT_LAYOUTS,
  MAX_WIDGETS,
  PRESETS,
  WIDGETS,
  sanitizeLayout,
  widgetById,
  type DashboardRole,
  type WidgetPlacement,
  type WidgetSize,
} from "./widget-registry";

const SIZE_CLASS: Record<WidgetSize, string> = {
  "1x1": "col-span-1 row-span-1",
  "2x1": "col-span-2 row-span-1",
  "1x2": "col-span-1 row-span-2",
  "2x2": "col-span-2 row-span-2",
};

const SIZE_CYCLE: WidgetSize[] = ["1x1", "2x1", "2x2", "1x2"];

export function WidgetGrid({ role, club, clubs }: { role: DashboardRole; club: ClubMine; clubs: ClubMine[] }) {
  const { t } = useI18n();
  const { user } = useAuth();

  const prefsQuery = useQuery({
    queryKey: qk.preferences,
    queryFn: fetchPreferences,
    enabled: !!user,
    staleTime: Infinity,
  });

  const [layout, setLayout] = React.useState<WidgetPlacement[]>(() => {
    // Synchronous first paint from cache when available (same query key as the shell).
    const cached = (prefsQuery.data as UserPreferences | undefined)?.dashboardLayouts?.[role];
    return sanitizeLayout(cached, role) ?? DEFAULT_LAYOUTS[role];
  });
  const [editMode, setEditMode] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const dragIndex = React.useRef<number | null>(null);
  /** Role whose server layout has already been applied — remount/role-switch safe. */
  const hydratedRoleRef = React.useRef<DashboardRole | null>(null);

  // Hydrate from the server layout for this role (validated against the registry).
  React.useEffect(() => {
    if (hydratedRoleRef.current === role) return;
    if (!prefsQuery.isSuccess && !!user) return; // wait for the GET, keep the default meanwhile
    const serverLayout = (prefsQuery.data as UserPreferences | undefined)?.dashboardLayouts?.[role];
    const sanitized = sanitizeLayout(serverLayout, role);
    setLayout(sanitized ?? DEFAULT_LAYOUTS[role]);
    hydratedRoleRef.current = role;
  }, [prefsQuery.data, prefsQuery.isSuccess, role, user]);

  const persist = React.useCallback(
    (next: WidgetPlacement[]) => {
      if (!user) return;
      const current = (prefsQuery.data as UserPreferences | undefined)?.dashboardLayouts ?? {};
      void fetchUpdatePreferences({
        dashboardLayouts: { ...current, [role]: next },
      }).catch(() => {});
    },
    [user, prefsQuery.data, role]
  );

  const commit = React.useCallback(
    (next: WidgetPlacement[]) => {
      setLayout(next);
      persist(next);
    },
    [persist]
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= layout.length || from === to) return;
    const next = [...layout];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next);
  };

  const resize = (index: number) => {
    const current = layout[index];
    const nextSize = SIZE_CYCLE[(SIZE_CYCLE.indexOf(current.size) + 1) % SIZE_CYCLE.length];
    const next = layout.map((p, i) => (i === index ? { ...p, size: nextSize } : p));
    commit(next);
  };

  const remove = (index: number) => commit(layout.filter((_, i) => i !== index));

  const add = (id: string) => {
    if (layout.length >= MAX_WIDGETS) return;
    const def = widgetById(id);
    if (!def || layout.some((p) => p.id === id)) return;
    commit([...layout, { id, size: def.defaultSize }]);
    setAddOpen(false);
  };

  const applyPreset = (presetId: string) => {
    const preset = PRESETS[role].find((p) => p.id === presetId);
    if (!preset) return;
    commit(sanitizeLayout(preset.layout, role) ?? preset.layout);
  };

  const reset = () => commit(DEFAULT_LAYOUTS[role]);

  const available = WIDGETS.filter((w) => w.roles.includes(role) && !layout.some((p) => p.id === w.id));

  return (
    <div className="space-y-3">
      {/* Toolbar: presets · edit toggle · add · reset */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="min-h-9">
              <Sparkles aria-hidden="true" className="mr-1.5 size-4 text-brand" />
              {t("game.dash.presets")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{t("game.dash.presets")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PRESETS[role].map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => applyPreset(p.id)}>
                {t(p.labelKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant={editMode ? "default" : "outline"}
          size="sm"
          className={cn("min-h-9", editMode && "bg-brand-deep text-white hover:bg-brand")}
          onClick={() => setEditMode((v) => !v)}
          aria-pressed={editMode}
        >
          <GripVertical aria-hidden="true" className="mr-1.5 size-4" />
          {editMode ? t("game.dash.doneEditing") : t("game.dash.editLayout")}
        </Button>

        {editMode && (
          <>
            <Button variant="outline" size="sm" className="min-h-9" onClick={() => setAddOpen(true)} disabled={layout.length >= MAX_WIDGETS}>
              <ListPlus aria-hidden="true" className="mr-1.5 size-4" />
              {t("game.dash.addWidget")}
            </Button>
            <Button variant="ghost" size="sm" className="min-h-9" onClick={reset}>
              <RotateCcw aria-hidden="true" className="mr-1.5 size-4" />
              {t("game.dash.resetLayout")}
            </Button>
          </>
        )}
        <span className="ml-auto hidden text-xs text-muted-foreground sm:block">{t("game.dash.layoutHint")}</span>
      </div>

      {/* Grid */}
      <div
        role="list"
        aria-label={t("game.dash.title")}
        className="grid auto-rows-[160px] grid-cols-2 gap-3 md:grid-cols-4"
      >
        {layout.map((placement, index) => {
          const def = widgetById(placement.id);
          if (!def) return null;
          const Content = def.component;
          return (
            <div
              key={placement.id}
              role="listitem"
              draggable={editMode}
              onDragStart={(e) => {
                dragIndex.current = index;
                e.dataTransfer.effectAllowed = "move";
                try {
                  e.dataTransfer.setData("text/plain", placement.id);
                } catch {}
              }}
              onDragOver={(e) => {
                if (dragIndex.current === null) return;
                e.preventDefault();
                if (dragIndex.current !== index) {
                  const from = dragIndex.current;
                  const next = [...layout];
                  const [item] = next.splice(from, 1);
                  next.splice(index, 0, item);
                  dragIndex.current = index;
                  setLayout(next);
                }
              }}
              onDragEnd={() => {
                if (dragIndex.current !== null) {
                  dragIndex.current = null;
                  persist(layout);
                }
              }}
              className={cn(
                "group/w relative min-h-0",
                SIZE_CLASS[placement.size],
                editMode && "rounded-xl ring-1 ring-brand/40"
              )}
              data-widget={placement.id}
              data-size={placement.size}
            >
              {/* Drag affordance */}
              {editMode && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 right-8 z-10 flex size-7 cursor-grab items-center justify-center rounded-md border bg-background/90 text-muted-foreground shadow-sm active:cursor-grabbing"
                >
                  <GripVertical className="size-4" />
                </span>
              )}
              {/* Edit controls */}
              {editMode && (
                <div className="absolute right-1 top-1 z-10 flex gap-1">
                  <button
                    type="button"
                    onClick={() => resize(index)}
                    aria-label={t("game.dash.resize", { size: t(`game.dash.size.${placement.size}`) })}
                    title={t("game.dash.resizeTitle")}
                    className="flex size-7 items-center justify-center rounded-md border bg-background/90 text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Maximize2 aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={t("game.dash.remove")}
                    className="flex size-7 items-center justify-center rounded-md border bg-background/90 text-destructive shadow-sm hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              )}
              {/* Touch reorder (accessibility alternative to drag) */}
              {editMode && (
                <div className="absolute bottom-1 right-1 z-10 flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={t("game.dash.moveUp")}
                    className="flex size-7 items-center justify-center rounded-md border bg-background/90 text-muted-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  >
                    <ArrowUp aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === layout.length - 1}
                    aria-label={t("game.dash.moveDown")}
                    className="flex size-7 items-center justify-center rounded-md border bg-background/90 text-muted-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                  >
                    <ArrowDown aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              )}
              <Content club={club} clubs={clubs} />
            </div>
          );
        })}
      </div>

      {/* Add-widget dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("game.dash.addWidget")}</DialogTitle>
            <DialogDescription>{t("game.dash.addWidgetDesc")}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {available.map((w) => (
              <li key={w.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t(w.titleKey)}</p>
                  <p className="truncate text-xs text-muted-foreground">{t(w.descKey)}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {t("game.dash.size.default", { size: t(`game.dash.size.${w.defaultSize}`) })}
                  </p>
                </div>
                <Button size="sm" className="min-h-9 shrink-0 bg-brand-deep text-white hover:bg-brand" onClick={() => add(w.id)}>
                  {t("common.add")}
                </Button>
              </li>
            ))}
            {available.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">{t("game.dash.allWidgetsAdded")}</li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WidgetGrid;
