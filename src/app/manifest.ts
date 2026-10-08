import type { MetadataRoute } from "next";

// Knight FM — PWA manifest (Task 24-b). Icon dimensions verified with sharp:
// src/app/icon.png = 256×256, src/app/apple-icon.png = 180×180.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Knight FM",
    short_name: "Knight FM",
    description: "El mánager de fútbol online persistente. Sin atajos. Sin pay-to-win. Sin pausas.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
