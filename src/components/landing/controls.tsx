"use client";
// Knight FM — landing language & theme selectors (shadcn DropdownMenu).
// Changing language/theme never changes game state; both fire analytics events.

import { Check, ChevronDown, Palette } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/components/theme-provider";
import { LANGUAGES, THEMES } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EV, track } from "./analytics";

type SelectorSource = "top" | "footer";

export function LanguageSelect({ source }: { source?: SelectorSource }) {
  const { t, lang, setLang } = useI18n();
  const current = LANGUAGES.find((l) => l.id === lang) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("landing.topbar.language")}
          className="h-10 gap-2 px-3"
        >
          <span aria-hidden="true" className="text-base leading-none">
            {current.flag}
          </span>
          <span className="hidden text-xs font-semibold uppercase tracking-wider sm:inline">{current.id}</span>
          <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.id}
            onSelect={() => {
              setLang(l.id);
              track(EV.languageChange, { lang: l.id, source: source ?? "top" });
            }}
          >
            <span aria-hidden="true">{l.flag}</span>
            <span>{l.name}</span>
            {lang === l.id ? <Check aria-hidden="true" className="ml-auto size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeSelect({ source }: { source?: SelectorSource }) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const current = THEMES.find((th) => th.id === theme) ?? THEMES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("landing.topbar.theme")} className="h-10 gap-2 px-3">
          <Palette aria-hidden="true" className="size-4 text-primary" />
          <span className="hidden max-w-28 truncate text-xs font-medium sm:inline">
            {t(current.nameKey)}
          </span>
          <span aria-hidden="true" className="flex items-center gap-0.5">
            {current.swatch.map((c) => (
              <span key={c} className="size-2.5 rounded-full border border-white/10" style={{ backgroundColor: c }} />
            ))}
          </span>
          <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {THEMES.map((th) => (
          <DropdownMenuItem
            key={th.id}
            onSelect={() => {
              setTheme(th.id);
              track(EV.themeChange, { theme: th.id, source: source ?? "top" });
            }}
          >
            <span aria-hidden="true" className="flex items-center gap-0.5">
              {th.swatch.map((c) => (
                <span key={c} className="size-3 rounded-full border border-white/10" style={{ backgroundColor: c }} />
              ))}
            </span>
            <span>{t(th.nameKey)}</span>
            {theme === th.id ? <Check aria-hidden="true" className="ml-auto size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
