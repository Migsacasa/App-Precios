import type { NextConfig } from "next";
import createPWA from "next-pwa";
import { dirname } from "path";
import { fileURLToPath } from "url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const envAllowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    if (!value.includes("://")) return value;
    try {
      return new URL(value).host;
    } catch {
      return value;
    }
  });

const allowedDevOrigins = Array.from(
  new Set([
    ...envAllowedDevOrigins,
    "*.a.free.pinggy.link",
    "*.app.github.dev",
    "*.githubpreview.dev",
  ]),
);

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
  allowedDevOrigins,
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
