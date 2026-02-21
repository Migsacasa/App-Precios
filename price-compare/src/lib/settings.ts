import { DEFAULT_THRESHOLDS, type ScoringThresholds } from "@/lib/schemas/evaluation";

/**
 * Settings are now loaded from environment variables with sensible defaults.
 * The old AppSettings table has been removed.
 */

const ENV_SETTINGS: Record<string, string> = {};

export async function getSettings(): Promise<Record<string, string>> {
  return { ...ENV_SETTINGS };
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  return ENV_SETTINGS[key] ?? process.env[`APP_${key.replace(/\./g, "_").toUpperCase()}`] ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  ENV_SETTINGS[key] = value;
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
