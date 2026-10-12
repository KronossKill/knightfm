"use client";
// Knight FM — Friendlies tab (user mandate).
// Purpose: a TACTICS LAB. A friendly pays NO prize, generates NO matchday
// revenue and NO gate receipts (engine-enforced) — it exists so managers can
// test tactics, and it DOES consume real player energy. The kickoff must sit
// at least `competition.friendlyBufferMin` (default 30) minutes BEFORE and
// AFTER any other fixture of BOTH participating clubs. The live validator
// below mirrors the server rule (both calendars are fetched, so conflicts are
// visible before paying the fee); the server re-checks authoritatively.

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, FlaskConical, ShieldAlert, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ApiError } from "@/components/auth/store";
import {
  fetchFixtures,
  fetchFriendlyInfo,
  scheduleFriendly,
  qk,
  type FixtureRow,
} from "@/components/game/api";
import { useActiveClub } from "@/components/game/hooks/use-active-club";
import { BrandBadge, EmptyState, ErrorState, TableSkeleton } from "@/components/game/ui/bits";

const DAY_MS = 86_400_000;
const FRIENDLY_WINDOW_DAYS = 7;
const MAX_FRIENDLIES_PER_WINDOW = 2;

interface ConflictRow {
  fixture: FixtureRow;
  side: "mine" | "opp";
  deltaMin: number;
}

/** One upcoming fixture of the manager's club (agenda card). */
function AgendaRow({ f, myClubId }: { f: FixtureRow; myClubId: string }) {
  const { t, formatDate } = useI18n();
  const isHome = f.home.id === myClubId;
  const opponent = isHome ? f.away : f.home;
  return (
    <li className="flex items-center gap-2 rounded-lg border bg-card/40 p-2.5">
      <Badge variant="outline" className={cn("shrink-0 text-[10px]", f.competition === "FRIENDLY" && "border-zinc-400/60")}>
        {t(`comp.${f.competition}`)}
      </Badge>
      <span className="min-w-0 flex-1 truncate text-sm">
        <BrandBadge brand={opponent.brand} name={opponent.name} size="sm" className="mr-1.5 align-[-4px] inline-flex" />
        {opponent.name}
      </span>
      <span className="shrink-0 rounded border border-border/70 px-1 text-[9px] leading-4 text-muted-foreground">
        {isHome ? t("game.dash.home") : t("game.dash.away")}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatDate(f.kickoffUtc)}</span>
    </li>
  );
}

