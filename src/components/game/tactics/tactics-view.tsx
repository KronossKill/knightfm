"use client";
// Knight FM — Knight Tactical Board, the flagship screen (Task 4-b, spec §12).
// Default export: TacticsView({ club, nextOpponent? }).
// Three-zone desktop layout (shortlist | pitch | analysis), mobile tabs,
// click-to-assign slot dialogs (fully keyboard accessible), formation re-mapping,
// in/out-of-possession overlay views, auto-complete (multi-factor, server-side),
// explicit save with dirty tracking + toasts. TanStack Query for squad + lineup,
// local optimistic selection between saves.

import "@/lib/i18n/dict/tactics";

import { ReactNode, useCallback, useContext, useMemo, useState } from "react";
import {
  QueryClient,
  QueryClientContext,
  QueryClientProvider,
} from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Shirt, AlertTriangle, Eraser, Loader2, RotateCcw, Save, Sparkles } from "lucide-react";
import CinemaHeader from "@/components/game/ui/cinema-header";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/components/auth/store";
import { FORMATIONS, FORMATION_LAYOUTS, Formation } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

import { Pitch, PitchMode } from "./pitch";
import { SlotDialog } from "./slot-dialog";
import { SquadPanel } from "./squad-panel";
import { AnalysisPanel } from "./analysis-panel";
import {
  normalizeSlots,
  useAutoLineup,
  useClubFallback,
  useLineup,
  useSaveLineup,
  useSquad,
  SquadPlayer,
} from "./use-tactics";

export interface TacticsViewProps {
  /** Active club. Optional: when omitted the view resolves it via /api/club/mine. */
  club?: { id: string; name: string };
  /** Optional matchup context — shown in the analysis panel when provided. */
  nextOpponent?: string;
}

interface LineupState {
  formation: Formation;
  slots: Record<string, string | null>;
}

// ─── Default export (resilient to a missing app-level QueryClientProvider) ──

export default function TacticsView(props: TacticsViewProps) {
  return (
    <QueryGate>
      <TacticsViewInner {...props} />
    </QueryGate>
  );
}

function QueryGate({ children }: { children: ReactNode }) {
  const existing = useContext(QueryClientContext);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      })
  );
  if (existing) return <>{children}</>;
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ─── Board ─────────────────────────────────────────────────────────

