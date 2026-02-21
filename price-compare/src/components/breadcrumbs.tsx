"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  observations: "Observations",
  reports: "Reports",
  stores: "Stores",
  map: "Map",
  admin: "Admin",
  products: "Products",
  new: "New",
  login: "Login",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label =
      SEGMENT_LABELS[segment] ||
      (segment.length > 20 ? segment.slice(0, 8) + "…" : segment);
    return { href, label, isLast: i === segments.length - 1 };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link
        href="/dashboard"
        className="hover:text-foreground transition-colors"
        aria-label="Home"
      >
        <Home className="h-4 w-4" />
      </Link>
      {crumbs.map(({ href, label, isLast }) => (
        <span key={href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          {isLast ? (
            <span className="text-foreground font-medium" aria-current="page">
              {label}
            </span>
          ) : (
            <Link href={href} className="hover:text-foreground transition-colors">
              {label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
