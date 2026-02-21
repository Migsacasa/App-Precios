import OpenAI from "openai";
import {
  AI_SCHEMA_VERSION,
  AiStoreEvaluationSchema,
  assignRating,
  type AiStoreEvaluation,
  type ScoringThresholds,
} from "@/lib/schemas/evaluation";
import { buildStoreEvaluationPrompts } from "@/lib/schemas/prompts";
import { getScoringThresholds } from "@/lib/settings";

// Re-export for backward compat with existing imports
export const analysisSchema = AiStoreEvaluationSchema;
export type StoreEvaluationAnalysis = AiStoreEvaluation;

export type { AiStoreEvaluation };

/** Context passed to the prompt builder for richer AI instructions */
export interface AnalysisContext {
  language?: "en" | "es";
  store?: {
    storeId?: string;
    customerCode?: string;
    name?: string;
    city?: string;
    zone?: string;
  };
  ourBrands?: string[];
  competitorBrands?: string[];
  referenceProducts?: Array<{ name: string; brand?: string; imageUrl: string; note?: string }>;
  photoTypes?: Array<"WIDE_SHOT" | "SHELF_CLOSEUP" | "OTHER">;
}

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
  name: "store_superiority_evaluation_v1",
  strict: false,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "schemaVersion", "rating", "score", "confidence", "subScores",
      "summary", "whyBullets", "evidence", "recommendations",
    ],
    properties: {
      schemaVersion: { type: "string", const: AI_SCHEMA_VERSION },
      rating: { type: "string", enum: ["GOOD", "REGULAR", "BAD", "NEEDS_REVIEW"] },
      score: { type: "number", minimum: 0, maximum: 100 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      subScores: {
        type: "object",
        additionalProperties: false,
        required: ["visibility", "shelfShare", "placement", "availability"],
        properties: {
          visibility: { type: "number", minimum: 0, maximum: 25 },
          shelfShare: { type: "number", minimum: 0, maximum: 25 },
          placement: { type: "number", minimum: 0, maximum: 25 },
          availability: { type: "number", minimum: 0, maximum: 25 },
        },
      },
      summary: { type: "string" },
      whyBullets: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
      evidence: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "detail", "severity"],
          properties: {
            type: { type: "string", enum: ["VISIBILITY", "SHELF_SHARE", "PLACEMENT", "AVAILABILITY", "BRANDING", "PRICING", "OTHER"] },
            detail: { type: "string" },
            severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
            tags: { type: "array", items: { type: "string", enum: ["LOW_VISIBILITY", "LOW_SHELF_SHARE", "POOR_PLACEMENT", "OUT_OF_STOCK", "COMPETITOR_BLOCKING", "MISSING_SIGNAGE", "PRICE_DISADVANTAGE", "UNCLEAR_IMAGE", "OTHER"] } },
            segment: { type: "string", enum: ["LUBRICANTS", "BATTERIES", "TIRES"] },
            ourBrandsMentioned: { type: "array", items: { type: "string" } },
            competitorBrandsMentioned: { type: "array", items: { type: "string" } },
          },
        },
        maxItems: 25,
      },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["priority", "action"],
          properties: {
            priority: { type: "string", enum: ["P0", "P1", "P2"] },
            action: { type: "string" },
            rationale: { type: "string" },
            ownerRole: { type: "string", enum: ["FIELD", "MANAGER", "ADMIN"] },
            segment: { type: "string", enum: ["LUBRICANTS", "BATTERIES", "TIRES"] },
          },
        },
        minItems: 1,
        maxItems: 15,
      },
      detected: {
        type: "object",
        additionalProperties: false,
        properties: {
          ourBrands: { type: "array", items: { type: "string" } },
          competitorBrands: { type: "array", items: { type: "string" } },
          segmentsSeen: { type: "array", items: { type: "string", enum: ["LUBRICANTS", "BATTERIES", "TIRES"] } },
        },
      },
      photoAssessments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["photoType", "quality", "piiRisk"],
          properties: {
            photoType: { type: "string", enum: ["WIDE_SHOT", "SHELF_CLOSEUP", "OTHER"] },
            quality: {
              type: "object",
              additionalProperties: false,
              required: ["overall"],
              properties: {
                overall: { type: "string", enum: ["OK", "BLURRY", "DARK", "TOO_FAR", "LOW_RES", "OBSTRUCTED", "OTHER_ISSUE"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                notes: { type: "string" },
              },
            },
            piiRisk: { type: "string", enum: ["NONE", "LOW", "MEDIUM", "HIGH"] },
          },
        },
        maxItems: 3,
      },
      limitations: { type: "array", items: { type: "string" }, maxItems: 6 },
      language: { type: "string", enum: ["en", "es"] },
    },
  },
};

