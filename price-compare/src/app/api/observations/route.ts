export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { saveUpload, UploadValidationError } from "@/lib/upload";
import { analyzeStorePhotos } from "@/lib/store-evaluation-ai";
import { logAudit } from "@/lib/audit";
import { AiStoreEvaluationSchema, AI_SCHEMA_VERSION } from "@/lib/schemas/evaluation";
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
  observedLat: z.number().optional(),
  observedLng: z.number().optional(),
  ai: AiStoreEvaluationSchema.optional(),
  slots: z.array(slotSchema),
});

const requiredSlots: Record<"LUBRICANTS" | "BATTERIES" | "TIRES", number[]> = {
  LUBRICANTS: [1, 2, 3, 4],
  BATTERIES: [1, 2],
  TIRES: [1],
};

function parseNumber(value: FormDataEntryValue | null) {
  if (value == null || value === "") return undefined;
  const normalized = String(value).trim().replace(",", ".");
  const n = Number(normalized);
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

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return jsonError(req, { code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
  }

  const [stores, products] = await Promise.all([
    prisma.store.findMany({
      where: { active: true },
      orderBy: [{ city: "asc" }, { name: "asc" }],
      select: {
        id: true,
        customerCode: true,
        name: true,
        city: true,
        zone: true,
        lat: true,
        lng: true,
      },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ segment: "asc" }, { name: "asc" }],
    }),
  ]);

  return NextResponse.json({ stores, products }, { headers: withRequestIdHeader(req) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return jsonError(req, { code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
  }

  const role = (session.user as { role?: string }).role ?? "FIELD";

  const form = await req.formData();
  const storeId = String(form.get("storeId") ?? "").trim();
  const clientEvaluationId = String(form.get("clientEvaluationId") ?? "").trim() || undefined;
  const notes = String(form.get("notes") ?? "").trim() || undefined;
  const observedLat = parseNumber(form.get("gpsAtCaptureLat"));
  const observedLng = parseNumber(form.get("gpsAtCaptureLng"));
  const slots = buildSlotsFromForm(form);

  if (!storeId) {
    return jsonError(req, { code: "STORE_REQUIRED", message: "Store is required" }, 400);
  }

  // Dedup: if clientEvaluationId exists, check for duplicate
  if (clientEvaluationId) {
    const existing = await prisma.evaluation.findUnique({
      where: { clientEvaluationId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { ok: true, id: existing.id, duplicate: true },
        { headers: withRequestIdHeader(req) },
      );
    }
  }

  if (slots.length === 0) {
    console.warn("Evaluation submitted without segment slots", {
      requestId: req.headers.get("x-request-id") ?? null,
      storeId,
      userId,
    });
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
        return jsonError(req, { code: "UPLOAD_VALIDATION_ERROR", message: e.message }, 400);
      }
      console.error("Upload failed:", e);
      return jsonError(req, { code: "UPLOAD_FAILED", message: "File upload failed" }, 500);
    }
  }

  // AI analysis
  let aiRating: "GOOD" | "REGULAR" | "BAD" | "NEEDS_REVIEW" | undefined;
  let aiScore: number | null = null;
  let aiConfidence: number | null = null;
  let aiOutputJson: Prisma.InputJsonValue | undefined;
  let aiFindings: Array<{ type: string; severity: string; detail: string; segment?: string; tags?: string[] }> = [];
  let aiRecommendations: Array<{ priority: string; action: string; rationale?: string; ownerRole?: string; segment?: string }> = [];

  // Try client-supplied AI data first
  const aiRaw = form.get("aiJson");
  if (typeof aiRaw === "string" && aiRaw.trim()) {
    try {
      const parsed = AiStoreEvaluationSchema.parse(JSON.parse(aiRaw));
      aiRating = parsed.rating;
      aiScore = parsed.score;
      aiConfidence = parsed.confidence;
      aiOutputJson = parsed as unknown as Prisma.InputJsonValue;
      aiFindings = (parsed.evidence ?? []).map((e) => ({
        type: e.type, severity: e.severity, detail: e.detail, segment: e.segment, tags: e.tags,
      }));
      aiRecommendations = (parsed.recommendations ?? []).map((r) => ({
        priority: r.priority, action: r.action, rationale: r.rationale, ownerRole: r.ownerRole, segment: r.segment,
      }));
    } catch (e) {
      console.warn("Failed to parse client-supplied aiJson:", e);
    }
  }

  // Server-side AI if no client AI and photos exist
  if (!aiOutputJson && uploadedPhotos.length > 0) {
    try {
      const [storeData, referenceProducts] = await Promise.all([
        prisma.store.findUnique({
          where: { id: storeId },
          select: { id: true, customerCode: true, name: true, city: true, zone: true },
        }),
        prisma.product.findMany({
          where: {
            active: true,
            referencePhotos: { some: {} },
          },
          orderBy: { updatedAt: "desc" },
          take: 30,
          select: {
            name: true,
            brand: true,
            referencePhotos: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { url: true, note: true },
            },
          },
        }),
      ]);

      const refs = referenceProducts.flatMap((product) => {
        const photo = product.referencePhotos[0];
        if (!photo?.url) return [];
        return [{
          name: product.name,
          brand: product.brand ?? undefined,
          imageUrl: photo.url,
          note: photo.note ?? undefined,
        }];
      });

      const analysis = await analyzeStorePhotos(
        uploadedPhotos.map((p) => p.url),
        {
          store: storeData ? {
            storeId: storeData.id,
            customerCode: storeData.customerCode,
            name: storeData.name,
            city: storeData.city ?? undefined,
            zone: storeData.zone ?? undefined,
          } : undefined,
          ourBrands: Array.from(new Set(refs.map((item) => item.brand).filter((x): x is string => !!x))),
          referenceProducts: refs,
          photoTypes: uploadedPhotos.map((p) => p.photoType as "WIDE_SHOT" | "SHELF_CLOSEUP" | "OTHER"),
        },
      );
      aiRating = analysis.rating;
      aiScore = analysis.score;
      aiConfidence = analysis.confidence;
      aiOutputJson = analysis as unknown as Prisma.InputJsonValue;
      aiFindings = (analysis.evidence ?? []).map((e) => ({
        type: e.type, severity: e.severity, detail: e.detail, segment: e.segment, tags: e.tags,
      }));
      aiRecommendations = (analysis.recommendations ?? []).map((r) => ({
        priority: r.priority, action: r.action, rationale: r.rationale, ownerRole: r.ownerRole, segment: r.segment,
      }));
    } catch {
      aiRating = "NEEDS_REVIEW";
      aiScore = 0;
      aiConfidence = 0;
      aiOutputJson = {
        schemaVersion: AI_SCHEMA_VERSION,
        rating: "NEEDS_REVIEW", score: 0, confidence: 0,
        subScores: { visibility: 0, shelfShare: 0, placement: 0, availability: 0 },
        summary: "Photo captured. AI analysis unavailable at save time.",
        whyBullets: [
          "AI analysis was not available during upload",
          "Captured data was saved without automated scoring context",
          "A manager review is recommended before acting on this evaluation",
        ],
        evidence: [{ type: "OTHER", detail: "Fallback response used", severity: "HIGH" }],
        recommendations: [{ priority: "P0", action: "Review photo later — no real-time AI response", rationale: "Ensure quality feedback" }],
      } as unknown as Prisma.InputJsonValue;
      aiFindings = [{ type: "OTHER", severity: "HIGH", detail: "Fallback response used" }];
      aiRecommendations = [{ priority: "P0", action: "Review photo later — no real-time AI response", rationale: "Ensure quality feedback" }];
    }
  }

  // Compute finalRating
  const finalRating = aiRating ?? null;
  const needsReview = aiRating === "NEEDS_REVIEW" || (aiConfidence != null && aiConfidence < 0.35);

  // Validate full payload
  let parsedPayload;
  try {
    parsedPayload = payloadSchema.parse({
      storeId,
      clientEvaluationId,
      notes,
      observedLat,
      observedLng,
      ai: aiOutputJson && typeof aiOutputJson === "object" ? aiOutputJson : undefined,
      slots,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Validation failed";
    return jsonError(req, { code: "VALIDATION_FAILED", message }, 400);
  }

  try {
    const evaluation = await prisma.evaluation.create({
      data: {
        storeId: parsedPayload.storeId,
        clientEvaluationId: parsedPayload.clientEvaluationId,
        createdById: userId,
        capturedAt: new Date(),
        observedLat: parsedPayload.observedLat,
        observedLng: parsedPayload.observedLng,
        aiRating: aiRating ?? null,
        aiScore,
        aiConfidence,
        finalRating,
        needsReview,
        hasPhotos: uploadedPhotos.length > 0,
        latestPhotoThumbUrl: uploadedPhotos[0]?.url ?? null,
        photos: uploadedPhotos.length > 0
          ? {
              create: uploadedPhotos.map((p) => ({
                url: p.url,
                photoType: p.photoType,
              })),
            }
          : undefined,
        segmentIndices: {
          create: parsedPayload.slots.map((item) => ({
            segment: item.segment,
            slot: item.slot,
            priceIndex: item.priceIndex,
            competitorPrice: item.competitorPrice ?? null,
            ourPrice: item.ourPrice ?? null,
            source: item.isManualOverride ? "MANUAL" : "AUTO_CALC",
          })),
        },
        // Create normalized AI records
        ...(aiOutputJson ? {
          aiEvaluation: {
            create: {
              schemaVersion: AI_SCHEMA_VERSION,
              modelName: process.env.OPENAI_MODEL_VISION ?? "gpt-4.1-mini",
              promptVersion: "v1",
              outputJson: aiOutputJson,
            },
          },
          aiFindings: aiFindings.length > 0 ? {
            create: aiFindings.map((f) => ({
              type: f.type as "VISIBILITY" | "SHELF_SHARE" | "PLACEMENT" | "AVAILABILITY" | "BRANDING" | "PRICING" | "OTHER",
              severity: f.severity as "LOW" | "MEDIUM" | "HIGH",
              detail: f.detail,
              segment: f.segment as "LUBRICANTS" | "BATTERIES" | "TIRES" | undefined ?? undefined,
              tags: f.tags ?? [],
            })),
          } : undefined,
          aiRecommendations: aiRecommendations.length > 0 ? {
            create: aiRecommendations.map((r) => ({
              priority: r.priority as "P0" | "P1" | "P2",
              action: r.action,
              rationale: r.rationale,
              ownerRole: r.ownerRole as "FIELD" | "MANAGER" | "ADMIN" | undefined ?? undefined,
              segment: r.segment as "LUBRICANTS" | "BATTERIES" | "TIRES" | undefined ?? undefined,
            })),
          } : undefined,
        } : {}),
      },
    });

    // Audit log
    await logAudit({
      action: "EVALUATION_CREATED",
      actorId: userId,
      entityType: "Evaluation",
      entityId: evaluation.id,
      meta: {
        role,
        storeId: parsedPayload.storeId,
        photoCount: uploadedPhotos.length,
        aiRating,
        aiScore,
        slotCount: parsedPayload.slots.length,
        offline: !!clientEvaluationId,
      },
    });

    return NextResponse.json({ ok: true, id: evaluation.id }, { headers: withRequestIdHeader(req) });
  } catch (e) {
    console.error("Failed to create evaluation:", e);
    return jsonError(req, { code: "SAVE_FAILED", message: "Failed to save evaluation" }, 500);
  }
}