export function FriendliesTab() {
  const { t, formatDate } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { club: myClub } = useActiveClub();
  const clubId = myClub?.id ?? null;

  // Scheduling parameters — server-authoritative (fee/buffer follow admin config).
  const infoQ = useQuery({
    queryKey: qk.friendly(clubId ?? "none"),
    queryFn: () => fetchFriendlyInfo(clubId!),
    enabled: !!clubId,
  });
  const fee = infoQ.data?.fee ?? 0;
  const bufferMin = infoQ.data?.bufferMin ?? 30;

  const [opponentId, setOpponentId] = React.useState("");
  const [dateRaw, setDateRaw] = React.useState<string | null>(null);
  const [time, setTime] = React.useState("");
  const [scheduledOk, setScheduledOk] = React.useState<{ name: string; kickoffUtc: string } | null>(null);
  // Derived-state pattern (no effects): the success banner auto-clears the
  // moment any form field changes, because each handler resets it.
  const onOpponentChange = (v: string) => {
    setOpponentId(v);
    setScheduledOk(null);
  };
  const onDateChange = (v: string) => {
    setDateRaw(v);
    setScheduledOk(null);
  };
  const onTimeChange = (v: string) => {
    setTime(v);
    setScheduledOk(null);
  };

  // Both calendars (mine + the chosen opponent) power the live validator.
  const myFixturesQ = useQuery({
    queryKey: ["fixtures", "friendly-planner", clubId ?? "none"],
    queryFn: () => fetchFixtures({ clubId: clubId!, limit: 200 }),
    enabled: !!clubId,
  });
  const oppFixturesQ = useQuery({
    queryKey: ["fixtures", "friendly-planner-opp", opponentId],
    queryFn: () => fetchFixtures({ clubId: opponentId, limit: 200 }),
    enabled: !!opponentId,
  });

  // Server clock (skew-proof): floors the date input and the "future" check.
  const serverNow = infoQ.data?.serverTimeUtc;
  const nowMs = React.useMemo(() => (serverNow ? Date.parse(serverNow) : Date.now()), [serverNow]);
  const todayUtc = new Date(nowMs).toISOString().slice(0, 10);
  // Date derives from the server clock until the manager picks one (no effect).
  const date = dateRaw ?? todayUtc;

  const kickoffMs = React.useMemo(() => {
    if (!date || !time) return null;
    const ms = Date.parse(`${date}T${time}:00.000Z`);
    return Number.isFinite(ms) ? ms : null;
  }, [date, time]);

  // Upcoming fixtures of MY club (agenda card, soonest first).
  const upcoming = React.useMemo(() => {
    const list = (myFixturesQ.data?.fixtures ?? [])
      .filter((f) => f.status === "SCHEDULED" && new Date(f.kickoffUtc).getTime() > nowMs)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());
    return list.slice(0, 14);
  }, [myFixturesQ.data, nowMs]);

  // Live buffer validation — mirrors the server: |kickoff − fixture| < buffer ⇒ conflict.
  const conflicts = React.useMemo<ConflictRow[]>(() => {
    if (kickoffMs === null) return [];
    const rows: ConflictRow[] = [];
    const sources = [
      ["mine", myFixturesQ.data?.fixtures ?? []],
      ["opp", opponentId ? oppFixturesQ.data?.fixtures ?? [] : []],
    ] as const;
    for (const [side, list] of sources) {
      for (const f of list) {
        if (f.status === "CANCELLED") continue;
        const diff = Math.abs(new Date(f.kickoffUtc).getTime() - kickoffMs);
        if (diff < bufferMin * 60_000) rows.push({ fixture: f, side, deltaMin: Math.max(0, Math.round(diff / 60_000)) });
      }
    }
    rows.sort((a, b) => a.deltaMin - b.deltaMin);
    return rows;
  }, [kickoffMs, myFixturesQ.data, oppFixturesQ.data, opponentId, bufferMin]);

  const inPast = kickoffMs !== null && kickoffMs <= nowMs;

  // 7-day window cap — mirrors the server: every friendly (played or upcoming)
  // whose kickoff falls after now−7d counts, for BOTH clubs.
  const windowCount = React.useCallback(
    (list: FixtureRow[]) =>
      list.filter((f) => f.competition === "FRIENDLY" && new Date(f.kickoffUtc).getTime() >= nowMs - FRIENDLY_WINDOW_DAYS * DAY_MS).length,
    [nowMs]
  );
  const limitReached =
    windowCount(myFixturesQ.data?.fixtures ?? []) >= MAX_FRIENDLIES_PER_WINDOW ||
    (opponentId ? windowCount(oppFixturesQ.data?.fixtures ?? []) >= MAX_FRIENDLIES_PER_WINDOW : false);

  const schedule = useMutation({
    mutationFn: () =>
      scheduleFriendly({
        clubId: clubId!,
        opponentClubId: opponentId,
        kickoffUtc: new Date(kickoffMs!).toISOString(),
      }),
    onSuccess: (res) => {
      setScheduledOk({ name: res.opponentName, kickoffUtc: res.kickoffUtc });
      setTime("");
      toast({ title: t("game.comp.friendly.scheduledToast", { name: res.opponentName }) });
      void queryClient.invalidateQueries({ queryKey: ["fixtures"] });
      void queryClient.invalidateQueries({ queryKey: qk.friendly(clubId!) });
      void queryClient.invalidateQueries({ queryKey: qk.myClubs });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : "";
      const localized = code && t(`game.err.${code}`) !== `game.err.${code}` ? t(`game.err.${code}`) : t("err.generic");
      toast({ title: localized, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    },
  });

  if (!clubId) {
    return <EmptyState title={t("game.dash.noClub")} />;
  }

  const canSubmit = kickoffMs !== null && !inPast && conflicts.length === 0 && !limitReached && !schedule.isPending;

  return (
    <div className="space-y-4">
      {/* Purpose banner — honest expectations before any money moves */}
      <Alert>
        <FlaskConical aria-hidden="true" className="size-4" />
        <AlertTitle>{t("game.comp.friendly.purposeTitle")}</AlertTitle>
        <AlertDescription>{t("game.comp.friendly.purposeBody", { fee, buffer: bufferMin })}</AlertDescription>
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Left: scheduling form ─────────────────────────── */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock aria-hidden="true" className="size-4 text-primary" />
              {t("game.comp.friendly.formTitle")}
            </CardTitle>
            <CardDescription>{t("game.comp.friendly.formDesc", { fee })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {infoQ.isLoading ? (
              <TableSkeleton rows={4} cols={2} />
            ) : infoQ.isError ? (
              <ErrorState message={t("err.generic")} onRetry={() => void infoQ.refetch()} />
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="friendly-opponent">{t("game.comp.friendly.opponent")}</Label>
                  <Select value={opponentId} onValueChange={onOpponentChange}>
                    <SelectTrigger id="friendly-opponent" className="min-h-11 w-full" aria-label={t("game.comp.friendly.opponent")}>
                      <SelectValue placeholder={t("game.comp.friendly.opponentPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {(infoQ.data?.opponents ?? []).map((o) => (
                        <SelectItem key={o.id} value={o.id} className="min-h-9">
                          <span className="flex items-center gap-2">
                            <BrandBadge brand={o.brand} name={o.name} size="sm" className="shrink-0" />
                            <span className="truncate">{o.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="friendly-date">{t("game.comp.friendly.date")}</Label>
                    <Input
                      id="friendly-date"
                      type="date"
                      min={todayUtc}
                      value={date}
                      onChange={(e) => onDateChange(e.target.value)}
                      className="min-h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="friendly-time">{t("game.comp.friendly.timeUtc")}</Label>
                    <Input
                      id="friendly-time"
                      type="time"
                      value={time}
                      onChange={(e) => onTimeChange(e.target.value)}
                      className="min-h-11"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("game.comp.friendly.utcHint")}</p>

                {/* Live validator — the manager sees the conflict BEFORE paying */}
                {kickoffMs !== null && (
                  <div className="space-y-2" role="status" aria-live="polite">
                    {inPast ? (
                      <Alert variant="destructive">
                        <ShieldAlert aria-hidden="true" className="size-4" />
                        <AlertDescription>{t("game.comp.friendly.inPast")}</AlertDescription>
                      </Alert>
                    ) : limitReached ? (
                      <Alert variant="destructive">
                        <ShieldAlert aria-hidden="true" className="size-4" />
                        <AlertDescription>{t("game.comp.friendly.limitReached")}</AlertDescription>
                      </Alert>
                    ) : conflicts.length > 0 ? (
                      <Alert variant="destructive">
                        <ShieldAlert aria-hidden="true" className="size-4" />
                        <AlertTitle>{t("game.comp.friendly.tooClose", { buffer: bufferMin })}</AlertTitle>
                        <AlertDescription>
                          <ul className="mt-1.5 space-y-1.5">
                            {conflicts.slice(0, 5).map((c) => (
                              <li key={c.fixture.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                <Badge variant="outline" className="shrink-0 text-[9px]">
                                  {t(`comp.${c.fixture.competition}`)}
                                </Badge>
                                <span className="min-w-0 flex-1 truncate">
                                  {c.fixture.home.name} – {c.fixture.away.name}
                                  {c.side === "opp" ? ` · ${t("game.comp.friendly.oppClub")}` : ""}
                                </span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">{formatDate(c.fixture.kickoffUtc)}</span>
                                <span className="shrink-0 font-mono font-semibold tabular-nums">Δ{c.deltaMin}′</span>
                              </li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="border-primary/40 bg-primary/5">
                        <CheckCircle2 aria-hidden="true" className="size-4 text-primary" />
                        <AlertDescription className="text-primary">{t("game.comp.friendly.ok")}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {scheduledOk && (
                  <Alert className="border-primary/40 bg-primary/5">
                    <CheckCircle2 aria-hidden="true" className="size-4 text-primary" />
                    <AlertTitle>{t("game.comp.friendly.scheduledTitle", { name: scheduledOk.name })}</AlertTitle>
                    <AlertDescription>{formatDate(scheduledOk.kickoffUtc)}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">{t("game.comp.friendly.feeLine", { fee })}</p>
                  <Button
                    type="button"
                    className="min-h-11 w-full sm:w-auto"
                    disabled={!canSubmit}
                    onClick={() => schedule.mutate()}
                  >
                    {schedule.isPending ? t("game.comp.friendly.scheduling") : t("game.comp.friendly.scheduleCta")}
                  </Button>
                </div>

                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Zap aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                  {t("game.comp.friendly.energyWarning")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Right: my club's upcoming fixtures (buffer planning) ── */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base">{t("game.comp.friendly.myAgenda")}</CardTitle>
            <CardDescription>{t("game.comp.friendly.myAgendaDesc", { buffer: bufferMin })}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {myFixturesQ.isLoading ? (
              <TableSkeleton rows={5} cols={2} />
            ) : myFixturesQ.isError ? (
              <ErrorState message={t("err.generic")} onRetry={() => void myFixturesQ.refetch()} />
            ) : upcoming.length === 0 ? (
              <EmptyState title={t("game.comp.friendly.noUpcoming")} />
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto pr-1" role="list" aria-label={t("game.comp.friendly.myAgenda")}>
                {upcoming.map((f) => (
                  <AgendaRow key={f.id} f={f} myClubId={clubId} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
