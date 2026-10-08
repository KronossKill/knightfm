"use client";
// Knight FM — Knight Control Center (Task 4-c + 3-c + 9-b). ADMIN-ONLY guard; tabs
// Configuración (inline per-row editing for ALL keys — locked/invariant keys ask for
// explicit confirmation before saving, with honest LOCKED_KEY/OUT_OF_RANGE errors),
// Acceso (admin bootstrap explainer + promote/demote form via POST /api/admin/promote),
// Mantenimiento, Jobs, Auditoría (filter + paginated + collapsible payload), Analítica
// (stat cards + Progress bars) and the two-step honest world-reset card.

import "@/lib/i18n/dict/markets";
import "@/lib/i18n/dict/game";
import "@/lib/i18n/dict/admincfg";
import { SeasonStartCard } from "@/components/game/control-center/season-start-card";
import { VpnExceptionsCard } from "@/components/game/control-center/vpn-exceptions-card";
import { IpAuditCard } from "@/components/game/control-center/ip-audit-card";
import { ModerationCard } from "@/components/game/control-center/moderation-card";

import React, { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  Activity, AlertTriangle, CheckCircle2, ChevronDown, Coins, Database, Gavel, Info, Loader2, Lock,
  RefreshCw, Save, Search, Settings2, ShieldAlert, ShieldCheck, Trash2, UserCog, Wrench,
} from "lucide-react";
import { ApiError, apiFetch, useAuth } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { useMarketError, EnsureQueryProvider } from "@/components/game/markets/club-context";
import type { AdminConfigRow, AnalyticsData, AuditItem, JobRunItem } from "@/components/game/markets/types";

// ─── Guard ────────────────────────────────────────────────────────

function Forbidden() {
  const { t } = useI18n();
  return (
    <section aria-label={t("markets.cc.title")} className="py-12">
      <Card className="mx-auto max-w-md border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden="true" />
          <p className="text-sm font-semibold">{t("markets.cc.forbidden")}</p>
          <p className="text-xs text-muted-foreground">{t("markets.cc.forbiddenHint")}</p>
        </CardContent>
      </Card>
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

function ControlCenterInner() {
  const { t } = useI18n();
  const { user } = useAuth();

  if (user?.role !== "ADMIN") return <Forbidden />;

  return (
    <section aria-label={t("markets.cc.title")} className="space-y-4">
      <header>
        <h2 className="text-lg font-bold tracking-tight">{t("markets.cc.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("markets.cc.subtitle")}</p>
      </header>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="flex w-full flex-wrap gap-1 bg-muted/60 p-1 sm:flex-nowrap">
          <TabsTrigger value="config" className="min-h-11 flex-1 px-3 sm:flex-none">
            <Settings2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("markets.cc.tabConfig")}
          </TabsTrigger>
          <TabsTrigger value="access" className="min-h-11 flex-1 px-3 sm:flex-none">
            <UserCog className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("game.admin.tabUsers")}
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="min-h-11 flex-1 px-3 sm:flex-none">
            <Wrench className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("markets.cc.tabMaintenance")}
          </TabsTrigger>
          <TabsTrigger value="jobs" className="min-h-11 flex-1 px-3 sm:flex-none">
            <Gavel className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("markets.cc.tabJobs")}
          </TabsTrigger>
          <TabsTrigger value="audit" className="min-h-11 flex-1 px-3 sm:flex-none">
            <Database className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("markets.cc.tabAudit")}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="min-h-11 flex-1 px-3 sm:flex-none">
            <Activity className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("markets.cc.tabAnalytics")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-4">
          <ConfigTab />
        </TabsContent>
        <TabsContent value="access" className="mt-4">
          <AccessTab />
          <div className="mt-4">
            <VpnExceptionsCard />
          </div>
          <div className="mt-4">
            <IpAuditCard />
          </div>
          {/* Task 41 (USER MANDATE): 30-day multi-account auto-block — the
              admin-only unlock door lives here. */}
          <div className="mt-4">
            <ModerationCard />
          </div>
        </TabsContent>
        <TabsContent value="maintenance" className="mt-4">
          <MaintenanceTab />
          <div className="mt-4">
            <SeasonStartCard />
          </div>
        </TabsContent>
        <TabsContent value="jobs" className="mt-4">
          <JobsTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTab />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab />
        </TabsContent>
      </Tabs>

      <ResetCard />
    </section>
  );
}

// ─── Config tab ───────────────────────────────────────────────────

function ConfigTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const queryClient = useQueryClient();

  const config = useQuery({
    queryKey: ["admin", "config"],
    queryFn: () => apiFetch<{ items: AdminConfigRow[]; total: number }>("/api/admin/config"),
  });

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiFetch<{ key: string }>("/api/admin/config", { method: "PUT", body: { key, value } }),
    onSuccess: (res) => {
      toast({ description: t("markets.cc.configSaved", { key: res.key }) });
      setDrafts((d) => {
        const next = { ...d };
        delete next[res.key];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
    },
    onError: (e) => {
      const info = describeError(e);
      toast({
        variant: "destructive",
        title: info.message,
        description: info.serverMessage ? t("markets.err.serverMessage", { message: info.serverMessage }) : undefined,
      });
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, AdminConfigRow[]>();
    for (const row of config.data?.items ?? []) {
      const list = map.get(row.group) ?? [];
      list.push(row);
      map.set(row.group, list);
    }
    return [...map.entries()];
  }, [config.data]);

  if (config.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (config.isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
          <Button variant="outline" className="min-h-11" onClick={() => config.refetch()}>
            {t("markets.action.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([group, rows]) => {
        const gLabel = t(`cfg.group.${group}`);
        return (
        <Card key={group}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">
              {gLabel === `cfg.group.${group}` ? group : gLabel}
              <span className="ml-2 text-xs font-normal text-muted-foreground">({rows.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-56">{t("markets.cc.configKey")}</TableHead>
                    <TableHead className="min-w-56">{t("markets.cc.configDescription")}</TableHead>
                    <TableHead className="whitespace-nowrap">{t("markets.cc.configType")}</TableHead>
                    <TableHead className="min-w-72">{t("markets.cc.configValue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <ConfigRowView
                      key={row.key}
                      row={row}
                      draft={drafts[row.key]}
                      onDraft={(v) => setDrafts((d) => ({ ...d, [row.key]: v }))}
                      saving={save.isPending && save.variables?.key === row.key}
                      onSave={(value) => save.mutate({ key: row.key, value })}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}

function ConfigRowView({
  row, draft, onDraft, saving, onSave,
}: {
  row: AdminConfigRow;
  draft: string | undefined;
  onDraft: (v: string) => void;
  saving: boolean;
  onSave: (value: string) => void;
}) {
  const { t } = useI18n();
  const effective = row.currentValue ?? row.defaultValue;
  const value = draft ?? effective;
  const changed = draft !== undefined && draft !== effective;
  const cfgLabel = t(`cfg.${row.key}.label`);

  // Invariant keys stay EDITABLE (Task 9-b): the admin decides — saving one asks
  // for explicit confirmation before the same mutation runs.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  const requestSave = (next: string) => {
    if (row.locked) {
      setPendingValue(next);
      setConfirmOpen(true);
      return;
    }
    onSave(next);
  };

  const minHint =
    row.minValue != null ? t("markets.cc.valueMin", { min: row.minValue }) : null;
  const maxHint =
    row.maxValue != null ? t("markets.cc.valueMax", { max: row.maxValue }) : null;

  return (
    <TableRow className={changed ? "bg-amber-500/5 ring-1 ring-inset ring-amber-500/30" : undefined}>
      <TableCell className="align-top">
        {/* Well-identified option name (Task 21) + the exact key being modified */}
        <div className="flex items-center gap-1.5">
          {row.locked && (
            <span title={t("game.cc.invariantBadge")} className="inline-flex shrink-0">
              <Lock className="h-3 w-3 text-amber-400" aria-label={t("game.cc.invariantBadge")} role="img" />
            </span>
          )}
          <span className="text-sm font-medium">
            {cfgLabel === `cfg.${row.key}.label` ? row.key : cfgLabel}
          </span>
        </div>
        <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{row.key}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{t("markets.cc.configDefault", { value: row.defaultValue || "—" })}</p>
      </TableCell>
      <TableCell className="max-w-72 align-top text-xs text-muted-foreground">{row.description || "—"}</TableCell>
      <TableCell className="align-top">
        <Badge variant="outline" className="border-border bg-muted/40 text-[10px] uppercase">{row.valueType}</Badge>
      </TableCell>
      <TableCell className="align-top">
        {row.valueType === "bool" ? (
          <div className="flex items-center gap-3">
            <Switch
              checked={value === "true"}
              onCheckedChange={(v) => onDraft(v ? "true" : "false")}
              aria-label={row.key}
            />
            <span className="text-xs text-muted-foreground">{value}</span>
            {changed && (
              <Button size="sm" className="min-h-9 bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving} onClick={() => requestSave(value)}>
                {t("common.save")}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={value}
              onChange={(e) => onDraft(e.target.value)}
              type={row.valueType === "int" ? "number" : "text"}
              min={row.minValue ?? undefined}
              max={row.maxValue ?? undefined}
              aria-label={row.key}
              className="h-9 max-w-56 font-mono text-xs"
            />
            {(minHint || maxHint) && (
              <span className="text-[11px] text-muted-foreground">{[minHint, maxHint].filter(Boolean).join(" · ")}</span>
            )}
            {changed && (
              <Button size="sm" className="min-h-9 bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving} onClick={() => requestSave(value)}>
                {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Save className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}
                {t("common.save")}
              </Button>
            )}
          </div>
        )}
      </TableCell>

      {/* "Admin decides" gate for invariant keys (row.locked) */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("game.cc.confirmInvariantTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("game.cc.confirmInvariantDesc", { key: row.key, value: pendingValue ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-amber-600 text-white hover:bg-amber-500"
              onClick={(e) => {
                e.preventDefault();
                if (pendingValue !== null) onSave(pendingValue);
                setConfirmOpen(false);
                setPendingValue(null);
              }}
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TableRow>
  );
}

// ─── Users tab (search + admin roles + grant funds) ─────────────

interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  role: "ADMIN" | "USER";
  emailVerified: boolean;
  path: string | null;
  createdAt: string;
  walletBalance: number;
  managedClubs: { id: string; name: string }[];
  ownedClubs: { id: string; name: string; operatingFund: number }[];
}

function AdminUserChip({ row }: { row: AdminUserRow }) {
  const { t } = useI18n();
  return (
    <div className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1.5 truncate text-sm font-medium">
        {row.username}
        {row.role === "ADMIN" && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />}
        {!row.emailVerified && <Badge variant="outline" className="shrink-0 px-1 text-[9px] text-muted-foreground">{t("game.admin.unverified")}</Badge>}
      </span>
      <span className="truncate text-xs text-muted-foreground">{row.email}</span>
    </div>
  );
}

function AccessTab() {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const queryClient = useQueryClient();

  const refreshUsers = () => void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  // ── Current admins (always visible) ──────────────────────────
  const adminsQ = useQuery({
    queryKey: ["admin", "users", "@admins"],
    queryFn: () => apiFetch<{ users: AdminUserRow[] }>("/api/admin/users?role=ADMIN&limit=25"),
  });

  // ── Debounced user search ────────────────────────────────────
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  const usersQ = useQuery({
    queryKey: ["admin", "users", debounced],
    queryFn: () => apiFetch<{ users: AdminUserRow[] }>(`/api/admin/users?q=${encodeURIComponent(debounced)}&limit=10`),
    enabled: debounced.length >= 2,
  });
  const found = usersQ.data?.users ?? [];

  // ── Role change (promote/demote) ─────────────────────────────
  const setRole = useMutation({
    mutationFn: ({ email, role }: { email: string; role: "ADMIN" | "USER" }) =>
      apiFetch<{ email: string; username: string; role: string; changed: boolean }>("/api/admin/promote", {
        method: "POST",
        body: { email, role },
      }),
    onSuccess: (res) => {
      toast({
        description: t("game.admin.promoted", {
          email: res.email,
          role: res.role === "ADMIN" ? t("game.admin.roleAdmin") : t("game.admin.roleUser"),
        }),
      });
      refreshUsers();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "USER_NOT_FOUND") {
        const key = "game.err.userNotFound";
        const localized = t(key);
        toast({ variant: "destructive", title: localized === key ? e.message : localized });
        return;
      }
      if (e instanceof ApiError && e.status === 403) {
        toast({ variant: "destructive", title: t("err.forbidden") });
        return;
      }
      const info = describeError(e);
      toast({
        variant: "destructive",
        title: info.message,
        description: info.serverMessage ? t("markets.err.serverMessage", { message: info.serverMessage }) : undefined,
      });
    },
  });

  // ── Grant funds ─────────────────────────────────────────────
  const [fundsEmail, setFundsEmail] = useState("");
  const [fundsTarget, setFundsTarget] = useState<"PERSONAL" | "CLUB">("PERSONAL");
  const [fundsClubId, setFundsClubId] = useState("");
  const [fundsAmount, setFundsAmount] = useState("");
  const [fundsMemo, setFundsMemo] = useState("");

  const fundsUser = useMemo(
    () =>
      [...(adminsQ.data?.users ?? []), ...found].find(
        (u) => u.email === fundsEmail.trim().toLowerCase()
      ) ?? null,
    [adminsQ.data, found, fundsEmail]
  );
  const fundsClubs = useMemo(() => {
    if (!fundsUser) return [] as { id: string; name: string; kind: "OWNED" | "MANAGED" }[];
    return [
      ...fundsUser.ownedClubs.map((c) => ({ id: c.id, name: c.name, kind: "OWNED" as const })),
      ...fundsUser.managedClubs
        .filter((c) => !fundsUser.ownedClubs.some((o) => o.id === c.id))
        .map((c) => ({ id: c.id, name: c.name, kind: "MANAGED" as const })),
    ];
  }, [fundsUser]);

  // Derived (not an effect): the stored club id is only valid while it belongs
  // to the currently selected user's clubs; otherwise the picker stays empty.
  const effectiveClubId = fundsClubs.some((c) => c.id === fundsClubId) ? fundsClubId : "";

  const grantFunds = useMutation({
    mutationFn: () =>
      apiFetch<{
        email: string;
        username: string;
        amount: number;
        target: "PERSONAL" | "CLUB";
        club: { id: string; name: string } | null;
        walletBalance: number | null;
        clubFund: number | null;
      }>("/api/admin/funds", {
        method: "POST",
        body: {
          email: fundsEmail.trim().toLowerCase(),
          amount: Number(fundsAmount),
          target: fundsTarget,
          clubId: fundsTarget === "CLUB" ? effectiveClubId : undefined,
          memo: fundsMemo.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast({
        description: t("game.admin.fundsGranted", {
          user: res.username,
          amount: formatCurrency(res.amount),
          place:
            res.target === "PERSONAL"
              ? t("game.admin.fundsTargetPersonal")
              : `${t("game.admin.fundsTargetClub")} (${res.club?.name ?? ""})`,
        }),
      });
      setFundsAmount("");
      setFundsMemo("");
      refreshUsers();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "USER_NOT_FOUND") {
        const key = "game.err.userNotFound";
        const localized = t(key);
        toast({ variant: "destructive", title: localized === key ? e.message : localized });
        return;
      }
      const info = describeError(e);
      toast({
        variant: "destructive",
        title: info.message,
        description: info.serverMessage ? t("markets.err.serverMessage", { message: info.serverMessage }) : undefined,
      });
    },
  });

  // ── Delete user (Task 27-f) ─────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const deleteUser = useMutation({
    mutationFn: ({ id }: { id: string; email: string }) =>
      apiFetch<{ deleted: boolean; clubsReverted: string[] }>(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: (_res, vars) => {
      toast({ description: t("game.admin.users.deleted", { email: vars.email }) });
      setDeleteTarget(null);
      refreshUsers();
    },
    onError: (e) => {
      // Map the known codes; anything else falls back to the honest generic.
      const keyByCode: Record<string, string> = {
        ADMIN_DELETE_FORBIDDEN: "game.err.ADMIN_DELETE_FORBIDDEN",
        USER_NOT_FOUND: "game.err.userNotFound",
        userNotFound: "game.err.userNotFound",
      };
      let title = t("game.admin.users.deleteFailed");
      if (e instanceof ApiError && keyByCode[e.code]) {
        const localized = t(keyByCode[e.code]);
        if (localized !== keyByCode[e.code]) title = localized;
      }
      toast({ variant: "destructive", title });
    },
  });

  const pickForFunds = (row: AdminUserRow) => {
    setFundsEmail(row.email);
    setFundsTarget("PERSONAL");
    setFundsClubId("");
  };

  const amountValid = /^[1-9]\d{0,7}$/.test(fundsAmount.trim());
  const fundsReady =
    fundsEmail.includes("@") && amountValid && fundsTarget === "PERSONAL"
      ? true
      : fundsTarget === "CLUB" && !!effectiveClubId;

  const renderUserRow = (row: AdminUserRow) => (
    <div
      key={row.id}
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/60 px-3 py-2.5"
    >
      <AdminUserChip row={row} />
      <span className="ml-auto hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">
        {formatCurrency(row.walletBalance)}
      </span>
      {row.managedClubs.length > 0 && (
        <Badge variant="outline" className="max-w-40 truncate px-1.5 text-[10px] text-primary">
          {row.managedClubs[0].name}
        </Badge>
      )}
      {row.ownedClubs.length > 0 && (
        <Badge variant="outline" className="max-w-40 truncate px-1.5 text-[10px] text-amber-300">
          {row.ownedClubs[0].name}
        </Badge>
      )}
      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
        <Button
          size="sm"
          variant="outline"
          className="min-h-9"
          disabled={setRole.isPending}
          onClick={() => setRole.mutate({ email: row.email, role: row.role === "ADMIN" ? "USER" : "ADMIN" })}
        >
          {setRole.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {row.role === "ADMIN" ? t("game.admin.revokeAdmin") : t("game.admin.makeAdmin")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-h-9"
          onClick={() => pickForFunds(row)}
        >
          <Coins className="mr-1 h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
          {t("game.admin.fundsAction")}
        </Button>
        {row.role !== "ADMIN" && (
          <Button
            size="icon"
            variant="ghost"
            className="min-h-11 w-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={t("game.admin.users.deleteAria", { user: row.username })}
            title={t("game.admin.users.deleteAria", { user: row.username })}
            disabled={deleteUser.isPending}
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Alert className="border-border bg-muted/40 py-3">
        <Info className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{t("game.admin.accessTitle")}</AlertTitle>
        <AlertDescription>{t("game.admin.accessDesc")}</AlertDescription>
      </Alert>

      {/* Current administrators */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="h-4 w-4 text-amber-400" aria-hidden="true" />
            {t("game.admin.currentAdmins")}
            <span className="text-xs font-normal text-muted-foreground">({adminsQ.data?.users.length ?? "…"})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {adminsQ.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (adminsQ.data?.users.length ?? 0) === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{t("game.admin.noAdmins")}</p>
          ) : (
            adminsQ.data!.users.map((row) => renderUserRow(row))
          )}
        </CardContent>
      </Card>

      {/* Search users */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <Search className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("game.admin.searchTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("game.admin.searchPlaceholder")}
            aria-label={t("game.admin.searchTitle")}
            className="min-h-11"
          />
          {debounced.length < 2 ? (
            <p className="text-xs text-muted-foreground">{t("game.admin.searchHint")}</p>
          ) : usersQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : found.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">{t("game.admin.noResults")}</p>
          ) : (
            <div className="space-y-2">{found.map((row) => renderUserRow(row))}</div>
          )}
        </CardContent>
      </Card>

      {/* Grant funds */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <Coins className="h-4 w-4 text-amber-400" aria-hidden="true" />
            {t("game.admin.fundsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (fundsReady && !grantFunds.isPending) grantFunds.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="funds-email">{t("game.admin.fundsUserLabel")}</Label>
              <Input
                id="funds-email"
                type="email"
                autoComplete="email"
                value={fundsEmail}
                onChange={(e) => setFundsEmail(e.target.value)}
                placeholder="usuario@correo.com"
                required
              />
              {fundsUser && (
                <p className="text-xs text-muted-foreground">
                  {t("game.admin.fundsUserFound", {
                    user: fundsUser.username,
                    wallet: formatCurrency(fundsUser.walletBalance),
                  })}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="funds-target">{t("game.admin.fundsTarget")}</Label>
                <Select
                  value={fundsTarget}
                  onValueChange={(v) => setFundsTarget(v as "PERSONAL" | "CLUB")}
                >
                  <SelectTrigger id="funds-target" className="min-h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERSONAL">{t("game.admin.fundsTargetPersonal")}</SelectItem>
                    <SelectItem value="CLUB">{t("game.admin.fundsTargetClub")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="funds-amount">{t("game.admin.fundsAmount")}</Label>
                <Input
                  id="funds-amount"
                  type="number"
                  min={1}
                  step={1}
                  value={fundsAmount}
                  onChange={(e) => setFundsAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            {fundsTarget === "CLUB" && (
              <div className="space-y-2">
                <Label htmlFor="funds-club">{t("game.admin.fundsPickClub")}</Label>
                {fundsUser && fundsClubs.length === 0 ? (
                  <p className="text-xs text-amber-300">{t("game.admin.fundsNoClubs")}</p>
                ) : (
                  <Select value={effectiveClubId} onValueChange={setFundsClubId}>
                    <SelectTrigger id="funds-club" className="min-h-11 w-full">
                      <SelectValue placeholder={t("game.admin.fundsPickClub")} />
                    </SelectTrigger>
                    <SelectContent>
                      {fundsClubs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} · {c.kind === "OWNED" ? t("role.owner") : t("role.manager")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="funds-memo">{t("game.admin.fundsReason")}</Label>
              <Input
                id="funds-memo"
                value={fundsMemo}
                onChange={(e) => setFundsMemo(e.target.value)}
                maxLength={200}
                placeholder={t("game.admin.fundsReasonHint")}
              />
            </div>

            <Button
              type="submit"
              className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!fundsReady || grantFunds.isPending}
            >
              {grantFunds.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("game.admin.fundsAction")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Task 27-f: two-step delete confirmation (never on ADMIN rows) */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("game.admin.users.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("game.admin.users.deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={deleteUser.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteUser.isPending}
              onClick={(ev) => {
                // Keep the dialog open while the request runs; close on success.
                ev.preventDefault();
                if (deleteTarget) deleteUser.mutate({ id: deleteTarget.id, email: deleteTarget.email });
              }}
            >
              {deleteUser.isPending && <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" />}
              {t("game.admin.users.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Maintenance tab ──────────────────────────────────────────────

function MaintenanceTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const queryClient = useQueryClient();

  const config = useQuery({
    queryKey: ["admin", "config"],
    queryFn: () => apiFetch<{ items: AdminConfigRow[] }>("/api/admin/config"),
  });

  const [message, setMessage] = useState<string | null>(null);

  const rows = config.data?.items ?? [];
  const modeRow = rows.find((r) => r.key === "ops.maintenanceMode");
  const msgRow = rows.find((r) => r.key === "ops.maintenanceMessage");
  const enabled = (modeRow?.currentValue ?? modeRow?.defaultValue ?? "false") === "true";
  const currentMessage = msgRow?.currentValue ?? msgRow?.defaultValue ?? "";

  const toggle = useMutation({
    mutationFn: (next: { enabled: boolean; message?: string }) =>
      apiFetch("/api/admin/maintenance", { method: "POST", body: next }),
    onSuccess: () => {
      toast({ description: t("markets.cc.maintenanceApplied") });
      queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
    },
    onError: (e) => {
      const info = describeError(e);
      toast({ variant: "destructive", title: info.message });
    },
  });

  if (config.isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;

  return (
    <div className="space-y-4">
      {enabled && (
        <Alert className="border-destructive/40 bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
          <AlertTitle className="text-destructive">{t("markets.cc.maintenanceOn")}</AlertTitle>
          <AlertDescription>{t("markets.cc.maintenanceWarning")}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">{t("markets.cc.maintenanceTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{t("markets.cc.maintenanceTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("markets.cc.maintenanceDesc")}</p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => toggle.mutate({ enabled: v, message: message ?? undefined })}
              aria-label={t("markets.cc.maintenanceTitle")}
              disabled={toggle.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maintenance-message">{t("markets.cc.maintenanceMessage")}</Label>
            <Textarea
              id="maintenance-message"
              value={message ?? currentMessage}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={300}
              rows={3}
            />
            <Button
              variant="outline"
              className="min-h-11"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ enabled, message: (message ?? currentMessage).slice(0, 300) })}
            >
              {toggle.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Jobs tab ─────────────────────────────────────────────────────

function JobsTab() {
  const { t, formatDate } = useI18n();
  const jobs = useQuery({
    queryKey: ["admin", "jobs"],
    queryFn: () => apiFetch<{ items: JobRunItem[] }>("/api/admin/jobs"),
    refetchInterval: 60_000,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold">{t("markets.cc.jobsTitle")}</CardTitle>
        <Button variant="outline" size="sm" className="min-h-11" onClick={() => jobs.refetch()} aria-label={t("markets.action.refresh")}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {jobs.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : jobs.isError ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
            <Button variant="outline" className="min-h-11" onClick={() => jobs.refetch()}>
              {t("markets.action.retry")}
            </Button>
          </div>
        ) : (jobs.data?.items.length ?? 0) === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("markets.cc.jobs.empty")}</p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background/95 backdrop-blur">
                <TableRow>
                  <TableHead className="whitespace-nowrap">{t("markets.cc.jobs.job")}</TableHead>
                  <TableHead className="whitespace-nowrap">{t("markets.cc.jobs.scheduled")}</TableHead>
                  <TableHead className="whitespace-nowrap">{t("markets.cc.jobs.completed")}</TableHead>
                  <TableHead className="whitespace-nowrap text-right">{t("markets.cc.jobs.duration")}</TableHead>
                  <TableHead className="whitespace-nowrap text-right">{t("markets.cc.jobs.retries")}</TableHead>
                  <TableHead className="whitespace-nowrap">{t("markets.cc.jobs.outcome")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.data!.items.map((j) => {
                  const duration = j.startedAt && j.completedAt
                    ? `${Math.max(0, new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime())} ms`
                    : "—";
                  const ok = j.outcome === "OK";
                  return (
                    <TableRow key={j.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{j.jobType}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(j.scheduledFor)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{j.completedAt ? formatDate(j.completedAt) : "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-xs">{duration}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs">{j.retryCount}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className={`text-[10px] ${ok ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
                          {ok ? t("markets.state.done") : j.outcome || t("markets.state.failed")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Audit tab ────────────────────────────────────────────────────

function AuditTab() {
  const { t, formatDate } = useI18n();
  const [typeFilter, setTypeFilter] = useState("");
  const [appliedFilter, setAppliedFilter] = useState("");
  const [page, setPage] = useState(1);

  const audit = useQuery({
    queryKey: ["admin", "audit", appliedFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (appliedFilter.trim()) params.set("type", appliedFilter.trim());
      return apiFetch<{ items: AuditItem[]; page: number; pages: number; total: number }>(`/api/admin/audit?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="audit-type">{t("markets.cc.audit.typeFilter")}</Label>
            <Input
              id="audit-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              placeholder={t("markets.cc.audit.typePlaceholder")}
              className="font-mono text-xs"
            />
          </div>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setAppliedFilter(typeFilter);
              setPage(1);
            }}
          >
            {t("common.filter")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {audit.isLoading ? (
            <div className="p-4">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : audit.isError ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
              <Button variant="outline" className="min-h-11" onClick={() => audit.refetch()}>
                {t("markets.action.retry")}
              </Button>
            </div>
          ) : (audit.data?.items.length ?? 0) === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t("markets.cc.audit.empty")}</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background/95 backdrop-blur">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{t("markets.cc.audit.timestamp")}</TableHead>
                    <TableHead className="whitespace-nowrap">{t("markets.cc.audit.typeFilter")}</TableHead>
                    <TableHead className="whitespace-nowrap">{t("markets.cc.audit.actor")}</TableHead>
                    <TableHead className="whitespace-nowrap">{t("markets.cc.audit.payload")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.data!.items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(a.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className="border-border bg-muted/40 font-mono text-[10px]">{a.type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-32 truncate font-mono text-xs text-muted-foreground" title={a.actorId ?? undefined}>
                        {a.actorId ?? t("markets.cc.audit.system")}
                      </TableCell>
                      <TableCell className="min-w-64">
                        <Collapsible>
                          <CollapsibleTrigger className="flex min-h-9 items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {t("markets.cc.audit.showPayload")}
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <pre className="mt-1 max-h-40 max-w-md overflow-auto rounded-md border border-border bg-muted/40 p-2 text-[11px] leading-snug">
                              {JSON.stringify(a.payload, null, 2)}
                            </pre>
                          </CollapsibleContent>
                        </Collapsible>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {audit.data && audit.data.pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label={t("markets.state.page", { page: audit.data.page, pages: audit.data.pages })}>
          <Button variant="outline" size="sm" className="min-h-11" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("markets.state.prev")}
          </Button>
          <span className="text-sm text-muted-foreground">{t("markets.state.page", { page: audit.data.page, pages: audit.data.pages })}</span>
          <Button variant="outline" size="sm" className="min-h-11" disabled={page >= audit.data.pages} onClick={() => setPage((p) => p + 1)}>
            {t("markets.state.next")}
          </Button>
        </nav>
      )}
    </div>
  );
}

// ─── Analytics tab ────────────────────────────────────────────────

function AnalyticsTab() {
  const { t, formatNumber } = useI18n();
  const analytics = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => apiFetch<AnalyticsData>("/api/admin/analytics"),
  });

  if (analytics.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (analytics.isError || !analytics.data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
          <Button variant="outline" className="min-h-11" onClick={() => analytics.refetch()}>
            {t("markets.action.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { total, byName, funnel } = analytics.data;
  const max = Math.max(1, ...byName.map((b) => b.count));
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("markets.cc.analytics.total")}</p>
            <p className="mt-1 text-2xl font-bold text-primary">{formatNumber(total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("markets.cc.analytics.eventTypes")}</p>
            <p className="mt-1 text-2xl font-bold">{formatNumber(byName.length)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("markets.cc.analyticsTitle")}</p>
            <p className="mt-1 text-2xl font-bold">{formatNumber(analytics.data.windowDays)}d</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">{t("markets.cc.analytics.funnel")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {funnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("markets.cc.analytics.empty")}</p>
          ) : (
            funnel.map((f) => (
              <div key={f.step} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">{f.step}</span>
                  <span className="font-semibold">{formatNumber(f.count)}</span>
                </div>
                <Progress value={(f.count / funnelMax) * 100} aria-label={`${f.step}: ${f.count}`} className="h-2" />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">{t("markets.cc.analytics.byEvent")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {byName.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("markets.cc.analytics.empty")}</p>
            ) : (
              byName.map((b) => (
                <div key={b.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-muted-foreground">{b.name}</span>
                    <span className="font-semibold">{formatNumber(b.count)}</span>
                  </div>
                  <Progress value={(b.count / max) * 100} aria-label={`${b.name}: ${b.count}`} className="h-2" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Reset card (two-step, honest) ────────────────────────────────

interface ResetConfirmResult {
  accepted: boolean;
  executed: boolean;
  backupFile?: string;
  epochUtc?: string;
  counts?: { regions: number; divisions: number; clubs: number; players: number; fixtures: number; seasons: number };
  durationMs?: number;
  note?: string;
}

function ResetCard() {
  const { t } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const [stage, setStage] = useState<"idle" | "requested">("idle");
  const [token, setToken] = useState("");
  const [result, setResult] = useState<ResetConfirmResult | null>(null);

  const request = useMutation({
    mutationFn: () => apiFetch<{ confirmToken: string }>("/api/admin/reset", { method: "POST", body: { stage: "request" } }),
    onSuccess: (res) => {
      setStage("requested");
      setToken(res.confirmToken); // sandbox honesty: the API returns the token in the response
    },
    onError: (e) => {
      const info = describeError(e);
      toast({ variant: "destructive", title: info.message });
    },
  });

  const confirm = useMutation({
    mutationFn: () => apiFetch<ResetConfirmResult>("/api/admin/reset", { method: "POST", body: { stage: "confirm", confirmToken: token.trim() } }),
    onSuccess: (res) => {
      setResult(res);
      setStage("idle");
      setToken("");
    },
    onError: (e) => {
      const info = describeError(e);
      toast({ variant: "destructive", title: info.message });
    },
  });

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-destructive">
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
          {t("markets.cc.resetTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <Alert className="border-destructive/40 bg-destructive/10">
          <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
          <AlertTitle className="text-destructive">{t("markets.cc.resetWarning")}</AlertTitle>
          <AlertDescription>{t("markets.cc.resetDesc")}</AlertDescription>
        </Alert>

        {stage === "idle" ? (
          <Button variant="destructive" className="min-h-11" disabled={request.isPending} onClick={() => request.mutate()}>
            {request.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.cc.resetRequest")}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="reset-token">{t("markets.cc.resetTokenLabel")}</Label>
              <Input
                id="reset-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="max-w-md font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">{t("markets.cc.resetTokenHint")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" className="min-h-11" disabled={token.trim().length === 0 || confirm.isPending} onClick={() => confirm.mutate()}>
                {confirm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("markets.cc.resetConfirm")}
              </Button>
              <Button variant="ghost" className="min-h-11" onClick={() => setStage("idle")}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {result && (result.executed ? (
          <Alert className="border-primary/40 bg-primary/10">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <AlertTitle className="text-primary">{t("markets.cc.resetDoneTitle")}</AlertTitle>
            <AlertDescription className="space-y-2 text-xs">
              <p>{t("markets.cc.resetDoneDesc")}</p>
              {result.counts && (
                <p className="font-medium">
                  {t("markets.cc.resetDoneCounts", {
                    clubs: result.counts.clubs,
                    players: result.counts.players,
                    fixtures: result.counts.fixtures,
                    seasons: result.counts.seasons,
                  })}
                </p>
              )}
              {result.backupFile && (
                <p className="font-mono text-[11px] break-all">{t("markets.cc.resetDoneBackup", { file: result.backupFile })}</p>
              )}
              {typeof result.durationMs === "number" && (
                <p className="text-muted-foreground">{t("markets.cc.resetDoneDuration", { seconds: Math.max(1, Math.round(result.durationMs / 1000)) })}</p>
              )}
              <Button size="sm" className="min-h-11" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("markets.cc.resetDoneReload")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <Info className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <AlertDescription className="text-xs">
              {result.note ?? ""}
            </AlertDescription>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}

/** ControlCenterView — exported shell contract: no props. */
export default function ControlCenterView() {
  return (
    <EnsureQueryProvider>
      <ControlCenterInner />
    </EnsureQueryProvider>
  );
}
