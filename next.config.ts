import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  
  // AÑADE ESTO: Configuración de cabeceras para permitir Cloudflare Turnstile
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss: https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;