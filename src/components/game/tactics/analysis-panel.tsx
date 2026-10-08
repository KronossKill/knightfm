"use client";
// Knight FM — tactics right panel (Task 4-b, spec §12): lineup summary with
// instructions, risks, strengths, dynamic coaching feedback and an optional
// next-opponent matchup placeholder.

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Sparkles,
  Swords,
  TrendingUp,
} from "lucide-react";
import { FORMATION_LAYOUTS, Formation } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { fitPct, isPlayerAvailable, SquadPlayer } from "./use-tactics";

interface AnalysisPanelProps {
  formation: Formation;
  slots: Record<string, string | null>;
  squadById: Map<string, SquadPlayer>;
  nextOpponent?: string;
}

export function AnalysisPanel({ formation, slots, squadById, nextOpponent }: AnalysisPanelProps) {
  const { t } = useI18n();
  const layout = FORMATION_LAYOUTS[formation];

  const stats = useMemo(() => {
    const starters = Object.values(slots)
      .filter((pid): pid is string => !!pid)
      .map((pid) => squadById.get(pid))
      .filter((p): p is SquadPlayer => !!p);
    const filled = starters.length;
    const total = layout.length;
    const avgOvr = filled ? Math.round(starters.reduce((s, p) => s + p.ovr, 0) / filled) : 0;
    const avgFit = filled
      ? Math.round(
          starters.reduce((s, p) => {
            const slot = layout.find((sl) => slots[sl.id] === p.id);
            return s + (slot ? fitPct(p, slot.pos) : 0);
          }, 0) / filled
        )
      : 0;
    const highFatigue = starters.filter((p) => p.fatigue > 70).length;
    const unavailable = starters.filter((p) => !isPlayerAvailable(p)).length;
    const naturalFit = starters.filter((p) => {
      const slot = layout.find((sl) => slots[sl.id] === p.id);
      return slot ? p.position === slot.pos : false;
    }).length;
    return { filled, total, avgOvr, avgFit, highFatigue, unavailable, naturalFit };
  }, [slots, squadById, layout]);

  const risks: Array<{ icon: "fatigue" | "injured" | "incomplete"; text: string }> = [];
  if (stats.highFatigue > 0) {
    risks.push({ icon: "fatigue", text: t("tactics.risks.fatigue", { n: stats.highFatigue }) });
  }
  if (stats.unavailable > 0) {
    risks.push({ icon: "injured", text: t("tactics.risks.injuredStarters", { n: stats.unavailable }) });
  }
  if (stats.filled < stats.total) {
    risks.push({ icon: "incomplete", text: t("tactics.risks.incomplete", { filled: stats.filled, total: stats.total }) });
  }

  const hints: string[] = [];
  if (stats.filled > 0) {
    hints.push(t("tactics.coaching.naturalFit", { n: stats.naturalFit }));
    if (stats.avgOvr >= 70) hints.push(t("tactics.coaching.ovrGood", { avg: stats.avgOvr }));
    if (stats.avgOvr > 0 && stats.avgOvr < 60) hints.push(t("tactics.coaching.ovrLow", { avg: stats.avgOvr }));
    if (stats.highFatigue > 0) {
      hints.push(t("tactics.coaching.fatigueWarn", { n: stats.highFatigue }));
    } else {
      hints.push(t("tactics.coaching.fresh"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={t("tactics.summary.title")} className="rounded-xl border bg-card">
        <header className="border-b px-3 py-2.5">
          <h2 className="text-sm font-semibold">{t("tactics.summary.title")}</h2>
        </header>

        <div className="flex flex-col gap-4 px-3 py-3">
          {/* Instructions */}
          <div>
            <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {t("tactics.instructions.title")}
            </h3>
            <p className="text-[13px] leading-relaxed">
              <span className="font-semibold text-amber-300">{formation}</span>
              {" — "}
              {t(`tactics.formation.desc.${formation}`)}
            </p>
          </div>

          {/* Strengths */}
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {t("tactics.strengths.title")}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-background/50 px-2.5 py-2">
                <p className="text-lg font-bold tabular-nums text-primary">{stats.avgOvr}</p>
                <p className="text-[10px] leading-tight text-muted-foreground">{t("tactics.strengths.avgOvr")}</p>
              </div>
              <div className="rounded-lg border bg-background/50 px-2.5 py-2">
                <p className="text-lg font-bold tabular-nums text-primary">
                  {stats.filled > 0 ? `${stats.avgFit}%` : "—"}
                </p>
                <p className="text-[10px] leading-tight text-muted-foreground">{t("tactics.strengths.avgFit")}</p>
              </div>
            </div>
          </div>

          {/* Risks */}
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              {t("tactics.risks.title")}
            </h3>
            {risks.length === 0 ? (
              <p className="flex items-center gap-1.5 text-[13px] text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("tactics.risks.none")}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {risks.map((r) => (
                  <li key={r.text} className="flex items-center gap-1.5 text-[13px] text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {r.text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Coaching feedback */}
          {hints.length > 0 && (
            <div>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {t("tactics.coaching.title")}
              </h3>
              <ul className="flex flex-col gap-1">
                {hints.map((h) => (
                  <li key={h} className="flex items-start gap-1.5 text-[13px] text-foreground/90">
                    <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Matchup placeholder */}
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Swords className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {t("tactics.matchup.title")}
            </h3>
            {nextOpponent ? (
              <p className="text-[13px] font-semibold text-amber-300">{nextOpponent}</p>
            ) : (
              <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                {t("tactics.matchup.placeholder")}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
