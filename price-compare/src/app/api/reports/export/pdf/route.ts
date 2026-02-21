import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { rateLimitRequest } from "@/lib/rate-limit";
import { requireManager, SecurityError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const limiter = rateLimitRequest(req, { key: "api:reports:export:pdf", limit: 5, windowMs: 60_000 });
    if (!limiter.ok) {
      return jsonError(req, { code: "RATE_LIMITED", message: "Too many requests" }, 429, {
        headers: limiter.headers,
      });
    }

    await requireManager();

    const url = new URL(req.url);
    const from = url.searchParams.get("from")
      ? new Date(url.searchParams.get("from") as string)
      : undefined;
    const to = url.searchParams.get("to")
      ? new Date(url.searchParams.get("to") as string)
      : undefined;

    const rows = await prisma.evaluation.findMany({
      where: {
        ...(from || to
          ? {
              capturedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
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
      take: 120,
    });

    const pdf = new PDFDocument({ margin: 36, size: "A4" });
    const chunks: Buffer[] = [];

    const done = new Promise<Buffer>((resolve, reject) => {
      pdf.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.on("error", reject);
    });

    pdf.fontSize(16).text("Retail Store Evaluation Report", { underline: true });
    pdf.moveDown(0.5);
    pdf
      .fontSize(10)
      .text(
        `Generated: ${new Date().toISOString().slice(0, 19)} | Range: ${from?.toISOString().slice(0, 10) ?? "all"} → ${to?.toISOString().slice(0, 10) ?? "now"} | Evaluations: ${rows.length}`
      );
    pdf.moveDown(1);

    for (const row of rows) {
      const effectiveRating = row.finalRating ?? row.aiRating;
      const aiOutput = row.aiEvaluation?.outputJson as Record<string, unknown> | null;
      const summary = (aiOutput?.summary as string) ?? "-";

      // Header line
      pdf.fontSize(10).font("Helvetica-Bold")
        .text(`${row.capturedAt.toISOString().slice(0, 10)} | ${row.store.customerCode} | ${row.store.name} | ${effectiveRating ?? "PENDING"}${row.aiScore != null ? ` (Score: ${row.aiScore}/100)` : ""}`);
      pdf.font("Helvetica");

      // Override notice
      if (row.finalRating && row.finalRating !== row.aiRating) {
        pdf.fontSize(8).text(`  Override: AI=${row.aiRating} → Manager=${row.finalRating} | Reason: ${row.overrideReason ?? "-"}`);
      }

      // Summary
      pdf.fontSize(9).text(`  Summary: ${summary}`);

      // Findings
      if (row.aiFindings.length > 0) {
        pdf.fontSize(8).text(`  Findings:`);
        for (const f of row.aiFindings.slice(0, 8)) {
          pdf.text(`    [${f.type}] ${f.detail} (${f.severity})`);
        }
      }

      // Recommendations
      if (row.aiRecommendations.length > 0) {
        pdf.fontSize(8).text(`  Recommendations:`);
        for (const r of row.aiRecommendations) {
          pdf.text(`    [${r.priority}] ${r.action}${r.rationale ? ` — ${r.rationale}` : ""}`);
        }
      }

      // Segment slots
      pdf.fontSize(8)
        .text(
          `  Slots: ${row.segmentIndices.map((slot) => `${slot.segment}#${slot.slot}:${Number(slot.priceIndex ?? 0).toFixed(1)}`).join(" | ")}`,
        );

      // Evaluator
      if (row.createdBy?.name) {
        pdf.fontSize(8).text(`  Evaluator: ${row.createdBy.name}`);
      }

      pdf.moveDown(0.5);

      // Page break if running low on space
      if (pdf.y > 700) {
        pdf.addPage();
      }
    }

    pdf.end();

    const buffer = await done;

    return new Response(new Uint8Array(buffer), {
      headers: withRequestIdHeader(req, {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=market_report.pdf",
        ...limiter.headers,
      }),
    });
  } catch (error) {
    if (error instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: error.message }, error.status);
    }

    const message = error instanceof Error ? error.message : "Internal Server Error";
    return jsonError(req, { code: "INTERNAL_ERROR", message }, 500);
  }
}
