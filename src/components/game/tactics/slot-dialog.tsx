"use client";
// Knight FM — slot assignment dialog (Task 4-b, spec §12).
// Lists every squad player for the chosen slot: same-position players first,
// out-of-position players below with a positionFit % badge. Filters (position,
// available-only, search) + sorting (fit / ovr / form / fatigue).

import { useMemo, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Formation, FormationSlot, POSITIONS, Position } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fitPct, isPlayerAvailable, SquadPlayer } from "./use-tactics";

type SortKey = "fit" | "ovr" | "form" | "fatigue";

interface SlotDialogProps {
  slot: FormationSlot | null;
  formation: Formation;
  squad: SquadPlayer[];
  /** Working slots map (slotId → playerId|null) of the unsaved lineup. */
  slots: Record<string, string | null>;
  onAssign: (slotId: string, playerId: string | null) => void;
  onClose: () => void;
}

export function SlotDialog({ slot, formation, squad, slots, onAssign, onClose }: SlotDialogProps) {
  const { t } = useI18n();
  const [posFilter, setPosFilter] = useState<"all" | Position>("all");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("fit");

  // playerId → slotId (occupied slots only), derived from the working map.
  const slotIdByPlayer = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [sid, pid] of Object.entries(slots)) {
      if (pid) map[pid] = sid;
    }
    return map;
  }, [slots]);

  // Reset per-slot filters so each dialog opens from a neutral, useful view
  // (state adjustment during render — React-documented pattern).
  const slotKey = slot?.id ?? null;
  const [renderedSlotKey, setRenderedSlotKey] = useState<string | null>(slotKey);
  if (slotKey !== renderedSlotKey) {
    setRenderedSlotKey(slotKey);
    setPosFilter("all");
    setAvailableOnly(true);
    setQuery("");
    setSortBy("fit");
  }

  const rows = useMemo(() => {
    if (!slot) return [];
    const q = query.trim().toLowerCase();
    const base = squad.filter((p) => {
      if (posFilter !== "all" && p.position !== posFilter) return false;
      if (availableOnly && !isPlayerAvailable(p)) return false;
      if (q && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const sortFn = (a: SquadPlayer, b: SquadPlayer): number => {
      switch (sortBy) {
        case "ovr":
          return b.ovr - a.ovr;
        case "form":
          return b.form - a.form;
        case "fatigue":
          return a.fatigue - b.fatigue;
        default:
          return fitPct(b, slot.pos) - fitPct(a, slot.pos) || b.ovr - a.ovr;
      }
    };
    const inPosition = base.filter((p) => p.position === slot.pos).sort(sortFn);
    const outOfPosition = base.filter((p) => p.position !== slot.pos).sort(sortFn);
    return [
      ...inPosition.map((p) => ({ p, oop: false as const })),
      ...outOfPosition.map((p) => ({ p, oop: true as const })),
    ];
  }, [slot, squad, posFilter, availableOnly, query, sortBy]);

  const currentPid = slot ? slots[slot.id] ?? null : null;

  return (
    <Dialog open={!!slot} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden bg-background sm:max-w-lg">
        {slot && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("tactics.dialog.title", { label: slot.label })}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {formation} · {slot.pos}
                </span>
              </DialogTitle>
              <DialogDescription>{t("tactics.pitch.aria")}</DialogDescription>
            </DialogHeader>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[120px] flex-1">
                <Label htmlFor="tactics-search" className="mb-1 block text-xs text-muted-foreground">
                  {t("common.search")}
                </Label>
                <Input
                  id="tactics-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("common.search")}
                  className="h-9"
                />
              </div>
              <div className="min-w-[110px]">
                <Label className="mb-1 block text-xs text-muted-foreground">{t("common.position")}</Label>
                <Select value={posFilter} onValueChange={(v) => setPosFilter(v as "all" | Position)}>
                  <SelectTrigger aria-label={t("common.position")} className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t(`tactics.pos.${p}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[110px]">
                <Label className="mb-1 block text-xs text-muted-foreground">{t("common.filter")}</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger aria-label={t("common.filter")} className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fit">{t("tactics.sort.fit")}</SelectItem>
                    <SelectItem value="ovr">{t("tactics.sort.ovr")}</SelectItem>
                    <SelectItem value="form">{t("tactics.sort.form")}</SelectItem>
                    <SelectItem value="fatigue">{t("tactics.sort.fatigue")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex h-9 items-center gap-2">
                <Switch
                  id="tactics-available-only"
                  checked={availableOnly}
                  onCheckedChange={setAvailableOnly}
                  aria-label={t("tactics.filter.availableOnly")}
                />
                <Label htmlFor="tactics-available-only" className="text-xs">
                  {t("tactics.filter.availableOnly")}
                </Label>
              </div>
            </div>

            {/* Player list */}
            <div className="-mx-1 max-h-[46vh] min-h-[120px] overflow-y-auto px-1">
              {rows.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("common.empty")}</p>
              )}
              {rows.map(({ p, oop }, i) => {
                const fit = fitPct(p, slot.pos);
                const available = isPlayerAvailable(p);
                const fitClass =
                  fit >= 80
                    ? "text-primary border-primary/40"
                    : fit >= 50
                      ? "text-amber-300 border-amber-400/40"
                      : "text-red-300 border-red-400/40";
                const inSlot = slotIdByPlayer[p.id];
                return (
                  <div key={p.id}>
                    {oop && rows[i - 1] && !rows[i - 1].oop && (
                      <p className="px-1 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("tactics.group.outOfPosition")}
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      disabled={!available}
                      onClick={() => {
                        onAssign(slot.id, p.id);
                        onClose();
                      }}
                      aria-label={`${p.firstName} ${p.lastName} — ${t("tactics.dialog.assign")}`}
                      className="min-h-[52px] w-full items-center justify-between gap-2 px-2 py-1.5 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">
                            {p.firstName} {p.lastName}
                          </span>
                          {inSlot && (
                            <Badge
                              variant="outline"
                              className="h-4 border-primary/40 px-1 text-[9px] font-semibold text-primary"
                            >
                              {inSlot}
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-semibold">{p.detailedPos}</span>
                          <StatusLine player={p} available={available} />
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs">
                        <span className="text-[10px] leading-none text-amber-300" aria-label={`${p.stars}`}>
                          {"★".repeat(p.stars)}
                        </span>
                        <span
                          className={cn(
                            "rounded border px-1 py-0.5 text-[10px] font-semibold tabular-nums",
                            fitClass
                          )}
                        >
                          {t("tactics.fit.percent", { pct: fit })}
                        </span>
                        <span className="flex items-center gap-1 tabular-nums">
                          <span className="font-semibold">{p.ovr}</span>
                          <span
                            role="img"
                            aria-label={
                              p.form >= 60
                                ? t("tactics.form.up")
                                : p.form <= 40
                                  ? t("tactics.form.down")
                                  : t("tactics.form.flat")
                            }
                            className={cn(
                              "text-[9px]",
                              p.form >= 60 ? "text-primary" : p.form <= 40 ? "text-red-300" : "text-muted-foreground"
                            )}
                          >
                            {p.form >= 60 ? "▲" : p.form <= 40 ? "▼" : "●"}
                          </span>
                        </span>
                      </span>
                    </Button>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              {currentPid && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onAssign(slot.id, null);
                    onClose();
                  }}
                >
                  {t("tactics.dialog.unassign")}
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                {t("common.close")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusLine({ player, available }: { player: SquadPlayer; available: boolean }) {
  const { t, formatDate } = useI18n();
  if (available) {
    return (
      <span className="inline-flex items-center gap-1 text-primary">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        {t("tactics.status.available")}
      </span>
    );
  }
  if (player.suspension > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-400">
        <Ban className="h-3 w-3" aria-hidden="true" />
        {t("tactics.status.suspended", { n: player.suspension })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-red-400">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      {t("tactics.status.injured", {
        date: player.injuredUntil
          ? formatDate(player.injuredUntil, { day: "2-digit", month: "short", timeZone: "UTC" })
          : "—",
      })}
    </span>
  );
}
