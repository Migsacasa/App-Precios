import { prisma } from "@/lib/prisma";
import { DEFAULT_THRESHOLDS, type ScoringThresholds } from "@/lib/schemas/evaluation";

/**
 * Settings are now loaded from environment variables with sensible defaults.
 * The old AppSettings table has been removed.
 */

const SETTINGS_ENTITY_TYPE = "Settings";
const SETTINGS_ACTION = "STORE_UPDATED" as const;

let settingsCache: Record<string, string> = {};
let lastLoadAt = 0;

async function loadPersistedSettings(force = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!force && now - lastLoadAt < 30_000) {
    return settingsCache;
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: SETTINGS_ENTITY_TYPE,
      action: SETTINGS_ACTION,
    },
    orderBy: { createdAt: "asc" },
    select: { meta: true },
    take: 5000,
  });

  const loaded: Record<string, string> = {};
  for (const row of logs) {
    const meta = row.meta as { key?: unknown; value?: unknown } | null;
    if (!meta) continue;
    const key = typeof meta.key === "string" ? meta.key : "";
    const value = typeof meta.value === "string" ? meta.value : "";
    if (!key) continue;
    loaded[key] = value;
  }

  settingsCache = loaded;
  lastLoadAt = now;
  return loaded;
}

export async function getSettings(): Promise<Record<string, string>> {
  return { ...(await loadPersistedSettings()) };
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const persisted = await loadPersistedSettings();
  return persisted[key] ?? process.env[`APP_${key.replace(/\./g, "_").toUpperCase()}`] ?? fallback;
}

export async function setSetting(
  key: string,
  value: string,
  options?: { actorId?: string },
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: SETTINGS_ACTION,
      actorId: options?.actorId ?? null,
      entityType: SETTINGS_ENTITY_TYPE,
      entityId: key,
      meta: { key, value },
    },
  });

  settingsCache[key] = value;
  lastLoadAt = Date.now();
}

export async function getScoringThresholds(): Promise<ScoringThresholds> {
  return {
    goodScore: Number(await getSetting("scoring.threshold.good", "")) || DEFAULT_THRESHOLDS.goodScore,
    badScore: Number(await getSetting("scoring.threshold.bad", "")) || DEFAULT_THRESHOLDS.badScore,
    goodConfidence: Number(await getSetting("scoring.confidence.good", "")) || DEFAULT_THRESHOLDS.goodConfidence,
    needsReviewConfidence:
      Number(await getSetting("scoring.confidence.needsReview", "")) || DEFAULT_THRESHOLDS.needsReviewConfidence,
  };
}

export async function getRecencyDays(): Promise<number> {
  const val = await getSetting("map.recencyDays", "30");
  return Number(val) || 30;
}

export async function getRetentionMonths(): Promise<number> {
  const val = await getSetting("retention.photoMonths", "6");
  return Number(val) || 6;
}
