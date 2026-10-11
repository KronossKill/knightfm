"use client";
// Knight FM — Knight Control Center: project backups card (Task 49/50).
// Lives in the "Mantenimiento" tab (after SeasonStartCard). ADMIN ONLY.
// Shows the cloud backup webhook status (honest: UPLOADED / LOCAL_ONLY / UPLOAD_FAILED —
// never fabricated), a "create backup now" button (POST /api/admin/backup → backup.sh)
// and the history of local salvas with md5, size, file count and DB statistics.

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Cloud, CloudOff, ExternalLink, HardDriveDownload, Loader2, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { useMarketError } from "@/components/game/markets/club-context";

interface CloudRow {
  target: string;
  url: string | null;
  expiresHours: number;
  status: string;
}
interface Manifest {
  file: string;
  createdAtUtc: string;
  md5: string;
  bytes: number;
  files: number;
  db: Record<string, number>;
  cloudStatus?: string;
  cloud?: CloudRow[];
}
interface BackupList {
  backups: Manifest[];
  webhookConfigured: boolean;
  cloudChainEnabled: boolean;
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export function BackupsCard() {
  const { t } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const queryClient = useQueryClient();
  const [log, setLog] = useState<string | null>(null);

  const list = useQuery<BackupList>({
    queryKey: ["admin", "backups"],
    queryFn: () => apiFetch<BackupList>("/api/admin/backup"),
  });

  const create = useMutation({
    mutationFn: () => apiFetch<{ status: string; summary: string; log: string }>("/api/admin/backup", { method: "POST" }),
    onSuccess: (res) => {
      setLog(res.summary || res.log || null);
      toast({ description: t("markets.cc.backupCreated") });
      void queryClient.invalidateQueries({ queryKey: ["admin", "backups"] });
    },
    onError: (e) => {
      const info = describeError(e);
      toast({ variant: "destructive", title: t("markets.cc.backupFailed"), description: info.serverMessage });
    },
  });

  const backups = list.data?.backups ?? [];
  const cloudChain = list.data?.cloudChainEnabled === true;
  const cloud = cloudChain || list.data?.webhookConfigured ? "cloud" : "local";

  const cloudUp = (m: Manifest): CloudRow[] => (m.cloud ?? []).filter((c) => c.status === "UPLOADED" && c.url);
  const cloudAllFailed = (m: Manifest): boolean =>
    (m.cloud ?? []).length > 0 && cloudUp(m).length === 0;
  const statusUp = (s?: string): boolean => s === "UPLOADED" || s === "CLOUD_OK";
  const statusFailed = (s?: string): boolean => s === "UPLOAD_FAILED" || s === "CLOUD_FAILED";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDriveDownload className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("markets.cc.backupTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0">
        <p className="text-xs text-muted-foreground">{t("markets.cc.backupDesc")}</p>

        <div className="flex flex-wrap items-center gap-2">
          {list.isLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : cloud === "cloud" ? (
            <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
              <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
              {list.data?.webhookConfigured
                ? t("markets.cc.backupCloudConfigured")
                : t("markets.cc.backupCloudAuto")}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
              {t("markets.cc.backupCloudLocal")}
            </Badge>
          )}
          <Button
            size="sm"
            className="min-h-11"
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            {create.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("markets.cc.backupCreating")}
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" aria-hidden="true" />
                {t("markets.cc.backupCreate")}
              </>
            )}
          </Button>
        </div>

        {log && (
          <p className="break-all rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px] text-muted-foreground">
            {log}
          </p>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t("markets.cc.backupHistory")}</h4>
          {list.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : backups.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("markets.cc.backupEmpty")}</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {backups.map((b) => (
                <li key={b.file} className="rounded-md border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold">{b.file}</span>
                    {statusUp(b.cloudStatus) ? (
                      <Badge variant="outline" className="border-primary/40 text-primary">{t("markets.cc.backupStatusUploaded")}</Badge>
                    ) : statusFailed(b.cloudStatus) ? (
                      <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                        {t("markets.cc.backupStatusFailed")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{t("markets.cc.backupStatusLocal")}</Badge>
                    )}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-4">
                    <div>
                      <dt className="sr-only">{t("markets.cc.backupDate")}</dt>
                      <dd>{b.createdAtUtc} UTC</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Size</dt>
                      <dd className="font-mono">{formatBytes(b.bytes)}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Files</dt>
                      <dd className="font-mono">{b.files} {t("markets.cc.backupFiles")}</dd>
                    </div>
                    <div>
                      <dt className="sr-only">MD5</dt>
                      <dd className="truncate font-mono" title={b.md5}>{b.md5.slice(0, 12)}…</dd>
                    </div>
                  </dl>
                  {b.db && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t("markets.cc.backupDbStats", { users: b.db.users ?? 0, clubs: b.db.clubs ?? 0, players: b.db.players ?? 0 })}
                    </p>
                  )}
                  {cloudUp(b).length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground">{t("markets.cc.backupCloudLink")}:</p>
                      <ul className="space-y-0.5">
                        {cloudUp(b).map((c) => (
                          <li key={c.target} className="flex flex-wrap items-center gap-1 text-[11px]">
                            <a
                              href={c.url ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-primary underline-offset-2 hover:underline"
                            >
                              {c.target}
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                            {c.expiresHours > 0 && (
                              <span className="text-muted-foreground">· {t("markets.cc.backupExpires", { hours: c.expiresHours })}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {cloudAllFailed(b) && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                      <CloudOff className="h-3 w-3" aria-hidden="true" />
                      {t("markets.cc.backupCloudFailedAll")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
