import type { NextConfig } from "next";
import path from "path";
import withPWAInit from "@ducanh2912/next-pwa";

// PWA policy (Poin 3 technical debt):
// - Online-only mutations. Tidak ada background sync queue / mutation queue
//   yang sengaja didaftarkan. Workbox default tidak meng-cache request non-GET.
// - Cache strategies hanya untuk GET (static asset, image, /_next/data).
// - Mutasi yang dilakukan saat offline akan gagal cepat (oleh OfflineGuard
//   di client) — bukan masuk antrean. Ini menjaga integritas ledger akuntansi.
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Fix: multiple lockfiles warning — pin tracing root to this project
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default withPWA(nextConfig);
