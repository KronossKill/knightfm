"use client";
// Knight FM — layout del grupo (legal): cabecera de navegación + pie sticky.
// Se devuelven hermanos (sin <div> envolvente) para no romper la cadena flex
// del <body> (min-h-screen flex flex-col): el pie usa mt-auto y queda pegado
// al fondo con páginas cortas y empujado naturalmente con páginas largas.

import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { KnightLogo } from "@/components/knight-logo";
import { LEGAL_LINKS } from "@/components/legal/legal-links";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <>
      <header className="border-b bg-card/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <a
            href="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            aria-label={t("legal.backHome")}
          >
            <KnightLogo size={32} eager />
            <span className="text-sm font-extrabold uppercase tracking-[0.28em]">
              Knight <span className="gold-accent">FM</span>
            </span>
          </a>
          <a
            href="/"
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("legal.backHome")}
          </a>
        </div>
      </header>

      <main id="main" className="w-full flex-1">
        {children}
      </main>

      <footer className="mt-auto border-t bg-card/40 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <nav aria-label={t("landing.footer.legalTitle")} className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(link.key)}
              </a>
            ))}
          </nav>
          <p className="mt-4 text-center text-xs text-muted-foreground">{t("legal.rights", { year })}</p>
        </div>
      </footer>
    </>
  );
}
