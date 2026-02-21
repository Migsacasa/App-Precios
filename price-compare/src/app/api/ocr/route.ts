export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limiter = rateLimitRequest(req, { key: "api:ocr", limit: 20, windowMs: 60_000 });
  if (!limiter.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: limiter.headers });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Vision not configured" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("photo") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Missing photo" }, { status: 400 });
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
    return NextResponse.json(
      { error: "Vision API error", details: err },
      { status: 500 },
    );
  }

  const json = await response.json();
  const text =
    json?.responses?.[0]?.fullTextAnnotation?.text ||
    json?.responses?.[0]?.textAnnotations?.[0]?.description ||
    "";

  return NextResponse.json({ ok: true, text });
}
