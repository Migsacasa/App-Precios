import OpenAI from "openai";
import {
  aiEvaluationOutputSchema,
  assignRating,
  legacyAnalysisSchema,
  type AiEvaluationOutput,
  type ScoringThresholds,
} from "@/lib/schemas/evaluation";
import { getScoringThresholds } from "@/lib/settings";

// Re-export for backward compat with existing imports
export const analysisSchema = aiEvaluationOutputSchema;
export { legacyAnalysisSchema };
export type StoreEvaluationAnalysis = AiEvaluationOutput;

function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1));
    }
    return null;
  }
}

/**
 * Documented scoring rubric:
 *
 * Score 0–100 composed of 4 weighted sub-scores (default 25 each):
 *   Visibility (0–25): products easy to spot, front-facing, eye-level, signage
 *   Share of Shelf (0–25): shelf share vs competitors
 *   Placement Quality (0–25): eye-level, end-cap, checkout, primary zone
 *   Availability / Stock (0–25): presence + quantity impression
 *
 * Rating thresholds (configurable in admin):
 *   GOOD if score >= 75 AND confidence >= 0.6
 *   REGULAR if score 45–74 OR confidence < 0.6
 *   BAD if score < 45 AND confidence >= 0.6
 *   NEEDS_REVIEW if confidence < 0.35
 */

const AI_JSON_SCHEMA = {
  type: "json_schema" as const,
  name: "store_superiority_evaluation_v2",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "score", "confidence", "subScores", "summary",
      "whyBullets", "evidence", "recommendations",
    ],
    properties: {
      score: { type: "number", minimum: 0, maximum: 100 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      subScores: {
        type: "object",
        additionalProperties: false,
        required: ["visibility", "shelfShare", "placementQuality", "availability"],
        properties: {
          visibility: { type: "number", minimum: 0, maximum: 25 },
          shelfShare: { type: "number", minimum: 0, maximum: 25 },
          placementQuality: { type: "number", minimum: 0, maximum: 25 },
          availability: { type: "number", minimum: 0, maximum: 25 },
        },
      },
      summary: { type: "string" },
      whyBullets: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 7 },
      evidence: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "detail", "severity"],
          properties: {
            type: { type: "string", enum: ["visibility", "shelf_share", "placement", "availability", "signage", "competitor", "general"] },
            detail: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
          },
        },
        minItems: 1,
      },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["action", "why", "expectedImpact"],
          properties: {
            action: { type: "string" },
            why: { type: "string" },
            expectedImpact: { type: "string" },
          },
        },
        minItems: 1,
      },
      detectedBrands: { type: "array", items: { type: "string" } },
    },
  },
};

const SYSTEM_PROMPT = `You are a retail execution auditor for a consumer goods company.
Evaluate store photos for product positioning superiority vs competitors.

Score using these weighted sub-scores (each 0–25, total 0–100):
1. Visibility (0–25): Are our products easy to spot? Front-facing, eye-level, signage present?
2. Share of Shelf (0–25): What approximate shelf share does our brand have vs competitors?
3. Placement Quality (0–25): Are products at eye-level, on end-caps, near checkout, in primary zones?
4. Availability / Stock (0–25): Are products present and well-stocked (impression, not exact count)?

Set confidence 0–1 based on image quality/clarity. If blurry/dark/far, lower confidence.

Provide:
- summary: 2–4 sentences
- whyBullets: 3–7 key observations
- evidence: structured items with type, detail, severity
- recommendations: actionable steps for sales reps
- detectedBrands: brands visible in photos

Return strict JSON only.`;

/**
 * Analyze one or more store photos using the AI vision model.
 * Supports multi-photo: passes all images in a single prompt.
 */
export async function analyzeStorePhotos(
  photoUrls: string[],
  thresholds?: ScoringThresholds,
): Promise<AiEvaluationOutput> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const resolvedThresholds = thresholds ?? (await getScoringThresholds());
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const photoCount = photoUrls.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userContent: any[] = [
    {
      type: "input_text",
      text: `Evaluate ${photoCount === 1 ? "this" : `these ${photoCount}`} in-store photo${photoCount > 1 ? "s" : ""} for superiority execution. ${photoCount === 1 ? "Only one photo — note if additional angles would help." : "Multiple angles provided."} Return strict JSON.`,
    },
    ...photoUrls.map((url) => ({ type: "input_image", image_url: url, detail: "auto" })),
  ];

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL_VISION ?? "gpt-4.1-mini",
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    text: { format: AI_JSON_SCHEMA },
  });

  const parsed = parseModelJson(response.output_text ?? "");
  const validated = aiEvaluationOutputSchema.safeParse(parsed);

  if (!validated.success) {
    console.warn("AI output validation failed:", validated.error.message);
    return {
      rating: "NEEDS_REVIEW",
      score: 0,
      confidence: 0,
      subScores: { visibility: 0, shelfShare: 0, placementQuality: 0, availability: 0 },
      summary: "AI analysis returned invalid data. Manual review required.",
      whyBullets: ["AI output failed schema validation", "Manual review needed", "Consider re-capturing photos"],
      evidence: [{ type: "general", detail: `Validation error: ${validated.error.message}`, severity: "high" }],
      recommendations: [{ action: "Review manually", why: "AI output was malformed", expectedImpact: "Ensure accurate rating" }],
    };
  }

  const result = validated.data;
  result.rating = assignRating(result.score, result.confidence, resolvedThresholds);
  return result;
}

/** Backward-compatible single-photo analysis */
export async function analyzeStorePhoto(photoUrlOrDataUrl: string): Promise<AiEvaluationOutput> {
  return analyzeStorePhotos([photoUrlOrDataUrl]);
}