function TacticsViewInner({ club, nextOpponent }: TacticsViewProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();

  // Resolve the club: explicit prop wins; otherwise GET /api/club/mine fallback.
  const clubMineQ = useClubFallback(!club);
  const fallbackClub = clubMineQ.data?.clubs?.[0];
  const resolvedClub: { id: string; name: string } | null =
    club ?? (fallbackClub ? { id: fallbackClub.id, name: fallbackClub.name } : null);

  const squadQ = useSquad(resolvedClub?.id);
  const lineupQ = useLineup(resolvedClub?.id);
  const saveMut = useSaveLineup(resolvedClub?.id ?? "");
  const autoMut = useAutoLineup(resolvedClub?.id ?? "");

  // Working (unsaved) lineup; the saved snapshot is derived from the query cache
  // (mutations update it via setQueryData, so "saved" always tracks the server).
  const [state, setState] = useState<LineupState | null>(null);
  const [mode, setMode] = useState<PitchMode>("combined");
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"pitch" | "squad" | "analysis">("pitch");
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  const squad: SquadPlayer[] = squadQ.data?.players ?? [];
  const squadById = useMemo(() => {
    const map = new Map<string, SquadPlayer>();
    for (const p of squad) map.set(p.id, p);
    return map;
  }, [squad]);

  const serverState = useMemo<LineupState | null>(() => {
    const d = lineupQ.data;
    if (!d) return null;
    const formation = (FORMATIONS as readonly string[]).includes(d.formation)
      ? (d.formation as Formation)
      : "4-4-2";
    return { formation, slots: normalizeSlots(d.slots, formation) };
  }, [lineupQ.data]);

  // Adopt the server snapshot once (working copy is local & optimistic).
  if (serverState && !state) {
    setState(serverState);
  }

  const saved = serverState;

  const layout = state ? FORMATION_LAYOUTS[state.formation] : [];
  const filled = state ? Object.values(state.slots).filter(Boolean).length : 0;
  const total = layout.length;
  const dirty =
    !!state &&
    !!saved &&
    (state.formation !== saved.formation || JSON.stringify(state.slots) !== JSON.stringify(saved.slots));

  const openSlot = state && openSlotId ? layout.find((s) => s.id === openSlotId) ?? null : null;

  // ── Handlers ─────────────────────────────────────────────────────

  const handleFormationChange = useCallback((value: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const formation = value as Formation;
      // Re-map: keep players whose slot id exists in the new layout
      // (slot ids are position-consistent across layouts), else unassign.
      const slots: Record<string, string | null> = {};
      const seen = new Set<string>();
      for (const s of FORMATION_LAYOUTS[formation]) {
        const pid = prev.slots[s.id] ?? null;
        if (pid && !seen.has(pid)) {
          slots[s.id] = pid;
          seen.add(pid);
        } else {
          slots[s.id] = null;
        }
      }
      return { formation, slots };
    });
  }, []);

  const handleAssign = useCallback((slotId: string, playerId: string | null) => {
    setState((prev) => {
      if (!prev) return prev;
      const slots = { ...prev.slots };
      if (playerId) {
        for (const k of Object.keys(slots)) {
          if (slots[k] === playerId) slots[k] = null;
        }
      }
      slots[slotId] = playerId;
      return { ...prev, slots };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!state) return;
    try {
      const res = await saveMut.mutateAsync({ formation: state.formation, slots: state.slots });
      const formation = res.formation as Formation;
      const next: LineupState = { formation, slots: normalizeSlots(res.slots, formation) };
      setState(next);
      toast({
        title: t("tactics.toast.saved"),
        description: t("tactics.toast.savedDesc", {
          formation: res.formation,
          filled: res.filled,
          total: res.total,
        }),
      });
    } catch (e) {
      toastError(toast, t, e);
    }
  }, [state, saveMut, t, toast]);

  const handleAuto = useCallback(async () => {
    if (!state) return;
    try {
      const res = await autoMut.mutateAsync({ formation: state.formation });
      const formation = res.formation as Formation;
      const next: LineupState = { formation, slots: normalizeSlots(res.slots, formation) };
      setState(next);
      toast({
        title: t("tactics.toast.autoDone"),
        description: t("tactics.toast.autoDesc"),
      });
    } catch (e) {
      toastError(toast, t, e);
    }
  }, [state, autoMut, t, toast]);

  // Clear the whole lineup of the CURRENT formation (unsaved until Guardar).
  const handleClear = useCallback(() => {
    setState((s) =>
      s ? { ...s, slots: Object.fromEntries(Object.keys(s.slots).map((k) => [k, null])) } : s
    );
    toast({ title: t("tactics.toast.cleared") });
  }, [t, toast]);

  const handleReset = useCallback(() => {
    if (saved) setState(saved);
  }, [saved]);

  const handleCompareA = useCallback(
    (id: string) => {
      setCompareB((prevB) => (prevB === id ? compareA : prevB));
      setCompareA(id);
    },
    [compareA]
  );

  const handleCompareB = useCallback(
    (id: string) => {
      setCompareA((prevA) => (prevA === id ? compareB : prevA));
      setCompareB(id);
    },
    [compareB]
  );

  // Comparison defaults to the first two squad players until overridden.
  const compareAId = compareA ?? squad[0]?.id ?? null;
  const compareBId = compareB ?? squad[1]?.id ?? null;

  const retry = useCallback(() => {
    squadQ.refetch();
    lineupQ.refetch();
    clubMineQ.refetch();
  }, [squadQ, lineupQ, clubMineQ]);

  // ── Render blocks ────────────────────────────────────────────────

  const hintKey =
    mode === "in"
      ? "tactics.view.hint.in"
      : mode === "out"
        ? "tactics.view.hint.out"
        : "tactics.view.hint.combined";

  const pitchBlock = state ? (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="border bg-card p-3">
        <Pitch
          formation={state.formation}
          slots={state.slots}
          squadById={squadById}
          mode={mode}
          animatePosition={!reduceMotion}
          onSlotClick={(slot) => setOpenSlotId(slot.id)}
        />
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{t(hintKey)}</p>
      </Card>
    </motion.div>
  ) : null;

  const leftPanel = state ? (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: reduceMotion ? 0 : 0.05 }}
    >
      <SquadPanel
        squad={squad}
        slots={state.slots}
        compareA={compareAId}
        compareB={compareBId}
        onCompareA={handleCompareA}
        onCompareB={handleCompareB}
      />
    </motion.div>
  ) : null;

  const rightPanel = state ? (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: reduceMotion ? 0 : 0.1 }}
    >
      <AnalysisPanel
        formation={state.formation}
        slots={state.slots}
        squadById={squadById}
        nextOpponent={nextOpponent}
      />
    </motion.div>
  ) : null;

  // Gates: club resolution → loading → error → board
  if (!resolvedClub) {
    if (clubMineQ.isError) {
      return (
        <BoardFrame>
          <ErrorCard
            message={(clubMineQ.error as Error | null)?.message}
            onRetry={retry}
            retryLabel={t("common.retry")}
            errorLabel={t("common.error")}
          />
        </BoardFrame>
      );
    }
    if (clubMineQ.isSuccess) {
      return (
        <BoardFrame>
          <Card className="mx-auto max-w-md border p-8 text-center text-sm text-muted-foreground">
            {t("common.empty")}
          </Card>
        </BoardFrame>
      );
    }
    return <BoardFrame><SkeletonBoard /></BoardFrame>;
  }

  if (squadQ.isLoading || lineupQ.isLoading) {
    return <BoardFrame><SkeletonBoard /></BoardFrame>;
  }

  if (squadQ.isError || lineupQ.isError) {
    const err = (squadQ.error ?? lineupQ.error) as Error | null;
    return (
      <BoardFrame>
        <ErrorCard
          message={err?.message}
          onRetry={retry}
          retryLabel={t("common.retry")}
          errorLabel={t("common.error")}
        />
      </BoardFrame>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] p-3 sm:p-4 lg:p-6">
      {/* Header — Task 56 cinematic scene (dark pitch photography) */}
      <CinemaHeader
        title={t("tactics.title")}
        subtitle={resolvedClub.name}
        image="/images/pitch-dark.jpg"
        icon={Shirt}
        className="mb-4"
      />

      {/* Top controls */}
      <Card className="mb-4 border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={state?.formation ?? "4-4-2"} onValueChange={handleFormationChange}>
            <SelectTrigger
              aria-label={t("tactics.formation.label")}
              className="w-[150px] font-semibold text-amber-300"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATIONS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={mode} onValueChange={(v) => setMode(v as PitchMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="combined" className="px-2.5 text-xs sm:px-3">
                {t("tactics.view.combined")}
              </TabsTrigger>
              <TabsTrigger value="in" className="px-2.5 text-xs sm:px-3">
                {t("tactics.view.inPossession")}
              </TabsTrigger>
              <TabsTrigger value="out" className="px-2.5 text-xs sm:px-3">
                {t("tactics.view.outOfPossession")}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Completeness + dirty indicator */}
            <span
              role="status"
              aria-label={t("tactics.completeness.aria", { filled, total })}
              className="flex items-center gap-1.5"
            >
              {dirty && (
                <span
                  aria-label={t("tactics.dirty.aria")}
                  title={t("tactics.dirty.aria")}
                  className="h-2 w-2 rounded-full bg-amber-400"
                />
              )}
              <Badge
                variant="outline"
                className="tabular-nums"
              >
                {filled}/{total}
              </Badge>
            </span>

            <Button
              variant="secondary"
              onClick={handleAuto}
              disabled={!state || autoMut.isPending}
              className="min-h-[44px]"
            >
              {autoMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              {t("tactics.action.auto")}
            </Button>
            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={!state || filled === 0}
              className="min-h-[44px]"
            >
              <Eraser className="h-4 w-4" aria-hidden="true" />
              {t("tactics.action.clear")}
            </Button>
            <Button
              variant="ghost"
              onClick={handleReset}
              disabled={!dirty}
              className="min-h-[44px]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t("tactics.action.reset")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!state || !dirty || saveMut.isPending}
              className="min-h-[44px]"
            >
              {saveMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {t("tactics.action.save")}
            </Button>
          </div>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
          {t("tactics.auto.note")}
        </p>
      </Card>

      {/* Mobile: tabs (Pitch | Squad | Analysis) */}
      <div className="lg:hidden">
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as typeof mobileTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pitch" className="min-h-[44px] text-xs">
              {t("tactics.tab.pitch")}
            </TabsTrigger>
            <TabsTrigger value="squad" className="min-h-[44px] text-xs">
              {t("tactics.tab.squad")}
            </TabsTrigger>
            <TabsTrigger value="analysis" className="min-h-[44px] text-xs">
              {t("tactics.tab.analysis")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-3">
          {mobileTab === "pitch" && pitchBlock}
          {mobileTab === "squad" && leftPanel}
          {mobileTab === "analysis" && rightPanel}
        </div>
      </div>

      {/* Desktop: 3-column grid */}
      <div className="hidden items-start gap-4 lg:grid lg:grid-cols-[280px_minmax(0,1fr)_280px] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <div>{leftPanel}</div>
        <div>{pitchBlock}</div>
        <div>{rightPanel}</div>
      </div>

      {/* Slot assignment dialog */}
      <SlotDialog
        slot={openSlot}
        formation={state?.formation ?? "4-4-2"}
        squad={squad}
        slots={state?.slots ?? {}}
        onAssign={handleAssign}
        onClose={() => setOpenSlotId(null)}
      />
    </div>
  );
}

// ─── Shared toast error helper ─────────────────────────────────────

function toastError(
  toast: ReturnType<typeof useToast>["toast"],
  t: (key: string, vars?: Record<string, string | number>) => string,
  e: unknown
) {
  let description: string | undefined;
  if (e instanceof ApiError) description = `${e.code} — ${e.message}`;
  else if (e instanceof Error) description = e.message;
  toast({ title: t("common.error"), description, variant: "destructive" });
}

// ─── Small shared render blocks ────────────────────────────────────

function BoardFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1400px] p-3 sm:p-4 lg:p-6">{children}</div>;
}

function SkeletonBoard() {
  return (
    <div>
      <Skeleton className="mb-4 h-8 w-56" />
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <Skeleton className="hidden h-[420px] rounded-xl lg:block" />
        <Skeleton className="mx-auto aspect-[68/105] w-full max-w-[540px] rounded-xl" />
        <Skeleton className="hidden h-[420px] rounded-xl lg:block" />
      </div>
    </div>
  );
}

function ErrorCard({
  message,
  onRetry,
  errorLabel,
  retryLabel,
}: {
  message?: string;
  onRetry: () => void;
  errorLabel: string;
  retryLabel: string;
}) {
  return (
    <Card className="mx-auto flex max-w-md flex-col items-center gap-3 border-destructive/40 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-400" aria-hidden="true" />
      <p className="font-semibold">{errorLabel}</p>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <Button variant="outline" onClick={onRetry} className="min-h-[44px]">
        {retryLabel}
      </Button>
    </Card>
  );
}
