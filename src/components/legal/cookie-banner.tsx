"use client";
// Knight FM — banner de consentimiento de cookies (LEGAL, Task 51).
// GDPR/LSSI: la analítica de primera parte permanece BLOQUEADA hasta que el
// usuario acepta; "Rechazar" es tan fácil y visible como "Aceptar". La
// decisión se guarda en localStorage (knightfm.consent) y el enlace del footer
// "Cookies" reabre el banner vía resetConsent().
// El estado se lee con useSyncExternalStore (sin setState en effects): SSR
// ve null (banner presente) y tras hidratar se aplica la decisión real.

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { CONSENT_EVENT, getConsent, setConsent, type ConsentValue } from "@/lib/consent";

/** Notifica cambios de consentimiento en esta pestaña (evento) y en otras (storage). */
function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function CookieBanner() {
  const { t } = useI18n();
  const consent = useSyncExternalStore(subscribe, getConsent, () => null);

  if (consent !== null) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4"
      role="region"
      aria-label={t("consent.title")}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
          >
            <Cookie className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("consent.title")}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("consent.text")}{" "}
              <Link
                href="/cookies"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {t("consent.more")}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col lg:flex-row">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 min-w-[104px] px-4"
            onClick={() => setConsent("denied")}
          >
            {t("consent.reject")}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-11 min-w-[104px] px-4"
            onClick={() => setConsent("granted")}
          >
            {t("consent.accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
