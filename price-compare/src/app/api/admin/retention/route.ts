import { NextResponse } from "next/server";
import { requireAdmin, SecurityError } from "@/lib/security";
import { jsonError, withRequestIdHeader } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getRetentionMonths } from "@/lib/settings";

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();

    const retentionMonths = await getRetentionMonths();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);

    // Delete old evaluations (cascade deletes photos, segmentIndices, aiEvaluation, aiFindings, aiRecommendations)
    const oldEvaluations = await prisma.evaluation.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
    });

    const evalIds = oldEvaluations.map((e) => e.id);
    let deletedEvaluations = 0;

    if (evalIds.length > 0) {
      const result = await prisma.evaluation.deleteMany({
        where: { id: { in: evalIds } },
      });
      deletedEvaluations = result.count;
    }

    // Delete old audit logs (older than double retention)
    const auditCutoff = new Date();
    auditCutoff.setMonth(auditCutoff.getMonth() - retentionMonths * 2);
    const deletedAudit = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditCutoff } },
    });

    await logAudit({
      action: "EVALUATION_DELETED",
      actorId: session.user!.id,
      entityType: "Evaluation",
      entityId: "retention-batch",
      meta: {
        retentionMonths,
        cutoff: cutoff.toISOString(),
        deletedEvaluations,
        deletedAuditLogs: deletedAudit.count,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        retentionMonths,
        cutoff: cutoff.toISOString(),
        deletedEvaluations,
        deletedAuditLogs: deletedAudit.count,
      },
      { headers: withRequestIdHeader(req) },
    );
  } catch (e) {
    if (e instanceof SecurityError) {
      return jsonError(req, { code: "SECURITY_ERROR", message: e.message }, e.status);
    }
    console.error("Retention cleanup error:", e);
    return jsonError(req, { code: "INTERNAL_ERROR", message: "Internal Server Error" }, 500);
  }
}
