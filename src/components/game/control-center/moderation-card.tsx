"use client";
// Knight FM — ModerationCard (Task 41, USER MANDATE). Self-contained ADMIN
// card for the Control Center "Access" tab, backed by /api/admin/moderation.
// Lists every BLOCKED account (auto multi-account IP blocks + admin manual
// blocks) with its IP evidence, and is the ONLY place where the block can be
// lifted — there is no self-service unlock anywhere in the product.

import "@/lib/i18n/dict/admincfg";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Lock, ShieldCheck, ShieldX } from "lucide-react";
import { useI18n } from "@/lib/i18n/index";
import { apiFetch } from "@/components/auth/store";
import { useToast } from "@/hooks/use-toast";
import { EnsureQueryProvider } from "@/components/game/markets/club-context";

interface BlockedAccount {
  id: string;
  email: string;
  username: string;
  role: string;
  blockedReason: string | null;
  blockedAt: string | null;
  registrationIp: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  ips: { ip: string; lastSeenAt: string }[];
}

interface ModerationResponse {
  blocked: BlockedAccount[];
}

function reasonKey(reason: string | null): string {
  if (reason === "MULTI_ACCOUNT_IP") return "admin.mod.reasonMulti";
  if (reason === "ADMIN_MANUAL") return "admin.mod.reasonAdmin";
  return "admin.mod.reasonOther";
}

function ModerationCardInner({ className }: { className?: string }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<BlockedAccount | null>(null);

  const query = useQuery({
    queryKey: ["admin-moderation"],
    queryFn: () => apiFetch<ModerationResponse>("/api/admin/moderation"),
  });

  const unblock = useMutation({
    mutationFn: (userId: string) =>
      // NOTE: apiFetch serializes `body` itself — pass the object, not a string.
      apiFetch<{ unblocked: boolean }>("/api/admin/moderation", {
        method: "POST",
        body: { userId, action: "UNBLOCK" },
      }),
    onSuccess: (_data, userId) => {
      toast({ description: t("admin.mod.unblocked", { user: pending?.username ?? userId }) });
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-moderation"] });
      void queryClient.invalidateQueries({ queryKey: ["ip-audit"] });
    },
    onError: () => {
      toast({ variant: "destructive", title: t("admin.mod.error") });
    },
  });

  const fmt = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleString(lang) : "—";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("admin.mod.title")}
        </CardTitle>
        <CardDescription>{t("admin.mod.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading && (
          <div className="space-y-2" aria-live="polite">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        )}

        {query.isError && (
          <Alert variant="destructive">
            <AlertDescription>{t("admin.mod.error")}</AlertDescription>
          </Alert>
        )}

        {query.data && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{t("admin.mod.blockedCount")}</p>
                <p className="text-lg font-semibold">{query.data.blocked.length}</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{t("admin.mod.multiCount")}</p>
                <p className="text-lg font-semibold">
                  {query.data.blocked.filter((b) => b.blockedReason === "MULTI_ACCOUNT_IP").length}
                </p>
              </div>
            </div>

            {query.data.blocked.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.mod.empty")}</p>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("admin.mod.colUser")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("admin.mod.colReason")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("admin.mod.colDate")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("admin.mod.colIps")}</TableHead>
                      <TableHead className="text-right">{t("admin.mod.colAction")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data.blocked.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <p className="font-medium leading-tight">{u.username}</p>
                          <p className="max-w-40 truncate text-xs text-muted-foreground">{u.email}</p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="destructive" className="gap-1">
                            <Lock className="h-3 w-3" aria-hidden="true" />
                            {t(reasonKey(u.blockedReason))}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-xs md:table-cell">{fmt(u.blockedAt)}</TableCell>
                        <TableCell className="hidden max-w-44 md:table-cell">
                          <p className="truncate font-mono text-xs" title={u.ips.map((i) => i.ip).join(", ")}>
                            {u.ips.length > 0 ? u.ips.map((i) => i.ip).join(", ") : "—"}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-9"
                            disabled={unblock.isPending}
                            onClick={() => setPending(u)}
                          >
                            <ShieldX className="mr-1.5 h-4 w-4" aria-hidden="true" />
                            {t("admin.mod.unblock")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.mod.confirmTitle", { user: pending?.username ?? "" })}</AlertDialogTitle>
              <AlertDialogDescription>{t("admin.mod.confirmDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("admin.mod.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={unblock.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (pending) unblock.mutate(pending.id);
                }}
              >
                {t("admin.mod.unblock")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export function ModerationCard(props: { className?: string }) {
  return (
    <EnsureQueryProvider>
      <ModerationCardInner {...props} />
    </EnsureQueryProvider>
  );
}
