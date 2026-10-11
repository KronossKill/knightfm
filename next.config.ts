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
};

export default nextConfig;
