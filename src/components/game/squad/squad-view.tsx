"use client";
// Knight FM — Squad view (Task 4-a, cards layout per user request).
// Filterable/sortable PLAYER CARD grid. Each card is a self-contained player
// "tarjeta": identity, value/salary/clause, state mini-bars, status badges and
// — for the club's OWNER **or MANAGER** — visible management buttons (sell /
// auction / loan / clause) wired to the shared market dialogs. Clicking the
// identity zone opens the full player detail dialog (attributes, trends, release).

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownUp, ArrowLeftRight, ChevronDown, FileSignature, Gavel, HandCoins,
  LayoutGrid, Maximize2, RectangleHorizontal, Rows3, Search, ShieldAlert, Users,
} from "lucide-react";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import CinemaHeader from "@/components/game/ui/cinema-header";
import "@/lib/i18n/dict/markets"; // markets.profile / loan / clause keys used by the market actions below
import {
  SellPlayerDialog,
  CreateAuctionDialog,
  LoanPlayerDialog,
  ClauseEditDialog,
} from "@/components/game/markets/action-dialogs";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, ApiError } from "@/components/auth/store";
import {
  fetchMyClubs,
  fetchPlayer,
  fetchPlayers,
  fetchWorldState,
  qk,
  type PlayerRow,
  type Trend,
} from "@/components/game/api";
import { useViewStore } from "@/components/game/view-store";
import {
  EmptyState,
  ErrorState,
  PositionBadge,
  StatBar,
  Stars,
  TrendArrow,
  daysUntil,
} from "@/components/game/ui/bits";

// ── Trend helpers ───────────────────────────────────────────────

const KEY_ATTRS = ["finishing", "passing", "dribbling", "tackling", "handling", "pace", "stamina", "decisions", "positioning"];

function overallTrend(trends: Record<string, Trend>): Trend {
  let up = 0;
  let down = 0;
  for (const k of KEY_ATTRS) {
    const v = trends[k];
    if (v === "up") up++;
    else if (v === "down") down++;
  }
  if (up > down) return "up";
  if (down > up) return "down";
  return "flat";
}

type SortKey = "name" | "age" | "ovr" | "value" | "salary";

/** Card-level market action kinds (wired to the shared markets dialogs). */
type MarketActionKind = "sell" | "auction" | "loan" | "clause";

/** Tone thresholds for state bars (mirrors StatBar's toneOf in ui/bits, which is not exported). */
function stateToneClass(value: number, invert = false): string {
  const v = invert ? 100 - value : value;
  return v >= 70 ? "bg-primary" : v >= 40 ? "bg-amber-500" : "bg-destructive";
}

/**
 * Label-free compact state bar for the squad table's 2×2 state grid.
 * Text label is sr-only (keeps the cell visually compact); native `title`
 * tooltip carries the label + value on hover, matching StatBar's tooltip.
 */
