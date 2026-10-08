"use client";
// Knight FM — Release clauses tab (Task 4-c). Explainer (5× market value default,
// works on ALL clubs incl. system-owned), player-ID lookup (no global search endpoint
// exists — honest hint), and my squad's clause amounts (informational: exercising a
// clause on your own player is blocked server-side, OWN_CLUB).

import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ShieldAlert } from "lucide-react";
import { ApiError, apiFetch, useAuth } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useOwnedClubs } from "../club-context";
import { PlayerCardView } from "../player-card-view";
import { ReleaseClauseDialog } from "../action-dialogs";
import { PlayerProfileDialog } from "../player-profile-dialog";
import type { ClubLite, PublicPlayerView, SquadPlayer } from "../types";

export function ReleaseClausesTab({ club }: { club: ClubLite }) {
  const { t, formatCurrency } = useI18n();
  const { user } = useAuth();
  const { ownedClubs } = useOwnedClubs();

  const [lookupId, setLookupId] = useState("");
  const [found, setFound] = useState<{ id: string; name: string } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [clauseTarget, setClauseTarget] = useState<{ id: string; name: string; cost: number | null } | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const squad = useQuery({
    queryKey: ["markets", "squad-clauses", club.id],
    queryFn: () => apiFetch<{ players: SquadPlayer[] }>(`/api/players?clubId=${encodeURIComponent(club.id)}`),
    enabled: club.role === "OWNER" || club.role === "MANAGER",
  });

  const lookup = useMutation({
    mutationFn: async () => {
      setLookupError(null);
      setFound(null);
      try {
        const data = await apiFetch<PublicPlayerView>(`/api/players/${lookupId.trim()}`);
        setFound({ id: data.player.id, name: `${data.player.firstName} ${data.player.lastName}` });
      } catch (e) {
        if (e instanceof ApiError && e.code === "PLAYER_NOT_FOUND") {
          setLookupError(t("markets.release.notFound"));
        } else {
          setLookupError(t("markets.err.loadFailed"));
        }
      }
    },
  });

  const players = squad.data?.players ?? [];

  return (
    <div className="space-y-4">
      {/* Explainer */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{t("markets.release.explainTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("markets.release.explainBody", { multiplier: 5 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Player-ID lookup (honest: no global search endpoint) */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <Label htmlFor="clause-lookup">{t("markets.release.lookupLabel")}</Label>
            <p className="mt-1 text-xs text-muted-foreground">{t("markets.release.lookupHint")}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="clause-lookup"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder={t("markets.release.lookupPlaceholder")}
              className="flex-1"
            />
            <Button
              variant="outline"
              className="min-h-11"
              disabled={lookupId.trim().length < 10 || lookup.isPending}
              onClick={() => lookup.mutate()}
            >
              {t("markets.release.lookupButton")}
            </Button>
          </div>
          {lookupError && <p className="text-xs text-destructive">{lookupError}</p>}
          {found && (
            <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{found.name}</p>
                <p className="text-xs text-muted-foreground">{t("markets.release.costUnknown")}</p>
              </div>
              <Button
                variant="destructive"
                className="min-h-11"
                onClick={() => setClauseTarget({ id: found.id, name: found.name, cost: null })}
              >
                <ShieldAlert className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("markets.action.exercise")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My squad clauses (informational) */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{t("markets.release.mySquadTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("markets.release.mySquadDesc")}</p>
            </div>
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300">
              {t("markets.release.ownClubNote")}
            </Badge>
          </div>

          <div className="mt-3 max-h-96 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
            {squad.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : players.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">{t("markets.state.emptySquad")}</p>
            ) : (
              players.map((p) => {
                const cost = p.releaseClause > 0 ? p.releaseClause : p.marketValue * 5;
                return (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-transparent bg-muted/30 px-3 py-2 hover:border-border">
                    <button
                      type="button"
                      onClick={() => setProfileId(p.id)}
                      className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t("markets.action.viewProfile")}
                    >
                      <PlayerCardView
                        player={{ id: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position, ovr: p.ovr, stars: p.stars, age: p.age, marketValue: p.marketValue }}
                      />
                    </button>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">{formatCurrency(cost)}</p>
                      {p.releaseClause <= 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          {t("markets.release.noClauseStored", { cost: formatCurrency(p.marketValue * 5) })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Authed non-owner hint: exercising needs an owned club */}
      {user && ownedClubs.length === 0 && (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <AlertDescription className="text-xs">{t("markets.err.clubRequired")}</AlertDescription>
        </Alert>
      )}

      <ReleaseClauseDialog
        open={!!clauseTarget}
        onOpenChange={(v) => !v && setClauseTarget(null)}
        playerId={clauseTarget?.id ?? null}
        playerName={clauseTarget?.name ?? "—"}
        knownCost={clauseTarget?.cost ?? null}
      />
      <PlayerProfileDialog playerId={profileId} open={!!profileId} onOpenChange={(v) => !v && setProfileId(null)} />
    </div>
  );
}
