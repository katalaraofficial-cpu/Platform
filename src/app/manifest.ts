import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Katalara POS",
    short_name: "Katalara",
    description: "Sistem POS dan manajemen bengkel untuk operasional harian.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    lang: "id",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/jpeg",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/jpeg",
      },
      {
        src: "/icon-512-maskable",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "maskable",
      },
    ],
  };
}
