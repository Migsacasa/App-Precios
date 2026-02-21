// Re-export offline queue operations from the single IndexedDB (idb) implementation.
// The previous Dexie-based database ("price-compare-db") has been removed to avoid
// maintaining two competing IndexedDB stores for the same purpose.
export {
  enqueueObservation,
  listPendingObservations,
  deletePendingObservation,
  countPending,
  syncPending,
  type PendingObservation,
} from "./offline-observations";
