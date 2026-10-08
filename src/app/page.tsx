"use client";
// Knight FM — single user-visible route (SPA). All views live under components;
// AppRoot composes landing → auth → onboarding → game shell.
//
// SEO (Task 24-b): the `loading` fallback of the dynamic(ssr:false) import IS
// server-rendered. It carries a full static hero — h1, lead, 6 features, FAQ —
// so crawlers and slow connections see real, keyword-rich content before the
// SPA boots and replaces it with the interactive landing. Pure markup, no hooks.

import dynamic from "next/dynamic";
import { Ban, Clock3, Compass, Globe2, Languages, Shield } from "lucide-react";
import { KnightLogo } from "@/components/knight-logo";

// Real world numbers from scripts/seo-stats.ts (Prisma counts):
// 1,600 clubs · 32,040 players · 10 regions · 100 divisions · 1 active season (37 game days).
const FEATURES = [
  {
    icon: Globe2,
    title: "Mundo persistente 24/7",
    body: "El mundo sigue moviéndose mientras duermes: mercados, partidos y rivales nunca se pausan.",
  },
  {
    icon: Clock3,
    title: "Días de 24 h reales",
    body: "Cada jornada se cierra a las 00:00 UTC y la siguiente arranca sola, bajo reloj UTC.",
  },
  {
    icon: Compass,
    title: "10 regiones",
    body: "Diez divisiones escalonadas por región, con ascensos, descensos y copas cada temporada.",
  },
  {
    icon: Shield,
    title: "1.600 clubes",
    body: "1.600 clubes y 32.040 jugadores compitiendo en una temporada activa de 37 días de juego.",
  },
  {
    icon: Languages,
    title: "4 idiomas",
    body: "Interfaz completa en español, inglés, francés y portugués, cambiable al instante.",
  },
  {
    icon: Ban,
    title: "Sin pay-to-win",
    body: "Ninguna compra afecta al resultado de un partido. Ni una sola. La ventaja se gana.",
  },
] as const;

const FAQ = [
  {
    q: "¿Qué es Knight FM?",
    a: "Knight FM es un mánager de fútbol online persistente y multijugador: diriges un club dentro de un mundo compartido de 10 regiones y 1.600 clubes que nunca se pausa. Cada día tomas decisiones —alineaciones, tácticas, mercado, cantera y finanzas— y compites en tiempo real contra otros mánagers.",
  },
  {
    q: "¿Es gratis?",
    a: "Sí. Crear tu cuenta y jugar es gratis. No existe pay-to-win: ninguna compra afecta al resultado de un partido; la ventaja se entrena, se planifica y se gana.",
  },
  {
    q: "¿En qué idiomas está?",
    a: "Knight FM está disponible en español, inglés, francés y portugués. Puedes cambiar el idioma en cualquier momento desde la barra superior.",
  },
  {
    q: "¿Cómo funcionan las temporadas?",
    a: "Un día de juego son 24 horas reales bajo reloj UTC: cada jornada se cierra a las 00:00 UTC y la siguiente arranca sola, sin pausas ni botones de avanzar día. Una temporada dura 37 días de juego y termina con ascensos, descensos, campeones de copa y plazas para la Copa del Mundo de clubes.",
  },
  {
    q: "¿Necesito instalar algo?",
    a: "No. Knight FM se juega directamente en tu navegador web, sin descargas ni instalaciones, y funciona igual de bien en escritorio y en móvil.",
  },
] as const;

function SeoHero() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-12 sm:px-8">
      <KnightLogo size={72} priority className="drop-shadow-[0_10px_36px_rgba(16,185,129,0.35)]" />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] gold-accent">
        Mundo persistente · Reloj UTC · Una temporada en marcha
      </p>
      <h1 className="mt-3 text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
        Knight FM — Mánager de fútbol online persistente
      </h1>
      <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
        Un mundo persistente en tiempo real donde tus decisiones construyen temporadas irrepetibles:
        10 regiones, 1.600 clubes y 32.040 jugadores avanzando día a día bajo reloj UTC. Sin atajos.
        Sin pay-to-win. Sin pausas.
      </p>

      <section aria-labelledby="seo-features-title" className="mt-10">
        <h2 id="seo-features-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Lo que hace único a Knight FM
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3 rounded-xl border bg-card/60 p-4">
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="seo-faq-title" className="mt-10">
        <h2 id="seo-faq-title" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Preguntas frecuentes
        </h2>
        <div className="mt-4 space-y-2">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="rounded-lg border bg-card/60 px-4 py-3">
              <summary className="cursor-pointer font-medium marker:text-primary">{q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-primary" />
        Cargando el juego…
      </p>
    </main>
  );
}

const AppRoot = dynamic(() => import("@/components/game/app-root"), {
  ssr: false,
  loading: () => <SeoHero />,
});

export default function Home() {
  return <AppRoot />;
}
