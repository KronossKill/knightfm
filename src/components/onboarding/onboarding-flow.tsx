"use client";
// Knight FM — Onboarding flow (Task 4-a, spec §13/§14).
// Step 1: career path (Manager free / Owner buys clubs with $Knight — honest
// funding note). Step 2: club browser (region filter, search, pagination).
// Step 3: MANAGER → contract review showing the three §14 numbers (fixed total,
// exact duration, derived daily salary) before acceptance; OWNER → purchase
// with atomic claim; on 402 INSUFFICIENT_FUNDS an honest guidance dialog
// (referral bonus / verified deposit — no fake money, D-010).

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Info,
  KeyRound,
  MonitorCog,
  Search,
  Shield,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, ApiError } from "@/components/auth/store";
import { useAuth } from "@/components/auth/store";
import {
  fetchContractPreview,
  fetchOnboardingClubs,
  fetchOnboardingState,
  qk,
  type ContractPreview,
  type OnboardingClub,
} from "@/components/game/api";
import { BrandBadge, ErrorState, KV } from "@/components/game/ui/bits";
import { useViewStore } from "@/components/game/view-store";
import { useHeartbeat } from "@/hooks/use-heartbeat";

type Path = "MANAGER" | "OWNER";

function localizeError(err: unknown, t: (k: string) => string): string {
  const code = err instanceof ApiError ? err.code : "";
  return code && t(`game.err.${code}`) !== `game.err.${code}` ? t(`game.err.${code}`) : t("err.generic");
}

// ── Step 1: path choice ─────────────────────────────────────────

