import { type AiStoreEvaluation, parseAiStoreEvaluation } from "@/lib/ai/aiStoreEvaluation.schema";
import { buildStoreEvaluationPrompts } from "@/lib/ai/prompts/storeEvaluation.prompt";

export type VisionModelResponse = {
  modelName: string;
  output: AiStoreEvaluation;
  rawText: string;      // keep for debugging (don't show to FIELD)
  latencyMs?: number;
  tokenCount?: number;
};

export async function evaluateStoreWithVisionLLM(args: {
  language?: "en" | "es";
  store: { customerCode?: string; name?: string; city?: string; zone?: string };
  photoInputs: Array<{ url: string; type: "WIDE_SHOT" | "SHELF_CLOSEUP" | "OTHER" }>;
  ourBrands?: string[];
  competitorBrands?: string[];
}): Promise<VisionModelResponse> {
  const prompts = buildStoreEvaluationPrompts({
    language: args.language ?? "es",
    store: args.store,
    ourBrands: args.ourBrands,
    competitorBrands: args.competitorBrands,
    photoTypesProvided: args.photoInputs.map((p) => p.type),
  });

  // PROVIDER-SPECIFIC IMPLEMENTATION GOES HERE.
  // You attach the images as vision inputs to your LLM request.
  // This stub assumes you get back text that should be strict JSON.

  const t0 = Date.now();

  const rawText = await fakeProviderCall({
    system: prompts.system,
    user: prompts.user,
    images: args.photoInputs.map((p) => p.url),
  });

  const latencyMs = Date.now() - t0;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("LLM returned non-JSON output");
  }

  const output = parseAiStoreEvaluation(parsed);

  return {
    modelName: "vision-model",
    output,
    rawText,
    latencyMs,
  };
}

// Replace this with your real model call
async function fakeProviderCall(input: unknown): Promise<string> {
  void input;
  throw new Error("Implement vision provider call");
}
