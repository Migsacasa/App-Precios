"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  /** Extra search params to preserve when navigating */
  className?: string;
};

export function Pagination({ currentPage, totalPages, className }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function buildHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  // Build page numbers to display — always show first, last, and up to 2 around current
  const pages: (number | "…")[] = [];
  const addPage = (p: number) => {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p);
  };

  addPage(1);
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    addPage(i);
  }
  addPage(totalPages);

  // Insert ellipsis markers
  const withEllipsis: (number | "…")[] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (typeof page === "number" && i > 0) {
      const prev = pages[i - 1];
      if (typeof prev === "number" && page - prev > 1) {
        withEllipsis.push("…");
      }
    }
    withEllipsis.push(page);
  }

  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-1", className)}>
      {/* Previous */}
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1)}
          className="px-3 py-1.5 rounded border text-sm hover:bg-foreground/5 transition-colors"
          aria-label="Previous page"
        >
          ← Prev
        </Link>
      ) : (
        <span className="px-3 py-1.5 rounded border text-sm opacity-40 cursor-not-allowed">← Prev</span>
      )}

      {/* Page numbers */}
      {withEllipsis.map((item, i) =>
        item === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-foreground/50">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={buildHref(item)}
            aria-current={item === currentPage ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 rounded border text-sm transition-colors",
              item === currentPage
                ? "bg-foreground text-background font-medium"
                : "hover:bg-foreground/5"
            )}
          >
            {item}
          </Link>
        )
      )}

      {/* Next */}
      {currentPage < totalPages ? (
        <Link
          href={buildHref(currentPage + 1)}
          className="px-3 py-1.5 rounded border text-sm hover:bg-foreground/5 transition-colors"
          aria-label="Next page"
        >
          Next →
        </Link>
      ) : (
        <span className="px-3 py-1.5 rounded border text-sm opacity-40 cursor-not-allowed">Next →</span>
      )}
    </nav>
  );
}
