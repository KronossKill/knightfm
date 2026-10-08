"use client";
// Knight FM — Command Palette (Task 56 "Cinematic Realm").
// A Linear/⌘K-grade command menu — the single feature no other online football
// manager has. One keyboard surface to reach every view, switch theme or
// language, and open the assistant. Purely additive chrome: it changes NO game
// state and calls the same useViewStore.setView the sidebar already uses.
//
// Interactions:
//   · ⌘K / Ctrl+K anywhere toggles the palette (listener lives in GameShell).
//   · Fuzzy filter, full keyboard navigation, focus is trapped by Radix Dialog.
//   · Reduced-motion users get the plain Radix fade (no custom animation).

import * as React from "react";
import {
  Building2,
  Dumbbell,
  FlaskConical,
  Gem,
  Globe2,
  Landmark,
  LayoutDashboard,
  Mail,
  MonitorCog,
  Settings as SettingsIcon,
  Shirt,
  Trophy,
  Users,
  UsersRound,
  Wallet as WalletIcon,
  Bot,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useI18n } from "@/lib/i18n";
import { useTheme, THEMES } from "@/components/theme-provider";
import { LANGUAGES, type Language, type ThemeId } from "@/lib/themes";
import { useAuth } from "@/components/auth/store";
import { useViewStore, type GameView } from "@/components/game/view-store";

export default function CommandPalette({
  open,
  onOpenChange,
  ccOnly = false,
  walletOnly = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ccOnly?: boolean;
  walletOnly?: boolean;
}) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const setView = useViewStore((s) => s.setView);
  const [search, setSearch] = React.useState("");

  const run = React.useCallback(
    (fn: () => void) => {
      onOpenChange(false);
      // Let the dialog unmount before the view swap so the spring pill animates
      // from a clean tree (same pattern the mobile sheet uses via onNavigate).
      window.setTimeout(fn, 30);
    },
    [onOpenChange],
  );

  const nav = (view: GameView, labelKey: string, Icon: React.ComponentType<{ className?: string }>) => (
    <CommandItem
      value={`${t(labelKey)} ${view}`}
      onSelect={() => run(() => setView(view))}
      className="gap-2.5"
    >
      <Icon aria-hidden="true" className="size-4 text-primary/80" />
      {t(labelKey)}
    </CommandItem>
  );

  const admin = user?.role === "ADMIN";

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setSearch("");
        onOpenChange(v);
      }}
      className="palette-pop"
    >
      <CommandInput
        placeholder={t("game.palette.placeholder")}
        value={search}
        onValueChange={setSearch}
        aria-label={t("game.palette.placeholder")}
      />
      <CommandList className="max-h-[min(60vh,420px)]">
        <CommandEmpty>{t("game.palette.noResults")}</CommandEmpty>

        {!ccOnly && !walletOnly && (
          <>
            <CommandGroup heading={t("game.palette.nav")}>
              {nav("dashboard", "game.nav.dashboard", LayoutDashboard)}
              {nav("squad", "game.nav.squad", Users)}
              {nav("tactics", "game.nav.tactics", Shirt)}
              {nav("training", "game.nav.training", Dumbbell)}
              {nav("facilities", "game.nav.facilities", Building2)}
              {nav("staff", "game.nav.staff", UsersRound)}
              {nav("youth", "game.nav.youth", FlaskConical)}
              {nav("competitions", "game.nav.competitions", Trophy)}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={t("game.nav.system")}>
              {nav("markets", "game.nav.markets", Landmark)}
              {nav("treasury", "game.nav.treasury", Gem)}
              {nav("wallet", "game.nav.wallet", WalletIcon)}
              {nav("inbox", "game.nav.inbox", Mail)}
              {nav("settings", "game.nav.settings", SettingsIcon)}
            </CommandGroup>
            {admin && (
              <>
                <CommandSeparator />
                <CommandGroup heading={t("game.nav.system")}>
                  {nav("control-center", "game.nav.controlCenter", MonitorCog)}
                </CommandGroup>
              </>
            )}
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading={t("game.palette.actions")}>
          <CommandItem
            value={`${t("game.shell.assistant")} assistant`}
            onSelect={() => run(() => setView("assistant"))}
            className="gap-2.5"
          >
            <Bot aria-hidden="true" className="size-4 text-primary/80" />
            {t("game.shell.assistant")}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading={t("game.palette.themes")}>
          {THEMES.map((th) => (
            <CommandItem
              key={th.id}
              value={`${t(th.nameKey)} theme`}
              onSelect={() => run(() => setTheme(th.id as ThemeId))}
              className="gap-2.5"
              aria-current={theme === th.id}
            >
              <span className="flex shrink-0 -space-x-1" aria-hidden="true">
                {th.swatch.map((c, i) => (
                  <span
                    key={i}
                    className="inline-block size-3.5 rounded-full border border-background"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              {t(th.nameKey)}
              {theme === th.id && (
                <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-primary">
                  ●
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading={t("game.palette.language")}>
          {LANGUAGES.map((l) => (
            <CommandItem
              key={l.id}
              value={`${l.name} ${l.id} language`}
              onSelect={() => run(() => setLang(l.id as Language))}
              className="gap-2.5"
              aria-current={lang === l.id}
            >
              <Globe2 aria-hidden="true" className="size-4 text-primary/80" />
              <span aria-hidden="true" className="shrink-0">{l.flag}</span>
              {l.name}
              {lang === l.id && (
                <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-primary">
                  ●
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>

      {/* sr-only live hint for screen readers */}
      <span className="sr-only">{t("game.palette.hint")}</span>
    </CommandDialog>
  );
}
