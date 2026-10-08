"use client";
// Knight FM — Knight Assistant panel (Task 4-c). Premium chat drawer: shield-icon
// header with the read-only trust line, user-right/assistant-left bubbles with
// avatars, quick suggestion chips, typing indicator, history load on open and the
// honest 503 message. The assistant NEVER executes actions (invariant #7).

import "@/lib/i18n/dict/markets";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, CircleUser, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import { apiFetch, ApiError } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { cn } from "@/lib/utils";
import type { AssistantHistoryItem } from "@/components/game/markets/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function Suggestions({ onPick }: { onPick: (text: string) => void }) {
  const { t } = useI18n();
  const chips = [
    t("markets.assistant.suggestion1"),
    t("markets.assistant.suggestion2"),
    t("markets.assistant.suggestion3"),
    t("markets.assistant.suggestion4"),
  ];
  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label={t("markets.assistant.title")}>
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          role="listitem"
          onClick={() => onPick(c)}
          className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 sm:min-h-0"
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function AssistantInner({ screen }: { screen: string }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [honestError, setHonestError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Load history (last 20 entries) once on mount.
  useEffect(() => {
    let alive = true;
    apiFetch<{ items: AssistantHistoryItem[] }>("/api/assistant/history")
      .then((res) => {
        if (!alive) return;
        setMessages(
          res.items
            .filter((e) => e.role === "user" || e.role === "assistant")
            .map((e) => ({ role: e.role as "user" | "assistant", content: e.content }))
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setHistoryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;
      setHonestError(null);
      setMessages((m) => [...m, { role: "user", content }]);
      setInput("");
      setSending(true);
      try {
        const last10 = [...messages, { role: "user" as const, content }].slice(-10);
        const res = await apiFetch<{ reply: string }>("/api/assistant", {
          method: "POST",
          body: { messages: last10, screen },
        });
        setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      } catch (e) {
        const fallback =
          e instanceof ApiError && e.status === 503
            ? e.message || t("markets.assistant.error")
            : e instanceof ApiError && e.status === 429
              ? t("markets.err.rateLimited")
              : t("markets.assistant.error");
        setHonestError(fallback);
      } finally {
        setSending(false);
      }
    },
    [messages, sending, screen, t]
  );

  return (
    <Card className="flex h-full flex-col overflow-hidden border-primary/20 bg-gradient-to-b from-primary/5 via-card to-card shadow-lg">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/15 to-transparent p-4">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
          <Bot className="h-5 w-5" aria-hidden="true" />
          <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold">{t("markets.assistant.title")}</h3>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[10px] text-primary">
              <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
              read-only
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{t("markets.assistant.trust")}</p>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1 px-4">
        <div className="space-y-4 py-4" role="log" aria-live="polite" aria-label={t("markets.assistant.title")}>
          {historyLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="ml-auto h-12 w-2/3" />
            </div>
          ) : (
            <>
              <Bubble role="assistant" content={t("markets.assistant.welcome")} />
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} content={m.content} />
              ))}
              {sending && <TypingIndicator label={t("markets.assistant.thinking")} />}
              {honestError && (
                <div
                  role="alert"
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
                >
                  {honestError}
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Suggestions + input */}
      <footer className="space-y-3 border-t border-border p-4">
        <Suggestions onPick={(c) => send(c)} />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("markets.assistant.placeholder")}
            aria-label={t("markets.assistant.send")}
            maxLength={4000}
            className="min-h-11 flex-1"
          />
          <Button
            type="submit"
            className="min-h-11 min-w-11 bg-primary px-3 text-primary-foreground hover:bg-primary/90"
            disabled={!input.trim() || sending}
            aria-label={t("markets.assistant.send")}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </form>
      </footer>
    </Card>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const { t } = useI18n();
  const isUser = role === "user";
  return (
    <div className={cn("flex items-start gap-2.5", isUser && "flex-row-reverse")}>
      <div
        aria-hidden="true"
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
          isUser ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <CircleUser className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
          isUser
            ? "rounded-tr-sm bg-primary/90 text-primary-foreground"
            : "rounded-tl-sm border border-border bg-muted/60 text-foreground"
        )}
      >
        <span className="sr-only">{isUser ? `${t("markets.assistant.you")}: ` : `${t("markets.assistant.ai")}: `}</span>
        {content}
      </div>
    </div>
  );
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5" aria-label={label}>
      <div aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-muted/60 px-3.5 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
        <span className="ml-1 text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

/** AssistantPanel — exported shell contract: optional {screen} (current view name). */
export default function AssistantPanel({ screen = "assistant" }: { screen?: string }) {
  return <AssistantInner screen={screen} />;
}
