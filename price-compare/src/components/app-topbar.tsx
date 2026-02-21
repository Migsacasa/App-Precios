"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SyncStatus } from "@/components/offline/SyncStatus";

function toInputDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function AppTopbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(toInputDate(searchParams.get("from")));
  const [to, setTo] = useState(toInputDate(searchParams.get("to")));
  const [city, setCity] = useState(searchParams.get("city") ?? "");

  useEffect(() => {
    setFrom(toInputDate(searchParams.get("from")));
    setTo(toInputDate(searchParams.get("to")));
    setCity(searchParams.get("city") ?? "");
  }, [searchParams]);

  const showFilters = useMemo(
    () => ["/dashboard", "/reports", "/map"].some((prefix) => pathname.startsWith(prefix)),
    [pathname]
  );

  if (pathname === "/login") return null;

  const applyFilters = () => {
    if (from && to && new Date(from) > new Date(to)) return; // prevent invalid range
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("from", from);
    else params.delete("from");

    if (to) params.set("to", to);
    else params.delete("to");

    if (city.trim()) params.set("city", city.trim());
    else params.delete("city");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    ["from", "to", "city"].forEach((key) => params.delete(key));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const dateRangeError = from && to && new Date(from) > new Date(to);

  return (
    <div className="border-b border-foreground/10 bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onMenuToggle && (
              <button
                type="button"
                onClick={onMenuToggle}
                aria-label="Toggle navigation menu"
                className="md:hidden p-1 rounded hover:bg-foreground/5"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-wide">Price Compare Console</h2>
              <p className="text-xs opacity-80">Retail Store Evaluator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncStatus />
            <ThemeToggle />
          </div>
        </div>

        {showFilters && (
          <div className="space-y-1">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <div>
                <label htmlFor="filter-from" className="sr-only">From date</label>
                <input
                  id="filter-from"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="w-full border rounded px-3 py-2 bg-background text-foreground"
                />
              </div>
              <div>
                <label htmlFor="filter-to" className="sr-only">To date</label>
                <input
                  id="filter-to"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="w-full border rounded px-3 py-2 bg-background text-foreground"
                />
              </div>
              <div>
                <label htmlFor="filter-city" className="sr-only">City</label>
                <input
                  id="filter-city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="City"
                  className="w-full border rounded px-3 py-2 bg-background text-foreground"
                />
              </div>
              <button className="rounded border px-3 py-2 hover:bg-foreground/5 transition-colors" onClick={applyFilters}>
                Apply
              </button>
              <button className="rounded border px-3 py-2 hover:bg-foreground/5 transition-colors" onClick={clearFilters}>
                Clear
              </button>
            </div>
            {dateRangeError && (
              <p className="text-xs text-red-500">"From" date must be before "To" date.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
