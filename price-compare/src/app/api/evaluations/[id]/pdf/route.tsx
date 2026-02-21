import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { StoreEvaluationPdf, type PdfData } from "@/components/pdf/store-evaluation-pdf";
import { renderToStream } from "@react-pdf/renderer";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ev = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      store: true,
      photos: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      segmentIndices: { orderBy: [{ segment: "asc" }, { slot: "asc" }] },
      aiEvaluation: true,
      aiFindings: true,
      aiRecommendations: { orderBy: { priority: "asc" } },
      createdBy: true,
    },
  });

  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json: any = ev.aiEvaluation?.outputJson ?? {};
  const data: PdfData = {
    store: {
      customerCode: ev.store.customerCode,
      name: ev.store.name,
      city: ev.store.city,
      zone: ev.store.zone,
      lat: Number(ev.store.lat),
      lng: Number(ev.store.lng),
    },
    evaluation: {
      capturedAt: ev.capturedAt.toISOString(),
      createdByEmail: ev.createdBy.email,
      aiRating: ev.aiRating,
      aiScore: ev.aiScore,
      aiConfidence: ev.aiConfidence,
      finalRating: ev.finalRating,
      overrideReason: ev.overrideReason,
    },
    photos: ev.photos.map((p) => ({ url: p.thumbnailUrl ?? p.url, photoType: p.photoType })),
    indices: ev.segmentIndices.map((x) => ({
      segment: x.segment,
      slot: x.slot,
      competitorPrice: x.competitorPrice?.toString() ?? null,
      ourPrice: x.ourPrice?.toString() ?? null,
      priceIndex: x.priceIndex?.toString() ?? null,
    })),
    ai: {
      summary: json.summary ?? null,
      whyBullets: json.whyBullets ?? null,
      evidence: (json.evidence ?? []).map((e: any) => ({
        type: e.type,
        severity: e.severity,
        detail: e.detail,
        segment: e.segment ?? null,
      })),
      recommendations: (json.recommendations ?? []).map((r: any) => ({
        priority: r.priority,
        action: r.action,
        rationale: r.rationale ?? null,
      })),
    },
  };

  const stream = await renderToStream(<StoreEvaluationPdf data={data} />);

  return new NextResponse(stream as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="evaluation-${id}.pdf"`,
    },
  });
}
