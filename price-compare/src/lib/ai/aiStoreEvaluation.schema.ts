/**
 * Canonical re-export of the AI store evaluation Zod schema + types.
 *
 * New code should import from here:
 *   import { AiStoreEvaluation, parseAiStoreEvaluation } from "@/lib/ai/aiStoreEvaluation.schema";
 *
 * The underlying definition lives in @/lib/schemas/evaluation.ts to avoid
 * breaking existing imports.  This barrel just gives the new canonical path.
 */
export {
  // ── Schema version ───────────────────────────────────────────
  AI_SCHEMA_VERSION,

  // ── Zod schemas ──────────────────────────────────────────────
  AiStoreEvaluationSchema,
  SubScoresSchema,
  EvidenceItemSchema,
  RecommendationSchema,
  PhotoAssessmentSchema,
  DetectedSchema,

  // ── Enums ────────────────────────────────────────────────────
  RatingEnum,
  SegmentEnum,
  RoleEnum,
  EvidenceTypeEnum,
  SeverityEnum,
  RecommendationPriorityEnum,
  PhotoTypeEnum,
  PhotoQualityEnum,
  PiiRiskEnum,
  FindingTagEnum,

  // ── Parser ───────────────────────────────────────────────────
  parseAiStoreEvaluation,

  // ── Rating / scoring ─────────────────────────────────────────
  assignRating,
  DEFAULT_THRESHOLDS,

  // ── Manager override ─────────────────────────────────────────
  managerOverrideSchema,
} from "@/lib/schemas/evaluation";

export type {
  AiStoreEvaluation,
  EvidenceItem,
  Recommendation,
  SubScores,
  Rating,
  Segment,
  Role,
  EvidenceType,
  Severity,
  RecommendationPriority,
  PhotoType,
  PhotoQuality,
  PiiRisk,
  FindingTag,
  ScoringThresholds,
  ManagerOverride,
  ImageQualityReport,

  // backward-compat aliases
  AiEvaluationOutput,
} from "@/lib/schemas/evaluation";
