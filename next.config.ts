import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  experimental: {
    useOffline: true,
    staleTimes: {
      dynamic: 86400,
      static: 86400,
    },
  },
  // Next 16.3 + Vercel adapter skips next-server.js.nft.json when standalone is set,
  // then onBuildComplete fails with ENOENT. Keep standalone for Electron/desktop only.
  output: process.env.VERCEL ? undefined : "standalone",
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
