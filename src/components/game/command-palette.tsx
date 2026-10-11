"use client";
// Knight FM — GLOBAL COMMAND PALETTE (Task 91, UI/UX master mandate).
// VS-Code/Linear-style power-user layer: jump to any screen, switch theme /
// language, toggle the sidebar, search the active squad. Open with Ctrl+K /
// Cmd+K (handled by the shell) or the top-bar search button.
// Recents persist in localStorage; fuzzy-ish matching comes from cmdk scoring.

import * as React from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bot,
  Building2,
  Dumbbell,
  FlaskConical,
  Globe2,
  Landmark,
  LayoutDashboard,
  Mail,
  MonitorCog,
  Palette,
  Search,
  Settings as SettingsIcon,
  Shirt,
  Trophy,
  Users,
  UsersRound,
  Wallet as WalletIcon,
} from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useI18n } from "@/lib/i18n";
import { useTheme, THEMES } from "@/components/theme-provider";
import { LANGUAGES, type Language, type ThemeId } from "@/lib/themes";
import { useViewStore, type GameView } from "@/components/game/view-store";
import { useAuth } from "@/components/auth/store";
import { fetchPlayers, type PlayerRow } from "@/components/game/api";
import { cn } from "@/lib/utils";

const RECENTS_KEY = "knightfm.palette.recents";

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    const next = [id, ...readRecents().filter((r) => r !== id)].slice(0, 5);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {}
}

interface NavTarget {
  view: GameView;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  recentId: string;
}

const NAV_TARGETS: NavTarget[] = [
  { view: "dashboard", labelKey: "game.nav.dashboard", icon: LayoutDashboard, recentId: "nav:dashboard" },
  { view: "squad", labelKey: "game.nav.squad", icon: Users, recentId: "nav:squad" },
  { view: "tactics", labelKey: "game.nav.tactics", icon: Shirt, recentId: "nav:tactics" },
  { view: "training", labelKey: "game.nav.training", icon: Dumbbell, recentId: "nav:training" },
  { view: "facilities", labelKey: "game.nav.facilities", icon: Building2, recentId: "nav:facilities" },
  { view: "staff", labelKey: "game.nav.staff", icon: UsersRound, recentId: "nav:staff" },
  { view: "youth", labelKey: "game.nav.youth", icon: FlaskConical, recentId: "nav:youth" },
  { view: "competitions", labelKey: "game.nav.competitions", icon: Trophy, recentId: "nav:competitions" },
  { view: "markets", labelKey: "game.nav.markets", icon: Landmark, recentId: "nav:markets" },
  { view: "treasury", labelKey: "game.nav.treasury", icon: Landmark, recentId: "nav:treasury" },
  { view: "wallet", labelKey: "game.nav.wallet", icon: WalletIcon, recentId: "nav:wallet" },
  { view: "inbox", labelKey: "game.nav.inbox", icon: Mail, recentId: "nav:inbox" },
  { view: "assistant", labelKey: "game.shell.assistant", icon: Bot, recentId: "nav:assistant" },
  { view: "settings", labelKey: "game.nav.settings", icon: SettingsIcon, recentId: "nav:settings" },
  { view: "control-center", labelKey: "game.nav.controlCenter", icon: MonitorCog, recentId: "nav:control-center" },
];

const RECENT_VIEW: Record<string, GameView> = Object.fromEntries(NAV_TARGETS.map((n) => [n.recentId, n.view]));

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const setView = useViewStore((s) => s.setView);
  const { user } = useAuth();
  const activeClubId = useViewStore((s) => s.activeClubId);
  const [recents, setRecents] = React.useState<string[]>([]);
  const [players, setPlayers] = React.useState<PlayerRow[] | null>(null);

  // Refresh recents each time the palette opens.
  React.useEffect(() => {
    if (open) setRecents(readRecents());
  }, [open]);

  // Squad search source (active club only; loaded lazily while the palette is open).
  React.useEffect(() => {
    if (!open || !activeClubId || players !== null) return;
    let alive = true;
    fetchPlayers(activeClubId)
      .then((res) => {
        if (alive) setPlayers(res.players ?? []);
      })
      .catch(() => {
        if (alive) setPlayers([]);
      });
    return () => {
      alive = false;
    };
  }, [open, activeClubId, players]);

  const run = (recentId: string, action: () => void) => {
    pushRecent(recentId);
    action();
    onOpenChange(false);
  };

  const recentTargets = recents
    .map((id) => NAV_TARGETS.find((n) => n.recentId === id))
    .filter((n): n is NavTarget => !!n);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("game.palette.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("game.palette.noResults")}</CommandEmpty>

        {recentTargets.length > 0 && (
          <>
            <CommandGroup heading={t("game.palette.recent")}>
              {recentTargets.map((n) => {
                const Icon = n.icon;
                return (
                  <CommandItem key={`recent-${n.recentId}`} onSelect={() => run(n.recentId, () => setView(n.view))}>
                    <Icon aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                    {t(n.labelKey)}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading={t("game.palette.nav")}>
          {NAV_TARGETS.filter((n) => !(n.view === "control-center" && user?.role !== "ADMIN")).map((n) => {
            const Icon = n.icon;
            return (
              <CommandItem key={n.recentId} onSelect={() => run(n.recentId, () => setView(n.view))}>
                <Icon aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                {t(n.labelKey)}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {activeClubId && players !== null && players.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("game.palette.players")}>
              {players.slice(0, 60).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.firstName} ${p.lastName} ${p.detailedPos} ${p.position}`}
                  onSelect={() => run(`player:${p.id}`, () => setView("squad"))}
                >
                  <Users aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {p.ovr} · {p.detailedPos}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading={t("game.palette.themes")}>
          {THEMES.map((th) => (
            <CommandItem
              key={th.id}
              onSelect={() => run(`theme:${th.id}`, () => setTheme(th.id as ThemeId))}
              className={cn(theme === th.id && "bg-primary/10")}
            >
              <Palette aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
              {t(th.nameKey)}
              {theme === th.id && <span className="sr-only">({t("common.yes")})</span>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading={t("game.palette.language")}>
          {LANGUAGES.map((l) => (
            <CommandItem
              key={l.id}
              onSelect={() => run(`lang:${l.id}`, () => setLang(l.id as Language))}
              className={cn(lang === l.id && "bg-primary/10")}
            >
              <Globe2 aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
              {l.flag} {l.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading={t("game.palette.finance")}>
          <CommandItem onSelect={() => run("nav:wallet", () => setView("wallet"))}>
            <ArrowDownToLine aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
            {t("game.palette.deposit")}
          </CommandItem>
          <CommandItem onSelect={() => run("nav:treasury", () => setView("treasury"))}>
            <ArrowUpFromLine aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
            {t("game.nav.treasury")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Global keyboard shortcut handler — mounted ONCE in the shell. */
export function useCommandPaletteHotkey(onOpen: () => void) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}

/** Small search button for the top bar (opens the palette). */
export function PaletteTriggerButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hidden h-9 min-w-40 items-center gap-2 rounded-md border bg-card/50 px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:flex xl:min-w-56"
      aria-label={t("game.palette.open")}
      aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
    >
      <Search aria-hidden="true" className="size-3.5" />
      <span className="flex-1 truncate text-left">{t("game.palette.placeholder")}</span>
      <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] font-semibold">{isMac ? "⌘K" : "Ctrl+K"}</kbd>
    </button>
  );
}
