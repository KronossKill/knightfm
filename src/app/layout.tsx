import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Task 67 (USER MANDATE): SVG country flags for the presence gadget + IP audit
// (flag emoji is NOT rendered on Windows, so we ship real flags instead).
import "flag-icons/css/flag-icons.min.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const SITE_NAME = "Knight FM";
const SITE_DESCRIPTION =
  "Un mundo persistente en tiempo real donde tus decisiones construyen temporadas irrepetibles. Sin atajos. Sin pay-to-win. Sin pausas.";
const OG_IMAGE = "/og-knight-fm.png";

// Knight FM — SEO (spec §34, §46.6, Task 24-b). Private SPA views are noindex;
// the landing route carries the full metadata package (canonical, robots
// directives, OG/Twitter, JSON-LD @graph with VideoGame/Organization/WebSite/FAQPage).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Knight FM — El mánager de fútbol online persistente",
    template: "%s | Knight FM",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Knight FM",
    "fútbol manager online",
    "mundo persistente",
    "football manager",
    "mánager de fútbol",
    "KMIE",
  ],
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "Games",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Knight FM — El mánager de fútbol online persistente",
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    locale: "es_ES",
    alternateLocale: ["en_US", "fr_FR", "pt_PT"],
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Knight FM — El mánager de fútbol online persistente" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: "El mánager de fútbol online persistente. Sin atajos. Sin pay-to-win. Sin pausas.",
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
};

// Structured data: one @graph linking the game, its publisher org, the website
// and the FAQ (same 5 Q/A as the server-rendered hero in page.tsx).
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "VideoGame",
      "@id": `${SITE_URL}/#game`,
      name: SITE_NAME,
      url: SITE_URL,
      description:
        "Persistent multiplayer online football-management world: 24-hour real days, UTC clock, causal KMIE simulation, 10 regions, 1,600 clubs and 32,040 players.",
      image: `${SITE_URL}${OG_IMAGE}`,
      genre: ["Sports Management", "Simulation", "MMO"],
      applicationCategory: "Game",
      operatingSystem: "Web",
      gamePlatform: "Web browser",
      playMode: "MultiPlayer",
      numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1 },
      inLanguage: ["es", "en", "fr", "pt"],
      author: { "@id": `${SITE_URL}/#org` },
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/knight-logo.png`,
        width: 719,
        height: 698,
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: ["es", "en", "fr", "pt"],
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "¿Qué es Knight FM?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Knight FM es un mánager de fútbol online persistente y multijugador: diriges un club dentro de un mundo compartido de 10 regiones y 1.600 clubes que nunca se pausa. Cada día tomas decisiones —alineaciones, tácticas, mercado, cantera y finanzas— y compites en tiempo real contra otros mánagers.",
          },
        },
        {
          "@type": "Question",
          name: "¿Es gratis?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sí. Crear tu cuenta y jugar es gratis. No existe pay-to-win: ninguna compra afecta al resultado de un partido; la ventaja se entrena, se planifica y se gana.",
          },
        },
        {
          "@type": "Question",
          name: "¿En qué idiomas está?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Knight FM está disponible en español, inglés, francés y portugués. Puedes cambiar el idioma en cualquier momento desde la barra superior.",
          },
        },
        {
          "@type": "Question",
          name: "¿Cómo funcionan las temporadas?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Un día de juego son 24 horas reales bajo reloj UTC: cada jornada se cierra a las 00:00 UTC y la siguiente arranca sola, sin pausas ni botones de avanzar día. Una temporada dura 37 días de juego y termina con ascensos, descensos, campeones de copa y plazas para la Copa del Mundo de clubes.",
          },
        },
        {
          "@type": "Question",
          name: "¿Necesito instalar algo?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Knight FM se juega directamente en tu navegador web, sin descargas ni instalaciones, y funciona igual de bien en escritorio y en móvil.",
          },
        },
      ],
    },
  ],
};

// Applies stored theme before hydration to avoid FOUC (theme switch never changes game state).
const themeBoot = `(function(){try{var t=localStorage.getItem("knightfm.theme")||"knight-emerald";document.documentElement.dataset.theme=t;document.documentElement.classList.add("dark");}catch(e){document.documentElement.dataset.theme="knight-emerald";document.documentElement.classList.add("dark");}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning data-theme="knight-emerald" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
