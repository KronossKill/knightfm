"use client";
// Knight FM — rival club squad dialog (Task 26).
// Shows ANOTHER club's full squad (players + staff) with market value and
// release clause so a manager can weigh up and exercise a rescission clause
// straight from here (standings and match detail). The confirmation reuses
// ReleaseClauseDialog; on-loan players and the manager's own club are blocked
// server-side and the button reflects that honestly.

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Trophy, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { fetchClubProfile, qk } from "@/components/game/api";
import { BrandBadge, daysUntil, ErrorState, PositionBadge, Stars } from "@/components/game/ui/bits";
import { ReleaseClauseDialog } from "@/components/game/markets/action-dialogs";
import { useOwnedClubs } from "@/components/game/markets/club-context";

export function ClubSquadDialog({
  clubId,
  open,
  onOpenChange,
}: {
  clubId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t, formatCurrency } = useI18n();
  const queryClient = useQueryClient();
  const { ownedClubs } = useOwnedClubs();
  const [clauseTarget, setClauseTarget] = React.useState<{ id: string; name: string; cost: number } | null>(null);

  const query = useQuery({
    queryKey: qk.club(clubId ?? "none"),
    queryFn: () => fetchClubProfile(clubId!),
    enabled: open && !!clubId,
    staleTime: 30_000,
  });

  const club = query.data?.club ?? null;
  const squad = query.data?.squad ?? [];
  const staff = query.data?.staff ?? [];
  const isOwnClub = !!club && ownedClubs.some((c) => c.id === club.id);

  const closeClause = (v: boolean) => {
    if (!v) {
      setClauseTarget(null);
      // The player may have switched clubs — refresh the rival squad and any
      // squad list that could have received him.
      void queryClient.invalidateQueries({ queryKey: ["players"] });
      if (clubId) void queryClient.invalidateQueries({ queryKey: qk.club(clubId) });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" role="dialog" aria-label={t("game.comp.squad.title")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users aria-hidden="true" className="size-4 text-primary" />
              {t("game.comp.squad.title")}
            </DialogTitle>
            <DialogDescription>
              {club ? (
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <BrandBadge brand={club.brand} name={club.name} size="sm" />
                  <span className="font-semibold text-foreground">{club.name}</span>
                  {club.division && (
                    <Badge variant="outline" className="border-primary/30 text-[10px]">
                      {t("game.comp.division")} {club.division.index}
                    </Badge>
                  )}
                  {club.systemOwned && (
                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-300">
                      {t("game.comp.squad.systemClub")}
                    </Badge>
                  )}
                </span>
              ) : (
                t("game.comp.squad.loading")
              )}
            </DialogDescription>
          </DialogHeader>

          {query.isLoading ? (
            <div className="space-y-2" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
          ) : (
            <div className="space-y-4">
              {/* Palmarés + all-time record — durable data that survives the
                  2-season match-detail purge (titles + W/D/L only). */}
              {club?.history && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Trophy aria-hidden="true" className="size-3.5 text-amber-400" />
                    <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("game.comp.squad.palmares")}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums">
                    {t("game.comp.squad.titlesLeague", { n: club.history.titlesLeague })}
                  </span>
                  <span className="font-mono tabular-nums">
                    {t("game.comp.squad.titlesCup", { n: club.history.titlesCup })}
                  </span>
                  <span className="font-mono tabular-nums">
                    {t("game.comp.squad.titlesWorld", { n: club.history.titlesWorld })}
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {t("game.comp.squad.histRecord", {
                      w: club.history.won,
                      d: club.history.drawn,
                      l: club.history.lost,
                    })}
                  </span>
                </div>
              )}

              {/* Squad table */}
              <div className="max-h-96 overflow-y-auto rounded-md border border-border" tabIndex={0} aria-label={t("game.comp.squad.title")}>
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                    <tr className="border-b">
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{t("game.comp.squad.player")}</th>
                      <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("common.age")}</th>
                      <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("player.ovr")}</th>
                      <th scope="col" className="px-2 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">{t("game.comp.squad.value")}</th>
                      <th scope="col" className="px-2 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">{t("game.comp.squad.clause")}</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                        <span className="sr-only">{t("markets.action.exercise")}</span>
                        <ShieldAlert aria-hidden="true" className="ml-auto size-4" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {squad.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                          {t("game.comp.squad.empty")}
                        </td>
                      </tr>
                    ) : (
                      squad.map((p) => {
                        const blocked = p.onLoan || isOwnClub;
                        // Task 27-f: availability status — suspension counts
                        // remaining MATCHES; injury shows whole days left.
                        const injuredNow =
                          !!p.injuredUntil && new Date(p.injuredUntil).getTime() > Date.now();
                        return (
                          <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="max-w-44 px-3 py-2">
                              <span className="flex items-center gap-2">
                                <PositionBadge pos={p.position} />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">
                                    {p.firstName} {p.lastName}
                                  </span>
                                  <Stars n={p.stars} className="mt-0.5" />
                                  <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                                    {p.onLoan && (
                                      <Badge variant="outline" className="border-muted-foreground/40 px-1 text-[10px] text-muted-foreground">
                                        {t("game.comp.squad.onLoan")}
                                      </Badge>
                                    )}
                                    {p.suspension > 0 && (
                                      <Badge variant="outline" className="border-amber-500/40 px-1 text-[10px] text-amber-300">
                                        {t("player.suspendedMatches", { n: p.suspension })}
                                      </Badge>
                                    )}
                                    {p.yellowCards > 0 && (
                                      <Badge variant="outline" className="border-amber-400/40 px-1 text-[10px] text-amber-200/90">
                                        {t("player.yellowCards", { n: p.yellowCards })}
                                      </Badge>
                                    )}
                                    {injuredNow && (
                                      <Badge variant="outline" className="border-destructive/40 px-1 text-[10px] text-destructive">
                                        {t("player.injuredDays", { d: daysUntil(p.injuredUntil!, Date.now()) })}
                                      </Badge>
                                    )}
                                  </span>
                                </span>
                              </span>
                            </td>
                            <td className="px-2 py-2 text-center font-mono tabular-nums">{p.age}</td>
                            <td className="px-2 py-2 text-center font-mono font-bold tabular-nums">{p.ovr}</td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">{formatCurrency(p.marketValue)}</td>
                            <td className="px-2 py-2 text-right font-mono font-semibold tabular-nums text-primary">{formatCurrency(p.releaseClause)}</td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                variant="outline"
                                className="min-h-11 border-primary/40 px-3 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                                disabled={blocked}
                                title={
                                  isOwnClub
                                    ? t("game.comp.squad.ownClub")
                                    : p.onLoan
                                      ? t("game.comp.squad.onLoan")
                                      : undefined
                                }
                                onClick={() =>
                                  setClauseTarget({
                                    id: p.id,
                                    name: `${p.firstName} ${p.lastName}`,
                                    cost: p.releaseClause,
                                  })
                                }
                              >
                                <ShieldAlert aria-hidden="true" className="mr-1 size-3.5" />
                                {t("markets.action.exercise")}
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {isOwnClub && (
                <p className="text-xs text-amber-300">{t("game.comp.squad.ownClub")}</p>
              )}

              {/* Staff (informational) */}
              {staff.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("game.comp.squad.staff")}
                  </h4>
                  <ul className="flex flex-wrap gap-2">
                    {staff.map((s) => (
                      <li key={s.id} className="inline-flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground">{t(`game.staff.area.${s.role}`)}</span>
                        <Stars n={s.stars} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReleaseClauseDialog
        open={!!clauseTarget}
        onOpenChange={closeClause}
        playerId={clauseTarget?.id ?? null}
        playerName={clauseTarget?.name ?? "—"}
        knownCost={clauseTarget?.cost ?? null}
      />
    </>
  );
}
