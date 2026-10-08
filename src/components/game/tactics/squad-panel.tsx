"use client";
// Knight FM — tactics left panel (Task 4-b, spec §12): squad shortlist of
// players outside the XI + simple two-player comparison of key attributes.

import { useMemo } from "react";
import { AlertTriangle, Ban, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isPlayerAvailable, SquadPlayer } from "./use-tactics";

interface SquadPanelProps {
  squad: SquadPlayer[];
  /** Working slots map — used to derive who is currently outside the XI. */
  slots: Record<string, string | null>;
  compareA: string | null;
  compareB: string | null;
  onCompareA: (id: string) => void;
  onCompareB: (id: string) => void;
}

interface AttrRow {
  key: string;
  get: (p: SquadPlayer) => number;
  lowerIsBetter?: boolean;
  format?: (v: number) => string;
}

export function SquadPanel({ squad, slots, compareA, compareB, onCompareA, onCompareB }: SquadPanelProps) {
  const { t } = useI18n();

  const assigned = new Set(Object.values(slots).filter((v): v is string => !!v));
  const bench = squad.filter((p) => !assigned.has(p.id));
  const byId = useMemo(() => {
    const map = new Map<string, SquadPlayer>();
    for (const p of squad) map.set(p.id, p);
    return map;
  }, [squad]);

  const ATTRS: AttrRow[] = [
    { key: "tactics.attr.ovr", get: (p) => p.ovr },
    { key: "tactics.attr.age", get: (p) => p.age },
    { key: "tactics.attr.form", get: (p) => p.form },
    { key: "tactics.attr.fatigue", get: (p) => p.fatigue, lowerIsBetter: true },
    { key: "tactics.attr.sharpness", get: (p) => p.sharpness },
    { key: "tactics.attr.morale", get: (p) => p.morale },
  ];

  const a = compareA ? byId.get(compareA) ?? null : null;
  const b = compareB ? byId.get(compareB) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Shortlist ─────────────────────────────────────────────── */}
      <section aria-label={t("tactics.bench.title")} className="rounded-xl border bg-card">
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <h2 className="text-sm font-semibold">{t("tactics.bench.title")}</h2>
          <Badge variant="outline" className="tabular-nums">
            {bench.length}
          </Badge>
        </header>
        <ScrollArea className="max-h-[420px]">
          <ul className="divide-y divide-border/60">
            {bench.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t("common.empty")}</li>
            )}
            {bench.map((p) => {
              const available = isPlayerAvailable(p);
              return (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-semibold">{p.detailedPos}</span>
                      {!available && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5",
                            p.suspension > 0 ? "text-amber-400" : "text-red-400"
                          )}
                        >
                          {p.suspension > 0 ? (
                            <Ban className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          )}
                          {p.suspension > 0
                            ? t("tactics.status.suspended", { n: p.suspension })
                            : t("tactics.status.injured", { date: "…" })}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{p.ovr}</span>
                  <FormArrow form={p.form} />
                  {/* Fatigue mini-bar */}
                  <span
                    aria-hidden="true"
                    className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-muted sm:block lg:hidden xl:block"
                  >
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        p.fatigue <= 40 ? "bg-primary" : p.fatigue <= 70 ? "bg-amber-400" : "bg-red-400"
                      )}
                      style={{ width: `${p.fatigue}%` }}
                    />
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Button
                      variant={compareA === p.id ? "secondary" : "outline"}
                      size="sm"
                      className="h-11 w-11 min-w-[44px] p-0 text-xs font-bold"
                      aria-label={`${t("tactics.compare.pickA")}: ${p.firstName} ${p.lastName}`}
                      aria-pressed={compareA === p.id}
                      onClick={() => onCompareA(p.id)}
                    >
                      A
                    </Button>
                    <Button
                      variant={compareB === p.id ? "secondary" : "outline"}
                      size="sm"
                      className="h-11 w-11 min-w-[44px] p-0 text-xs font-bold"
                      aria-label={`${t("tactics.compare.pickB")}: ${p.firstName} ${p.lastName}`}
                      aria-pressed={compareB === p.id}
                      onClick={() => onCompareB(p.id)}
                    >
                      B
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </section>

      {/* ── Comparison ────────────────────────────────────────────── */}
      <section aria-label={t("tactics.compare.title")} className="rounded-xl border bg-card">
        <header className="flex items-center gap-2 border-b px-3 py-2.5">
          <GitCompare className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">{t("tactics.compare.title")}</h2>
        </header>
        {!a || !b ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("common.empty")}</p>
        ) : (
          <div className="px-3 py-2">
            <div className="grid grid-cols-[minmax(56px,1fr)_1fr_1fr] gap-x-2 pb-1 text-xs">
              <span />
              <span className="truncate font-semibold text-primary">{a.lastName}</span>
              <span className="truncate text-right font-semibold text-primary">{b.lastName}</span>
            </div>
            <ul className="divide-y divide-border/60">
              {ATTRS.map((row) => {
                const va = row.get(a);
                const vb = row.get(b);
                const aWins = row.lowerIsBetter ? va < vb : va > vb;
                const bWins = row.lowerIsBetter ? vb < va : vb > va;
                return (
                  <li key={row.key} className="grid grid-cols-[minmax(56px,1fr)_1fr_1fr] items-center gap-x-2 py-1.5 text-sm">
                    <span className="text-[11px] text-muted-foreground">{t(row.key)}</span>
                    <span className={cn("tabular-nums", aWins && "font-semibold text-primary")}>{va}</span>
                    <span className={cn("text-right tabular-nums", bWins && "font-semibold text-primary")}>{vb}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function FormArrow({ form }: { form: number }) {
  const { t } = useI18n();
  return (
    <span
      role="img"
      aria-label={form >= 60 ? t("tactics.form.up") : form <= 40 ? t("tactics.form.down") : t("tactics.form.flat")}
      className={cn(
        "text-[10px] leading-none",
        form >= 60 ? "text-primary" : form <= 40 ? "text-red-300" : "text-muted-foreground"
      )}
    >
      {form >= 60 ? "▲" : form <= 40 ? "▼" : "●"}
    </span>
  );
}
