"use client";

import { useCallback, useEffect, useState } from "react";
import { countPending, countByState, syncPending, type SyncState } from "@/lib/offline-db";
import { toast } from "sonner";

function formatRelativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const STATE_COLORS: Record<SyncState, string> = {
  pending: "bg-blue-500",
  uploading: "bg-yellow-500 animate-pulse",
  synced: "bg-green-500",
  failed: "bg-red-500",
};

export function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [stateCounts, setStateCounts] = useState<Record<SyncState, number>>({ pending: 0, uploading: 0, synced: 0, failed: 0 });
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [count, counts] = await Promise.all([countPending(), countByState()]);
      setPending(count);
      setStateCounts(counts);
    } catch {
      // IndexedDB may be unavailable in some contexts
    }
  }, []);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncPending();
      await refresh();
      setLastSyncedAt(new Date());
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} evaluation(s)`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} evaluation(s) failed to sync`);
      }
    } catch {
      toast.error("Sync failed. Will retry when connection is stable.");
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();

    const onOnline = () => void doSync();
    const refreshInterval = setInterval(() => void refresh(), 30_000);
    const tickInterval = setInterval(() => setTick((t) => t + 1), 30_000);

    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(refreshInterval);
      clearInterval(tickInterval);
    };
  }, [doSync, refresh]);

  if (pending === 0 && !lastSyncedAt) return null;

  const hasDetails = stateCounts.pending > 0 || stateCounts.uploading > 0 || stateCounts.failed > 0;

  return (
    <div className="border rounded p-2 text-sm space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          {pending > 0 && (
            <span>
              Offline queue: <b>{pending}</b> item{pending !== 1 ? "s" : ""}
            </span>
          )}
          {lastSyncedAt && (
            <span className="text-xs text-muted-foreground">
              Last synced: {formatRelativeTime(lastSyncedAt)}
            </span>
          )}
        </div>
        {pending > 0 && (
          <button
            className="border rounded px-3 py-1 hover:bg-foreground/5 transition-colors"
            onClick={doSync}
            disabled={syncing}
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        )}
      </div>

      {/* Sync state breakdown */}
      {hasDetails && (
        <div className="flex gap-3 text-xs">
          {(["pending", "uploading", "failed"] as SyncState[]).map((state) =>
            stateCounts[state] > 0 ? (
              <span key={state} className="inline-flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${STATE_COLORS[state]}`} />
                {stateCounts[state]} {state}
              </span>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
