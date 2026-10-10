"use client";
// Knight FM — connection-country flag next to the username (Task 53).
//
// Data: GET /api/user/geo (one shared request per page load, see fetchGeo).
// Rendering, most reliable first, all free:
//   · "ZZ" (private/local IP, classified on-server) → local-network icon.
//   · ISO code → flagcdn.com image (free CDN, no key, real flags on every
//     OS — unlike emoji flags, which Windows renders as plain letters).
//     If the CDN image fails to load we degrade to the regional-indicator
//     emoji, then to the neutral 🏴 — never a broken image.
//   · unknown → neutral flag + honest "unknown country" tooltip.
// Country names come from the browser-native Intl.DisplayNames, so the tooltip
// is localized to the active UI language (es/en/fr/pt) with zero extra data.

import { useEffect, useState } from "react";
import { Monitor } from "lucide-react";
import { apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import type { Language } from "@/lib/themes";

type GeoPayload = { countryCode: string | null; country: string | null };
type GeoState =
  | { status: "loading" }
  | { status: "ok"; countryCode: string | null; country: string | null }
  | { status: "error" };

// One request per page load shared by every CountryFlag instance (trigger +
// dropdown label render together, so they MUST not fire two fetches).
let geoPromise: Promise<GeoState> | null = null;
function fetchGeo(): Promise<GeoState> {
  geoPromise ??= apiFetch<GeoPayload>("/api/user/geo")
    .then((d) => ({ status: "ok" as const, countryCode: d?.countryCode ?? null, country: d?.country ?? null }))
    .catch(() => ({ status: "error" as const }));
  return geoPromise;
}

const LOCALE_BY_LANG: Record<Language, string> = { es: "es", en: "en", fr: "fr", pt: "pt" };

/** Localized region name via browser Intl (no data files, offline-safe). */
function regionName(code: string, lang: Language): string | null {
  try {
    const dn = new Intl.DisplayNames([LOCALE_BY_LANG[lang] ?? "en"], { type: "region" });
    const name = dn.of(code.toUpperCase());
    return name && name.toUpperCase() !== code.toUpperCase() ? name : null;
  } catch {
    return null;
  }
}

/** 2-letter ISO code → emoji from regional indicator symbols (A→🇦 …). */
function flagEmoji(countryCode: string): string | null {
  const cc = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  let out = "";
  for (const ch of cc) out += String.fromCodePoint(127397 + ch.charCodeAt(0));
  return out;
}

// Reserve the exact final box while loading so the header never shifts.
const FLAG_BOX = "inline-block h-3.5 w-[19px]";

export function CountryFlag({ className }: { className?: string }) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<GeoState>({ status: "loading" });
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchGeo().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Loading → fixed-size transparent placeholder (no layout shift, no flash).
  if (state.status === "loading") {
    return <span className={`${FLAG_BOX} ${className ?? ""}`} aria-hidden="true" />;
  }

  // API error → quiet neutral marker (feature degrades, header stays clean).
  if (state.status === "error") {
    return (
      <span
        className={`${FLAG_BOX} ${className ?? ""}`}
        role="img"
        aria-label={t("game.shell.geoUnknown")}
        title={t("game.shell.geoUnknown")}
      >
        <span aria-hidden="true" className="text-[11px] leading-none">
          {"🏴"}
        </span>
      </span>
    );
  }

  // Private/local network (ZZ) → same icon the admin panel uses.
  if (state.countryCode === "ZZ") {
    return (
      <span
        className={`inline-flex items-center ${className ?? ""}`}
        role="img"
        aria-label={t("game.shell.geoLocal")}
        title={t("game.shell.geoLocal")}
      >
        <Monitor aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </span>
    );
  }

  // Resolved country → flagcdn image, emoji fallback, honest unknown last.
  const cc = state.countryCode;
  if (!cc) {
    return (
      <span
        className={`${FLAG_BOX} ${className ?? ""}`}
        role="img"
        aria-label={t("game.shell.geoUnknown")}
        title={t("game.shell.geoUnknown")}
      >
        <span aria-hidden="true" className="text-[11px] leading-none">
          {"🏴"}
        </span>
      </span>
    );
  }

  const name = state.country ?? regionName(cc, lang) ?? cc;
  const label = `${t("game.shell.geoAria")}: ${name}`;
  const emoji = imgFailed ? (flagEmoji(cc) ?? "🏴") : null;

  if (emoji) {
    return (
      <span
        className={`inline-flex items-center text-sm leading-none ${className ?? ""}`}
        role="img"
        aria-label={label}
        title={name}
      >
        <span aria-hidden="true">{emoji}</span>
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w80/${cc.toLowerCase()}.png`}
      alt=""
      width={20}
      height={15}
      loading="lazy"
      decoding="async"
      className={`h-3.5 w-auto rounded-[2px] ring-1 ring-border ${className ?? ""}`}
      role="img"
      aria-label={label}
      title={name}
      onError={() => setImgFailed(true)}
    />
  );
}
