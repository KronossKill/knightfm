"use client";
// Knight FM — Inbox view (Task 4-c). Tabs Mensajes | Notificaciones.
// Messages: thread list (GET /api/messages?box=inbox|sent) + compose dialog (recipient
// by user ID, prefilled from a thread) with the honest 429 rate-limit toast. Mark-read
// of single threads is NOT wired: the threads endpoint returns no messageIds (documented
// API gap in the worklog) — no fake button. Notifications: icon per typeKey + mark all read.

import "@/lib/i18n/dict/markets";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell, BellRing, CheckCheck, Info, Loader2, Mail, MailOpen, PenLine, User,
} from "lucide-react";
import { apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { useMarketError, EnsureQueryProvider } from "@/components/game/markets/club-context";
import type { MessageThread, NotificationItem } from "@/components/game/markets/types";

function InboxInner() {
  const { t, formatDate } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const queryClient = useQueryClient();

  const [box, setBox] = useState<"inbox" | "sent">("inbox");
  const [composeOpen, setComposeOpen] = useState(false);
  const [prefillRecipient, setPrefillRecipient] = useState("");

  const threads = useQuery({
    queryKey: ["inbox", "threads", box],
    queryFn: () => apiFetch<{ box: string; items: MessageThread[] }>(`/api/messages?box=${box}`),
    refetchInterval: 60_000,
  });

  const notifications = useQuery({
    queryKey: ["inbox", "notifications"],
    queryFn: () => apiFetch<{ items: NotificationItem[]; unread: number }>("/api/messages/notifications"),
    refetchInterval: 60_000,
  });

  const markAllRead = useMutation({
    mutationFn: () => {
      const unreadIds = (notifications.data?.items ?? []).filter((n) => !n.readAt).map((n) => n.id);
      return apiFetch<{ marked: number }>("/api/messages/notifications/read", { method: "POST", body: { ids: unreadIds } });
    },
    onSuccess: (res) => {
      toast({ description: t("markets.inbox.notifMarked", { count: res.marked }) });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (e) => {
      const info = describeError(e);
      toast({ variant: "destructive", title: info.message });
    },
  });

  const unreadNotifs = notifications.data?.unread ?? 0;

  return (
    <section aria-label={t("markets.inbox.title")} className="space-y-4">
      <header>
        <h2 className="text-lg font-bold tracking-tight">{t("markets.inbox.title")}</h2>
      </header>

      <Tabs defaultValue="messages" className="w-full">
        <TabsList className="flex w-full gap-1 bg-muted/60 p-1 sm:w-auto">
          <TabsTrigger value="messages" className="min-h-11 flex-1 px-4 sm:flex-none">
            <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("markets.inbox.tabMessages")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="min-h-11 flex-1 px-4 sm:flex-none">
            <Bell className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("markets.inbox.tabNotifications")}
            {unreadNotifs > 0 && (
              <Badge className="ml-2 border-0 bg-primary text-[10px] text-primary-foreground">{unreadNotifs}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Messages ── */}
        <TabsContent value="messages" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={box} onValueChange={(v) => setBox(v as "inbox" | "sent")}>
              <SelectTrigger className="min-h-11 w-40" aria-label={t("markets.inbox.boxInbox")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inbox">{t("markets.inbox.boxInbox")}</SelectItem>
                <SelectItem value="sent">{t("markets.inbox.boxSent")}</SelectItem>
              </SelectContent>
            </Select>
            <Button className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setComposeOpen(true)}>
              <PenLine className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("markets.inbox.compose")}
            </Button>
          </div>

          {threads.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : threads.isError ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
                <Button variant="outline" className="min-h-11" onClick={() => threads.refetch()}>
                  {t("markets.action.retry")}
                </Button>
              </CardContent>
            </Card>
          ) : (threads.data?.items.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">{t("markets.inbox.threadsEmpty")}</CardContent>
            </Card>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {threads.data!.items.map((th) => (
                <Card key={th.userId} className="transition-colors hover:border-primary/30">
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                        <User className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{th.username ?? th.userId}</p>
                          <span className="text-xs text-muted-foreground">{formatDate(th.lastAt)}</span>
                          {box === "inbox" && th.unread > 0 && (
                            <Badge className="border-0 bg-primary text-[10px] text-primary-foreground">
                              {t("markets.inbox.unreadBadge", { count: th.unread })}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{th.lastBody}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-xs text-muted-foreground">{t("markets.inbox.messagesCount", { count: th.total })}</span>
                      {box === "inbox" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-11 text-xs text-muted-foreground"
                          onClick={() => {
                            setPrefillRecipient(th.userId);
                            setComposeOpen(true);
                          }}
                        >
                          <MailOpen className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          {t("markets.action.send")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Alert className="border-border bg-muted/40 py-2">
            <Info className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="text-xs">{t("markets.inbox.markReadUnavailable")}</AlertDescription>
          </Alert>
        </TabsContent>

        {/* ── Notifications ── */}
        <TabsContent value="notifications" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={unreadNotifs === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {markAllRead.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCheck className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {t("markets.action.markAllRead")}
            </Button>
          </div>

          {notifications.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : notifications.isError ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
                <Button variant="outline" className="min-h-11" onClick={() => notifications.refetch()}>
                  {t("markets.action.retry")}
                </Button>
              </CardContent>
            </Card>
          ) : (notifications.data?.items.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">{t("markets.inbox.notifEmpty")}</CardContent>
            </Card>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {notifications.data!.items.map((n) => (
                <NotificationRow key={n.id} item={n} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        initialRecipient={prefillRecipient}
        onSent={() => {
          queryClient.invalidateQueries({ queryKey: ["inbox"] });
          setPrefillRecipient("");
        }}
      />
    </section>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const { t, formatDate, formatCurrency } = useI18n();
  const labelKey = `markets.inbox.notif.${item.typeKey}`;
  // Payload interpolation: {clubName}, {amount}, … render from the notification
  // payload (money fields come out as formatted currency).
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(item.payload ?? {})) {
    if (typeof v === "string") vars[k] = v;
    else if (typeof v === "number") vars[k] = k === "amount" || k === "price" || k === "net" || k === "levy" ? formatCurrency(v) : v;
  }
  // Legacy clubSold notifications predate the net field: fall back to the gross
  // amount so the sentence never shows a raw placeholder.
  if (item.typeKey === "notification.clubSold" && vars.net === undefined && vars.amount !== undefined) {
    vars.net = vars.amount;
  }
  const rendered = t(labelKey, vars);
  const label = rendered.startsWith("markets.inbox.notif.") ? t("markets.inbox.notif.GENERIC") : rendered;
  const read = !!item.readAt;
  const from = typeof item.payload?.fromUserId === "string" ? (item.payload.fromUserId as string) : null;
  return (
    <Card className={read ? "opacity-70" : "border-primary/25"}>
      <CardContent className="flex items-start gap-3 p-3.5">
        <div
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}
        >
          {item.typeKey === "MSG_RECEIVED" ? <Mail className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{label}</p>
            <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
            <Badge variant="outline" className={`text-[10px] ${read ? "border-border text-muted-foreground" : "border-primary/40 bg-primary/10 text-primary"}`}>
              {read ? t("markets.inbox.read") : t("markets.inbox.unread")}
            </Badge>
          </div>
          {from && <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{from}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ComposeDialog({
  open, onOpenChange, initialRecipient, onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialRecipient: string;
  onSent: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const [recipient, setRecipient] = useState(initialRecipient);
  const [body, setBody] = useState("");

  React.useEffect(() => {
    if (open) setRecipient(initialRecipient);
  }, [open, initialRecipient]);

  const send = useMutation({
    mutationFn: () => apiFetch("/api/messages", { method: "POST", body: { toUserId: recipient.trim(), body: body.trim() } }),
    onSuccess: () => {
      toast({ description: t("markets.inbox.sentOk") });
      onSent();
      onOpenChange(false);
      setBody("");
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

  const canSend = recipient.trim().length >= 10 && body.trim().length > 0 && body.length <= 4000 && !send.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" role="dialog" aria-label={t("markets.inbox.compose")}>
        <DialogHeader>
          <DialogTitle>{t("markets.inbox.compose")}</DialogTitle>
          <DialogDescription>{t("markets.inbox.recipientHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="compose-recipient">{t("markets.inbox.recipient")}</Label>
            <Input
              id="compose-recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="font-mono text-xs"
              placeholder="cuid…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="compose-body">{t("markets.inbox.messageBody")}</Label>
            <Textarea
              id="compose-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("markets.inbox.messagePlaceholder")}
              maxLength={4000}
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!canSend}
            onClick={() => send.mutate()}
          >
            {send.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.action.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** InboxView — exported shell contract: no props. */
export default function InboxView() {
  return (
    <EnsureQueryProvider>
      <InboxInner />
    </EnsureQueryProvider>
  );
}
