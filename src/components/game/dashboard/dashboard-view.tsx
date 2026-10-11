"use client";
// Knight FM — Dashboard view (Task 4-a → REBUILT Task 91, UI/UX master
// mandate): a fully CUSTOMIZABLE widget hub (add / remove / resize / drag
// reorder / presets, persisted server-side per user) with role-aware defaults
// (MANAGER vs OWNER). The previous fixed-layout cards live on as registry
// widgets with equivalent content. Switches on the club role from /api/club/mine.

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import type { ClubMine } from "@/components/game/api";
import { WidgetsGrid } from "./widgets-grid";
import { resolveRole } from "./widget-registry";

export default function DashboardView({ clubs }: { clubs: ClubMine[] }) {
  const { t } = useI18n();
  const role = resolveRole(clubs);

  const title =
    clubs.length === 0
      ? t("game.dash.title")
      : role === "OWNER"
        ? t("game.dash.titleOwner")
        : t("game.dash.title");

  return (
    <section aria-label={title} className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{t("game.dash.subtitle")}</p>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">{t("game.dash.w.customizeHint")}</p>
      </header>

      {clubs === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <WidgetsGrid clubs={clubs} />
      )}
    </section>
  );
}