/**
 * Analyze one or more store photos using the AI vision model.
 * Supports multi-photo: passes all images in a single prompt.
 *
 * @param photoUrls   Public URLs or data-URLs for the photos
 * @param context     Optional store/brand/language context for richer prompts
 * @param thresholds  Optional scoring thresholds (loaded from settings if omitted)
 */
export async function analyzeStorePhotos(
  photoUrls: string[],
  context?: AnalysisContext,
  thresholds?: ScoringThresholds,
): Promise<AiStoreEvaluation> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const resolvedThresholds = thresholds ?? (await getScoringThresholds());
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Build prompts from the structured prompt builder
  const photoTypes = context?.photoTypes ?? photoUrls.map(() => "WIDE_SHOT" as const);
  const { system, user: userPrompt } = buildStoreEvaluationPrompts({
    language: context?.language,
    store: context?.store,
    ourBrands: context?.ourBrands,
    competitorBrands: context?.competitorBrands,
    referenceProducts: context?.referenceProducts,
    photoTypesProvided: photoTypes,
  });

  type UserInputContent =
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "auto" };

  const userContent: UserInputContent[] = [
    { type: "input_text", text: userPrompt },
  ];

  if (context?.referenceProducts?.length) {
    userContent.push({ type: "input_text", text: "Reference product images (our products):" });
    for (const ref of context.referenceProducts.slice(0, 20)) {
      userContent.push({
        type: "input_text",
        text: `Reference: ${ref.name}${ref.brand ? ` · brand: ${ref.brand}` : ""}${ref.note ? ` · note: ${ref.note}` : ""}`,
      });
      userContent.push({ type: "input_image", image_url: ref.imageUrl, detail: "auto" });
    }
  }

  userContent.push({ type: "input_text", text: "Store capture images to evaluate:" });
  userContent.push(
    ...photoUrls.map<UserInputContent>((url) => ({ type: "input_image", image_url: url, detail: "auto" })),
  );

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL_VISION ?? "gpt-4.1-mini",
    input: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    text: { format: AI_JSON_SCHEMA },
  });

  const parsed = parseModelJson(response.output_text ?? "");
  const validated = AiStoreEvaluationSchema.safeParse(parsed);

  if (!validated.success) {
    console.warn("AI output validation failed:", validated.error.message);
    return {
      schemaVersion: AI_SCHEMA_VERSION,
      rating: "NEEDS_REVIEW",
      score: 0,
      confidence: 0,
      subScores: { visibility: 0, shelfShare: 0, placement: 0, availability: 0 },
      summary: "AI analysis returned invalid data. Manual review required.",
      whyBullets: ["AI output failed schema validation", "Manual review needed", "Consider re-capturing photos"],
      evidence: [{ type: "OTHER", detail: `Validation error: ${validated.error.message}`, severity: "HIGH" }],
      recommendations: [{ priority: "P0", action: "Review this evaluation manually — AI output was malformed", rationale: "Ensure accurate rating" }],
    };
  }

  const result = validated.data;
  result.rating = assignRating(result.score, result.confidence, resolvedThresholds);
  return result;
}

/** Backward-compatible single-photo analysis */
export async function analyzeStorePhoto(
  photoUrlOrDataUrl: string,
  context?: AnalysisContext,
): Promise<AiStoreEvaluation> {
  return analyzeStorePhotos([photoUrlOrDataUrl], context);
}
