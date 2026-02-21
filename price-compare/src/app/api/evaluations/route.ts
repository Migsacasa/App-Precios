import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storage, type UploadedObject } from "@/lib/upload";
import { evaluateStoreWithVisionLLM } from "@/lib/ai/evaluateStore";
import type { Rating, EvaluationPhoto } from "@prisma/client";
import crypto from "node:crypto";

export const runtime = "nodejs";

function sha256(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function computeFinalRating(args: {
  aiRating?: Rating | null;
  overrideRating?: Rating | null;
}): Rating | null {
  return (args.overrideRating ?? args.aiRating) ?? null;
}

/**
 * EXPECTED FORM FIELDS:
 * - storeId: string
 * - capturedAt: ISO string
 * - observedLat / observedLng: optional
 * - indicesJson: JSON string for EvaluationSegmentIndex[]
 * - photoTypesJson: JSON string array aligned to files (WIDE_SHOT/SHELF_CLOSEUP/OTHER)
 * - files: 1–3 images
 */
export async function POST(req: Request) {
  // 0) AuthZ (outline)
  // const session = await auth();
  // if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // if (session.user.role !== "FIELD" && session.user.role !== "MANAGER") ...

  const userId = "REPLACE_WITH_SESSION_USER_ID";

  const form = await req.formData();

  const storeId = String(form.get("storeId") ?? "");
  const capturedAtStr = String(form.get("capturedAt") ?? "");
  const photoTypesJson = String(form.get("photoTypesJson") ?? "[]");
  const indicesJson = String(form.get("indicesJson") ?? "[]");

  if (!storeId || !capturedAtStr) {
    return NextResponse.json({ error: "storeId and capturedAt are required" }, { status: 400 });
  }

  const capturedAt = new Date(capturedAtStr);
  if (Number.isNaN(capturedAt.getTime())) {
    return NextResponse.json({ error: "capturedAt invalid" }, { status: 400 });
  }

  const observedLat = form.get("observedLat") ? Number(form.get("observedLat")) : null;
  const observedLng = form.get("observedLng") ? Number(form.get("observedLng")) : null;

  let photoTypes: Array<"WIDE_SHOT" | "SHELF_CLOSEUP" | "OTHER"> = [];
  try {
    photoTypes = JSON.parse(photoTypesJson);
  } catch {
    return NextResponse.json({ error: "photoTypesJson invalid JSON" }, { status: 400 });
  }

  let indices: any[] = [];
  try {
    indices = JSON.parse(indicesJson);
  } catch {
    return NextResponse.json({ error: "indicesJson invalid JSON" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f) => f instanceof File) as File[];
  if (files.length < 1 || files.length > 3) {
    return NextResponse.json({ error: "Upload 1 to 3 photos" }, { status: 400 });
  }
  if (photoTypes.length !== files.length) {
    return NextResponse.json({ error: "photoTypesJson must align with files length" }, { status: 400 });
  }

  // 1) Create evaluation first (so we have evaluationId)
  const evaluation = await prisma.evaluation.create({
    data: {
      storeId,
      createdById: userId,
      capturedAt,
      observedLat: Number.isFinite(observedLat ?? NaN) ? observedLat : null,
      observedLng: Number.isFinite(observedLng ?? NaN) ? observedLng : null,
      submittedAt: new Date(),
      hasPhotos: false,
      needsReview: false,
    },
    include: { store: true },
  });

  // 2) Store photos (upload + photo rows)
  const uploaded: Array<{ photoRow: EvaluationPhoto; storage: UploadedObject }> = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = sha256(bytes);

    const obj = await storage.putEvaluationPhoto({
      evaluationId: evaluation.id,
      fileName: file.name,
      contentType: file.type || "image/jpeg",
      bytes,
    });

    const photo = await prisma.evaluationPhoto.create({
      data: {
        evaluationId: evaluation.id,
        photoType: photoTypes[i],
        url: obj.url,
        thumbnailUrl: obj.thumbnailUrl ?? null,
        redactedUrl: obj.redactedUrl ?? null,
        byteSize: obj.byteSize ?? bytes.byteLength,
        width: obj.width ?? null,
        height: obj.height ?? null,
        sha256: obj.sha256 ?? digest,
      },
    });

    uploaded.push({ photoRow: photo, storage: obj });
  }

  // 3) Write indices (segment price index slots)
  if (Array.isArray(indices) && indices.length) {
    await prisma.evaluationSegmentIndex.createMany({
      data: indices.map((x) => ({
        evaluationId: evaluation.id,
        segment: x.segment,
        slot: x.slot,
        currency: x.currency ?? "NIO",
        competitorPrice: x.competitorPrice ?? null,
        ourPrice: x.ourPrice ?? null,
        priceIndex: x.priceIndex ?? null,
        source: x.source ?? "MANUAL",
        notes: x.notes ?? null,
      })),
      skipDuplicates: true,
    });
  }

  // 4) Call vision LLM with photo URLs (or redacted URLs if you enforce PII policy)
  try {
    const ai = await evaluateStoreWithVisionLLM({
      language: "es",
      store: {
        customerCode: evaluation.store.customerCode,
        name: evaluation.store.name,
        city: evaluation.store.city ?? undefined,
        zone: evaluation.store.zone ?? undefined,
      },
      photoInputs: uploaded.map((u, idx) => ({
        url: u.photoRow.redactedUrl ?? u.photoRow.url,
        type: photoTypes[idx],
      })),
      ourBrands: [],
      competitorBrands: [],
    });

    // 5) Transaction: AI tables + denormalized evaluation updates
    await prisma.$transaction(async (tx) => {
      await tx.aiEvaluation.create({
        data: {
          evaluationId: evaluation.id,
          schemaVersion: ai.output.schemaVersion,
          modelName: ai.modelName,
          promptVersion: "prompt.v1",
          outputJson: ai.output as any,
          latencyMs: ai.latencyMs ?? null,
          tokenCount: ai.tokenCount ?? null,
        },
      });

      if (ai.output.evidence?.length) {
        await tx.aiFinding.createMany({
          data: ai.output.evidence.map((e) => ({
            evaluationId: evaluation.id,
            type: e.type,
            severity: e.severity,
            detail: e.detail,
            segment: e.segment ?? null,
            tags: (e.tags ?? []) as any,
          })),
        });
      }

      if (ai.output.recommendations?.length) {
        await tx.aiRecommendation.createMany({
          data: ai.output.recommendations.map((r) => ({
            evaluationId: evaluation.id,
            priority: r.priority,
            action: r.action,
            rationale: r.rationale ?? null,
            ownerRole: r.ownerRole ?? null,
            segment: r.segment ?? null,
          })),
        });
      }

      const aiRating = ai.output.rating === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : ai.output.rating;
      const needsReview = ai.output.rating === "NEEDS_REVIEW" || ai.output.confidence < 0.35;

      const updated = await tx.evaluation.update({
        where: { id: evaluation.id },
        data: {
          hasPhotos: true,
          latestPhotoThumbUrl: uploaded[0]?.photoRow.thumbnailUrl ?? uploaded[0]?.photoRow.url ?? null,
          aiRating: aiRating as any,
          aiScore: ai.output.score,
          aiConfidence: ai.output.confidence,
          needsReview,
          finalRating: computeFinalRating({ aiRating: aiRating as any, overrideRating: null }) as any,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "AI_EVALUATED",
          entityType: "Evaluation",
          entityId: updated.id,
          meta: {
            aiRating: updated.aiRating,
            aiScore: updated.aiScore,
            aiConfidence: updated.aiConfidence,
            needsReview: updated.needsReview,
            modelName: ai.modelName,
            promptVersion: "prompt.v1",
          },
        },
      });
    });

    return NextResponse.json({ evaluationId: evaluation.id, status: "ok" });
  } catch (err: any) {
    // Persist failure for auditability + mark needs review
    await prisma.$transaction(async (tx) => {
      await tx.aiEvaluation.create({
        data: {
          evaluationId: evaluation.id,
          schemaVersion: "ai.store_eval.v1",
          modelName: "vision-model",
          promptVersion: "prompt.v1",
          outputJson: {},
          errorCode: "AI_FAILED",
          errorMessage: String(err?.message ?? err),
        },
      });

      await tx.evaluation.update({
        where: { id: evaluation.id },
        data: {
          hasPhotos: true,
          needsReview: true,
          aiRating: "NEEDS_REVIEW",
          finalRating: computeFinalRating({ aiRating: "NEEDS_REVIEW", overrideRating: null }) as any,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "AI_EVALUATION_FAILED",
          entityType: "Evaluation",
          entityId: evaluation.id,
          meta: { error: String(err?.message ?? err) },
        },
      });
    });

    return NextResponse.json(
      { evaluationId: evaluation.id, status: "needs_review", error: "AI evaluation failed" },
      { status: 202 },
    );
  }
}
