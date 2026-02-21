/**
 * Shared zod schemas for AI evaluation output.
 * Single source of truth used by:
 *  - AI analysis engine (server)
 *  - API routes (validation)
 *  - Client components (type inference)
 */
import { z } from "zod";

// ── Evidence item ──────────────────────────────────────────────
export const evidenceItemSchema = z.object({
  type: z.enum([
    "visibility",
    "shelf_share",
    "placement",
    "availability",
    "signage",
    "competitor",
    "general",
  ]),
  detail: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1).optional(),
});

// ── Recommendation ─────────────────────────────────────────────
export const recommendationSchema = z.object({
  action: z.string().min(1),
  why: z.string().min(1),
  expectedImpact: z.string().min(1),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

// ── Sub-scores ─────────────────────────────────────────────────
export const subScoresSchema = z.object({
  visibility: z.number().min(0).max(25),
  shelfShare: z.number().min(0).max(25),
  placementQuality: z.number().min(0).max(25),
  availability: z.number().min(0).max(25),
});

// ── Full AI evaluation output ──────────────────────────────────
export const aiEvaluationOutputSchema = z.object({
  rating: z.enum(["GOOD", "REGULAR", "BAD", "NEEDS_REVIEW"]),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  subScores: subScoresSchema,
  summary: z.string().min(1),
  whyBullets: z.array(z.string().min(1)).min(3).max(7),
  evidence: z.array(evidenceItemSchema).min(1),
  recommendations: z.array(recommendationSchema).min(1),
  detectedBrands: z.array(z.string()).optional(),
});

export type AiEvaluationOutput = z.infer<typeof aiEvaluationOutputSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type SubScores = z.infer<typeof subScoresSchema>;

// ── Scoring thresholds (configurable via AppSettings) ──────────
export interface ScoringThresholds {
  goodScore: number;       // default 75
  badScore: number;        // default 45
  goodConfidence: number;  // default 0.6
  needsReviewConfidence: number; // default 0.35
}

export const DEFAULT_THRESHOLDS: ScoringThresholds = {
  goodScore: 75,
  badScore: 45,
  goodConfidence: 0.6,
  needsReviewConfidence: 0.35,
};

/**
 * Assign rating from score + confidence using the documented rubric:
 *   GOOD if score >= 75 AND confidence >= 0.6
 *   BAD  if score <  45 AND confidence >= 0.6
 *   NEEDS_REVIEW if confidence < 0.35
 *   REGULAR otherwise
 */
export function assignRating(
  score: number,
  confidence: number,
  thresholds: ScoringThresholds = DEFAULT_THRESHOLDS,
): "GOOD" | "REGULAR" | "BAD" | "NEEDS_REVIEW" {
  if (confidence < thresholds.needsReviewConfidence) return "NEEDS_REVIEW";
  if (score >= thresholds.goodScore && confidence >= thresholds.goodConfidence) return "GOOD";
  if (score < thresholds.badScore && confidence >= thresholds.goodConfidence) return "BAD";
  return "REGULAR";
}

// ── Manager override ───────────────────────────────────────────
export const managerOverrideSchema = z.object({
  rating: z.enum(["GOOD", "REGULAR", "BAD"]),
  reason: z.string().min(5, "Override reason must be at least 5 characters"),
});

export type ManagerOverride = z.infer<typeof managerOverrideSchema>;

// ── Image quality report (client-side) ─────────────────────────
export interface ImageQualityReport {
  ok: boolean;
  issues: Array<{
    type: "too_dark" | "too_bright" | "too_small" | "too_blurry";
    message: string;
  }>;
}

// ── Legacy compatibility: map old schema to new ────────────────
export const legacyAnalysisSchema = z.object({
  overallRating: z.enum(["GOOD", "REGULAR", "BAD"]),
  summary: z.string().min(1),
  findings: z.array(z.string()).min(1),
  recommendations: z.array(
    z.object({
      action: z.string().min(1),
      why: z.string().min(1),
      expectedImpact: z.string().min(1),
    }),
  ),
  evidence: z.array(
    z.object({
      observation: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
});
