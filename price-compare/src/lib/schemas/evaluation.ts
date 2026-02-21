/**
 * Shared zod schemas for AI evaluation output.
 * Single source of truth used by:
 *  - AI analysis engine (server)
 *  - API routes (validation)
 *  - Client components (type inference)
 *
 * IMPORTANT:
 * - Keep this schema STRICT to reject unknown keys (auditability + safety).
 * - Use z.coerce.number() to tolerate numeric strings from LLMs.
 */
import { z } from "zod";

export const AI_SCHEMA_VERSION = "ai.store_eval.v1" as const;

export const RatingEnum = z.enum(["GOOD", "REGULAR", "BAD", "NEEDS_REVIEW"]);
export type Rating = z.infer<typeof RatingEnum>;

export const SegmentEnum = z.enum(["LUBRICANTS", "BATTERIES", "TIRES"]);
export type Segment = z.infer<typeof SegmentEnum>;

export const RoleEnum = z.enum(["FIELD", "MANAGER", "ADMIN"]);
export type Role = z.infer<typeof RoleEnum>;

export const EvidenceTypeEnum = z.enum([
  "VISIBILITY",
  "SHELF_SHARE",
  "PLACEMENT",
  "AVAILABILITY",
  "BRANDING",
  "PRICING",
  "OTHER",
]);
export type EvidenceType = z.infer<typeof EvidenceTypeEnum>;

export const SeverityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type Severity = z.infer<typeof SeverityEnum>;

export const RecommendationPriorityEnum = z.enum(["P0", "P1", "P2"]);
export type RecommendationPriority = z.infer<typeof RecommendationPriorityEnum>;

export const PhotoTypeEnum = z.enum(["WIDE_SHOT", "SHELF_CLOSEUP", "OTHER"]);
export type PhotoType = z.infer<typeof PhotoTypeEnum>;

export const PhotoQualityEnum = z.enum([
  "OK",
  "BLURRY",
  "DARK",
  "TOO_FAR",
  "LOW_RES",
  "OBSTRUCTED",
  "OTHER_ISSUE",
]);
export type PhotoQuality = z.infer<typeof PhotoQualityEnum>;

export const PiiRiskEnum = z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]);
export type PiiRisk = z.infer<typeof PiiRiskEnum>;

export const FindingTagEnum = z.enum([
  "LOW_VISIBILITY",
  "LOW_SHELF_SHARE",
  "POOR_PLACEMENT",
  "OUT_OF_STOCK",
  "COMPETITOR_BLOCKING",
  "MISSING_SIGNAGE",
  "PRICE_DISADVANTAGE",
  "UNCLEAR_IMAGE",
  "OTHER",
]);
export type FindingTag = z.infer<typeof FindingTagEnum>;

// ── Sub-scores ─────────────────────────────────────────────────
export const SubScoresSchema = z
  .object({
    // Each 0–25 (ints). Total score should be 0–100.
    visibility: z.coerce.number().int().min(0).max(25),
    shelfShare: z.coerce.number().int().min(0).max(25),
    placement: z.coerce.number().int().min(0).max(25),
    availability: z.coerce.number().int().min(0).max(25),
  })
  .strict();

// ── Evidence item ──────────────────────────────────────────────
export const EvidenceItemSchema = z
  .object({
    type: EvidenceTypeEnum,
    severity: SeverityEnum,
    detail: z.string().min(5).max(400),

    // Optional analytics tags for dashboards/drivers.
    tags: z.array(FindingTagEnum).min(0).max(6).optional(),

    // Optional scoping
    segment: SegmentEnum.optional(),

    // Optional brand mentions (strings to avoid forcing a fixed ontology)
    ourBrandsMentioned: z.array(z.string().min(1).max(60)).min(0).max(10).optional(),
    competitorBrandsMentioned: z.array(z.string().min(1).max(60)).min(0).max(10).optional(),
  })
  .strict();

// ── Recommendation ─────────────────────────────────────────────
export const RecommendationSchema = z
  .object({
    priority: RecommendationPriorityEnum,
    action: z.string().min(5).max(220),
    rationale: z.string().min(5).max(420).optional(),

    // Who should act
    ownerRole: RoleEnum.optional(),

    // Optional segment target
    segment: SegmentEnum.optional(),
  })
  .strict();

export const PhotoAssessmentSchema = z
  .object({
    photoType: PhotoTypeEnum,

    quality: z
      .object({
        overall: PhotoQualityEnum,
        confidence: z.coerce.number().min(0).max(1).optional(),
        notes: z.string().min(0).max(250).optional(),
      })
      .strict(),

    piiRisk: PiiRiskEnum.default("NONE"),
  })
  .strict();

export const DetectedSchema = z
  .object({
    ourBrands: z.array(z.string().min(1).max(60)).min(0).max(30).default([]),
    competitorBrands: z.array(z.string().min(1).max(60)).min(0).max(30).default([]),
    segmentsSeen: z.array(SegmentEnum).min(0).max(3).default([]),
  })
  .strict();

// ── Full AI evaluation output ──────────────────────────────────
export const AiStoreEvaluationSchema = z
  .object({
    schemaVersion: z.literal(AI_SCHEMA_VERSION),

    rating: RatingEnum,
    score: z.coerce.number().int().min(0).max(100),
    confidence: z.coerce.number().min(0).max(1),

    // Subscores should support auditability and score reproducibility.
    subScores: SubScoresSchema,

    // Human-friendly content for UI.
    summary: z.string().min(15).max(900),
    whyBullets: z.array(z.string().min(5).max(220)).min(3).max(8),

    evidence: z.array(EvidenceItemSchema).min(0).max(25),
    recommendations: z.array(RecommendationSchema).min(1).max(15),

    // Optional signals / metadata
    detected: DetectedSchema.optional(),
    photoAssessments: z.array(PhotoAssessmentSchema).min(1).max(3).optional(),
    limitations: z.array(z.string().min(5).max(220)).min(0).max(6).optional(),

    // Optional language marker for UI (keep optional to reduce LLM failures)
    language: z.enum(["en", "es"]).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    // Soft integrity check: ensure score matches subscores.
    const computed =
      val.subScores.visibility +
      val.subScores.shelfShare +
      val.subScores.placement +
      val.subScores.availability;

    if (val.score !== computed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["score"],
        message: `score must equal sum(subScores). Expected ${computed}, got ${val.score}.`,
      });
    }
  });

export type AiStoreEvaluation = z.infer<typeof AiStoreEvaluationSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type SubScores = z.infer<typeof SubScoresSchema>;

// ── Backward-compat aliases so existing imports keep working ───
export const aiEvaluationOutputSchema = AiStoreEvaluationSchema;
export type AiEvaluationOutput = AiStoreEvaluation;

export function parseAiStoreEvaluation(input: unknown): AiStoreEvaluation {
  return AiStoreEvaluationSchema.parse(input);
}

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