function PathStep({
  onSelect,
  busy,
  previousPath,
}: {
  onSelect: (p: Path) => void;
  busy: boolean;
  previousPath?: Path | null;
}) {
  const { t } = useI18n();
  const cards: {
    path: Path;
    titleKey: string;
    priceKey: string;
    descKey: string;
    bullets: string[];
    icon: React.ComponentType<{ className?: string }>;
    note?: string;
  }[] = [
    {
      path: "MANAGER",
      titleKey: "game.onb.managerTitle",
      priceKey: "game.onb.managerPrice",
      descKey: "game.onb.managerDesc",
      bullets: ["game.onb.managerB1", "game.onb.managerB2", "game.onb.managerB3"],
      icon: Trophy,
    },
    {
      path: "OWNER",
      titleKey: "game.onb.ownerTitle",
      priceKey: "game.onb.ownerPrice",
      descKey: "game.onb.ownerDesc",
      bullets: ["game.onb.ownerB1", "game.onb.ownerB2"],
      icon: Shield,
      note: "game.onb.ownerNote",
    },
  ];

  return (
    <div className="space-y-5">
      <header className="text-center">
        <h1 className="text-2xl font-bold">{t("game.onb.pathTitle")}</h1>
        <p className="mx-auto mt-1.5 max-w-lg text-sm text-muted-foreground">{t("game.onb.pathSubtitle")}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label={t("game.onb.pathTitle")}>
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.path}
              type="button"
              role="radio"
              aria-checked={false}
              disabled={busy}
              onClick={() => onSelect(c.path)}
              className={cn(
                "group flex min-h-11 flex-col rounded-2xl border bg-card p-5 text-left transition-all",
                "hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                c.path === "OWNER" && "border-amber-500/30"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15">
                  <Icon aria-hidden="true" className="size-6 text-primary" />
                </span>
                <div>
                  <p className="text-lg font-bold">{t(c.titleKey)}</p>
                  <Badge variant="outline" className={c.path === "OWNER" ? "border-amber-500/40 text-amber-300" : "border-primary/40 text-primary"}>
                    {t(c.priceKey)}
                  </Badge>
                </div>
                {c.path === previousPath && (
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <Check aria-hidden="true" className="size-3" />
                    {t("game.onb.prevChoice")}
                  </span>
                )}
                <ArrowRight
                  aria-hidden="true"
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary",
                    c.path !== previousPath && "ml-auto"
                  )}
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t(c.descKey)}</p>
              <ul className="mt-3 space-y-1.5">
                {c.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {t(b)}
                  </li>
                ))}
              </ul>
              {c.note && (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs leading-relaxed text-amber-200/90">
                  <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  {t(c.note)}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: club browser ────────────────────────────────────────

function ClubCard({
  club,
  isOwner,
  onSelect,
  disabled,
}: {
  club: OnboardingClub;
  isOwner: boolean;
  onSelect: (c: OnboardingClub) => void;
  disabled: boolean;
}) {
  const { t, formatCurrency } = useI18n();
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BrandBadge brand={club.brand} name={club.name} />
          <span className="min-w-0 flex-1 truncate">{club.name}</span>
        </CardTitle>
        <CardDescription>
          {t(club.regionNameKey)} · {t("game.comp.division")} {club.divisionIndex}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-2.5">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md bg-muted/50 p-1.5">
            <p className="text-[10px] uppercase text-muted-foreground">{t("game.onb.avgOvr")}</p>
            <p className="font-mono text-sm font-semibold">{club.avgOvr ?? "—"}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-1.5">
            <p className="text-[10px] uppercase text-muted-foreground">{t("game.onb.squadSize")}</p>
            <p className="font-mono text-sm font-semibold">{club.squadSize}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-1.5">
            <p className="text-[10px] uppercase text-muted-foreground">{t("game.dash.fund")}</p>
            <p className="font-mono text-sm font-semibold">{club.operatingFund}</p>
          </div>
        </div>
        {isOwner && club.price !== null && (
          <p className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("game.onb.price")}</span>
            <span className="font-mono font-bold text-amber-300">{formatCurrency(club.price)}</span>
          </p>
        )}
        <Button
          className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={disabled}
          onClick={() => onSelect(club)}
        >
          {t("game.onb.select")}
          <ArrowRight aria-hidden="true" className="ml-1 size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function ClubsStep({
  path,
  onSelect,
  onBack,
}: {
  path: Path;
  onSelect: (c: OnboardingClub) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [regionIndex, setRegionIndex] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 400);
    return () => window.clearTimeout(id);
  }, [search]);

  const regionsQ = useQuery({ queryKey: qk.regions, queryFn: () => apiFetch<{ regions: { id: string; index: number; nameKey: string }[] }>("/api/world/regions") });

  const query = useQuery({
    queryKey: qk.onboardingClubs(path, regionIndex === "all" ? undefined : Number(regionIndex), debounced, page),
    queryFn: () =>
      fetchOnboardingClubs(path, regionIndex === "all" ? undefined : Number(regionIndex), debounced, page),
  });
  const data = query.data;
  const isOwner = path === "OWNER";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("game.onb.clubTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? t("game.onb.clubSubtitle", { total: data.total }) : t("game.onb.loadingClubs")}
          </p>
        </div>
        <Button variant="outline" className="min-h-11" onClick={onBack}>
          <ArrowLeft aria-hidden="true" className="mr-1.5 size-4" />
          {t("game.onb.back")}
        </Button>
      </header>

      {/* Task 30: honest rule notice — only divisions >= minDivisionIndex are selectable */}
      {data && (
        <Alert className="border-amber-500/30 bg-amber-500/10 py-2">
          <Info aria-hidden="true" className="size-4 text-amber-300" />
          <AlertDescription className="text-xs text-amber-200">
            {t("game.onb.divisionRestrict", { n: data.minDivisionIndex })}
          </AlertDescription>
        </Alert>
      )}

      {/* User mandate: a picked system club starts bare-bones — level-1
          facilities and NO staff; everything is built over time with the
          club's own funds (and special training needs a coach). */}
      <Alert className="py-2">
        <Info aria-hidden="true" className="size-4" />
        <AlertDescription className="text-xs text-muted-foreground">
          {t("game.onb.systemClubBaseline")}
        </AlertDescription>
      </Alert>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={regionIndex}
          onValueChange={(v) => {
            setRegionIndex(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="min-h-11 sm:w-52" aria-label={t("game.comp.region")}>
            <SelectValue placeholder={t("game.onb.filterRegion")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("game.onb.filterRegion")}</SelectItem>
            {regionsQ.data?.regions.map((r) => (
              <SelectItem key={r.id} value={String(r.index)}>
                {t(r.nameKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("game.onb.search")}
            className="min-h-11 pl-8"
            aria-label={t("game.onb.search")}
          />
        </div>
      </div>

      {/* Grid */}
      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
      ) : (data?.clubs.length ?? 0) === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("common.empty")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data!.clubs.map((c) => (
            <ClubCard key={c.id} club={c} isOwner={isOwner} onSelect={onSelect} disabled={false} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="Pagination">
          <Button
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label={t("game.onb.prev")}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {data.page} / {data.pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => Math.min(data!.pages, p + 1))}
            aria-label={t("game.onb.next")}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}

// ── Step 3 (manager): contract review ───────────────────────────

function ContractStep({
  club,
  onBack,
  onDone,
}: {
  club: OnboardingClub;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const previewQ = useQuery({
    queryKey: qk.contractPreview(club.id),
    queryFn: () => fetchContractPreview(club.id),
    staleTime: 0,
  });
  const preview: ContractPreview | undefined = previewQ.data;

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ contract: { dailySalary: number } }>("/api/onboarding/accept-manager-contract", {
        method: "POST",
        body: { clubId: club.id },
      }),
    onSuccess: () => {
      toast({ title: t("game.onb.accepted", { club: club.name }), description: t("game.onb.welcome") });
      onDone();
    },
    onError: (err) => {
      toast({ title: localizeError(err, t), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      // If the club was taken in a race, go back to the browser.
      if (err instanceof ApiError && (err.code === "CLUB_TAKEN" || err.code === "CLUB_UNAVAILABLE")) onBack();
    },
  });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandBadge brand={club.brand} name={club.name} size="lg" />
          <div>
            <h1 className="text-xl font-bold">{t("game.onb.contractTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {club.name} · {t(club.regionNameKey)} · {t("game.comp.division")} {club.divisionIndex}
            </p>
          </div>
        </div>
        <Button variant="outline" className="min-h-11" onClick={onBack}>
          <ArrowLeft aria-hidden="true" className="mr-1.5 size-4" />
          {t("game.onb.back")}
        </Button>
      </header>

      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BadgeDollarSign aria-hidden="true" className="size-4 text-primary" />
            {t("game.onb.contractTitle")}
          </CardTitle>
          <CardDescription>{t("game.onb.contractSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {previewQ.isLoading ? (
            <Skeleton className="h-40 w-full" aria-hidden="true" />
          ) : previewQ.isError || !preview ? (
            <ErrorState message={t("err.generic")} onRetry={() => void previewQ.refetch()} />
          ) : (
            <div className="space-y-4">
              {/* The three §14 numbers */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("game.onb.contractTotal")}</p>
                  <p className="mt-1 font-mono text-xl font-bold text-primary">{formatCurrency(preview.totalAmount)}</p>
                </div>
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("game.onb.contractDuration")}</p>
                  <p className="mt-1 flex items-center justify-center gap-1.5 font-mono text-xl font-bold text-primary">
                    <CalendarClock aria-hidden="true" className="size-4" />
                    {t("game.onb.contractDays", { n: preview.durationDays })}
                  </p>
                </div>
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("game.onb.contractDaily")}</p>
                  <p className="mt-1 font-mono text-xl font-bold text-amber-300">{formatCurrency(preview.dailySalary)}</p>
                </div>
              </div>
              <p className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span>{t("game.onb.contractSeason", { n: preview.seasonNumber, start: preview.startDay, end: preview.endDay })}</span>
                <span className="font-mono">{preview.seasons} {t("common.seasons")}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="min-h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={!preview || acceptMutation.isPending}
        onClick={() => setConfirmOpen(true)}
      >
        <KeyRound aria-hidden="true" className="mr-2 size-4" />
        {t("game.onb.accept")}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("game.onb.contractTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {preview
                ? `${t("game.onb.contractTotal")}: ${formatCurrency(preview.totalAmount)} · ${t(
                    "game.onb.contractDuration"
                  )}: ${t("game.onb.contractDays", { n: preview.durationDays })} · ${t(
                    "game.onb.contractDaily"
                  )}: ${formatCurrency(preview.dailySalary)}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={acceptMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                acceptMutation.mutate();
              }}
            >
              {acceptMutation.isPending ? "…" : t("game.onb.accept")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Owner: honest insufficient-funds dialog ─────────────────────

function FundsDialog({
  need,
  have,
  open,
  onOpenChange,
  onDeposit,
}: {
  need: number;
  have: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeposit: () => void;
}) {
  const { t, formatCurrency } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins aria-hidden="true" className="size-5 text-amber-400" />
            {t("game.onb.fundsTitle")}
          </DialogTitle>
          <DialogDescription>{t("game.onb.fundsDesc", { need, have })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5 rounded-lg border p-3">
            <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed">{t("game.onb.fundsReferral")}</p>
          </div>
          {/* Deposit route: a real button — one click takes the user to the
              Wallet (deposit-escape mode) so the deposit is actually reachable. */}
          <button
            type="button"
            onClick={onDeposit}
            aria-label={t("game.onb.fundsDepositCta")}
            className="group flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Coins aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-relaxed">{t("game.onb.fundsDeposit")}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:text-primary">
                {t("game.onb.fundsDepositCta")}
                <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">{formatCurrency(need)} · {formatCurrency(have)}</p>
      </DialogContent>
    </Dialog>
  );
}

// ── Main flow ───────────────────────────────────────────────────

export default function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = useAuth((s) => s.user);

  const stateQ = useQuery({ queryKey: qk.onboardingState, queryFn: fetchOnboardingState });
  const meQ = useQuery({
    queryKey: qk.me,
    queryFn: () => apiFetch<{ wallet: { balance: number }; walletBalance?: number }>("/api/auth/me"),
  });
  const serverPath = stateQ.data?.path ?? null;

  const [step, setStep] = React.useState<"path" | "clubs" | "contract">("path");
  const [path, setPath] = React.useState<Path | null>(null);
  const [selectedClub, setSelectedClub] = React.useState<OnboardingClub | null>(null);
  const [purchaseTarget, setPurchaseTarget] = React.useState<OnboardingClub | null>(null);
  const [funds, setFunds] = React.useState<{ need: number; have: number } | null>(null);

  // Users deciding their path count as active users too.
  useHeartbeat(true);

  // NOTE: no auto-skip here. Until the user owns/manages a club, entry ALWAYS
  // shows step 1 with both options (Mánager / Propietario); the previous
  // choice is highlighted and can be changed while club-less (server allows
  // it). Once a club exists, AuthedGate never renders this flow again.

  const setPathMutation = useMutation({
    mutationFn: (p: Path) => apiFetch<{ path: string }>("/api/onboarding/path", { method: "POST", body: { path: p } }),
    onSuccess: (_res, p) => {
      setPath(p);
      setStep("clubs");
      void queryClient.invalidateQueries({ queryKey: qk.onboardingState });
    },
    onError: (err) => {
      toast({ title: localizeError(err, t), variant: "destructive" });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: (clubId: string) =>
      apiFetch<{ price: number; balanceAfter: number }>("/api/onboarding/purchase-club", {
        method: "POST",
        body: { clubId },
      }),
    onSuccess: (res) => {
      toast({
        title: t("game.onb.purchased", { club: purchaseTarget?.name ?? "" }),
        description: `${t("game.onb.price")}: ${formatCurrency(res.price)} · ${t("common.balance")}: ${formatCurrency(res.balanceAfter)}`,
      });
      setPurchaseTarget(null);
      onDone();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "INSUFFICIENT_FUNDS") {
        // The API message carries the honest numbers: "Insufficient funds (need X, have Y)".
        const match = /need (\d+), have (\d+)/.exec(err.message);
        const need = match ? Number(match[1]) : purchaseTarget?.price ?? 0;
        const have = match
          ? Number(match[2])
          : meQ.data?.wallet?.balance ?? meQ.data?.walletBalance ?? user?.walletBalance ?? 0;
        setFunds({ need, have });
        setPurchaseTarget(null);
        return;
      }
      toast({ title: localizeError(err, t), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      setPurchaseTarget(null);
    },
  });

  const finish = () => {
    // Refetch profile so auth state reflects the new path/club, then hand over.
    void queryClient.invalidateQueries({ queryKey: qk.onboardingState });
    void queryClient.invalidateQueries({ queryKey: qk.me });
    onDone();
  };

  const goDeposit = () => {
    // Deposit escape hatch: leave the onboarding flow for a restricted
    // wallet-only shell so the user can actually make the verified Solana
    // deposit, then return to this decision. The reactive zustand flag switches
    // AuthedGate IMMEDIATELY (a query invalidation alone cannot trigger it:
    // structural sharing keeps the same data reference for identical payloads);
    // sessionStorage keeps the mode across reloads.
    setFunds(null);
    window.sessionStorage.setItem("kfm.onb.wallet", "1");
    useViewStore.getState().setDepositEscape(true);
  };

  if (stateQ.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-3xl space-y-4" aria-busy="true">
          <Skeleton className="mx-auto h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const stepNumber = step === "path" ? 1 : step === "clubs" ? 2 : 3;

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-5xl">
        {/* Admin escape hatch: reach the Control Center without a club */}
        {user?.role === "ADMIN" && (
          <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t("game.onb.adminEscapeTitle")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("game.onb.adminEscapeDesc")}</p>
              </div>
              <Button
                variant="outline"
                className="min-h-11 shrink-0 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                onClick={() => {
                  window.sessionStorage.setItem("kfm.admin.ccOnly", "1");
                  // AuthedGate re-evaluates on the next onboardingState render:
                  // invalidating refetches it so the shell mounts immediately.
                  void queryClient.invalidateQueries({ queryKey: qk.onboardingState });
                  onDone();
                }}
              >
                <MonitorCog aria-hidden="true" className="mr-2 size-4" />
                {t("game.onb.adminEscapeButton")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        <div className="mb-6 flex items-center justify-center gap-2" aria-label={t("game.onb.step", { n: stepNumber, m: 3 })}>
          {[1, 2, 3].map((n) => (
            <React.Fragment key={n}>
              <span
                aria-current={n === stepNumber ? "step" : undefined}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs font-bold",
                  n < stepNumber && "border-primary/50 bg-primary/20 text-primary",
                  n === stepNumber && "border-primary bg-primary text-primary-foreground",
                  n > stepNumber && "text-muted-foreground"
                )}
              >
                {n}
              </span>
              {n < 3 && <span aria-hidden="true" className={cn("h-px w-10", n < stepNumber ? "bg-primary/60" : "bg-border")} />}
            </React.Fragment>
          ))}
        </div>

        {step === "path" && (
          <PathStep
            busy={setPathMutation.isPending}
            previousPath={serverPath === "MANAGER" || serverPath === "OWNER" ? serverPath : null}
            onSelect={(p) => setPathMutation.mutate(p)}
          />
        )}

        {step === "clubs" && path && (
          <ClubsStep
            path={path}
            onBack={() => {
              setStep("path");
            }}
            onSelect={(c) => {
              if (path === "MANAGER") {
                setSelectedClub(c);
                setStep("contract");
              } else {
                setPurchaseTarget(c);
              }
            }}
          />
        )}

        {step === "contract" && selectedClub && (
          <ContractStep club={selectedClub} onBack={() => setStep("clubs")} onDone={finish} />
        )}
      </div>

      {/* Owner purchase confirmation */}
      <AlertDialog open={!!purchaseTarget} onOpenChange={(v) => !v && setPurchaseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("game.onb.purchaseTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("game.onb.purchaseDesc", {
                club: purchaseTarget?.name ?? "",
                price: formatCurrency(purchaseTarget?.price ?? 0),
                balance: formatCurrency(
                  Math.max(0, (meQ.data?.wallet?.balance ?? meQ.data?.walletBalance ?? user?.walletBalance ?? 0) - (purchaseTarget?.price ?? 0))
                ),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={purchaseMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (purchaseTarget) purchaseMutation.mutate(purchaseTarget.id);
              }}
            >
              {purchaseMutation.isPending ? "…" : t("game.onb.select")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Honest insufficient funds */}
      <FundsDialog need={funds?.need ?? 0} have={funds?.have ?? 0} open={!!funds} onOpenChange={(v) => !v && setFunds(null)} onDeposit={goDeposit} />
    </div>
  );
}
