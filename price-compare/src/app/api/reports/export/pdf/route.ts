import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";
import { requireManager, SecurityError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireManager();

    const url = new URL(req.url);
    const from = url.searchParams.get("from")
      ? new Date(url.searchParams.get("from") as string)
      : undefined;
    const to = url.searchParams.get("to")
      ? new Date(url.searchParams.get("to") as string)
      : undefined;

    const rows = await prisma.storeEvaluation.findMany({
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
        segmentInputs: { orderBy: [{ segment: "asc" }, { slot: "asc" }] },
        evaluatorUser: { select: { name: true } },
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
      const effectiveRating = row.overrideRating ?? row.aiOverallRating;
      const whyBullets = row.aiWhyBullets as string[] | null;
      const evidence = row.aiEvidence as Array<{ type: string; detail: string; severity: string }> | null;
      const recs = row.aiRecommendations as Array<{ action: string; why: string; expectedImpact: string; priority: string }> | null;

      // Header line
      pdf.fontSize(10).font("Helvetica-Bold")
        .text(`${row.capturedAt.toISOString().slice(0, 10)} | ${row.store.customerCode} | ${row.store.customerName} | ${effectiveRating}${row.aiScore != null ? ` (Score: ${row.aiScore}/100)` : ""}`);
      pdf.font("Helvetica");

      // Override notice
      if (row.overrideRating) {
        pdf.fontSize(8).text(`  Override: AI=${row.aiOverallRating} → Manager=${row.overrideRating} | Reason: ${row.overrideReason ?? "-"}`);
      }

      // Summary
      pdf.fontSize(9).text(`  Summary: ${row.aiSummary ?? "-"}`);

      // Why bullets
      if (whyBullets && whyBullets.length > 0) {
        pdf.fontSize(8).text(`  Key findings:`);
        for (const bullet of whyBullets) {
          pdf.text(`    • ${bullet}`);
        }
      }

      // Evidence
      if (evidence && evidence.length > 0) {
        pdf.fontSize(8).text(`  Evidence:`);
        for (const e of evidence.slice(0, 5)) {
          pdf.text(`    [${e.type}] ${e.detail} (${e.severity})`);
        }
      }

      // Recommendations
      if (recs && recs.length > 0) {
        pdf.fontSize(8).text(`  Recommendations:`);
        for (const r of recs) {
          pdf.text(`    [${r.priority}] ${r.action} — ${r.why}`);
        }
      }

      // Segment slots
      pdf.fontSize(8)
        .text(
          `  Slots: ${row.segmentInputs.map((slot) => `${slot.segment}#${slot.slot}:${Number(slot.priceIndex).toFixed(1)}`).join(" | ")}`,
        );

      // Evaluator
      if (row.evaluatorUser?.name) {
        pdf.fontSize(8).text(`  Evaluator: ${row.evaluatorUser.name}`);
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
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=market_report.pdf",
      },
    });
  } catch (error) {
    if (error instanceof SecurityError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
