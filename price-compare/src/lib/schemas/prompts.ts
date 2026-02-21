import { AI_SCHEMA_VERSION } from "@/lib/schemas/evaluation";

type PromptParams = {
  language?: "en" | "es";
  store?: {
    storeId?: string;
    customerCode?: string;
    name?: string;
    city?: string;
    zone?: string;
  };
  ourBrands?: string[]; // optional: known brand names
  competitorBrands?: string[]; // optional
  referenceProducts?: Array<{ name: string; brand?: string; imageUrl: string; note?: string }>;
  photoTypesProvided: Array<"WIDE_SHOT" | "SHELF_CLOSEUP" | "OTHER">; // align with uploaded photos
};

export function buildStoreEvaluationPrompts(params: PromptParams) {
  const language = params.language ?? "es";

  const system = `
You are a retail execution auditor analyzing 1–3 store photos.
Your task: evaluate product positioning quality for our brands vs competition, with auditability.

CRITICAL OUTPUT RULES (must follow):
- Output MUST be a SINGLE valid JSON object.
- Do NOT wrap in markdown or code fences.
- Do NOT output any extra text before or after the JSON.
- Use double quotes for all JSON strings.
- No trailing commas.
- Do NOT include keys that are not in the schema.
- Your JSON MUST match schemaVersion "${AI_SCHEMA_VERSION}" exactly.

HONESTY / SAFETY:
- Do NOT guess brand presence if it is not clearly visible.
- If images are blurry/dark/too far to judge, set rating="NEEDS_REVIEW" with low confidence and explain limitations.
- Do not identify people or infer demographics. Ignore faces; if faces/plates are visible, mark piiRisk accordingly.
- If shelf/area is not visible, say so explicitly.

SCORING RUBRIC:
Provide subScores (0–25 each, integers):
- visibility (0–25): how easy our products are to spot (front-facing, eye-level, clear branding, signage)
- shelfShare (0–25): approximate visible share of shelf compared to competitors
- placement (0–25): quality of placement (eye-level, endcaps, main aisle vs bottom/hidden)
- availability (0–25): are our products present and appear sufficiently stocked (not exact units)

Computed score MUST equal:
score = visibility + shelfShare + placement + availability
(score must be integer 0–100)

RATING THRESHOLDS (apply them consistently):
- GOOD if score >= 75 AND confidence >= 0.60
- BAD if score < 45 AND confidence >= 0.60
- REGULAR otherwise (including low confidence)
- NEEDS_REVIEW if confidence < 0.35 OR photo quality prevents judgment

REQUIRED CONTENT QUALITY:
- summary: 2–4 sentences, concise.
- whyBullets: 3–8 bullets; each must reference visible cues ("top shelf", "blocked by competitor", "missing signage").
- evidence: structured items (type, severity, detail, optional tags/segment)
- recommendations: 1–15 actions with priority P0/P1/P2, focused on merchandising improvements.

LANGUAGE:
- Write summary, bullets, evidence.detail, and recommendation text in "${language}".
`.trim();

  const user = `
Context (may be partial):
- Store: ${JSON.stringify(params.store ?? {}, null, 0)}
- Our brands (if provided): ${JSON.stringify(params.ourBrands ?? [], null, 0)}
- Competitor brands (if provided): ${JSON.stringify(params.competitorBrands ?? [], null, 0)}
- Reference products with images (if provided): ${JSON.stringify((params.referenceProducts ?? []).map((p) => ({
  name: p.name,
  brand: p.brand ?? null,
  note: p.note ?? null,
  imageUrl: p.imageUrl,
})), null, 0)}
- Photo types provided (in order): ${JSON.stringify(params.photoTypesProvided, null, 0)}

Segments of interest:
- LUBRICANTS
- BATTERIES
- TIRES

TASK:
1) Assess photo quality per photoType (OK/BLURRY/DARK/TOO_FAR/LOW_RES/OBSTRUCTED/OTHER_ISSUE).
2) If reference product images are provided, compare shelf/store photos against those references to identify our products more reliably.
3) Determine if our brands/products are visible and how they compare to competitor visibility and shelf share.
4) Produce the final JSON strictly following the schema:
{
  "schemaVersion": "${AI_SCHEMA_VERSION}",
  "rating": "GOOD|REGULAR|BAD|NEEDS_REVIEW",
  "score": 0-100,
  "confidence": 0-1,
  "subScores": {"visibility":0-25,"shelfShare":0-25,"placement":0-25,"availability":0-25},
  "summary": "...",
  "whyBullets": ["...", "...", "..."],
  "evidence": [{"type":"VISIBILITY|SHELF_SHARE|PLACEMENT|AVAILABILITY|BRANDING|PRICING|OTHER","severity":"LOW|MEDIUM|HIGH","detail":"...", "tags":[...], "segment":"LUBRICANTS|BATTERIES|TIRES"}],
  "recommendations": [{"priority":"P0|P1|P2","action":"...","rationale":"...","ownerRole":"FIELD|MANAGER|ADMIN","segment":"LUBRICANTS|BATTERIES|TIRES"}],
  "detected": {"ourBrands":[...],"competitorBrands":[...],"segmentsSeen":[...]},
  "photoAssessments": [{"photoType":"WIDE_SHOT|SHELF_CLOSEUP|OTHER","quality":{"overall":"OK|BLURRY|DARK|TOO_FAR|LOW_RES|OBSTRUCTED|OTHER_ISSUE","confidence":0-1,"notes":"..."},"piiRisk":"NONE|LOW|MEDIUM|HIGH"}],
  "limitations": ["..."],
  "language": "${language}"
}

IMPORTANT:
- score MUST equal sum(subScores).
- If you are uncertain, reduce confidence and explain limitations.
- If no shelf is visible, use NEEDS_REVIEW.
`.trim();

  return { system, user };
}
