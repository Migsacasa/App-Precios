import type { NextConfig } from "next";
import createPWA from "next-pwa";
import { dirname } from "path";
import { fileURLToPath } from "url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const withPWA = createPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3001",
        "127.0.0.1:3001",
        "*.app.github.dev",
        "*.githubpreview.dev",
      ],
    },
  },
};

export default withPWA(nextConfig);
