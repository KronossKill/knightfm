import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  // Task 90 (USER MANDATE — "el zip no me permite descargarlo en la nueva
  // pestaña"): EVERY file under /downloads/ is a DELIBERATE DELIVERY artifact
  // (zips + LEEME txt guides). Forcing `Content-Disposition: attachment` means
  // any navigation to those URLs — clicking the panel button, "open in new
  // tab", middle-click, pasting the URL — ALWAYS triggers a browser download
  // instead of trying to render bytes in a tab. Header values must be static
  // here; the exact filename for "Save as" comes from the URL itself, and the
  // panel links also carry the `download` attribute as a second guarantee.
  async headers() {
    return [
      {
        source: "/downloads/:path*",
        headers: [
          // NOTE: no `filename=` on purpose — per RFC 6266 the browser then
          // derives the save name from the URL basename, so every file keeps
          // its real name + extension (knightfm-sincronizacion-completa.zip,
          // LEEME-….txt) instead of being renamed by a static header value.
          { key: "Content-Disposition", value: "attachment" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  // Task 95 (USER MANDATE — "dame el zip para descargarlo desde la nueva
  // pestaña"): dev.log showed a real 404 for
  // `/knightfm_updated_20261011_145930_UTC_v9.0.0.zip` — the user pasted the
  // delivery filename at the ROOT, without the `/downloads/` prefix, and got
  // a blank error instead of the file. Fix at the config layer: any
  // root-level `.zip` / `.txt` request is redirected to the same filename
  // under `/downloads/`, so pasting the bare name in a new tab ALWAYS lands
  // on the real artifact. Safety: no legit route or public file lives at the
  // root with those extensions (all artifacts live in public/downloads/),
  // so this cannot shadow anything. 307 (not 308) so no browser caches a
  // mapping that might later change.
  async redirects() {
    return [
      { source: "/:file([^/]+\\.zip)", destination: "/downloads/:file", permanent: false },
      { source: "/:file([^/]+\\.txt)", destination: "/downloads/:file", permanent: false },
    ];
  },
};

export default nextConfig;
