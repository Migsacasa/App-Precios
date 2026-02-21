import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    const evaluations = await prisma.storeEvaluation.findMany({
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
      orderBy: { capturedAt: "desc" },
      take: 200,
    });

    const summary = evaluations.map((evaluation) => {
      const json = evaluation.aiJson as
        | { findings?: string[]; recommendations?: Array<{ action?: string; expectedImpact?: string }> }
        | null
        | undefined;
      return {
        rating: evaluation.aiOverallRating,
        summary: evaluation.aiSummary,
        findings: json?.findings ?? [],
        recommendations: json?.recommendations ?? [],
      };
    });

    const findings = summary.flatMap((item) => item.findings).slice(0, 8);
    const recommendations = summary
      .flatMap((item) => item.recommendations)
      .map((item) => `${item.action ?? "Action"} — ${item.expectedImpact ?? "Impact"}`)
      .slice(0, 8);

    return NextResponse.json({
      insight: {
        ratings: {
          GOOD: summary.filter((item) => item.rating === "GOOD").length,
          REGULAR: summary.filter((item) => item.rating === "REGULAR").length,
          BAD: summary.filter((item) => item.rating === "BAD").length,
          NO_IMAGE: summary.filter((item) => item.rating === "NO_IMAGE").length,
        },
        findings,
        recommendations,
      },
    });
  } catch (error) {
    if (error instanceof SecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
