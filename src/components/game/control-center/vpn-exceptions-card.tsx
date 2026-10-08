"use client";
// Knight FM — VpnExceptionsCard (Task 25-d). Self-contained ADMIN card for the
// VPN exception allow-list backed by /api/admin/vpn-exceptions. Shows the live
// security.vpnPolicy / security.vpnDetectUrl values and lets an admin manage
// exact-IP / IPv4-CIDR exceptions (add with note, remove with confirmation).
// NOT wired into control-center-view on purpose — the leader cables it.

import "@/lib/i18n/dict/vpnpol";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Globe2, Loader2, Plus, Radar, ShieldCheck, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/components/auth/store";
import { EnsureQueryProvider } from "@/components/game/markets/club-context";
import {
  fetchAddVpnException,
  fetchDeleteVpnException,
  fetchVpnExceptions,
  type VpnException,
} from "@/components/game/api";

// Honest ApiError → i18n mapping (vpnpol namespace).
function vpnErrorKey(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "INVALID_IP") return "vpnpol.errorInvalidIp";
    if (e.code === "FORBIDDEN") return "vpnpol.errorForbidden";
  }
  return "vpnpol.errorGeneric";
}

function VpnExceptionsCardInner({ className }: { className?: string }) {
  const { t, formatDate } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [pendingDelete, setPendingDelete] = useState<VpnException | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["vpn-exceptions"],
    queryFn: fetchVpnExceptions,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["vpn-exceptions"] });

  const addMutation = useMutation({
    mutationFn: () => fetchAddVpnException(value.trim(), note.trim()),
    onSuccess: (row) => {
      setFormError(null);
      setValue("");
      setNote("");
      void invalidate();
      toast({ description: t("vpnpol.added", { value: row.value }) });
    },
    onError: (e) => {
      setFormError(t(vpnErrorKey(e)));
      toast({ variant: "destructive", title: t(vpnErrorKey(e)) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchDeleteVpnException(id),
    onSuccess: (_res, id) => {
      const removed = listQuery.data?.exceptions.find((x) => x.id === id);
      setPendingDelete(null);
      void invalidate();
      toast({ description: t("vpnpol.removed", { value: removed?.value ?? id }) });
    },
    onError: (e) => {
      setPendingDelete(null);
      toast({ variant: "destructive", title: t(vpnErrorKey(e)) });
    },
  });

  const policy = listQuery.data?.policy ?? "log_only";
  const detectUrl = listQuery.data?.detectUrl ?? "";
  const isBlock = policy.trim().toLowerCase().startsWith("block");
  const exceptions = listQuery.data?.exceptions ?? [];
  const canSubmit = value.trim().length > 0 && !addMutation.isPending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setFormError(null);
    addMutation.mutate();
  };

  return (
    <Card className={className} data-testid="vpn-exceptions-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("vpnpol.card.title")}
          {exceptions.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {t("vpnpol.count", { n: exceptions.length })}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{t("vpnpol.card.desc")}</CardDescription>

        {/* Live policy + detector readout (server values, never guessed). */}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("vpnpol.policy")}:
          </span>
          {isBlock ? (
            <Badge variant="destructive">{t("vpnpol.policyBlock")}</Badge>
          ) : (
            <Badge variant="outline" className="text-primary">
              {t("vpnpol.policyLogOnly")}
            </Badge>
          )}
          <span className="inline-flex items-center gap-1">
            <Radar className="h-3.5 w-3.5" aria-hidden="true" />
            {t("vpnpol.detectUrl")}:
          </span>
          {detectUrl ? (
            <code className="max-w-[16rem] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {detectUrl}
            </code>
          ) : (
            <span>{t("vpnpol.detectNone")}</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Add form */}
        <form onSubmit={onSubmit} className="space-y-3" aria-label={t("vpnpol.add")}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="vpn-exception-value">{t("vpnpol.ipLabel")}</Label>
              <Input
                id="vpn-exception-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t("vpnpol.ipPlaceholder")}
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                maxLength={64}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vpn-exception-note">{t("vpnpol.noteLabel")}</Label>
              <Input
                id="vpn-exception-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("vpnpol.notePlaceholder")}
                maxLength={140}
              />
            </div>
            <Button type="submit" className="h-11 w-full sm:w-auto" disabled={!canSubmit}>
              {addMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              )}
              {addMutation.isPending ? t("vpnpol.adding") : t("vpnpol.add")}
            </Button>
          </div>
          {formError && (
            <Alert variant="destructive" className="border-destructive/40">
              <AlertDescription className="text-xs">{formError}</AlertDescription>
            </Alert>
          )}
        </form>

        {/* List */}
        {listQuery.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : listQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-2 text-xs">
              <span>{t("vpnpol.loadError")}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => listQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : exceptions.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {t("vpnpol.empty")}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {exceptions.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-mono text-sm font-medium">{row.value}</p>
                  {row.note && <p className="truncate text-xs text-muted-foreground">{row.note}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(row.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => setPendingDelete(row)}
                  aria-label={t("vpnpol.confirmRemove", { value: row.value })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {t("vpnpol.remove")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Globe2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("vpnpol.blockedHint")}
        </p>
      </CardContent>

      {/* Remove confirmation */}
      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("vpnpol.confirmRemove", { value: pendingDelete?.value ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("vpnpol.confirmRemoveDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("vpnpol.confirmRemoveAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** VpnExceptionsCard — exported shell contract: optional className, no required props. */
function VpnExceptionsCard({ className }: { className?: string }) {
  return (
    <EnsureQueryProvider>
      <VpnExceptionsCardInner className={className} />
    </EnsureQueryProvider>
  );
}

export { VpnExceptionsCard };
export default VpnExceptionsCard;
