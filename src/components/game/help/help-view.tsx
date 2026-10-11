"use client";
// Knight FM — Help / guide (Task 32, section "Assistant" → sub-tab "Ayuda").
// Keyboard shortcuts, navigation principles and a compact game guide. Static
// content — everything is i18n keys, no game state.

import { Bot, Command, Globe2, Keyboard, MousePointerClick, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useI18n } from "@/lib/i18n";
import { useViewStore } from "@/components/game/view-store";

const SHORTCUTS: { keys: string[]; labelKey: string }[] = [
  { keys: ["Ctrl", "K"], labelKey: "game.help.sc.palette" },
  { keys: ["Ctrl", "1"], labelKey: "game.help.sc.dashboard" },
  { keys: ["Ctrl", "2"], labelKey: "game.help.sc.club" },
  { keys: ["Ctrl", "3"], labelKey: "game.help.sc.squad" },
  { keys: ["Ctrl", "4"], labelKey: "game.help.sc.tactics" },
  { keys: ["Ctrl", "5"], labelKey: "game.help.sc.recruitment" },
  { keys: ["Ctrl", "6"], labelKey: "game.help.sc.training" },
  { keys: ["Ctrl", "7"], labelKey: "game.help.sc.competitions" },
  { keys: ["Ctrl", "8"], labelKey: "game.help.sc.assistant" },
  { keys: ["Esc"], labelKey: "game.help.sc.esc" },
];

export default function HelpView() {
  const { t } = useI18n();
  const setPaletteOpen = useViewStore((s) => s.setPaletteOpen);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ShieldCheck aria-hidden="true" className="size-5 text-brand" />
          {t("game.help.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("game.help.subtitle")}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Keyboard aria-hidden="true" className="size-4 text-brand" />
              {t("game.help.shortcuts")}
            </CardTitle>
            <CardDescription>{t("game.help.shortcutsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {SHORTCUTS.map((s) => (
                <li key={s.labelKey} className="flex items-center justify-between gap-3 rounded-md px-1 py-1 text-sm">
                  <span className="text-muted-foreground">{t(s.labelKey)}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MousePointerClick aria-hidden="true" className="size-4 text-brand" />
                {t("game.help.navTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{t("game.help.navTwoClicks")}</p>
              <p>{t("game.help.navPins")}</p>
              <p>{t("game.help.navClock")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe2 aria-hidden="true" className="size-4 text-brand" />
                {t("game.help.worldTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{t("game.help.worldLive")}</p>
              <p>{t("game.help.worldUtc")}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot aria-hidden="true" className="size-4 text-brand" />
            {t("game.help.assistantTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-muted-foreground">{t("game.help.assistantBody")}</p>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" className="min-h-11 bg-brand-deep text-white hover:bg-brand" onClick={() => setPaletteOpen(true)}>
              <Command aria-hidden="true" className="mr-1 size-4" />
              {t("game.pal.open")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
