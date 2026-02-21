"use client";

import dynamic from "next/dynamic";

// Leaflet requires browser APIs (window/document) and cannot be SSR'd.
// Use dynamic import with ssr: false to prevent server-side rendering crashes.
export const HeatMap = dynamic(() => import("@/components/heat-map").then((mod) => mod.HeatMap), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[560px] text-sm text-foreground/60">
      Loading map…
    </div>
  ),
});
