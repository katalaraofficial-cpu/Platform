import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const iconVersion = "20260607b";
  return {
    // `id` membuat Chrome/Edge mengenali aplikasi sebagai installable PWA
    // (bukan sekadar "Create shortcut"). Harus stabil seumur hidup aplikasi.
    id: "/?source=pwa",
    name: "Katalara POS",
    short_name: "Katalara",
    description: "Sistem POS dan manajemen bengkel untuk operasional harian.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    background_color: "#ffffff",
    theme_color: "#0f172a",
    lang: "id",
    dir: "ltr",
    orientation: "any",
    categories: ["business", "productivity", "finance"],
    prefer_related_applications: false,
    icons: [
      {
        src: `/icon-192?v=${iconVersion}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icon-512?v=${iconVersion}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icon-512-maskable?v=${iconVersion}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
