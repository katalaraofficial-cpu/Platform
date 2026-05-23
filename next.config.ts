import type { NextConfig } from "next";
import path from "path";

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

export default nextConfig;