function MiniStateBar({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  return (
    <div className="space-y-0.5" title={`${label}: ${value}/100`}>
      <span className="sr-only">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn("h-full rounded-full transition-all", stateToneClass(value, invert))}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}

/** Column sort header (hoisted: not created during render). */

// ── Task 58 — Bloomberg-style squad table (no vertical lines, right-aligned
// mono numbers, star players emphasized by SIZE not color, expandable rows,
// quick actions that surface on hover). Same data and actions as the cards. ──

const QUICK_ACTIONS: { kind: MarketActionKind; icon: React.ComponentType<{ className?: string }>; labelKey: string }[] = [
  { kind: "sell", icon: HandCoins, labelKey: "markets.profile.sellAction" },
  { kind: "auction", icon: Gavel, labelKey: "markets.profile.auctionAction" },
  { kind: "loan", icon: ArrowLeftRight, labelKey: "markets.profile.loanAction" },
  { kind: "clause", icon: FileSignature, labelKey: "markets.profile.clauseEditAction" },
];

function SquadTableRow({
  p,
  canManage,
  expanded,
  onToggle,
  onOpenDetail,
  onAction,
}: {
  p: PlayerRow;
  canManage: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail: (id: string) => void;
  onAction: (kind: MarketActionKind, player: PlayerRow) => void;
}) {
  const { t, formatCurrency } = useI18n();
  const trend = overallTrend(p.trendPerAttribute ?? {});
  const loan = p.loan ?? null;
  const actionable = canManage && !loan;
  const isStar = p.stars >= 4;

  return (
    <>
      <TableRow
        className={cn(
          "group/row cursor-pointer border-b border-border/60 transition-colors duration-200 hover:bg-accent/40",
          isStar && "py-1", // star rows breathe: slightly taller, no new colors
        )}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <TableCell className="w-8 pl-3 pr-0">
          <button
            type="button"
            tabIndex={expanded ? -1 : 0}
            aria-label={expanded ? t("game.squad.collapseRow") : t("game.squad.expandRow")}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform duration-200", expanded && "rotate-180")} />
          </button>
        </TableCell>
        <TableCell className="min-w-44 max-w-56 py-2.5">
          <div className="flex items-center gap-2">
            <PositionBadge pos={p.position} />
            <span className={cn("min-w-0 truncate", isStar ? "text-sm font-bold" : "text-sm")}>
              {p.firstName} {p.lastName}
            </span>
            <Stars n={p.stars} />
            <TrendArrow trend={trend} />
            {loan && (
              <Badge variant="outline" className="hidden shrink-0 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-300 xl:inline-flex">
                {loan.status === "OUT" ? "OUT" : "IN"}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="w-12 text-right font-mono text-xs tabular-nums text-muted-foreground">{p.age}</TableCell>
        <TableCell className="w-14 text-right">
          <span
            className={cn(
              "player-card__ovr inline-block rounded-md bg-muted/50 px-1.5 font-mono text-xs font-semibold tabular-nums",
              isStar && "font-bold text-primary",
            )}
          >
            {p.ovr}
          </span>
        </TableCell>
        <TableCell className="hidden w-16 text-right sm:table-cell">
          <div className="ml-auto w-10" title={`${t("player.form")}: ${p.form}/100`}>
            <MiniStateBar label={t("player.form")} value={p.form} />
          </div>
        </TableCell>
        <TableCell className="hidden w-16 text-right sm:table-cell">
          <div className="ml-auto w-10" title={`${t("player.fatigue")}: ${p.fatigue}/100`}>
            <MiniStateBar label={t("player.fatigue")} value={p.fatigue} invert />
          </div>
        </TableCell>
        <TableCell className="w-24 text-right font-mono text-xs tabular-nums">{formatCurrency(p.marketValue)}</TableCell>
        <TableCell className="hidden w-24 text-right font-mono text-xs tabular-nums text-muted-foreground md:table-cell">{formatCurrency(p.salary)}</TableCell>
        <TableCell className="hidden w-24 text-right font-mono text-xs tabular-nums text-muted-foreground lg:table-cell">{formatCurrency(p.releaseClause)}</TableCell>
        <TableCell className="w-10 pr-3">
          {/* Quick actions surface on hover (keyboard + touch get the expanded row) */}
          {canManage && (
            <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 focus-within:opacity-100">
              {QUICK_ACTIONS.slice(0, 1).map(({ kind, icon: Icon, labelKey }) => (
                <Button
                  key={kind}
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={!actionable}
                  title={t(labelKey)}
                  aria-label={`${t(labelKey)}: ${p.firstName} ${p.lastName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (actionable) onAction(kind, p);
                  }}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </Button>
              ))}
            </div>
          )}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="border-b border-border/60 hover:bg-transparent">
          <TableCell colSpan={10} className="border-l-2 border-l-primary/40 bg-muted/25 px-4 py-3">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              {/* State */}
              <div className="grid grid-cols-4 gap-x-3 gap-y-2">
                <MiniStateBar label={t("player.form")} value={p.form} />
                <MiniStateBar label={t("player.fatigue")} value={p.fatigue} invert />
                <MiniStateBar label={t("player.sharpness")} value={p.sharpness} />
                <MiniStateBar label={t("player.morale")} value={p.morale} />
              </div>
              {/* Status */}
              <div className="flex flex-wrap items-start gap-1.5">
                {p.injuredUntil && (
                  <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
                    <ShieldAlert aria-hidden="true" className="mr-1 size-3" />
                    {t("player.injuredDays", { d: daysUntil(p.injuredUntil, Date.now()) })}
                  </Badge>
                )}
                {p.suspension > 0 && (
                  <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-300">
                    {t("player.suspendedMatches", { n: p.suspension })}
                  </Badge>
                )}
                {p.yellowCards > 0 && (
                  <Badge variant="outline" className="border-amber-400/40 text-[10px] text-amber-200/90">
                    <RectangleHorizontal aria-hidden="true" className="mr-1 size-3 fill-amber-400 text-amber-400" />
                    {t("player.yellowCards", { n: p.yellowCards })}
                  </Badge>
                )}
                {loan && (
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-300">
                    {loan.status === "OUT"
                      ? t("markets.profile.loanOutBadge", { day: loan.untilDay })
                      : t("markets.profile.loanInBadge", { day: loan.untilDay })}
                  </Badge>
                )}
                {!p.injuredUntil && p.suspension === 0 && p.yellowCards === 0 && !loan && (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
              {/* Actions */}
              <div className="flex flex-wrap items-start justify-end gap-2 lg:justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(p.id);
                  }}
                >
                  <Maximize2 aria-hidden="true" className="mr-1.5 size-3.5" />
                  {t("game.squad.openProfile")}
                </Button>
                {canManage &&
                  QUICK_ACTIONS.map(({ kind, icon: Icon, labelKey }) => (
                    <Button
                      key={kind}
                      size="sm"
                      variant="outline"
                      className="min-h-9"
                      disabled={!actionable}
                      title={!actionable ? t("game.err.PLAYER_ON_LOAN") : undefined}
                      aria-label={`${t(labelKey)}: ${p.firstName} ${p.lastName}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (actionable) onAction(kind, p);
                      }}
                    >
                      <Icon aria-hidden="true" className="mr-1.5 size-3.5" />
                      {t(labelKey)}
                    </Button>
                  ))}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function SortHead({
  k,
  label,
  sortKey,
  sortAsc,
  onSort,
  className,
}: {
  k: SortKey;
  label: string;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] uppercase tracking-wide transition-colors hover:text-foreground",
          sortKey === k ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label={`${label} — ${t("game.squad.sortBy")}`}
      >
        {label}
        {sortKey === k && <span aria-hidden="true" className="font-mono text-[9px]">{sortAsc ? "▲" : "▼"}</span>}
      </button>
    </TableHead>
  );
}

function SquadTable({
  players,
  sortKey,
  sortAsc,
  onSort,
  canManage,
  expandedId,
  onToggle,
  onOpenDetail,
  onAction,
}: {
  players: PlayerRow[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (k: SortKey) => void;
  canManage: boolean;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onAction: (kind: MarketActionKind, player: PlayerRow) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="max-h-[70vh] overflow-auto">
        <Table className="min-w-[760px]">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <TableRow className="border-b border-border/80 hover:bg-transparent">
              <TableHead className="w-8 pl-3" aria-hidden="true" />
              <SortHead k="name" label={t("common.player")} sortKey={sortKey} sortAsc={sortAsc} onSort={onSort} />
              <SortHead k="age" label={t("common.age")} sortKey={sortKey} sortAsc={sortAsc} onSort={onSort} className="text-right" />
              <SortHead k="ovr" label={t("player.ovr")} sortKey={sortKey} sortAsc={sortAsc} onSort={onSort} className="text-right" />
              <TableHead className="hidden text-right text-[11px] uppercase tracking-wide text-muted-foreground sm:table-cell">{t("player.form")}</TableHead>
              <TableHead className="hidden text-right text-[11px] uppercase tracking-wide text-muted-foreground sm:table-cell">{t("player.fatigue")}</TableHead>
              <SortHead k="value" label={t("game.squad.value")} sortKey={sortKey} sortAsc={sortAsc} onSort={onSort} className="text-right" />
              <SortHead k="salary" label={t("common.salary")} sortKey={sortKey} sortAsc={sortAsc} onSort={onSort} className="hidden text-right md:table-cell" />
              <TableHead className="hidden text-right text-[11px] uppercase tracking-wide text-muted-foreground lg:table-cell">{t("game.squad.clause")}</TableHead>
              <TableHead className="w-10 pr-3" aria-hidden="true" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((p) => (
              <SquadTableRow
                key={p.id}
                p={p}
                canManage={canManage}
                expanded={expandedId === p.id}
                onToggle={() => onToggle(p.id)}
                onOpenDetail={onOpenDetail}
                onAction={onAction}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Player card ─────────────────────────────────────────────

function SquadPlayerCard({
  p,
  canManage,
  onOpenDetail,
  onAction,
}: {
  p: PlayerRow;
  canManage: boolean;
  onOpenDetail: (id: string) => void;
  onAction: (kind: MarketActionKind, player: PlayerRow) => void;
}) {
  const { t, formatCurrency } = useI18n();
  const trend = overallTrend(p.trendPerAttribute ?? {});
  const loan = p.loan ?? null;
  // A loaned player (OUT: mine away · IN: borrowed in) cannot be transferred,
  // auctioned, loaned again or have its clause edited.
  const actionable = canManage && !loan;

  return (
    <Card className="player-card flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {/* Identity — opens the detail dialog */}
        <button
          type="button"
          onClick={() => onOpenDetail(p.id)}
          className="flex items-start justify-between gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={t("game.squad.openDetailAria", { name: `${p.firstName} ${p.lastName}` })}
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <PositionBadge pos={p.position} />
              <span className="truncate font-semibold">{p.firstName} {p.lastName}</span>
            </span>
            <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t("common.age")} {p.age}</span>
              <span aria-hidden="true">·</span>
              <span className="player-card__ovr inline-block rounded-md bg-muted/50 px-1.5 font-mono font-semibold tabular-nums text-foreground">{p.ovr}</span>
              <Stars n={p.stars} />
              <TrendArrow trend={trend} />
            </span>
          </span>
          {loan && (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-[10px]",
                loan.status === "OUT"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-sky-500/30 bg-sky-500/15 text-sky-300"
              )}
            >
              {loan.status === "OUT"
                ? t("markets.profile.loanOutBadge", { day: loan.untilDay })
                : t("markets.profile.loanInBadge", { day: loan.untilDay })}
            </Badge>
          )}
        </button>

        {/* Value / salary / clause */}
        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/20 p-2 text-center" title={t("game.squad.clause")}>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.squad.value")}</p>
            <p className="font-mono text-xs font-semibold tabular-nums">{formatCurrency(p.marketValue)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("common.salary")}</p>
            <p className="font-mono text-xs tabular-nums text-muted-foreground">{formatCurrency(p.salary)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.squad.clause")}</p>
            <p className="font-mono text-xs tabular-nums">{formatCurrency(p.releaseClause)}</p>
          </div>
        </div>

        {/* State (2×2 compact bars) + status badges */}
        <div className="grid grid-cols-4 gap-x-2 gap-y-1">
          <MiniStateBar label={t("player.form")} value={p.form} />
          <MiniStateBar label={t("player.fatigue")} value={p.fatigue} invert />
          <MiniStateBar label={t("player.sharpness")} value={p.sharpness} />
          <MiniStateBar label={t("player.morale")} value={p.morale} />
        </div>
        {(p.injuredUntil || p.suspension > 0 || p.yellowCards > 0) && (
          <div className="flex flex-wrap gap-1">
            {p.injuredUntil && (
              <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
                <ShieldAlert aria-hidden="true" className="mr-1 size-3" />
                {t("player.injuredDays", {
                  d: daysUntil(p.injuredUntil, Date.now()),
                })}
              </Badge>
            )}
            {p.suspension > 0 && (
              <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-300">
                {t("player.suspendedMatches", { n: p.suspension })}
              </Badge>
            )}
            {p.yellowCards > 0 && (
              <Badge variant="outline" className="border-amber-400/40 text-[10px] text-amber-200/90">
                <RectangleHorizontal aria-hidden="true" className="mr-1 size-3 fill-amber-400 text-amber-400" />
                {t("player.yellowCards", { n: p.yellowCards })}
              </Badge>
            )}
          </div>
        )}

        {/* Management buttons — visible directly on the card (owner OR manager) */}
        {canManage && (
          <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={!actionable}
              title={!actionable ? t("game.err.PLAYER_ON_LOAN") : undefined}
              aria-label={`${t("markets.profile.sellAction")}: ${p.firstName} ${p.lastName}`}
              onClick={() => onAction("sell", p)}
            >
              {t("markets.profile.sellAction")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={!actionable}
              title={!actionable ? t("game.err.PLAYER_ON_LOAN") : undefined}
              aria-label={`${t("markets.profile.auctionAction")}: ${p.firstName} ${p.lastName}`}
              onClick={() => onAction("auction", p)}
            >
              {t("markets.profile.auctionAction")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={!actionable}
              title={!actionable ? t("game.err.PLAYER_ON_LOAN") : undefined}
              aria-label={`${t("markets.profile.loanAction")}: ${p.firstName} ${p.lastName}`}
              onClick={() => onAction("loan", p)}
            >
              {t("markets.profile.loanAction")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={!actionable}
              title={!actionable ? t("game.err.PLAYER_ON_LOAN") : undefined}
              aria-label={`${t("markets.profile.clauseEditAction")}: ${p.firstName} ${p.lastName}`}
              onClick={() => onAction("clause", p)}
            >
              {t("markets.profile.clauseEditAction")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Detail dialog ───────────────────────────────────────────────

function PlayerDetailDialog({
  playerId,
  open,
  onOpenChange,
  isOwner,
  viewingClubId,
}: {
  playerId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isOwner: boolean;
  /** Club whose squad list the player was opened from (loan OUT/IN context). */
  viewingClubId?: string | null;
}) {
  const { t, formatCurrency, formatDate } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: qk.player(playerId ?? "none"),
    queryFn: () => fetchPlayer(playerId!),
    enabled: open && !!playerId,
    staleTime: 30_000,
  });

  const player = query.data?.player;
  const isStaff = query.data?.view === "STAFF";

  // Settlement estimate mirrors the server rule: salary × days left in season.
  const worldQ = useQuery({ queryKey: qk.world, queryFn: fetchWorldState, enabled: isOwner });
  const [releaseOpen, setReleaseOpen] = React.useState(false);
  const releaseMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ released: boolean; settlement: number; daysRemaining: number }>(`/api/players/${id}/release`, {
        method: "POST",
      }),
    onSuccess: (res) => {
      toast({
        title: t("game.squad.released", {
          name: player ? `${player.firstName} ${player.lastName}` : "",
          amount: formatCurrency(res.settlement),
        }),
      });
      setReleaseOpen(false);
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["players"] });
      void queryClient.invalidateQueries({ queryKey: qk.myClubs });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : "";
      const localized = code && t(`game.err.${code}`) !== `game.err.${code}` ? t(`game.err.${code}`) : t("err.generic");
      toast({
        title: localized,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    },
  });

  const season = worldQ.data?.season ?? null;
  const gameDay = worldQ.data?.gameDay ?? 0;
  const daysRemaining = season ? Math.max(0, season.endEpochDay - gameDay + 1) : 0;
  const settlementEstimate = player?.salary ? (player.salary ?? 0) * daysRemaining : 0;

  // Market actions (Task 9-a/lead): sell / auction / loan / clause edit.
  const [sellOpen, setSellOpen] = React.useState(false);
  const [auctionOpen, setAuctionOpen] = React.useState(false);
  const [loanOpen, setLoanOpen] = React.useState(false);
  const [clauseOpen, setClauseOpen] = React.useState(false);
  const playerLoan = player?.loan ?? null;
  // OUT = my player away at the borrowing club (registered elsewhere); IN = borrowed in.
  const loanOut = !!playerLoan && !!viewingClubId && player?.clubId !== viewingClubId;

  const closeMarketDialogs = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setSellOpen(false);
      setAuctionOpen(false);
      setLoanOpen(false);
      setClauseOpen(false);
    }
  };

  const attrFamilies: { key: string; labelKey: string }[] = [
    { key: "technical", labelKey: "game.squad.attrs.technical" },
    { key: "physical", labelKey: "game.squad.attrs.physical" },
    { key: "mental", labelKey: "game.squad.attrs.mental" },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={closeMarketDialogs}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          {query.isLoading && (
            <div className="space-y-3" aria-hidden="true">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          {query.error && !query.isLoading && (
            <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
          )}
          {player && !query.isLoading && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {player.firstName} {player.lastName}
                  <PositionBadge pos={player.position} />
                  {isStaff ? <Stars n={player.stars} /> : null}
                </DialogTitle>
                <DialogDescription>
                  {t("player.ovr")} {player.ovr}
                  {player.potential !== undefined ? ` · ${t("game.squad.potential")} ${player.potential}` : ""} ·{" "}
                  {t("common.age")} {player.age}
                </DialogDescription>
              </DialogHeader>

              {isStaff && (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,290px)] lg:items-start">
                  {/* LEFT — identity & economics (premium-card style) */}
                  <aside className="space-y-3 rounded-xl border bg-gradient-to-b from-muted/40 to-transparent p-4">
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="flex size-14 shrink-0 items-center justify-center rounded-full border bg-primary/10 font-mono text-lg font-bold text-primary"
                      >
                        {`${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-2xl font-bold leading-none tabular-nums text-primary">{player.ovr}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                          {t("player.ovr")}
                          {player.potential !== undefined ? ` · ${t("game.squad.potential")} ${player.potential}` : ""}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <dl className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-xs text-muted-foreground">{t("game.squad.value")}</dt>
                        <dd className="font-mono font-semibold tabular-nums">{formatCurrency(player.marketValue ?? 0)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-xs text-muted-foreground">{t("common.salary")}</dt>
                        <dd className="font-mono tabular-nums text-muted-foreground">{formatCurrency(player.salary ?? 0)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-xs text-muted-foreground">{t("game.squad.clause")}</dt>
                        <dd className="font-mono tabular-nums">{formatCurrency(player.releaseClause ?? 0)}</dd>
                      </div>
                    </dl>
                    {playerLoan && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "w-full justify-center",
                          loanOut
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                            : "border-sky-500/30 bg-sky-500/15 text-sky-300",
                        )}
                        role="status"
                      >
                        {loanOut
                          ? t("markets.profile.loanOutBadge", { day: playerLoan.untilDay })
                          : t("markets.profile.loanInBadge", { day: playerLoan.untilDay })}
                      </Badge>
                    )}
                  </aside>

                  {/* CENTER — attributes by family */}
                  <section className="space-y-3">
                    <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("game.squad.attrsTitle")}
                      <span className="font-normal normal-case">{t("game.squad.trend")}</span>
                    </p>
                    {attrFamilies.map((fam) => {
                      const attrs = player.attributes?.[fam.key] ?? {};
                      const keys = Object.keys(attrs).sort();
                      if (keys.length === 0) return null;
                      return (
                        <div key={fam.key} className="rounded-lg border p-3">
                          <p className="mb-2 text-xs font-semibold text-primary">{t(fam.labelKey)}</p>
                          {/* Single column: inside the 3-zone profile the center column
                              is ~300px — two sub-columns would collapse the labels. */}
                          <div className="grid gap-y-1.5">
                            {keys.map((k) => (
                              <div key={k} className="flex items-center gap-1.5">
                                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={t(`attr.${k}`)}>
                                  {t(`attr.${k}`)}
                                </span>
                                <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      attrs[k] >= 70 ? "bg-primary" : attrs[k] >= 40 ? "bg-amber-500" : "bg-destructive"
                                    )}
                                    style={{ width: `${Math.max(0, Math.min(100, attrs[k]))}%` }}
                                  />
                                </div>
                                <span className="w-6 text-right font-mono text-[11px] tabular-nums">{attrs[k]}</span>
                                <TrendArrow trend={player.trendPerAttribute?.[k]} />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </section>

                  {/* RIGHT — day state + quick actions */}
                  <aside className="space-y-3">
                    {player.state && (
                      <div className="space-y-1.5 rounded-lg border p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("game.squad.stateTitle")}
                        </p>
                        <StatBar label={t("player.form")} value={player.state.form} />
                        <StatBar label={t("player.fatigue")} value={player.state.fatigue} invert />
                        <StatBar label={t("player.sharpness")} value={player.state.sharpness} />
                        <StatBar label={t("player.morale")} value={player.state.morale} />
                        <StatBar label={t("player.confidence")} value={player.state.confidence} />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {player.state.injuredUntil && (
                            <Badge variant="outline" className="border-destructive/40 text-destructive">
                              <ShieldAlert aria-hidden="true" className="mr-1 size-3" />
                              {t("player.injuredDays", { d: daysUntil(player.state.injuredUntil, Date.now()) })}{" "}
                              {t("game.squad.until", { date: formatDate(player.state.injuredUntil) })}
                            </Badge>
                          )}
                          {player.state.suspension > 0 && (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                              {t("player.suspendedMatches", { n: player.state.suspension })}
                            </Badge>
                          )}
                          {player.state.yellowCards > 0 && (
                            <Badge variant="outline" className="border-amber-400/40 text-amber-200/90">
                              <RectangleHorizontal aria-hidden="true" className="mr-1 size-3 fill-amber-400 text-amber-400" />
                              {t("player.yellowCards", { n: player.state.yellowCards })}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Owner actions */}
                    {isOwner && (
                      <>
                        {playerLoan ? null : (
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              className="min-h-11"
                              aria-label={t("markets.profile.sellAction")}
                              onClick={() => setSellOpen(true)}
                            >
                              {t("markets.profile.sellAction")}
                            </Button>
                            <Button
                              variant="outline"
                              className="min-h-11"
                              aria-label={t("markets.profile.auctionAction")}
                              onClick={() => setAuctionOpen(true)}
                            >
                              {t("markets.profile.auctionAction")}
                            </Button>
                            <Button
                              variant="outline"
                              className="min-h-11"
                              aria-label={t("markets.profile.loanAction")}
                              onClick={() => setLoanOpen(true)}
                            >
                              {t("markets.profile.loanAction")}
                            </Button>
                            <Button
                              variant="outline"
                              className="min-h-11"
                              aria-label={t("markets.profile.clauseEditAction")}
                              onClick={() => setClauseOpen(true)}
                            >
                              {t("markets.profile.clauseEditAction")}
                            </Button>
                          </div>
                        )}
                        <Button
                          variant="destructive"
                          className="min-h-11 w-full"
                          onClick={() => setReleaseOpen(true)}
                        >
                          {t("game.squad.release")}
                        </Button>
                      </>
                    )}
                  </aside>
                </div>
              )}

              {!isStaff && (
                <EmptyState
                  title={t("game.squad.noTrend")}
                  hint={t("err.forbidden")}
                  className="py-6"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Release confirmation */}
      <AlertDialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("game.squad.releaseTitle", { name: player ? `${player.firstName} ${player.lastName}` : "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("game.squad.releaseDesc", { amount: formatCurrency(settlementEstimate) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
              disabled={releaseMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (playerId) releaseMutation.mutate(playerId);
              }}
            >
              {releaseMutation.isPending ? "…" : t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Market action dialogs (shared with the markets module) */}
      <SellPlayerDialog open={sellOpen} onOpenChange={setSellOpen} initialPlayerId={playerId} />
      <CreateAuctionDialog open={auctionOpen} onOpenChange={setAuctionOpen} initialPlayerId={playerId} />
      <LoanPlayerDialog
        open={loanOpen}
        onOpenChange={setLoanOpen}
        initialPlayerId={playerId}
        playerName={player ? `${player.firstName} ${player.lastName}` : ""}
      />
      <ClauseEditDialog
        open={clauseOpen}
        onOpenChange={setClauseOpen}
        playerId={playerId}
        playerName={player ? `${player.firstName} ${player.lastName}` : ""}
        currentValue={player?.releaseClause ?? 0}
        marketValue={player?.marketValue ?? 0}
      />
    </>
  );
}

// ── Squad view ────────────────────────────────────────────────────────

export default function SquadView() {
  const { t, formatCurrency } = useI18n();
  const [posFilter, setPosFilter] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("ovr");
  const [sortAsc, setSortAsc] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  // Task 58 — presentation layouts: the historical card grid and the new
  // Bloomberg-style expandable table share every filter/sort/action.
  const [layout, setLayout] = React.useState<"cards" | "table">("cards");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  // Card-level market action: which dialog is open and for which player.
  const [action, setAction] = React.useState<{ kind: MarketActionKind; player: PlayerRow } | null>(null);

  const activeClubId = useViewStore((s) => s.activeClubId);
  const clubsQ = useQuery({ queryKey: qk.myClubs, queryFn: fetchMyClubs });
  const allClubs = clubsQ.data?.clubs ?? [];
  // Respect the top-bar club switcher (falls back to the first club).
  const club = allClubs.find((c) => c.id === activeClubId) ?? allClubs[0] ?? null;
  // User mandate: the club's OWNER **or** its MANAGER manages the squad
  // (sell / auction / loan / clause buttons live on every player card).
  const canManage = club?.role === "OWNER" || club?.role === "MANAGER";
  const isOwner = club?.role === "OWNER";
  const clubId = club?.id ?? "";

  const query = useQuery({
    queryKey: qk.players(clubId),
    queryFn: () => fetchPlayers(clubId),
    enabled: !!clubId,
  });
  const players = React.useMemo(() => query.data?.players ?? [], [query.data]);

  const filtered = React.useMemo(() => {
    let list = players;
    if (posFilter !== "ALL") list = list.filter((p) => p.position === posFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q));
    }
    const dir = sortAsc ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`) * dir;
        case "age":
          return (a.age - b.age) * dir;
        case "value":
          return (a.marketValue - b.marketValue) * dir;
        case "salary":
          return (a.salary - b.salary) * dir;
        default:
          return (a.ovr - b.ovr) * dir;
      }
    });
    return sorted;
  }, [players, posFilter, search, sortKey, sortAsc]);

  const openDetail = (id: string) => {
    setSelected(id);
    setDetailOpen(true);
  };

  const onCardAction = (kind: MarketActionKind, player: PlayerRow) => setAction({ kind, player });

  // Header sort: same key toggles direction, new key starts DESC (ASC for names).
  const onSortKey = (k: SortKey) => {
    if (k === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(k);
      setSortAsc(k === "name");
    }
  };

  if (!club && clubsQ.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64 w-full" aria-hidden="true" />
          ))}
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold">{t("game.squad.title")}</h1>
        <EmptyState title={t("game.dash.noClub")} icon={Users} className="mt-4" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <CinemaHeader
        title={t("game.squad.title")}
        subtitle={t("game.squad.subtitle", { n: club.playerCount, cap: club.capacity.finalCapacity })}
        image="/images/locker-mood.jpg"
        right={
          <div className="relative w-full sm:w-64">
            <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("game.squad.search")}
              className="min-h-11 bg-background/70 pl-8 backdrop-blur"
              aria-label={t("game.squad.search")}
            />
          </div>
        }
      />

      {/* Position filter + sort controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={posFilter} onValueChange={setPosFilter} aria-label={t("common.position")}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="ALL" className="min-h-9">{t("common.all")}</TabsTrigger>
            <TabsTrigger value="GK" className="min-h-9">{t("pos.GK")}</TabsTrigger>
            <TabsTrigger value="DF" className="min-h-9">{t("pos.DF")}</TabsTrigger>
            <TabsTrigger value="MF" className="min-h-9">{t("pos.MF")}</TabsTrigger>
            <TabsTrigger value="FW" className="min-h-9">{t("pos.FW")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex items-center gap-2">
          {/* Task 58 — layout toggle: cards (default) ↔ expandable table */}
          <div
            role="group"
            aria-label={t("game.squad.layoutAria")}
            className="flex items-center rounded-lg border p-0.5"
          >
            <Button
              variant={layout === "cards" ? "secondary" : "ghost"}
              size="icon"
              className={cn("size-8", layout === "cards" && "bg-accent text-accent-foreground")}
              aria-pressed={layout === "cards"}
              aria-label={t("game.squad.viewCards")}
              title={t("game.squad.viewCards")}
              onClick={() => setLayout("cards")}
            >
              <LayoutGrid aria-hidden="true" className="size-4" />
            </Button>
            <Button
              variant={layout === "table" ? "secondary" : "ghost"}
              size="icon"
              className={cn("size-8", layout === "table" && "bg-accent text-accent-foreground")}
              aria-pressed={layout === "table"}
              aria-label={t("game.squad.viewTable")}
              title={t("game.squad.viewTable")}
              onClick={() => {
                setExpandedId(null);
                setLayout("table");
              }}
            >
              <Rows3 aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="min-h-9 w-40" aria-label={t("game.squad.sortBy")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">{t("common.player")}</SelectItem>
              <SelectItem value="age">{t("common.age")}</SelectItem>
              <SelectItem value="ovr">{t("player.ovr")}</SelectItem>
              <SelectItem value="value">{t("game.squad.value")}</SelectItem>
              <SelectItem value="salary">{t("common.salary")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            aria-label={t("game.squad.sortDir")}
            title={t("game.squad.sortDir")}
            onClick={() => setSortAsc((v) => !v)}
          >
            <ArrowDownUp aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>

      {/* Task 58 — cards or expandable table; identical data and actions */}
      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64 w-full" aria-hidden="true" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("game.squad.empty")} icon={Users} />
      ) : layout === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p: PlayerRow) => (
            <SquadPlayerCard key={p.id} p={p} canManage={canManage} onOpenDetail={openDetail} onAction={onCardAction} />
          ))}
        </div>
      ) : (
        <SquadTable
          players={filtered}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={onSortKey}
          canManage={canManage}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
          onOpenDetail={openDetail}
          onAction={onCardAction}
        />
      )}

      {canManage ? null : (
        <p className="text-xs text-muted-foreground">{t("game.squad.ownerOnly")}</p>
      )}

      <PlayerDetailDialog
        playerId={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        isOwner={!!isOwner}
        viewingClubId={clubId ?? null}
      />

      {/* Card-level market action dialogs (shared with the markets module) */}
      <SellPlayerDialog
        open={action?.kind === "sell"}
        onOpenChange={(v) => {
          if (!v) setAction(null);
        }}
        initialPlayerId={action?.kind === "sell" ? action.player.id : null}
      />
      <CreateAuctionDialog
        open={action?.kind === "auction"}
        onOpenChange={(v) => {
          if (!v) setAction(null);
        }}
        initialPlayerId={action?.kind === "auction" ? action.player.id : null}
      />
      <LoanPlayerDialog
        open={action?.kind === "loan"}
        onOpenChange={(v) => {
          if (!v) setAction(null);
        }}
        initialPlayerId={action?.kind === "loan" ? action.player.id : null}
        playerName={action?.kind === "loan" ? `${action.player.firstName} ${action.player.lastName}` : ""}
      />
      <ClauseEditDialog
        open={action?.kind === "clause"}
        onOpenChange={(v) => {
          if (!v) setAction(null);
        }}
        playerId={action?.kind === "clause" ? action.player.id : null}
        playerName={action?.kind === "clause" ? `${action.player.firstName} ${action.player.lastName}` : ""}
        currentValue={action?.kind === "clause" ? action.player.releaseClause : 0}
        marketValue={action?.kind === "clause" ? action.player.marketValue : 0}
      />
    </div>
  );
}
