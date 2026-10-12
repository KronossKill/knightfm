import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  // Task 107 (USER MANDATE — "Los usuarios no tienen por que descargar nada
  // del sitio"): the public delivery downloads were removed entirely — no
  // /downloads/ assets, no listing API, no attachment headers, no zip/txt
  // redirects. The game runs in the browser; nothing is downloadable.
};

export default nextConfig;
