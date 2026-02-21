import { prisma } from "@/lib/prisma";
import { DEFAULT_THRESHOLDS, type ScoringThresholds } from "@/lib/schemas/evaluation";

/**
 * Load configurable settings from the app_settings table.
 * Falls back to defaults if a key is missing.
 */
export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.appSettings.findMany();
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const row = await prisma.appSettings.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSettings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getScoringThresholds(): Promise<ScoringThresholds> {
  const settings = await getSettings();
  return {
    goodScore: Number(settings["scoring.threshold.good"]) || DEFAULT_THRESHOLDS.goodScore,
    badScore: Number(settings["scoring.threshold.bad"]) || DEFAULT_THRESHOLDS.badScore,
    goodConfidence: Number(settings["scoring.confidence.good"]) || DEFAULT_THRESHOLDS.goodConfidence,
    needsReviewConfidence:
      Number(settings["scoring.confidence.needsReview"]) || DEFAULT_THRESHOLDS.needsReviewConfidence,
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
