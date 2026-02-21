export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUpload, UploadValidationError } from "@/lib/upload";
import { analyzeStorePhotos, analysisSchema } from "@/lib/store-evaluation-ai";
import { logAudit } from "@/lib/audit";
import { aiEvaluationOutputSchema } from "@/lib/schemas/evaluation";
import type { Prisma, PhotoType } from "@prisma/client";

const slotSchema = z.object({
  segment: z.enum(["LUBRICANTS", "BATTERIES", "TIRES"]),
  slot: z.number().int().positive(),
  priceIndex: z.number().nonnegative(),
  competitorPrice: z.number().nonnegative().optional(),
  ourPrice: z.number().nonnegative().optional(),
  isManualOverride: z.boolean().optional(),
});

const payloadSchema = z.object({
  storeId: z.string().min(1),
  clientEvaluationId: z.string().optional(),
  notes: z.string().optional(),
  gpsAtCaptureLat: z.number().optional(),
  gpsAtCaptureLng: z.number().optional(),
  ai: aiEvaluationOutputSchema.optional(),
  slots: z.array(slotSchema),
});

const requiredSlots: Record<"LUBRICANTS" | "BATTERIES" | "TIRES", number[]> = {
  LUBRICANTS: [1, 2, 3, 4],
  BATTERIES: [1, 2],
  TIRES: [1],
};

