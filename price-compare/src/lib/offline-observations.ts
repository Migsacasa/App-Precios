"use client";

import { openDB } from "idb";

const DB_NAME = "price-compare";
const DB_VERSION = 2;
const STORE = "pendingObservations";

export type SyncState = "pending" | "uploading" | "synced" | "failed";

export type PendingObservation = {
  id: string; // clientEvaluationId
  createdAt: number;
  fields: Record<string, string>;
  photo?: Blob;
  extraPhotos?: Array<{ blob: Blob; type: string }>;
  syncState: SyncState;
  lastAttempt?: number;
  attempts: number;
  errorMessage?: string;
};

async function openOfflineDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (!database.objectStoreNames.contains(STORE)) {
        const os = database.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("createdAt", "createdAt");
        os.createIndex("syncState", "syncState");
      }
      // Migrate v1 → v2: add missing indexes if store exists
      if (oldVersion < 2 && database.objectStoreNames.contains(STORE)) {
        try {
          const txStore = (database as unknown as { transaction: (name: string, mode: string) => { objectStore: (name: string) => IDBObjectStore } }).transaction(STORE, "readwrite").objectStore(STORE);
          if (!txStore.indexNames.contains("syncState")) {
            txStore.createIndex("syncState", "syncState");
          }
        } catch {
          // ignore if already exists
        }
      }
    },
  });
}

export async function enqueueObservation(item: Omit<PendingObservation, "syncState" | "attempts">) {
  const d = await openOfflineDb();
  await d.put(STORE, { ...item, syncState: "pending" as SyncState, attempts: 0 });
}

export async function listPendingObservations(): Promise<PendingObservation[]> {
  const d = await openOfflineDb();
  return (await d.getAll(STORE)) as PendingObservation[];
}

export async function deletePendingObservation(id: string) {
  const d = await openOfflineDb();
  await d.delete(STORE, id);
}

export async function updateObservationState(
  id: string,
  update: Partial<Pick<PendingObservation, "syncState" | "lastAttempt" | "attempts" | "errorMessage">>,
) {
  const d = await openOfflineDb();
  const item = await d.get(STORE, id);
  if (item) {
    await d.put(STORE, { ...item, ...update });
  }
}

export async function countPending(): Promise<number> {
  const d = await openOfflineDb();
  return await d.count(STORE);
}

export async function countByState(): Promise<Record<SyncState, number>> {
  const items = await listPendingObservations();
  const counts: Record<SyncState, number> = { pending: 0, uploading: 0, synced: 0, failed: 0 };
  for (const item of items) {
    const state = (item as PendingObservation).syncState ?? "pending";
    counts[state] = (counts[state] ?? 0) + 1;
  }
  return counts;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncPending(): Promise<{ synced: number; failed: number }> {
  const items = await listPendingObservations();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (item.syncState === "synced") continue;

    let success = false;
    await updateObservationState(item.id, { syncState: "uploading" });

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const fd = new FormData();
        // Include clientEvaluationId for server-side dedup
        fd.append("clientEvaluationId", item.id);
        for (const [k, v] of Object.entries(item.fields)) fd.append(k, v);
        if (item.photo) fd.append("photo", item.photo, "photo.jpg");
        // Append extra photos
        if (item.extraPhotos) {
          item.extraPhotos.forEach((ep, idx) => {
            fd.append(`photo_${idx + 1}`, ep.blob, `photo_${idx + 1}.jpg`);
            fd.append(`photoType_${idx + 1}`, ep.type);
          });
        }

        const res = await fetch("/api/observations", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        await deletePendingObservation(item.id);
        synced++;
        success = true;
        break;
      } catch (err) {
        const newAttempts = (item.attempts ?? 0) + attempt + 1;
        await updateObservationState(item.id, {
          attempts: newAttempts,
          lastAttempt: Date.now(),
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        });

        if (attempt < MAX_RETRIES - 1) {
          const backoff = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
          await delay(backoff);
        }
      }
    }

    if (!success) {
      await updateObservationState(item.id, { syncState: "failed" });
      failed++;
    }
  }

  return { synced, failed };
}
