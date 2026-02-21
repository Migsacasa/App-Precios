export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limiter = rateLimitRequest(req, { key: "api:ocr", limit: 20, windowMs: 60_000 });
  if (!limiter.ok) {
    return jsonError(req, { code: "RATE_LIMITED", message: "Too many requests" }, 429, { headers: limiter.headers });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return jsonError(req, { code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return jsonError(req, { code: "VISION_NOT_CONFIGURED", message: "Google Vision not configured" }, 400);
  }

  const form = await req.formData();
  const file = form.get("photo") as File | null;
  if (!file) {
    return jsonError(req, { code: "PHOTO_REQUIRED", message: "Missing photo" }, 400);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const content = bytes.toString("base64");

  const payload = {
    requests: [
      {
        image: { content },
        features: [{ type: "TEXT_DETECTION" }],
      },
    ],
  };

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    return jsonError(req, { code: "VISION_API_ERROR", message: "Vision API error", details: err }, 500);
  }

  const json = await response.json();
  const text =
    json?.responses?.[0]?.fullTextAnnotation?.text ||
    json?.responses?.[0]?.textAnnotations?.[0]?.description ||
    "";

  return jsonOk(req, { text }, { headers: limiter.headers });
}
