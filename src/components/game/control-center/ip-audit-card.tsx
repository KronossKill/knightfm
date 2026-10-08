"use client";
// Knight FM — IpAuditCard (Task 39). Self-contained ADMIN card for the Control
// Center "Access" tab: anti-multi-account oversight backed by
// GET /api/admin/ip-audit. Summary view lists IPs where 2+ accounts last signed
// in (probable multi-accounting) plus legacy users without a registration IP;
// the search box drills into every account tied to a specific IP (registered
// there OR last signed in from there). The one-account-per-IP rule itself is
// enforced server-side at registration (UNIQUE registrationIp).

import "@/lib/i18n/dict/admincfg";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/index";
import { apiFetch } from "@/components/auth/store";
import { EnsureQueryProvider } from "@/components/game/markets/club-context";

interface IpAuditAccount {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
  registrationIp: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  lastActiveAt: string;
}

interface IpAuditSummary {
  mode: "summary";
  sharedLoginIps: { ip: string; accounts: number }[];
  legacyUsersWithoutIp: number;
  totalUsers: number;
}

interface IpAuditLookup {
  mode: "ip";
  ip: string;
  accounts: IpAuditAccount[];
}

type IpAuditResponse = IpAuditSummary | IpAuditLookup;

function IpAuditCardInner({ className }: { className?: string }) {
  const { t } = useI18n();
  const [ip, setIp] = useState("");
  const [lookupIp, setLookupIp] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["ip-audit", lookupIp],
    queryFn: () =>
      apiFetch<IpAuditResponse>(
        `/api/admin/ip-audit${lookupIp ? `?ip=${encodeURIComponent(lookupIp)}` : ""}`
      ),
  });

  const submitSearch = () => {
    const v = ip.trim();
    if (v.length === 0) return;
    setLookupIp(v);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {query.data?.mode === "ip" ? (
            <ShieldAlert className="h-4 w-4 text-primary" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          )}
          {t("admin.ipAudit.title")}
        </CardTitle>
        <CardDescription>{t("admin.ipAudit.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drill-down search */}
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <div className="flex-1 space-y-1.5">
            <label htmlFor="ip-audit-search" className="text-sm font-medium">
              {t("admin.ipAudit.searchLabel")}
            </label>
            <Input
              id="ip-audit-search"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder={t("admin.ipAudit.searchPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              maxLength={60}
              className="min-h-11"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="min-h-11 flex-1 sm:flex-none" disabled={ip.trim().length === 0}>
              <Search className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t("admin.ipAudit.search")}
            </Button>
            {lookupIp !== null && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setLookupIp(null);
                  setIp("");
                }}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {t("admin.ipAudit.back")}
              </Button>
            )}
          </div>
        </form>

        {query.isLoading && (
          <div className="space-y-2" aria-live="polite">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        )}

        {query.isError && (
          <Alert variant="destructive">
            <AlertDescription>{t("admin.ipAudit.error")}</AlertDescription>
          </Alert>
        )}

        {query.data?.mode === "summary" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{t("admin.ipAudit.total")}</p>
                <p className="text-lg font-semibold">{query.data.totalUsers}</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{t("admin.ipAudit.legacy")}</p>
                <p className="text-lg font-semibold">{query.data.legacyUsersWithoutIp}</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">{t("admin.ipAudit.shared")}</p>
                <p className="text-lg font-semibold">{query.data.sharedLoginIps.length}</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium">{t("admin.ipAudit.sharedTitle")}</p>
              {query.data.sharedLoginIps.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("admin.ipAudit.sharedEmpty")}</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.ipAudit.colIp")}</TableHead>
                        <TableHead className="text-right">{t("admin.ipAudit.colAccounts")}</TableHead>
                        <TableHead className="w-10" aria-label="" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {query.data.sharedLoginIps.map((row) => (
                        <TableRow key={row.ip}>
                          <TableCell className="font-mono text-xs">{row.ip}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive">{row.accounts}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => {
                                setIp(row.ip);
                                setLookupIp(row.ip);
                              }}
                            >
                              <Search className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">{t("admin.ipAudit.search")}</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}

        {(() => {
          const lookup = query.data?.mode === "ip" ? query.data : null;
          if (!lookup) return null;
          return (
            <div className="space-y-2">
              {lookup.accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("admin.ipAudit.noAccounts")}</p>
              ) : (
                <div className="max-h-80 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.ipAudit.colUsername")}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t("admin.ipAudit.colEmail")}</TableHead>
                        <TableHead>{t("admin.ipAudit.colRole")}</TableHead>
                        <TableHead className="hidden md:table-cell">{t("admin.ipAudit.colRegIp")}</TableHead>
                        <TableHead className="hidden md:table-cell">{t("admin.ipAudit.colLastIp")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lookup.accounts.map((a) => {
                        const multi =
                          a.registrationIp !== null &&
                          lookup.accounts.filter((x) => x.registrationIp === a.registrationIp).length > 1;
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">
                              {a.username}
                              {multi && (
                                <Badge variant="destructive" className="ml-1.5">
                                  {t("admin.ipAudit.flagMulti")}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="hidden max-w-40 truncate sm:table-cell">{a.email}</TableCell>
                            <TableCell>
                              <Badge variant={a.role === "ADMIN" ? "default" : "outline"}>{a.role}</Badge>
                            </TableCell>
                            <TableCell className="hidden font-mono text-xs md:table-cell">{a.registrationIp ?? "—"}</TableCell>
                            <TableCell className="hidden font-mono text-xs md:table-cell">{a.lastLoginIp ?? "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

export function IpAuditCard(props: { className?: string }) {
  return (
    <EnsureQueryProvider>
      <IpAuditCardInner {...props} />
    </EnsureQueryProvider>
  );
}
