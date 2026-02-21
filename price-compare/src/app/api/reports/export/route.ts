import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { rateLimitRequest } from "@/lib/rate-limit";
import { requireManager, SecurityError } from "@/lib/security";

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const limiter = rateLimitRequest(req, { key: "api:reports:export", limit: 10, windowMs: 60_000 });
    if (!limiter.ok) {
      return jsonError(req, { code: "RATE_LIMITED", message: "Too many requests" }, 429, {
        headers: limiter.headers,
      });
    }

    await requireManager();

    const url = new URL(req.url);
    const city = url.searchParams.get("city") || undefined;
    const from = url.searchParams.get("from")
      ? new Date(url.searchParams.get("from") as string)
      : undefined;
    const to = url.searchParams.get("to")
      ? new Date(url.searchParams.get("to") as string)
      : undefined;
    const type = url.searchParams.get("type") ?? "history";

    const evaluations = await prisma.evaluation.findMany({
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
        segmentIndices: { orderBy: [{ segment: "asc" }, { slot: "asc" }] },
        createdBy: { select: { name: true } },
        aiFindings: true,
        aiRecommendations: true,
        aiEvaluation: true,
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
      "store_name",
      "city",
      "zone",
      "ai_rating",
      "final_rating",
      "effective_rating",
      "ai_score",
      "ai_confidence",
      "evaluator",
      "segment_slots",
      "findings",
      "recommendations",
    ];

    const lines = [
      header.join(","),
      ...rows.map((evaluation) => {
        return [
          csvEscape(evaluation.capturedAt.toISOString()),
          csvEscape(evaluation.store.customerCode),
          csvEscape(evaluation.store.name),
          csvEscape(evaluation.store.city ?? ""),
          csvEscape(evaluation.store.zone ?? ""),
          csvEscape(evaluation.aiRating ?? ""),
          csvEscape(evaluation.finalRating ?? ""),
          csvEscape(evaluation.finalRating ?? evaluation.aiRating ?? ""),
          csvEscape(evaluation.aiScore ?? ""),
          csvEscape(evaluation.aiConfidence != null ? (evaluation.aiConfidence * 100).toFixed(0) + "%" : ""),
          csvEscape(evaluation.createdBy?.name ?? ""),
          csvEscape(
            evaluation.segmentIndices
              .map((slot) => `${slot.segment}#${slot.slot}:${Number(slot.priceIndex ?? 0).toFixed(2)}`)
              .join(" | "),
          ),
          csvEscape(evaluation.aiFindings.map((f) => `[${f.type}] ${f.detail}`).join(" | ")),
          csvEscape(evaluation.aiRecommendations.map((r) => `[${r.priority}] ${r.action}`).join(" | ")),
        ].join(",");
      }),
    ];

    const filename = type === "snapshot" ? "store_snapshot.csv" : "evaluation_history.csv";

    return new Response(lines.join("\n"), {
      headers: withRequestIdHeader(req, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...limiter.headers,
      }),
    });
  } catch (error) {
    if (error instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: error.message }, error.status);
    }
    return jsonError(req, { code: "INTERNAL_ERROR", message: "Internal Server Error" }, 500);
  }
}
