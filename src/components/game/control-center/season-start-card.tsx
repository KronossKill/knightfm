"use client";
// Knight FM — Knight Control Center: world season anchor + account-lifecycle policy
// card (Task 25-a). Lives in the "Mantenimiento" tab. Shows the current world
// anchor (UTC date), the live game day and the active season; lets an ADMIN set a
// new anchor date (re-anchoring with seasons on the books requires the explicit
// force confirmation dialog). Also surfaces the inactivity policy (users.* keys).

import "@/lib/i18n/dict/lifecycle";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApiError, apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { useMarketError } from "@/components/game/markets/club-context";
import { fetchSeasonAnchor, fetchSetSeasonAnchor, type SeasonAnchorInfo } from "@/components/game/api";
import type { AdminConfigRow } from "@/components/game/markets/types";

function configValue(rows: AdminConfigRow[], key: string): number | null {
  const row = rows.find((r) => r.key === key);
  const raw = row?.currentValue ?? row?.defaultValue ?? "";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function SeasonStartCard() {
  const { t } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const queryClient = useQueryClient();

  const anchor = useQuery({
    queryKey: ["admin", "season-anchor"],
    queryFn: fetchSeasonAnchor,
  });
  // Same query key the Control Center config tab uses → shared cache, no extra hit.
  const config = useQuery({
    queryKey: ["admin", "config"],
    queryFn: () => apiFetch<{ items: AdminConfigRow[] }>("/api/admin/config"),
  });

  const [dateInput, setDateInput] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [forceChecked, setForceChecked] = useState(false);

  const data: SeasonAnchorInfo | undefined = anchor.data;
  const date = dateInput ?? data?.epochDate ?? "";

  const setAnchor = useMutation({
    mutationFn: (input: { date: string; force: boolean }) =>
      fetchSetSeasonAnchor(input.date, input.force),
    onSuccess: (info) => {
      setConfirmOpen(false);
      setForceChecked(false);
      setDateInput(null);
      toast({ description: t("lifecycle.season.setDone", { date: info.epochDate, day: info.gameDay }) });
      queryClient.invalidateQueries({ queryKey: ["admin", "season-anchor"] });
    },
    onError: (e) => {
      // 409 SEASON_EXISTS → open the explicit force confirmation instead of a toast.
      if (e instanceof ApiError && e.code === "SEASON_EXISTS") {
        setForceChecked(false);
        setConfirmOpen(true);
        return;
      }
      toast({ variant: "destructive", title: t("lifecycle.season.error"), description: describeError(e).message });
    },
  });

  const inactiveAfter = config.data ? configValue(config.data.items, "users.inactiveAfterDays") : null;
  const deleteAfter = config.data ? configValue(config.data.items, "users.deleteAfterDays") : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("lifecycle.season.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <p className="text-xs text-muted-foreground">{t("lifecycle.season.desc")}</p>

        {anchor.isLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : anchor.isError || !data ? (
          <p className="text-sm text-muted-foreground">{t("lifecycle.season.error")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{t("lifecycle.season.currentAnchor")}</p>
              <p className="text-sm font-bold">{data.epochDate}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{t("lifecycle.season.gameDay")}</p>
              <p className="text-sm font-bold">{data.gameDay}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">{t("lifecycle.season.activeSeason")}</p>
              <p className="text-sm font-bold">
                {data.season ? (
                  <>
                    {t("lifecycle.season.seasonN", { n: data.season.number })}{" "}
                    <Badge variant="outline" className="ml-1">{data.season.state}</Badge>
                  </>
                ) : (
                  <span className="text-muted-foreground">{t("lifecycle.season.none")}</span>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="season-start-date">{t("lifecycle.season.dateLabel")}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="season-start-date"
              type="date"
              className="h-11 sm:max-w-56"
              value={date}
              min="1970-01-01"
              max="2100-12-31"
              onChange={(e) => setDateInput(e.target.value)}
            />
            <Button
              className="h-11"
              disabled={!date || setAnchor.isPending || anchor.isLoading}
              onClick={() => setAnchor.mutate({ date, force: false })}
            >
              {setAnchor.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("lifecycle.season.setButton")}
            </Button>
          </div>
        </div>

        {/* Inactivity policy (users.* configs; static text without numbers until loaded) */}
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              {t("lifecycle.inactivity.title")}
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            </p>
            <p className="text-xs text-muted-foreground">{t("lifecycle.inactivity.desc")}</p>
            <p className="text-xs font-medium">
              {inactiveAfter !== null && deleteAfter !== null
                ? t("lifecycle.inactivity.policy", { a: inactiveAfter, b: deleteAfter })
                : t("lifecycle.inactivity.policyUnknown")}
            </p>
          </div>
        </div>
      </CardContent>

      {/* Destructive re-anchor confirmation (required when seasons exist) */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setForceChecked(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("lifecycle.season.forceTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("lifecycle.season.forceDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border bg-muted/30 px-3 text-sm font-medium">
            <Checkbox
              checked={forceChecked}
              onCheckedChange={(v) => setForceChecked(v === true)}
              aria-label={t("lifecycle.season.forceCheck")}
            />
            {t("lifecycle.season.forceCheck")}
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
              disabled={!forceChecked || setAnchor.isPending}
              onClick={(e) => {
                e.preventDefault(); // keep the dialog open until the mutation resolves
                setAnchor.mutate({ date, force: true });
              }}
            >
              {setAnchor.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("lifecycle.season.forceConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
