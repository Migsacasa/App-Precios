import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { requireManager, SecurityError } from "@/lib/security";

export const runtime = "nodejs";

type InsightRequest = {
  storeId?: string;
  from?: string;
  to?: string;
  city?: string;
};

export async function POST(req: Request) {
  try {
    await requireManager();

    const body = (await req.json()) as InsightRequest;
    const { storeId, city, from, to } = body;

    const evaluations = await prisma.evaluation.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        ...(city ? { store: { city } } : {}),
        ...(from || to
          ? {
              capturedAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        aiEvaluation: true,
        aiFindings: true,
        aiRecommendations: true,
      },
      orderBy: { capturedAt: "desc" },
      take: 200,
    });

    const summary = evaluations.map((evaluation) => {
      return {
        rating: evaluation.aiRating ?? evaluation.finalRating,
        findings: evaluation.aiFindings.map((f) => f.detail),
        recommendations: evaluation.aiRecommendations.map((r) => ({
          action: r.action,
          rationale: r.rationale,
        })),
      };
    });

    const findings = summary.flatMap((item) => item.findings).slice(0, 8);
    const recommendations = summary
      .flatMap((item) => item.recommendations)
      .map((item) => `${item.action ?? "Action"}${item.rationale ? ` — ${item.rationale}` : ""}`)
      .slice(0, 8);

    return NextResponse.json(
      {
        insight: {
          ratings: {
            GOOD: summary.filter((item) => item.rating === "GOOD").length,
            REGULAR: summary.filter((item) => item.rating === "REGULAR").length,
            BAD: summary.filter((item) => item.rating === "BAD").length,
            NEEDS_REVIEW: summary.filter((item) => item.rating === "NEEDS_REVIEW").length,
          },
          findings,
          recommendations,
        },
      },
      { headers: withRequestIdHeader(req) },
    );
  } catch (error) {
    if (error instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return jsonError(req, { code: "INTERNAL_ERROR", message }, 500);
  }
}
