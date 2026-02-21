export const runtime = "nodejs";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { rateLimitRequest } from "@/lib/rate-limit";
import { saveUpload } from "@/lib/upload";
import { analyzeStorePhoto } from "@/lib/store-evaluation-ai";

export async function POST(req: Request) {
  const limiter = rateLimitRequest(req, { key: "api:evaluations:analyze", limit: 20, windowMs: 60_000 });
  if (!limiter.ok) {
    return jsonError(req, { code: "RATE_LIMITED", message: "Too many requests" }, 429, { headers: limiter.headers });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return jsonError(req, { code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
  }

  const form = await req.formData();
  const file = form.get("photo") as File | null;

  if (!file || file.size <= 0) {
    return jsonError(req, { code: "PHOTO_REQUIRED", message: "Photo is required" }, 400);
  }

  const photoUrl = await saveUpload(file);

  try {
    const analysis = await analyzeStorePhoto(photoUrl);
    return jsonOk(req, { photoUrl, analysis }, { headers: limiter.headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI analysis failed";
    return jsonError(req, { code: "AI_ANALYSIS_FAILED", message }, 500);
  }
}
