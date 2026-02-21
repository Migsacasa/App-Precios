import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, SecurityError } from "@/lib/security";

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  try {
    await requireManager();

    const url = new URL(req.url);
    const city = url.searchParams.get("city") || undefined;
    const from = url.searchParams.get("from")
      ? new Date(url.searchParams.get("from") as string)
      : undefined;
    const to = url.searchParams.get("to")
      ? new Date(url.searchParams.get("to") as string)
      : undefined;
    const type = url.searchParams.get("type") ?? "history"; // "history" (all rows) or "snapshot" (latest per store)

    const evaluations = await prisma.storeEvaluation.findMany({
      where: {
        ...(from || to
          ? {
              capturedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
        ...(city ? { store: { city } } : {}),
      },
      include: {
        store: true,
        segmentInputs: { orderBy: [{ segment: "asc" }, { slot: "asc" }] },
        evaluatorUser: { select: { name: true } },
      },
      orderBy: { capturedAt: "desc" },
      take: 10000,
    });

    // For snapshot mode, deduplicate by store (keep latest)
    let rows = evaluations;
    if (type === "snapshot") {
      const seen = new Set<string>();
      rows = evaluations.filter((e) => {
        if (seen.has(e.storeId)) return false;
        seen.add(e.storeId);
        return true;
      });
    }

    const header = [
      "captured_at",
      "customer_code",
      "customer_name",
      "city",
      "zone",
      "ai_rating",
      "override_rating",
      "effective_rating",
      "ai_score",
      "ai_confidence",
      "ai_summary",
      "evaluator",
      "segment_slots",
      "why_bullets",
      "recommendations",
    ];

    const lines = [
      header.join(","),
      ...rows.map((evaluation) => {
        const whyBullets = evaluation.aiWhyBullets as string[] | null;
        const recs = evaluation.aiRecommendations as Array<{ action: string }> | null;
        return [
          csvEscape(evaluation.capturedAt.toISOString()),
          csvEscape(evaluation.store.customerCode),
          csvEscape(evaluation.store.customerName),
          csvEscape(evaluation.store.city ?? ""),
          csvEscape(evaluation.store.zone ?? ""),
          csvEscape(evaluation.aiOverallRating),
          csvEscape(evaluation.overrideRating ?? ""),
          csvEscape(evaluation.overrideRating ?? evaluation.aiOverallRating),
          csvEscape(evaluation.aiScore ?? ""),
          csvEscape(evaluation.aiConfidence != null ? (evaluation.aiConfidence * 100).toFixed(0) + "%" : ""),
          csvEscape(evaluation.aiSummary ?? ""),
          csvEscape(evaluation.evaluatorUser?.name ?? ""),
          csvEscape(
            evaluation.segmentInputs
              .map((slot) => `${slot.segment}#${slot.slot}:${Number(slot.priceIndex).toFixed(2)}`)
              .join(" | "),
          ),
          csvEscape(whyBullets?.join(" | ") ?? ""),
          csvEscape(recs?.map((r) => r.action).join(" | ") ?? ""),
        ].join(",");
      }),
    ];

    const filename = type === "snapshot" ? "store_snapshot.csv" : "evaluation_history.csv";

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof SecurityError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