function parseNumber(value: FormDataEntryValue | null) {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function buildSlotsFromForm(form: FormData) {
  return [
    ...requiredSlots.LUBRICANTS.map((slot) => ({
      segment: "LUBRICANTS" as const,
      slot,
      priceIndex: parseNumber(form.get(`lubricants${slot}`)),
      competitorPrice: parseNumber(form.get(`competitorPrice_lubricants${slot}`)),
      ourPrice: parseNumber(form.get(`ourPrice_lubricants${slot}`)),
    })),
    ...requiredSlots.BATTERIES.map((slot) => ({
      segment: "BATTERIES" as const,
      slot,
      priceIndex: parseNumber(form.get(`batteries${slot}`)),
      competitorPrice: parseNumber(form.get(`competitorPrice_batteries${slot}`)),
      ourPrice: parseNumber(form.get(`ourPrice_batteries${slot}`)),
    })),
    ...requiredSlots.TIRES.map((slot) => ({
      segment: "TIRES" as const,
      slot,
      priceIndex: parseNumber(form.get(`tires${slot}`)),
      competitorPrice: parseNumber(form.get(`competitorPrice_tires${slot}`)),
      ourPrice: parseNumber(form.get(`ourPrice_tires${slot}`)),
    })),
  ]
    .map((item) => {
      // Auto-calc priceIndex if competitorPrice and ourPrice are provided and priceIndex is missing
      let priceIndex = item.priceIndex;
      if (priceIndex == null && item.competitorPrice != null && item.ourPrice != null && item.ourPrice > 0) {
        priceIndex = Math.round((item.competitorPrice / item.ourPrice) * 100) / 100;
      }
      return { ...item, priceIndex };
    })
    .filter((item) => item.priceIndex != null) as Array<{
    segment: "LUBRICANTS" | "BATTERIES" | "TIRES";
    slot: number;
    priceIndex: number;
    competitorPrice?: number;
    ourPrice?: number;
  }>;
}

function assertSlots(slots: Array<{ segment: "LUBRICANTS" | "BATTERIES" | "TIRES"; slot: number; priceIndex: number }>) {
  for (const [segment, required] of Object.entries(requiredSlots) as Array<[
    "LUBRICANTS" | "BATTERIES" | "TIRES",
    number[],
  ]>) {
    const present = slots.filter((item) => item.segment === segment).map((item) => item.slot).sort((a, b) => a - b);
    if (present.length !== required.length || present.some((value, index) => value !== required[index])) {
      throw new Error(`Missing required inputs for ${segment}`);
    }
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [stores, products] = await Promise.all([
    prisma.store.findMany({
      where: { isActive: true },
      orderBy: [{ city: "asc" }, { customerName: "asc" }],
      select: {
        id: true,
        customerCode: true,
        customerName: true,
        city: true,
        zone: true,
        lat: true,
        lng: true,
      },
    }),
    prisma.ourProduct.findMany({ where: { isActive: true }, orderBy: [{ segment: "asc" }, { productName: "asc" }] }),
  ]);

  return NextResponse.json({ stores, products });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // FIELD can only create evaluations
  const role = (session.user as { role?: string }).role ?? "FIELD";

  const form = await req.formData();
  const storeId = String(form.get("storeId") ?? "").trim();
  const clientEvaluationId = String(form.get("clientEvaluationId") ?? "").trim() || undefined;
  const notes = String(form.get("notes") ?? "").trim() || undefined;
  const gpsAtCaptureLat = parseNumber(form.get("gpsAtCaptureLat"));
  const gpsAtCaptureLng = parseNumber(form.get("gpsAtCaptureLng"));
  const slots = buildSlotsFromForm(form);

  if (!storeId) {
    return NextResponse.json({ error: "Store is required" }, { status: 400 });
  }

  // Dedup: if clientEvaluationId exists, check for duplicate
  if (clientEvaluationId) {
    const existing = await prisma.storeEvaluation.findUnique({
      where: { clientEvaluationId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, duplicate: true });
    }
  }

  try {
    assertSlots(slots);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid segment slots";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Handle multi-photo: photo, photo_1, photo_2 (up to 3)
  const photoFiles: Array<{ file: File; photoType: PhotoType; sortOrder: number }> = [];
  const photoKeys = ["photo", "photo_1", "photo_2"];
  const photoTypeMap: Record<string, PhotoType> = {
    WIDE_SHOT: "WIDE_SHOT",
    SHELF_CLOSEUP: "SHELF_CLOSEUP",
    OTHER: "OTHER",
  };

  for (let i = 0; i < photoKeys.length; i++) {
    const file = form.get(photoKeys[i]) as File | null;
    if (file && file.size > 0) {
      const typeStr = String(form.get(`${photoKeys[i]}_type`) ?? "WIDE_SHOT");
      const photoType = photoTypeMap[typeStr] ?? "WIDE_SHOT";
      photoFiles.push({ file, photoType, sortOrder: i });
    }
  }

  // Upload all photos
  const uploadedPhotos: Array<{ url: string; mime: string; photoType: PhotoType; sortOrder: number }> = [];
  for (const pf of photoFiles) {
    try {
      const url = await saveUpload(pf.file);
      uploadedPhotos.push({
        url,
        mime: pf.file.type || "image/jpeg",
        photoType: pf.photoType,
        sortOrder: pf.sortOrder,
      });
    } catch (e) {
      if (e instanceof UploadValidationError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      console.error("Upload failed:", e);
      return NextResponse.json({ error: "File upload failed" }, { status: 500 });
    }
  }

  // AI analysis
  let aiOverallRating: "GOOD" | "REGULAR" | "BAD" | "NEEDS_REVIEW" | "NO_IMAGE" = "NO_IMAGE";
  let aiScore: number | null = null;
  let aiConfidence: number | null = null;
  let aiSummary: string | undefined;
  let aiWhyBullets: Prisma.InputJsonValue | undefined;
  let aiEvidence: Prisma.InputJsonValue | undefined;
  let aiRecommendations: Prisma.InputJsonValue | undefined;
  let aiJson: Prisma.InputJsonValue | undefined;

  // Try client-supplied AI data first
  const aiRaw = form.get("aiJson");
  if (typeof aiRaw === "string" && aiRaw.trim()) {
    try {
      const parsed = aiEvaluationOutputSchema.parse(JSON.parse(aiRaw));
      aiOverallRating = parsed.rating;
      aiScore = parsed.score;
      aiConfidence = parsed.confidence;
      aiSummary = parsed.summary;
      aiWhyBullets = parsed.whyBullets as Prisma.InputJsonValue;
      aiEvidence = parsed.evidence as unknown as Prisma.InputJsonValue;
      aiRecommendations = parsed.recommendations as unknown as Prisma.InputJsonValue;
      aiJson = parsed as unknown as Prisma.InputJsonValue;
    } catch (e) {
      console.warn("Failed to parse client-supplied aiJson:", e);
    }
  }

  // Server-side AI if no client AI and photos exist
  if (!aiJson && uploadedPhotos.length > 0) {
    try {
      const analysis = await analyzeStorePhotos(uploadedPhotos.map((p) => p.url));
      aiOverallRating = analysis.rating;
      aiScore = analysis.score;
      aiConfidence = analysis.confidence;
      aiSummary = analysis.summary;
      aiWhyBullets = analysis.whyBullets as Prisma.InputJsonValue;
      aiEvidence = analysis.evidence as unknown as Prisma.InputJsonValue;
      aiRecommendations = analysis.recommendations as unknown as Prisma.InputJsonValue;
      aiJson = analysis as unknown as Prisma.InputJsonValue;
    } catch {
      aiOverallRating = "NEEDS_REVIEW";
      aiScore = 0;
      aiConfidence = 0;
      aiSummary = "Photo captured. AI analysis unavailable at save time.";
      aiWhyBullets = ["AI analysis was not available during upload"] as Prisma.InputJsonValue;
      aiEvidence = [{ type: "general", detail: "Fallback response used", severity: "high" }] as unknown as Prisma.InputJsonValue;
      aiRecommendations = [{ action: "Review photo later", why: "No real-time AI response", expectedImpact: "Ensure quality feedback" }] as unknown as Prisma.InputJsonValue;
      aiJson = {
        rating: "NEEDS_REVIEW", score: 0, confidence: 0,
        subScores: { visibility: 0, shelfShare: 0, placementQuality: 0, availability: 0 },
        summary: aiSummary,
        whyBullets: aiWhyBullets,
        evidence: aiEvidence,
        recommendations: aiRecommendations,
      } as unknown as Prisma.InputJsonValue;
    }
  }

  // Validate full payload
  let parsedPayload;
  try {
    parsedPayload = payloadSchema.parse({
      storeId,
      clientEvaluationId,
      notes,
      gpsAtCaptureLat,
      gpsAtCaptureLng,
      ai: aiJson && typeof aiJson === "object" ? aiJson : undefined,
      slots,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const evaluation = await prisma.storeEvaluation.create({
      data: {
        storeId: parsedPayload.storeId,
        clientEvaluationId: parsedPayload.clientEvaluationId,
        evaluatorUserId: userId,
        capturedAt: new Date(),
        notes: parsedPayload.notes,
        gpsAtCaptureLat: parsedPayload.gpsAtCaptureLat,
        gpsAtCaptureLng: parsedPayload.gpsAtCaptureLng,
        aiOverallRating,
        aiScore,
        aiConfidence,
        aiSummary,
        aiWhyBullets: aiWhyBullets ?? undefined,
        aiEvidence: aiEvidence ?? undefined,
        aiRecommendations: aiRecommendations ?? undefined,
        aiJson: aiJson ?? undefined,
        syncStatus: "SYNCED",
        photos: uploadedPhotos.length > 0
          ? {
              create: uploadedPhotos.map((p) => ({
                url: p.url,
                mime: p.mime,
                photoType: p.photoType,
                sortOrder: p.sortOrder,
              })),
            }
          : undefined,
        segmentInputs: {
          create: parsedPayload.slots.map((item) => ({
            segment: item.segment,
            slot: item.slot,
            priceIndex: item.priceIndex,
            competitorPrice: item.competitorPrice ?? null,
            ourPrice: item.ourPrice ?? null,
            isManualOverride: item.isManualOverride ?? false,
          })),
        },
      },
    });

    // Audit log
    await logAudit({
      event: "evaluation.created",
      userId,
      evaluationId: evaluation.id,
      storeId: parsedPayload.storeId,
      metadata: {
        role,
        photoCount: uploadedPhotos.length,
        aiRating: aiOverallRating,
        aiScore,
        slotCount: parsedPayload.slots.length,
        offline: !!clientEvaluationId,
      },
    });

    return NextResponse.json({ ok: true, id: evaluation.id });
  } catch (e) {
    console.error("Failed to create evaluation:", e);
    return NextResponse.json({ error: "Failed to save evaluation" }, { status: 500 });
  }
}
