"use client";
// Knight FM — customizable DASHBOARD GRID (Task 91, UI/UX master mandate).
// Fully customizable widget hub: ADD / REMOVE / RESIZE (1×1, 2×1, 1×2, 2×2) /
// drag-REORDER (dnd-kit, keyboard-accessible) / PRESETS (named layout
// snapshots, applied instantly). Layout + presets persist SERVER-SIDE per
// user (GET/PUT /api/me/dashboard); role defaults are code-owned.
//
// A11y: reorder works with keyboard (dnd-kit KeyboardSensor +
// sortableKeyboardCoordinates), every control has an aria-label, drag handle
// is a real button, prefers-reduced-motion is honored by dnd-kit/measuring.

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { apiFetch } from "@/components/auth/store";
import type { ClubMine } from "@/components/game/api";
import {
  WIDGET_REGISTRY,
  defaultLayout,
  resolveRole,
  widgetById,
  type DashboardRole,
  type WidgetContext,
  type WidgetDef,
  type WidgetSize,
} from "./widget-registry";

interface Placement {
  id: string;
  w: 1 | 2;
  h: 1 | 2;
}
interface Preset {
  name: string;
  widgets: Placement[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

// ── Single sortable widget card ─────────────────────────────────

function SortableWidget({
  placement,
  def,
  ctx,
  onRemove,
  onResize,
}: {
  placement: Placement;
  def: WidgetDef;
  ctx: WidgetContext;
  onRemove: () => void;
  onResize: () => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: placement.id });
  const Icon = def.icon;
  const resizeLabel = t("game.dash.w.resize");

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "col-span-1 flex flex-col",
        placement.w === 2 && "sm:col-span-2",
        placement.h === 2 && "row-span-2",
        isDragging && "z-20 opacity-80 ring-2 ring-primary"
      )}
      aria-label={t(def.labelKey)}
    >
      <div className="flex items-center gap-1 px-6 pb-2 pt-6">
        <button
          type="button"
          className="flex min-h-11 min-w-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
          aria-label={t("game.dash.w.dragHandle")}
          aria-describedby={`drag-instructions-${placement.id}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
        <span id={`drag-instructions-${placement.id}`} className="sr-only">
          {t("game.dash.w.dragInstructions")}
        </span>
        <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <CardTitle className="min-w-0 flex-1 truncate text-sm font-semibold">{t(def.labelKey)}</CardTitle>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`${resizeLabel} — ${t(def.labelKey)}`}
            title={resizeLabel}
            onClick={onResize}
          >
            {placement.w === 2 || placement.h === 2 ? (
              <Minimize2 aria-hidden="true" className="size-3.5" />
            ) : (
              <Maximize2 aria-hidden="true" className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`${t("game.dash.w.remove")} — ${t(def.labelKey)}`}
            title={t("game.dash.w.remove")}
            onClick={onRemove}
          >
            <X aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
      </div>
      <CardContent className="min-h-0 flex-1 pb-3">{def.render(ctx)}</CardContent>
    </Card>
  );
}

// ── The grid ────────────────────────────────────────────────────

export function WidgetsGrid({ clubs }: { clubs: ClubMine[] }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const role: DashboardRole = resolveRole(clubs);
  const club = React.useMemo(
    () => clubs.find((c) => c.role === role) ?? clubs[0] ?? null,
    [clubs, role]
  );

  const [placements, setPlacements] = React.useState<Placement[] | null>(null); // null = loading
  const [presets, setPresets] = React.useState<Preset[]>([]);
  const [dirty, setDirty] = React.useState(false);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [addErrorOpen, setAddErrorOpen] = React.useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  const [presetName, setPresetName] = React.useState("");

  // Load persisted layout (or role defaults when uncustomized).
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<{ customized: boolean; widgets: Placement[]; presets: Preset[] }>(
          "/api/me/dashboard"
        );
        if (!alive) return;
        setPresets(res.presets ?? []);
        setPlacements(res.customized && res.widgets.length > 0 ? res.widgets : defaultLayout(role));
      } catch {
        if (alive) setPlacements(defaultLayout(role));
      }
    })();
    return () => {
      alive = false;
    };
    // role derives from clubs; reload when the role changes (e.g. took a club).
  }, [role]);

  // Debounced server persistence of every user change.
  React.useEffect(() => {
    if (!dirty || placements === null) return;
    const id = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await apiFetch("/api/me/dashboard", {
          method: "PUT",
          body: { widgets: placements, presets },
        });
        setSaveState("saved");
        setDirty(false);
      } catch {
        setSaveState("error");
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [dirty, placements, presets]);

  const commit = (next: Placement[]) => {
    setPlacements(next);
    setDirty(true);
  };

  // ── Drag reorder ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || placements === null) return;
    const from = placements.findIndex((p) => p.id === active.id);
    const to = placements.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;
    commit(arrayMove(placements, from, to));
  };

  // ── Resize: cycle through the widget's allowed sizes ──
  const cycleSize = (p: Placement): Placement => {
    const def = widgetById(p.id);
    const sizes = def?.allowedSizes ?? [{ w: 1, h: 1 } as WidgetSize];
    const idx = sizes.findIndex((s) => s.w === p.w && s.h === p.h);
    const next = sizes[(idx + 1) % sizes.length];
    return { ...p, w: next.w, h: next.h };
  };

  // ── Add / remove ──
  const available = WIDGET_REGISTRY.filter((d) => d.roles.includes(role) && !(placements ?? []).some((p) => p.id === d.id));
  const addWidget = (def: WidgetDef) => {
    if (!placements) return;
    commit([...placements, { id: def.id, ...def.defaultSize }]);
    setAddErrorOpen(false);
    toast({ description: t("game.dash.w.added", { name: t(def.labelKey) }) });
  };
  const removeWidget = (id: string) => {
    if (!placements) return;
    commit(placements.filter((p) => p.id !== id));
  };

  // ── Presets ──
  const applyPreset = (preset: Preset) => {
    if (!placements) return;
    const valid = preset.widgets.filter((p) => widgetById(p.id));
    if (valid.length === 0) return;
    commit(valid);
    toast({ description: t("game.dash.w.presetApplied", { name: preset.name }) });
  };
  const savePreset = () => {
    if (!placements || !presetName.trim()) return;
    const next = [...presets.filter((p) => p.name !== presetName.trim()), { name: presetName.trim(), widgets: placements }].slice(0, 8);
    setPresets(next);
    setDirty(true);
    setPresetName("");
    setSaveDialogOpen(false);
    toast({ description: t("game.dash.w.presetSaved") });
  };
  const deletePreset = (name: string) => {
    setPresets(presets.filter((p) => p.name !== name));
    setDirty(true);
  };
  const resetDefault = () => {
    commit(defaultLayout(role));
    toast({ description: t("game.dash.w.resetDone") });
  };

  const ctx: WidgetContext = { club, clubs };

  if (placements === null) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-live="polite">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className={cn("h-40 w-full", i % 3 === 0 && "sm:col-span-2")} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="min-h-9" onClick={() => setAddErrorOpen(true)}>
          <Plus aria-hidden="true" className="size-4" />
          {t("game.dash.w.add")}
        </Button>
        <Button size="sm" variant="outline" className="min-h-9" onClick={() => setSaveDialogOpen(true)}>
          <Save aria-hidden="true" className="size-4" />
          {t("game.dash.w.savePreset")}
        </Button>
        <Button size="sm" variant="ghost" className="min-h-9 text-muted-foreground" onClick={resetDefault}>
          <RotateCcw aria-hidden="true" className="size-4" />
          {t("game.dash.w.resetDefault")}
        </Button>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          <LayoutGrid aria-hidden="true" className="size-3.5" />
          {saveState === "saving" && t("game.dash.w.saving")}
          {saveState === "saved" && t("game.dash.w.saved")}
          {saveState === "error" && <span className="text-destructive">{t("game.dash.w.saveError")}</span>}
        </span>
      </div>

      {/* ── Saved presets ── */}
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("game.dash.w.presets")}:</span>
          {presets.map((p) => (
            <span key={p.name} className="inline-flex items-center overflow-hidden rounded-md border">
              <button
                type="button"
                className="min-h-9 px-2.5 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => applyPreset(p)}
              >
                {p.name}
              </button>
              <button
                type="button"
                className="flex min-h-9 items-center px-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`${t("game.dash.w.deletePreset")} ${p.name}`}
                onClick={() => deletePreset(p.name)}
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Widget grid (drag to reorder) ── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={placements.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="grid auto-rows-[minmax(148px,auto)] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {placements.map((p) => {
              const def = widgetById(p.id);
              if (!def) return null; // unknown/removed widget id — skip silently
              return (
                <SortableWidget
                  key={p.id}
                  placement={p}
                  def={def}
                  ctx={ctx}
                  onRemove={() => removeWidget(p.id)}
                  onResize={() => commit(placements.map((q) => (q.id === p.id ? cycleSize(q) : q)))}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── Add widget dialog ── */}
      <Dialog open={addErrorOpen} onOpenChange={setAddErrorOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("game.dash.w.add")}</DialogTitle>
            <DialogDescription>{t("game.dash.w.addDesc")}</DialogDescription>
          </DialogHeader>
          {available.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t("game.dash.w.allAdded")}</p>
          ) : (
            <ul className="space-y-2">
              {available.map((d) => {
                const Icon = d.icon;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => addWidget(d)}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{t(d.labelKey)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{t(d.descKey)}</span>
                      </span>
                      <Plus aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Save preset dialog ── */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("game.dash.w.savePreset")}</DialogTitle>
            <DialogDescription>{t("game.dash.w.savePresetDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="preset-name">{t("game.dash.w.presetName")}</Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              maxLength={40}
              placeholder={t("game.dash.w.presetNamePlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") savePreset();
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" onClick={savePreset} disabled={!presetName.trim()}>
              {t("game.dash.w.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
