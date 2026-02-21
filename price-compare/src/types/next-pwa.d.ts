declare module "next-pwa" {
  import type { NextConfig } from "next";

  type PwaOptions = {
    dest: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
  };

  type WithPwa = (nextConfig?: NextConfig) => NextConfig;

  export default function createPWA(options?: PwaOptions): WithPwa;
}
